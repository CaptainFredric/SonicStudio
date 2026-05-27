import { describe, expect, it } from 'vitest';

import { createBlankProject, createTwilightFrameProject } from '../project/schema';
import { computeSmartSuggestions } from './smartSuggestions';

describe('computeSmartSuggestions', () => {
  it('returns no suggestions for an empty track list', () => {
    expect(computeSmartSuggestions([])).toEqual([]);
  });

  it('keeps the list manageable for Twilight Frame (full session)', () => {
    const project = createTwilightFrameProject();
    const suggestions = computeSmartSuggestions(project.tracks);
    // Twilight Frame fills its lanes, so the list mostly speaks to
    // density / downbeats rather than emptiness.
    suggestions.forEach((entry) => {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.detail.length).toBeGreaterThan(0);
      expect(['tip', 'attention']).toContain(entry.tone);
    });
  });

  it('names the detected key when it surfaces a melodic suggestion', () => {
    const project = createTwilightFrameProject();
    // Clear out a melodic lane so we trigger the "empty lane" tip.
    const violin = project.tracks.find((track) => track.type === 'violin');
    if (!violin) throw new Error('Twilight Frame should have a violin lane.');
    for (const stepGrid of Object.values(violin.patterns)) {
      stepGrid.forEach((_, index) => { stepGrid[index] = []; });
    }
    const suggestions = computeSmartSuggestions(project.tracks);
    const emptyMelodicTip = suggestions.find((entry) => entry.id === `empty-${violin.id}`);
    expect(emptyMelodicTip).toBeDefined();
    expect(emptyMelodicTip?.detail).toMatch(/A minor|major|minor/);
  });

  it('flags a fully empty session with the no-melody tip', () => {
    const project = createBlankProject();
    // Wipe every melodic note so the heuristic fires.
    for (const track of project.tracks) {
      for (const stepGrid of Object.values(track.patterns)) {
        stepGrid.forEach((_, index) => { stepGrid[index] = []; });
      }
    }
    const suggestions = computeSmartSuggestions(project.tracks);
    expect(suggestions.some((entry) => entry.id === 'no-melodic-content')).toBe(true);
  });
});
