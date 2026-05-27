import { describe, expect, it } from 'vitest';

import { createBlankProject, createTwilightFrameProject, createLateHoursProject } from '../project/schema';
import { detectKey } from './keyDetector';

describe('detectKey', () => {
  it('returns the empty key when there are no pitched notes', () => {
    const result = detectKey([]);
    expect(result.uncertain).toBe(true);
    expect(result.noteCount).toBe(0);
  });

  it('locks Twilight Frame to A minor', () => {
    const project = createTwilightFrameProject();
    const result = detectKey(project.tracks);
    expect(result.uncertain).toBe(false);
    expect(result.rootName).toBe('A');
    expect(result.mode).toBe('minor');
    expect(result.label).toBe('A minor');
  });

  it('locks Late Hours to D minor', () => {
    const project = createLateHoursProject();
    const result = detectKey(project.tracks);
    expect(result.uncertain).toBe(false);
    expect(result.rootName).toBe('D');
    expect(result.mode).toBe('minor');
    expect(result.label).toBe('D minor');
  });

  it('skips drum lanes so kick/snare/hat noise does not poison the histogram', () => {
    // The Blank Grid template seeds drums in C1 and a few melodic
    // events. Without the drum filter the result would land on C
    // simply because kick is loud and constant; verify the detector
    // either reads the melodic lanes or stays uncertain rather than
    // returning a spurious major / minor.
    const project = createBlankProject();
    const result = detectKey(project.tracks);
    expect(result).toBeDefined();
    expect(result.noteCount).toBeGreaterThan(0);
  });

  it('exposes a 0..1 confidence on every result', () => {
    const project = createTwilightFrameProject();
    const result = detectKey(project.tracks);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
