import {
  transcribeSamples,
  type TranscriptionOptions,
  type TranscriptionResult,
} from '../services/songTranscription';

export interface SongTranscriptionRequest {
  id: number;
  options: TranscriptionOptions;
  sampleRate: number;
  samples: ArrayBuffer;
}

export interface SongTranscriptionResponse {
  error?: string;
  id: number;
  result?: TranscriptionResult;
}

// This project loads DOM types rather than the WebWorker lib. The cast keeps
// the dedicated-worker messaging API typed without changing the global build.
const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<SongTranscriptionRequest>) => {
  const { id, options, sampleRate, samples } = event.data;

  try {
    const result = transcribeSamples(new Float32Array(samples), sampleRate, options);
    const response: SongTranscriptionResponse = { id, result };
    ctx.postMessage(response);
  } catch (error) {
    const response: SongTranscriptionResponse = {
      error: error instanceof Error ? error.message : 'Melody analysis failed.',
      id,
    };
    ctx.postMessage(response);
  }
};
