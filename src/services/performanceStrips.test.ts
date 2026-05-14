import { describe, expect, it } from 'vitest';

import { buildPerformanceMacroParams, getInputChannelStripDefinitions } from './performanceStrips';

describe('performanceStrips', () => {
  it('filters input strips by the selected lane type', () => {
    const pluckStrips = getInputChannelStripDefinitions('pluck');

    expect(pluckStrips.some((strip) => strip.id === 'guitar-clean-amp')).toBe(true);
    expect(pluckStrips.every((strip) => strip.trackTypes.includes('pluck'))).toBe(true);
  });

  it('maps the macro pad into stable synth parameter ranges', () => {
    const closedMacro = buildPerformanceMacroParams(0, 0);
    const openMacro = buildPerformanceMacroParams(1, 1);

    expect(closedMacro.cutoff).toBeLessThan(openMacro.cutoff ?? 0);
    expect(closedMacro.resonance).toBeGreaterThan(openMacro.resonance ?? 0);
    expect(openMacro.reverbSend).toBeGreaterThan(closedMacro.reverbSend ?? 0);
    expect(openMacro.release).toBeGreaterThan(closedMacro.release ?? 0);
  });
});