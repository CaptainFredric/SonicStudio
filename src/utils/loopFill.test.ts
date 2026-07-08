import { describe, expect, it } from 'vitest';

import { hasLoopSource, loopFillSteps } from './loopFill';
import type { NoteEvent } from '../project/schema';

const note = (name: string): NoteEvent => ({ note: name, velocity: 0.8, gate: 1 });

describe('loopFillSteps', () => {
  it('repeats the existing material across the new steps', () => {
    const steps = [[note('C4')], [], [note('E4')], []];
    const filled = loopFillSteps(steps, 4, 8);

    expect(filled).toHaveLength(8);
    expect(filled[4].map((event) => event.note)).toEqual(['C4']);
    expect(filled[5]).toEqual([]);
    expect(filled[6].map((event) => event.note)).toEqual(['E4']);
    expect(filled[7]).toEqual([]);
  });

  it('keeps looping when the extension is longer than the source', () => {
    const steps = [[note('C4')], []];
    const filled = loopFillSteps(steps, 2, 7);

    expect(filled.map((step) => step.length)).toEqual([1, 0, 1, 0, 1, 0, 1]);
  });

  it('clones events so edits to a copy leave the source alone', () => {
    const steps = [[note('C4')]];
    const filled = loopFillSteps(steps, 1, 2);

    filled[1][0].velocity = 0.1;
    expect(steps[0][0].velocity).toBe(0.8);
  });

  it('keeps the original steps untouched by reference', () => {
    const original = [note('C4')];
    const filled = loopFillSteps([original], 1, 3);

    expect(filled[0]).toBe(original);
  });

  it('handles sparse patterns and a zero-length source safely', () => {
    const sparse: NoteEvent[][] = [];
    sparse[1] = [note('D4')];
    expect(loopFillSteps(sparse, 2, 4)[3].map((event) => event.note)).toEqual(['D4']);
    expect(loopFillSteps([], 0, 3)).toEqual([[], [], []]);
  });
});

describe('hasLoopSource', () => {
  it('is true only when the existing span carries notes', () => {
    expect(hasLoopSource([[note('C4')], []], 2)).toBe(true);
    expect(hasLoopSource([[], []], 2)).toBe(false);
    expect(hasLoopSource([], 0)).toBe(false);
  });
});
