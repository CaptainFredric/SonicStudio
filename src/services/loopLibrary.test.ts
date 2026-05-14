import { describe, expect, it } from 'vitest';

import { FACTORY_LOOP_LIBRARY, getFactoryLoopById, getFactoryLoopsForTrackType } from './loopLibrary';

describe('loopLibrary', () => {
  it('exposes factory loops grouped by the owning track type', () => {
    const bassLoops = getFactoryLoopsForTrackType('bass');

    expect(bassLoops.length).toBeGreaterThan(0);
    expect(bassLoops.every((loop) => loop.sourceTrackType === 'bass')).toBe(true);
  });

  it('keeps loop step data aligned to the declared pattern length', () => {
    expect(FACTORY_LOOP_LIBRARY.every((loop) => loop.steps.length === loop.stepsPerPattern)).toBe(true);
    expect(FACTORY_LOOP_LIBRARY.every((loop) => loop.automation.level.length === loop.stepsPerPattern)).toBe(true);
    expect(FACTORY_LOOP_LIBRARY.every((loop) => loop.automation.tone.length === loop.stepsPerPattern)).toBe(true);
  });

  it('returns concrete musical content for a known loop id', () => {
    const loop = getFactoryLoopById('factory-loop-night-drive-kick');

    expect(loop).not.toBeNull();
    expect(loop?.stepsPerPattern).toBe(16);
    expect(loop?.steps[0]?.[0]?.note).toBe('C1');
    expect(loop?.tags).toContain('foundation');
  });
});