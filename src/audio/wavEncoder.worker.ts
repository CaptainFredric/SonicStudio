// Dedicated worker that turns raw render PCM into a downloadable WAV plus its
// loudness analysis. The heavy per-sample work (normalize, loudness, 16-bit
// encode) runs here so a long bounce never freezes the studio UI. The
// OfflineAudioContext render itself stays on the main thread (it is not
// available in workers); only the post-render number crunching moves here.

import {
  processPcmToWav,
  type AudioRenderAnalysis,
  type PcmAudio,
  type WavConversionOptions,
} from './wavCodec';

export interface WavEncodeRequest {
  id: number;
  channels: ArrayBuffer[];
  sampleRate: number;
  length: number;
  options: WavConversionOptions;
}

export type WavEncodeResponse =
  | { id: number; ok: true; wav: ArrayBuffer; analysis: AudioRenderAnalysis }
  | { id: number; ok: false; error: string };

// `self` inside a module worker is the worker global scope; casting to Worker
// keeps the postMessage/onmessage signatures available without pulling in the
// WebWorker lib (this project's tsconfig only loads the DOM libs).
const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<WavEncodeRequest>) => {
  const { id, channels, sampleRate, length, options } = event.data;

  try {
    const pcm: PcmAudio = {
      channels: channels.map((buffer) => new Float32Array(buffer)),
      sampleRate,
      length,
    };
    const { wav, analysis } = processPcmToWav(pcm, options);
    const response: WavEncodeResponse = { id, ok: true, wav, analysis };
    ctx.postMessage(response, [wav]);
  } catch (error) {
    const response: WavEncodeResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'WAV encoding failed in worker.',
    };
    ctx.postMessage(response);
  }
};
