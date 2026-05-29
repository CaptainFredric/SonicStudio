import { describe, expect, it } from 'vitest';

import { bpmFromTaps, trimTapRun } from './tapTempo';

describe('bpmFromTaps', () => {
  it('returns null for fewer than two taps', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([1000])).toBeNull();
  });

  it('reads 120 BPM from taps 500ms apart', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
  });

  it('reads 60 BPM from taps one second apart', () => {
    expect(bpmFromTaps([0, 1000, 2000])).toBe(60);
  });

  it('averages uneven intervals rather than using only the last', () => {
    // Intervals: 500, 520, 480 -> mean 500 -> 120 BPM.
    expect(bpmFromTaps([0, 500, 1020, 1500])).toBe(120);
  });

  it('clamps absurdly fast tapping to the max tempo', () => {
    expect(bpmFromTaps([0, 50, 100])).toBe(240);
  });

  it('clamps very slow tapping to the min tempo', () => {
    expect(bpmFromTaps([0, 5000, 10000])).toBe(40);
  });
});

describe('trimTapRun', () => {
  it('keeps a contiguous run within the gap window', () => {
    expect(trimTapRun([0, 500, 1000])).toEqual([0, 500, 1000]);
  });

  it('restarts the run after a long pause', () => {
    // 5000ms gap is past the 2000ms reset, so only the later pair survives.
    expect(trimTapRun([0, 500, 5500, 6000])).toEqual([5500, 6000]);
  });

  it('returns an empty array when given no taps', () => {
    expect(trimTapRun([])).toEqual([]);
  });
});
