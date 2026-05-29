import { describe, expect, it } from 'vitest';

import {
  analyzeCaptureFrame,
  buildCaptureSuggestions,
  buildDetectedNoteCandidates,
  buildRecordingInsights,
  captureProfileToPitchThreshold,
  captureSuggestionControlsToTrackSource,
  DEFAULT_CAPTURE_PITCH_THRESHOLD,
} from './audioRecording';

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

const createSnapLikeBurst = (durationSeconds: number, sampleRate = 44100) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);
  let seed = 1234567;

  for (let index = 0; index < sampleCount; index += 1) {
    seed = (seed * 16807) % 2147483647;
    const noise = ((seed / 2147483647) * 2) - 1;
    const time = index / sampleRate;
    const envelope = Math.exp(-time * 55);
    const click = index < 14 ? (1 - (index / 14)) * 0.72 : 0;
    const brightBody = (
      Math.sin((2 * Math.PI * 2300 * index) / sampleRate) * 0.12
      + Math.sin((2 * Math.PI * 4100 * index) / sampleRate) * 0.08
    );

    samples[index] = ((noise * 0.46) + brightBody + click) * envelope;
  }

  return samples;
};

const createResonantSnapBurst = (durationSeconds: number, sampleRate = 44100) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);
  let seed = 987654;

  for (let index = 0; index < sampleCount; index += 1) {
    seed = (seed * 48271) % 2147483647;
    const noise = ((seed / 2147483647) * 2) - 1;
    const time = index / sampleRate;
    const click = index < 10 ? (1 - (index / 10)) * 0.86 : 0;
    const ringEnvelope = Math.exp(-time * 24);
    const noiseEnvelope = Math.exp(-time * 78);
    const ring = (
      Math.sin((2 * Math.PI * 1110 * index) / sampleRate) * 0.32
      + Math.sin((2 * Math.PI * 1175 * index) / sampleRate) * 0.21
      + Math.sin((2 * Math.PI * 2220 * index) / sampleRate) * 0.05
    );

    samples[index] = click + (ring * ringEnvelope) + ((noise * 0.17) * noiseEnvelope);
  }

  return samples;
};

const createRepeatedResonantSnapSequence = (durationSeconds: number, sampleRate = 44100) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);
  const burst = createResonantSnapBurst(0.14, sampleRate);
  const starts = [0.35, 0.9, 1.46, 2.08, 2.76, 3.22]
    .map((seconds) => Math.floor(seconds * sampleRate))
    .filter((start) => start < sampleCount);

  starts.forEach((start) => {
    burst.forEach((value, index) => {
      const target = start + index;
      if (target < sampleCount) {
        samples[target] += value;
      }
    });
  });

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
    expect(suggestions[0]?.controls.release).toBeGreaterThan(0.4);
    expect(suggestions[0]?.controls.waveform).toBe('sine');
  });

  it('maps capture suggestions back to a synth instrument source', () => {
    const suggestion = buildCaptureSuggestions({
      brightness: 0.22,
      clarity: 0.74,
      durationSeconds: 0.68,
      pitchHz: 392,
      rmsDb: -18,
      transientDensity: 0.28,
    })[0];

    const source = captureSuggestionControlsToTrackSource(suggestion.controls);

    expect(source.engine).toBe('synth');
    expect(source.waveform).toBe(suggestion.controls.waveform);
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

  it('keeps bright transient bursts in upper percussive territory', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 0.18,
      sampleRate: 44100,
      samples: createBrightBurst(0.18),
    });

    expect(['snare', 'hihat']).toContain(frame.suggestions[0]?.trackType ?? '');
    expect(frame.transientDensity).toBeGreaterThan(0.45);
    expect(frame.suggestions[0]?.controls.release).toBeLessThan(0.5);
    expect(['bandpass', 'highpass']).toContain(frame.suggestions[0]?.controls.filterMode ?? '');
  });

  it('suppresses fake pitch on snap-like transients and avoids bass-heavy matches', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 0.12,
      sampleRate: 44100,
      samples: createSnapLikeBurst(0.12),
    });

    expect(frame.detectedPitchHz).toBeNull();
    expect(frame.noteCandidates).toHaveLength(0);
    expect(['bass', 'kick', 'pad']).not.toContain(frame.suggestions[0]?.trackType ?? '');
    expect(frame.suggestions[0]?.controls.release).toBeLessThan(0.18);
    expect(frame.suggestions[0]?.controls.reverbSend).toBeLessThan(0.12);
  });

  it('keeps note candidates for resonant snap-like transients', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 0.14,
      sampleRate: 44100,
      samples: createResonantSnapBurst(0.14),
    });

    expect(frame.detectedPitchHz).not.toBeNull();
    expect(frame.detectedPitchHz ?? 0).toBeGreaterThan(1000);
    expect(frame.detectedPitchHz ?? 0).toBeLessThan(1300);
    expect(['C#6', 'D6']).toContain(frame.noteCandidates[0]?.note ?? '');
    expect(frame.noteCandidates[0]?.confidence ?? 0).toBeGreaterThan(0.4);
    expect(['bass', 'kick', 'pad']).not.toContain(frame.suggestions[0]?.trackType ?? '');
  });

  it('focuses long repeated snap recordings on the strongest transient slice', () => {
    const frame = analyzeCaptureFrame({
      durationSeconds: 3.6,
      sampleRate: 44100,
      samples: createRepeatedResonantSnapSequence(3.6),
    });

    expect(frame.detectedPitchHz).not.toBeNull();
    expect(frame.detectedPitchHz ?? 0).toBeGreaterThan(1000);
    expect(frame.detectedPitchHz ?? 0).toBeLessThan(1300);
    expect(['C#6', 'D6']).toContain(frame.noteCandidates[0]?.note ?? '');
    expect(frame.durationSeconds).toBe(3.6);
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

describe('capture analysis profile sensitivity', () => {
  it('makes Quick more eager and Steady stricter than Balanced', () => {
    const quick = captureProfileToPitchThreshold('quick');
    const balanced = captureProfileToPitchThreshold('balanced');
    const steady = captureProfileToPitchThreshold('steady');

    // A higher YIN threshold accepts a periodic dip sooner (more eager).
    expect(quick).toBeGreaterThan(balanced);
    expect(steady).toBeLessThan(balanced);
  });

  it('keeps Balanced on the established default threshold', () => {
    expect(captureProfileToPitchThreshold('balanced')).toBe(DEFAULT_CAPTURE_PITCH_THRESHOLD);
  });

  it('stays within a sane YIN range for every profile', () => {
    (['quick', 'balanced', 'steady'] as const).forEach((profile) => {
      const threshold = captureProfileToPitchThreshold(profile);
      expect(threshold).toBeGreaterThan(0.05);
      expect(threshold).toBeLessThan(0.3);
    });
  });

  it('still locks a clean A3 across every profile threshold', () => {
    (['quick', 'balanced', 'steady'] as const).forEach((profile) => {
      const frame = analyzeCaptureFrame({
        durationSeconds: 0.5,
        sampleRate: 44100,
        samples: createSineWave(220, 0.5),
        pitchThreshold: captureProfileToPitchThreshold(profile),
      });

      expect(frame.detectedPitchHz).not.toBeNull();
      expect(Math.abs((frame.detectedPitchHz ?? 0) - 220)).toBeLessThan(220 * 0.03);
      expect(frame.detectedNote).toBe('A3');
    });
  });
});