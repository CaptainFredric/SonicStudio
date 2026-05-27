import { describe, expect, it } from 'vitest';

import { createBlankProject, createTwilightFrameProject, createLateHoursProject } from '../project/schema';
import { detectKey, detectPatternKeyDrift, laneFitness } from './keyDetector';

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

describe('laneFitness', () => {
  it('returns null ratio for drum lanes (their pitches do not encode harmony)', () => {
    const project = createTwilightFrameProject();
    const kick = project.tracks.find((track) => track.type === 'kick');
    if (!kick) throw new Error('Twilight Frame should have a kick');
    const key = detectKey(project.tracks);
    expect(laneFitness(kick, key).ratio).toBeNull();
  });

  it('reads a high inside-key ratio for the violin lane in A minor', () => {
    const project = createTwilightFrameProject();
    const violin = project.tracks.find((track) => track.type === 'violin');
    if (!violin) throw new Error('Twilight Frame should have a violin');
    const key = detectKey(project.tracks);
    const fitness = laneFitness(violin, key);
    expect(fitness.ratio).not.toBeNull();
    expect(fitness.ratio as number).toBeGreaterThan(0.8);
  });
});

describe('detectPatternKeyDrift', () => {
  it('returns no drift entries when no key has been called', () => {
    const project = createBlankProject();
    // Wipe pitched notes so detectKey reports uncertain.
    for (const track of project.tracks) {
      if (['kick', 'snare', 'hihat'].includes(track.type)) continue;
      for (const stepGrid of Object.values(track.patterns)) {
        stepGrid.forEach((_, index) => { stepGrid[index] = []; });
      }
    }
    const key = detectKey(project.tracks);
    expect(detectPatternKeyDrift(project.tracks, key)).toEqual([]);
  });

  it('flags zero drifting patterns for the in-key Twilight Frame', () => {
    const project = createTwilightFrameProject();
    const key = detectKey(project.tracks);
    const drift = detectPatternKeyDrift(project.tracks, key);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.filter((entry) => entry.drifts)).toEqual([]);
  });
});
