import { describe, expect, it } from 'vitest';

import { extractPeaks } from './waveformPeaks';

describe('extractPeaks', () => {
  it('returns the requested number of buckets', () => {
    const samples = new Float32Array(1000).fill(0.5);
    expect(extractPeaks(samples, 32)).toHaveLength(32);
  });

  it('returns all zeros for empty input', () => {
    expect(extractPeaks(new Float32Array(0), 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('returns all zeros for silent input', () => {
    expect(extractPeaks(new Float32Array(500).fill(0), 4)).toEqual([0, 0, 0, 0]);
  });

  it('takes the max magnitude per bucket and normalizes to 1', () => {
    // Two buckets: first half peaks at 0.25, second half at 0.5.
    const samples = [0.1, 0.25, 0.5, 0.2];
    const peaks = extractPeaks(samples, 2);
    // Loudest bucket (0.5) normalizes to 1, the quieter (0.25) to 0.5.
    expect(peaks[0]).toBeCloseTo(0.5, 5);
    expect(peaks[1]).toBeCloseTo(1, 5);
  });

  it('treats negative samples by magnitude', () => {
    const peaks = extractPeaks([-0.8, 0.2], 1);
    expect(peaks[0]).toBeCloseTo(1, 5);
  });

  it('clamps absurd bucket counts to at least one', () => {
    expect(extractPeaks([0.3, 0.6], 0)).toHaveLength(1);
  });
});
