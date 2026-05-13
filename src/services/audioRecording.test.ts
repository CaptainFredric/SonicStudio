import { describe, expect, it } from 'vitest';

import { analyzeCaptureFrame, buildCaptureSuggestions, buildDetectedNoteCandidates, buildRecordingInsights } from './audioRecording';

const createSineWave = (hz: number, durationSeconds: number, sampleRate = 44100, amplitude = 0.62) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * hz * index) / sampleRate) * amplitude;
  }
  return samples;
};

const createPadTone = (hz: number, durationSeconds: number, sampleRate = 44100) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / 0.22);
    const release = Math.min(1, (durationSeconds - time) / 0.28);
    const envelope = Math.max(0, Math.min(attack, release));
    samples[index] = (
      Math.sin((2 * Math.PI * hz * index) / sampleRate) * 0.68
      + Math.sin((2 * Math.PI * hz * 2 * index) / sampleRate) * 0.14
      + Math.sin((2 * Math.PI * hz * 3 * index) / sampleRate) * 0.06
    ) * envelope * 0.48;
  }
  return samples;
};

const createBrightBurst = (durationSeconds: number, sampleRate = 44100) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.exp(-time * 30);
    samples[index] = (
      Math.sin((2 * Math.PI * 6200 * index) / sampleRate) * 0.58
      + Math.sin((2 * Math.PI * 9100 * index) / sampleRate) * 0.26
      + Math.sin((2 * Math.PI * 13100 * index) / sampleRate) * 0.14
    ) * envelope;
  }
  return samples;
};

describe('audioRecording insights', () => {
  it('ranks the nearest detected note ahead of neighboring semitones', () => {
    const notes = buildDetectedNoteCandidates(440, 0.86);

    expect(notes[0]?.note).toBe('A4');
    expect(notes[0]?.confidence).toBeGreaterThan(notes[1]?.confidence ?? 0);
    expect(notes).toHaveLength(3);
  });

  it('prefers bass-like suggestions for low, dark pitched captures', () => {
    const suggestions = buildCaptureSuggestions({
      brightness: 0.12,
      clarity: 0.82,
      durationSeconds: 1.1,
      pitchHz: 132,
      rmsDb: -17,
      transientDensity: 0.18,
    });

    expect(suggestions[0]?.trackType).toBe('bass');
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]?.controls.cutoff).toBeLessThan(3000);
  });

  it('keeps bright short captures in melodic or percussive upper voices', () => {
    const insights = buildRecordingInsights({
      brightness: 0.74,
      clarity: 0.78,
      durationSeconds: 0.24,
      pitchHz: 920,
      rmsDb: -24,
      transientDensity: 0.66,
    });

    expect(['lead', 'pluck', 'hihat']).toContain(insights.primarySuggestion?.trackType ?? '');
    expect(insights.noteCandidates[0]?.note).toBeTruthy();
    expect(insights.suggestions[0]?.confidence).toBeGreaterThanOrEqual(insights.suggestions[1]?.confidence ?? 0);
  });

  it('extracts a usable live capture frame from a steady note', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 0.42,
      sampleRate: 44100,
      samples: createSineWave(220, 0.42),
    });

    expect(frame.detectedNote).toBe('A3');
    expect(frame.signalLevel).toBeGreaterThan(0.2);
    expect(frame.noteCandidates[0]?.confidence).toBeGreaterThan(0.5);
    expect(frame.suggestions.length).toBe(3);
  });

  it('leans toward pad suggestions for long soft sustained captures', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 2.8,
      sampleRate: 44100,
      samples: createPadTone(329.63, 2.8),
    });

    expect(frame.suggestions[0]?.trackType).toBe('pad');
    expect(frame.transientDensity).toBeLessThan(0.3);
    expect(frame.detectedNote).toBe('E4');
  });

  it('keeps bright transient bursts in hihat-like territory', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 0.18,
      sampleRate: 44100,
      samples: createBrightBurst(0.18),
    });

    expect(frame.suggestions[0]?.trackType).toBe('hihat');
    expect(frame.transientDensity).toBeGreaterThan(0.45);
  });

  it('keeps silent live frames low-confidence and low-level', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 0.2,
      sampleRate: 44100,
      samples: new Float32Array(44100),
    });

    expect(frame.detectedPitchHz).toBeNull();
    expect(frame.signalLevel).toBe(0);
    expect(frame.noteCandidates).toHaveLength(0);
  });
});