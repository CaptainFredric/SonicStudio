import { describe, expect, it } from 'vitest';

import { STABILITY_LOOKAHEAD_SECONDS, lookaheadForMode } from './schedulerTiming';

describe('lookaheadForMode', () => {
  it('passes the named modes straight through', () => {
    expect(lookaheadForMode('tight', false)).toBe(STABILITY_LOOKAHEAD_SECONDS.tight);
    expect(lookaheadForMode('stable', false)).toBe(STABILITY_LOOKAHEAD_SECONDS.stable);
    expect(lookaheadForMode('resilient', false)).toBe(STABILITY_LOOKAHEAD_SECONDS.resilient);
  });

  it('adds headroom as the mode gets more resilient', () => {
    expect(STABILITY_LOOKAHEAD_SECONDS.stable).toBeGreaterThan(STABILITY_LOOKAHEAD_SECONDS.tight);
    expect(STABILITY_LOOKAHEAD_SECONDS.resilient).toBeGreaterThan(STABILITY_LOOKAHEAD_SECONDS.stable);
  });

  // The studio plays back sequenced patterns, so "auto" leans toward glitch-free
  // playback over the lowest possible latency. It must never collapse back to
  // the tight window, which is what starves the scheduler on busy machines.
  it('keeps auto at least as generous as stable on every device', () => {
    expect(lookaheadForMode('auto', false)).toBe(STABILITY_LOOKAHEAD_SECONDS.stable);
    expect(lookaheadForMode('auto', true)).toBeGreaterThanOrEqual(STABILITY_LOOKAHEAD_SECONDS.stable);
    expect(lookaheadForMode('auto', false)).toBeGreaterThan(STABILITY_LOOKAHEAD_SECONDS.tight);
  });

  it('gives phones at least as much headroom as desktops', () => {
    expect(lookaheadForMode('auto', true)).toBeGreaterThanOrEqual(lookaheadForMode('auto', false));
  });

  it('never returns a non-positive window', () => {
    for (const mode of ['auto', 'tight', 'stable', 'resilient'] as const) {
      expect(lookaheadForMode(mode, false)).toBeGreaterThan(0);
      expect(lookaheadForMode(mode, true)).toBeGreaterThan(0);
    }
  });
});
