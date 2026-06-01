// Main-thread client for the WAV encode worker. It copies the rendered channel
// data, transfers it to the worker, and resolves with the WAV blob + analysis.
// Everything degrades gracefully: if workers are unavailable or the worker
// fails, it encodes synchronously on the main thread so exports still succeed.

import {
  processPcmToWav,
  type AudioRenderAnalysis,
  type WavConversionOptions,
} from './wavCodec';
import type { WavEncodeRequest, WavEncodeResponse } from './wavEncoder.worker';

export interface EncodedWavResult {
  analysis: AudioRenderAnalysis;
  wavBlob: Blob;
}

interface PendingEntry {
  resolve: (result: EncodedWavResult) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let workerUnavailable = false;
let nextId = 1;
const pending = new Map<number, PendingEntry>();

const failAllPending = (message: string) => {
  const entries = [...pending.values()];
  pending.clear();
  entries.forEach((entry) => entry.reject(new Error(message)));
};

const getWorker = (): Worker | null => {
  if (workerUnavailable) {
    return null;
  }
  if (worker) {
    return worker;
  }
  if (typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }

  try {
    const instance = new Worker(new URL('./wavEncoder.worker.ts', import.meta.url), {
      type: 'module',
    });
    instance.onmessage = (event: MessageEvent<WavEncodeResponse>) => {
      const data = event.data;
      const entry = pending.get(data.id);
      if (!entry) {
        return;
      }
      pending.delete(data.id);
      if (data.ok) {
        entry.resolve({
          analysis: data.analysis,
          wavBlob: new Blob([data.wav], { type: 'audio/wav' }),
        });
      } else {
        entry.reject(new Error(data.error));
      }
    };
    instance.onerror = () => {
      // A worker-level crash invalidates the singleton; fail outstanding work so
      // each caller can fall back to a main-thread encode, and stop using it.
      worker = null;
      workerUnavailable = true;
      failAllPending('WAV encode worker crashed.');
    };
    worker = instance;
    return worker;
  } catch {
    workerUnavailable = true;
    worker = null;
    return null;
  }
};

const toPcm = (audioBuffer: AudioBuffer) => {
  const channels: Float32Array[] = [];
  for (let index = 0; index < audioBuffer.numberOfChannels; index += 1) {
    channels.push(audioBuffer.getChannelData(index));
  }
  return { channels, sampleRate: audioBuffer.sampleRate, length: audioBuffer.length };
};

const encodeOnMainThread = (
  audioBuffer: AudioBuffer,
  options: WavConversionOptions,
): EncodedWavResult => {
  const { analysis, wav } = processPcmToWav(toPcm(audioBuffer), options);
  return { analysis, wavBlob: new Blob([wav], { type: 'audio/wav' }) };
};

// Copies each channel into a fresh buffer so the originals stay intact for a
// fallback, and returns the copies' ArrayBuffers for a zero-copy transfer.
const copyChannelsForTransfer = (audioBuffer: AudioBuffer): ArrayBuffer[] => {
  const transfer: ArrayBuffer[] = [];
  for (let index = 0; index < audioBuffer.numberOfChannels; index += 1) {
    const copy = new Float32Array(audioBuffer.length);
    copy.set(audioBuffer.getChannelData(index));
    transfer.push(copy.buffer);
  }
  return transfer;
};

// Encodes a rendered AudioBuffer to a WAV blob and analysis, off the main
// thread when possible. Always resolves (never rejects): worker problems fall
// back to a synchronous encode so an export can never silently fail.
export const encodeAudioBufferToWavAsync = async (
  audioBuffer: AudioBuffer,
  options: WavConversionOptions = {},
): Promise<EncodedWavResult> => {
  const activeWorker = getWorker();
  if (!activeWorker) {
    return encodeOnMainThread(audioBuffer, options);
  }

  const channels = copyChannelsForTransfer(audioBuffer);
  const id = nextId;
  nextId += 1;
  const request: WavEncodeRequest = {
    id,
    channels,
    sampleRate: audioBuffer.sampleRate,
    length: audioBuffer.length,
    options,
  };

  try {
    return await new Promise<EncodedWavResult>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      activeWorker.postMessage(request, channels);
    });
  } catch {
    pending.delete(id);
    // The worker could not produce a result; the source buffer is untouched
    // (we transferred copies), so a main-thread encode still works.
    return encodeOnMainThread(audioBuffer, options);
  }
};
