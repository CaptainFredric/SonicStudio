import { describe, expect, it } from 'vitest';

import { CHORD_STARTERS, transposeChordStarterToKey } from './chordStarters';

const findStarter = (id: string) => {
  const starter = CHORD_STARTERS.find((entry) => entry.id === id);
  if (!starter) throw new Error(`Missing starter ${id}`);
  return starter;
};

describe('transposeChordStarterToKey', () => {
  it('moves a C-major starter to F major (+5 semitones)', () => {
    const starter = findStarter('pop-i-v-vi-iv-c');
    const result = transposeChordStarterToKey(starter, 5, 'major');
    expect(result.tokens.map((token) => token.note)).toEqual(['F4', 'C5', 'D5', 'A#4']);
    expect(result.label).toContain('F');
  });

  it('keeps a starter in place when its mode does not match', () => {
    const starter = findStarter('pop-i-v-vi-iv-c');
    const result = transposeChordStarterToKey(starter, 9, 'minor');
    expect(result).toBe(starter);
  });

  it('returns the starter as-is when the target root already matches', () => {
    const starter = findStarter('cinematic-i-vi-iii-vii-am');
    const result = transposeChordStarterToKey(starter, 9, 'minor');
    expect(result).toBe(starter);
  });

  it('moves an A-minor starter to D minor (+5 semitones)', () => {
    const starter = findStarter('cinematic-i-vi-iii-vii-am');
    const result = transposeChordStarterToKey(starter, 2, 'minor');
    expect(result.tokens.map((token) => token.note)).toEqual(['D4', 'A#3', 'F4', 'C4']);
    expect(result.label).toContain('D');
  });
});
