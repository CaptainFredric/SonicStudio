import { describe, expect, it } from 'vitest';

import { createTwilightFrameProject, createLateHoursProject } from '../project/schema';
import { detectKey } from './keyDetector';
import { suggestNextChords } from './nextChord';

describe('suggestNextChords', () => {
  it('returns no suggestions when the key is uncertain', () => {
    expect(suggestNextChords([], { root: 0, rootName: 'C', mode: 'major', label: '', confidence: 0, uncertain: true, noteCount: 0 })).toEqual([]);
  });

  it('proposes diatonic next chords for Twilight Frame', () => {
    const project = createTwilightFrameProject();
    const key = detectKey(project.tracks);
    const suggestions = suggestNextChords(project.tracks, key);
    expect(suggestions.length).toBeGreaterThan(0);
    suggestions.forEach((entry) => {
      expect(entry.tokens).toHaveLength(1);
      expect(entry.numeral.length).toBeGreaterThan(0);
      // Every suggested root should fit the minor diatonic set in A.
      const allowed = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'G#']);
      const noteLetter = entry.tokens[0].note.replace(/\d+$/, '');
      expect(allowed.has(noteLetter)).toBe(true);
    });
  });

  it('uses the minor transition table when the session is in a minor key', () => {
    const project = createLateHoursProject();
    const key = detectKey(project.tracks);
    expect(key.mode).toBe('minor');
    const suggestions = suggestNextChords(project.tracks, key);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((entry) => entry.label.length > 0)).toBe(true);
  });
});
