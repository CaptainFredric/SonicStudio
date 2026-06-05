import { describe, expect, it } from 'vitest';

import { MAX_HUMANIZE_TIME_SWING_SECONDS, humanizeTime, humanizeVelocity } from './humanize';

describe('humanizeVelocity', () => {
  it('returns the base velocity unchanged when humanize is off', () => {
    expect(humanizeVelocity(0.7, 0, 1)).toBe(0.7);
    expect(humanizeVelocity(0.7, 0, -1)).toBe(0.7);
  });

  it('never pushes velocity above 1 or below an audible floor', () => {
    expect(humanizeVelocity(1, 1, 1)).toBeLessThanOrEqual(1);
    expect(humanizeVelocity(0.06, 1, -1)).toBeGreaterThanOrEqual(0.05);
  });

  it('raises with positive jitter and drops with negative jitter', () => {
    expect(humanizeVelocity(0.5, 1, 1)).toBeGreaterThan(0.5);
    expect(humanizeVelocity(0.5, 1, -1)).toBeLessThan(0.5);
  });
});

describe('humanizeTime', () => {
  it('returns the time unchanged when humanize is off', () => {
    expect(humanizeTime(5, 0, 1, 0)).toBe(5);
  });

  it('never lands before the floor', () => {
    expect(humanizeTime(5, 1, -1, 4.999)).toBeGreaterThanOrEqual(4.999);
  });

  it('stays within the timing swing window', () => {
    expect(Math.abs(humanizeTime(5, 1, 1, 0) - 5)).toBeLessThanOrEqual(MAX_HUMANIZE_TIME_SWING_SECONDS + 1e-9);
  });
});
