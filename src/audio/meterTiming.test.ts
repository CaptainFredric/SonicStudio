import { describe, expect, it } from 'vitest';

import { meterIntervalForMode } from './meterTiming';

describe('meterIntervalForMode', () => {
  it('leaves tight and auto at the base rate', () => {
    expect(meterIntervalForMode(50, 'tight')).toBe(50);
    expect(meterIntervalForMode(110, 'auto')).toBe(110);
  });

  it('slows meters progressively in the more resilient modes', () => {
    const base = 100;
    const tight = meterIntervalForMode(base, 'tight');
    const stable = meterIntervalForMode(base, 'stable');
    const resilient = meterIntervalForMode(base, 'resilient');

    expect(stable).toBeGreaterThan(tight);
    expect(resilient).toBeGreaterThan(stable);
  });

  it('doubles the interval in resilient mode', () => {
    expect(meterIntervalForMode(50, 'resilient')).toBe(100);
  });

  it('always returns a whole number of milliseconds', () => {
    expect(Number.isInteger(meterIntervalForMode(55, 'stable'))).toBe(true);
  });
});
