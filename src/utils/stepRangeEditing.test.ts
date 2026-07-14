import { describe, expect, it } from 'vitest';

import type { NoteEvent } from '../project/schema';
import { clearPatternRange, copyPatternRange, movePatternRange, writePatternRange } from './stepRangeEditing';

const note = (pitch: string): NoteEvent => ({ gate: 1, note: pitch, velocity: 0.8 });

describe('step range editing', () => {
  it('copies a phrase without retaining mutable event references', () => {
    const source = [[note('C4')], [], [note('E4')]];
    const copied = copyPatternRange(source, 0, 2);

    expect(copied).toEqual(source);
    expect(copied[0]).not.toBe(source[0]);
    expect(copied[0][0]).not.toBe(source[0][0]);
  });

  it('writes a copied phrase at a new position and grows empty space around it', () => {
    const result = writePatternRange([[note('C4')]], [[note('G4')], []], 2, 5);

    expect(result).toEqual([[note('C4')], [], [note('G4')], [], []]);
  });

  it('overwrites the target range while preserving steps outside it', () => {
    const result = writePatternRange(
      [[note('C4')], [note('D4')], [note('E4')]],
      [[note('A4')]],
      1,
      3,
    );

    expect(result).toEqual([[note('C4')], [note('A4')], [note('E4')]]);
  });

  it('clears notes without collapsing the pattern or mutating neighboring steps', () => {
    const source = [[note('C4')], [note('D4')], [note('E4')]];
    const result = clearPatternRange(source, 1, 2, 4);

    expect(result).toEqual([[note('C4')], [], [], []]);
    expect(result[0]).not.toBe(source[0]);
  });

  it('moves a phrase without duplicating its source notes', () => {
    const result = movePatternRange(
      [[note('C4')], [note('D4')], [], [note('G4')], []],
      0,
      1,
      2,
      5,
    );

    expect(result).toEqual([[], [], [note('C4')], [note('D4')], []]);
  });

  it('moves overlapping ranges from an immutable source copy', () => {
    const result = movePatternRange(
      [[note('C4')], [note('D4')], [note('E4')], [note('F4')]],
      0,
      2,
      1,
      4,
    );

    expect(result).toEqual([[], [note('C4')], [note('D4')], [note('E4')]]);
  });
});
