import { describe, expect, it } from 'vitest';

import { detectPitchYin } from './pitchDetection';

const SAMPLE_RATE = 44100;

// Generate a sine wave (optionally with a quieter octave-up partial and
// white noise) for a given fundamental.
const makeTone = (hz: number, seconds = 0.2, opts: { harmonic?: number; noise?: number } = {}): Float32Array => {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    let v = Math.sin(2 * Math.PI * hz * t);
    if (opts.harmonic) v += opts.harmonic * Math.sin(2 * Math.PI * hz * 2 * t);
    if (opts.noise) v += opts.noise * (Math.random() * 2 - 1);
    out[i] = v * 0.6;
  }
  return out;
};

describe('detectPitchYin', () => {
  it('detects A3 (220 Hz) within 1 Hz', () => {
    const reading = detectPitchYin(makeTone(220), SAMPLE_RATE);
    expect(reading).not.toBeNull();
    expect(Math.abs((reading!.hz) - 220)).toBeLessThan(1);
    expect(reading!.clarity).toBeGreaterThan(0.8);
  });

  it('detects a high violin-range pitch (1320 Hz) within ~1%', () => {
    const reading = detectPitchYin(makeTone(1320), SAMPLE_RATE);
    expect(reading).not.toBeNull();
    expect(Math.abs(reading!.hz - 1320) / 1320).toBeLessThan(0.01);
  });

  it('does not slip an octave when a strong second harmonic is present', () => {
    // Autocorrelation often reports 110 Hz here; YIN should hold 220.
    const reading = detectPitchYin(makeTone(220, 0.2, { harmonic: 0.8 }), SAMPLE_RATE);
    expect(reading).not.toBeNull();
    expect(Math.abs(reading!.hz - 220)).toBeLessThan(2);
  });

  it('still locks the fundamental through moderate noise', () => {
    const reading = detectPitchYin(makeTone(330, 0.2, { noise: 0.15 }), SAMPLE_RATE);
    expect(reading).not.toBeNull();
    expect(Math.abs(reading!.hz - 330)).toBeLessThan(4);
  });

  it('returns null for silence', () => {
    expect(detectPitchYin(new Float32Array(4096), SAMPLE_RATE)).toBeNull();
  });

  it('returns null for a frame that is too short to analyze', () => {
    expect(detectPitchYin(new Float32Array(64).fill(0.3), SAMPLE_RATE)).toBeNull();
  });

  it('honors the requested frequency range', () => {
    // A 220 Hz tone with the search floor raised above it should not be
    // reported as 220 (the detector has to look elsewhere or give up).
    const reading = detectPitchYin(makeTone(220), SAMPLE_RATE, { minHz: 400, maxHz: 2500 });
    if (reading) {
      expect(reading.hz).toBeGreaterThan(399);
    }
  });
});
