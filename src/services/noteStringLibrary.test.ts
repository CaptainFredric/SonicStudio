import { describe, expect, it } from 'vitest';

import {
  noteStringToPatternSegment,
  parseNoteString,
  summarizeCapturedNoteString,
  type CapturedNoteString,
} from './noteStringLibrary';

describe('parseNoteString', () => {
  it('reads a plain space-separated melody', () => {
    const { tokens, ok, rejected } = parseNoteString('C4 E4 G4 B4');
    expect(ok).toBe(true);
    expect(rejected).toEqual([]);
    expect(tokens.map((token) => token?.note)).toEqual(['C4', 'E4', 'G4', 'B4']);
  });

  it('accepts commas and pipes as separators', () => {
    const { tokens } = parseNoteString('C4, E4 | G4');
    expect(tokens.map((token) => token?.note)).toEqual(['C4', 'E4', 'G4']);
  });

  it('treats . and - as rests', () => {
    const { tokens } = parseNoteString('C4 . E4 - G4');
    expect(tokens).toEqual([
      { note: 'C4', gate: 1, velocity: 0.78 },
      null,
      { note: 'E4', gate: 1, velocity: 0.78 },
      null,
      { note: 'G4', gate: 1, velocity: 0.78 },
    ]);
  });

  it('parses *N gate and @V velocity suffixes', () => {
    const { tokens } = parseNoteString('C4*2 E4@0.5 G4*3@0.9');
    expect(tokens[0]).toEqual({ note: 'C4', gate: 2, velocity: 0.78 });
    expect(tokens[1]?.velocity).toBeCloseTo(0.5, 3);
    expect(tokens[2]).toEqual({ note: 'G4', gate: 3, velocity: 0.9 });
  });

  it('flats round-trip into sharps so the engine accepts them', () => {
    const { tokens, rejected } = parseNoteString('Db4 Eb4 Bb3');
    expect(rejected).toEqual([]);
    expect(tokens.map((token) => token?.note)).toEqual(['C#4', 'D#4', 'A#3']);
  });

  it('flags unreadable tokens without throwing', () => {
    const { ok, tokens, rejected } = parseNoteString('C4 banana G4');
    expect(ok).toBe(false);
    expect(rejected).toEqual(['banana']);
    expect(tokens.map((token) => token?.note)).toEqual(['C4', 'G4']);
  });
});

describe('noteStringToPatternSegment', () => {
  const baseEntry: CapturedNoteString = {
    id: 'test-1',
    name: 'Test arpeggio',
    source: 'typed',
    raw: 'C4 E4 G4 B4',
    tokens: parseNoteString('C4 E4 G4 B4').tokens,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  it('emits a PatternSegment with steps and stepsPerPattern aligned', () => {
    const segment = noteStringToPatternSegment(baseEntry, 'Lead', 'lead');
    expect(segment.stepsPerPattern).toBeGreaterThanOrEqual(8);
    expect(segment.steps.length).toBe(segment.stepsPerPattern);
    expect(segment.steps[0][0]?.note).toBe('C4');
    expect(segment.steps[1][0]?.note).toBe('E4');
    expect(segment.steps[2][0]?.note).toBe('G4');
    expect(segment.steps[3][0]?.note).toBe('B4');
  });

  it('respects *N gates by advancing the cursor by N', () => {
    const held: CapturedNoteString = {
      ...baseEntry,
      tokens: parseNoteString('C4*2 E4').tokens,
    };
    const segment = noteStringToPatternSegment(held, 'Lead', 'lead');
    expect(segment.steps[0][0]?.note).toBe('C4');
    expect(segment.steps[0][0]?.gate).toBe(2);
    expect(segment.steps[2][0]?.note).toBe('E4');
    expect(segment.steps[1]).toEqual([]);
  });

  it('skips a step for each rest token', () => {
    const withRest: CapturedNoteString = {
      ...baseEntry,
      tokens: parseNoteString('C4 . E4').tokens,
    };
    const segment = noteStringToPatternSegment(withRest, 'Lead', 'lead');
    expect(segment.steps[0][0]?.note).toBe('C4');
    expect(segment.steps[1]).toEqual([]);
    expect(segment.steps[2][0]?.note).toBe('E4');
  });
});

describe('summarizeCapturedNoteString', () => {
  it('counts notes and total step span (gates and rests included)', () => {
    const entry: CapturedNoteString = {
      id: 'sum-1',
      name: 'Summary',
      source: 'typed',
      raw: 'C4*2 . E4',
      tokens: parseNoteString('C4*2 . E4').tokens,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    expect(summarizeCapturedNoteString(entry)).toEqual({ noteCount: 2, stepCount: 4 });
  });
});
