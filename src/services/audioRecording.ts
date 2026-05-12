// Audio recording + pitch analysis for SonicStudio.
//
// Records microphone audio via MediaRecorder, then runs a lightweight
// autocorrelation-based pitch detector over the decoded buffer to identify
// the dominant musical pitch. From that pitch (and a rough energy/spectral
// hint) we suggest a track type the recording most resembles.

import type { InstrumentType } from '../project/schema';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface RecordingResult {
  blob: Blob;
  durationSeconds: number;
  detectedPitchHz: number | null;
  detectedNote: string | null;
  rmsDb: number;
  suggestedTrackType: InstrumentType;
  reason: string;
}

const frequencyToNote = (hz: number): { note: string; octave: number; midi: number } | null => {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  // MIDI note from frequency, A4 = 440Hz = MIDI 69
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  if (midi < 0 || midi > 127) return null;
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return { note: `${name}${octave}`, octave, midi };
};

const rmsOf = (samples: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
};

const linearToDb = (linear: number): number => {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
};

// Yin-lite: pick the strongest periodicity via autocorrelation on a slice of the buffer.
const detectFundamentalHz = (samples: Float32Array, sampleRate: number): number | null => {
  // Trim near-silence
  const SILENCE_THRESHOLD = 0.01;
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < SILENCE_THRESHOLD) start += 1;
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < SILENCE_THRESHOLD) end -= 1;
  if (end - start < 1024) return null;

  // Use a centered window of up to 8192 samples to keep autocorrelation cheap
  const windowStart = Math.max(start, Math.floor((start + end) / 2) - 4096);
  const windowEnd = Math.min(end, windowStart + 8192);
  const buffer = samples.subarray(windowStart, windowEnd);

  // Reasonable pitch range: 50 Hz to 2000 Hz
  const minLag = Math.floor(sampleRate / 2000);
  const maxLag = Math.floor(sampleRate / 50);

  let bestLag = -1;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag && lag < buffer.length; lag += 1) {
    let acc = 0;
    let norm = 0;
    for (let i = 0; i < buffer.length - lag; i += 1) {
      acc += buffer[i] * buffer[i + lag];
      norm += buffer[i] * buffer[i];
    }
    const normalized = norm > 0 ? acc / norm : 0;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestScore < 0.25) return null;
  return sampleRate / bestLag;
};

const classifyByPitch = (pitchHz: number | null, rmsDb: number): { type: InstrumentType; reason: string } => {
  if (pitchHz === null) {
    // No clear pitch — likely percussive
    if (rmsDb > -18) return { type: 'snare', reason: 'Strong, non-pitched signal — sounds like a snare hit.' };
    if (rmsDb > -30) return { type: 'hihat', reason: 'Bright noise with no clear pitch — closest to a hi-hat.' };
    return { type: 'kick', reason: 'Low-energy, non-pitched signal — closest to a kick.' };
  }
  if (pitchHz < 90) return { type: 'kick', reason: `Very low pitch (${pitchHz.toFixed(0)} Hz) — closest to a kick.` };
  if (pitchHz < 200) return { type: 'bass', reason: `Low pitch (${pitchHz.toFixed(0)} Hz) — closest to a bass line.` };
  if (pitchHz < 500) return { type: 'pad', reason: `Mid-low pitch (${pitchHz.toFixed(0)} Hz) — sits well in a pad.` };
  if (pitchHz < 1200) return { type: 'lead', reason: `Mid-high pitch (${pitchHz.toFixed(0)} Hz) — sounds like a lead line.` };
  if (pitchHz < 3000) return { type: 'pluck', reason: `High pitch (${pitchHz.toFixed(0)} Hz) — closest to a pluck.` };
  return { type: 'hihat', reason: `Very high frequency (${pitchHz.toFixed(0)} Hz) — closest to a hi-hat.` };
};

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && typeof MediaRecorder !== 'undefined';
  }

  public async start(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Recording is not supported in this browser.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    this.mediaRecorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.start();
    this.startedAt = Date.now();
  }

  public async stop(): Promise<RecordingResult> {
    const recorder = this.mediaRecorder;
    if (!recorder) throw new Error('Not currently recording.');
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        try {
          const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };
      recorder.onerror = (event) => reject(event);
    });
    recorder.stop();
    const blob = await done;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    const durationSeconds = (Date.now() - this.startedAt) / 1000;

    // Decode and analyze
    let detectedPitchHz: number | null = null;
    let detectedNote: string | null = null;
    let rmsDb = -Infinity;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const samples = audioBuffer.getChannelData(0);
      const rms = rmsOf(samples);
      rmsDb = linearToDb(rms);
      detectedPitchHz = detectFundamentalHz(samples, audioBuffer.sampleRate);
      const noteInfo = detectedPitchHz ? frequencyToNote(detectedPitchHz) : null;
      detectedNote = noteInfo?.note ?? null;
      audioCtx.close().catch(() => {});
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.warn('SonicStudio: analysis failed', error);
      }
    }

    const { type: suggestedTrackType, reason } = classifyByPitch(detectedPitchHz, rmsDb);

    return {
      blob,
      durationSeconds,
      detectedPitchHz,
      detectedNote,
      rmsDb,
      suggestedTrackType,
      reason,
    };
  }

  public cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch { /* ignore */ }
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
