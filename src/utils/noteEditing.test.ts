import { describe, expect, it } from 'vitest';

import {
  NOTE_GATE_GRID_STEP,
  NOTE_GATE_MAX,
  NOTE_GATE_MIN,
  buildMidiWindow,
  clampNoteGate,
  snapNoteGate,
} from './noteEditing';

describe('noteEditing', () => {
  it('clamps note gates to the expanded global range', () => {
    expect(clampNoteGate(NOTE_GATE_MIN / 2)).toBe(NOTE_GATE_MIN);
    expect(clampNoteGate(NOTE_GATE_MAX * 2)).toBe(NOTE_GATE_MAX);
    expect(clampNoteGate(2.5)).toBe(2.5);
  });

  it('snaps note gates to the requested edit step', () => {
    expect(snapNoteGate(1.18, NOTE_GATE_GRID_STEP)).toBe(1.125);
    expect(snapNoteGate(3.87, 0.25)).toBe(3.75);
  });

  it('keeps snap results inside the canonical bounds', () => {
    expect(snapNoteGate(0.01, NOTE_GATE_GRID_STEP)).toBe(NOTE_GATE_MIN);
    expect(snapNoteGate(12, NOTE_GATE_GRID_STEP)).toBe(NOTE_GATE_MAX);
  });

  it('shifts pitch windows at the MIDI limits without repeating rows', () => {
    expect(buildMidiWindow(96, 7)).toEqual([
      96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82,
    ]);
    expect(buildMidiWindow(24, 2)).toEqual([28, 27, 26, 25, 24]);
    expect(new Set(buildMidiWindow(96, 7)).size).toBe(15);
  });
});
