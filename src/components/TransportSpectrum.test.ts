import { describe, expect, it } from 'vitest';

import { spectrumToBars } from './TransportSpectrum';

describe('spectrumToBars', () => {
  it('returns the requested number of bars', () => {
    const values = new Float32Array(64).fill(-40);
    expect(spectrumToBars(values, 32)).toHaveLength(32);
  });

  it('maps silence (-Infinity) to zero and full scale (0 dB) to one', () => {
    const silent = new Float32Array(64).fill(-Infinity);
    expect(spectrumToBars(silent, 8).every((bar) => bar === 0)).toBe(true);

    const loud = new Float32Array(64).fill(0);
    expect(spectrumToBars(loud, 8).every((bar) => Math.abs(bar - 1) < 1e-9)).toBe(true);
  });

  it('keeps every bar within 0..1 and rises with louder input', () => {
    const quiet = spectrumToBars(new Float32Array(64).fill(-60), 16);
    const loud = spectrumToBars(new Float32Array(64).fill(-12), 16);
    quiet.forEach((bar) => expect(bar).toBeGreaterThanOrEqual(0));
    loud.forEach((bar) => expect(bar).toBeLessThanOrEqual(1));
    // Same input across the buffer, so every bar should track the level.
    expect(loud[0]).toBeGreaterThan(quiet[0]);
  });

  it('clamps input below the dB floor to zero', () => {
    const belowFloor = new Float32Array(64).fill(-120);
    expect(spectrumToBars(belowFloor, 8, 80).every((bar) => bar === 0)).toBe(true);
  });

  it('reflects a low-frequency peak in the left bars, not the right', () => {
    const values = new Float32Array(64).fill(-Infinity);
    // Energy only in the lowest bins.
    for (let i = 0; i < 4; i += 1) {
      values[i] = -10;
    }
    const bars = spectrumToBars(values, 16);
    expect(bars[0]).toBeGreaterThan(0.5);
    expect(bars[bars.length - 1]).toBe(0);
  });
});
