import { describe, expect, it } from 'vitest';

import type { NoteEvent } from '../project/schema';
import { buildRunwayContinuation } from './runwayContinuation';

const note = (name: string, velocity = 0.8, gate = 1): NoteEvent => ({ note: name, velocity, gate });

describe('buildRunwayContinuation', () => {
  it('repeats the nearest note and preserves its expression', () => {
    const result = buildRunwayContinuation({
      count: 3,
      fallbackNote: 'C4',
      maxSteps: 32,
      startStep: 4,
      steps: [[note('E4', 0.61, 1.75)], [], [], []],
    });

    expect(result.nextLength).toBe(7);
    expect(result.addedCount).toBe(3);
    expect(result.steps.slice(4).map((step) => step[0])).toEqual([
      note('E4', 0.61, 1.75),
      note('E4', 0.61, 1.75),
      note('E4', 0.61, 1.75),
    ]);
  });

  it('uses the track fallback when the lane has no notes', () => {
    const result = buildRunwayContinuation({
      count: 2,
      fallbackNote: 'C2',
      maxSteps: 32,
      startStep: 4,
      steps: [[], [], [], []],
    });

    expect(result.steps[4][0].note).toBe('C2');
    expect(result.steps[5][0].note).toBe('C2');
  });

  it('uses an explicitly dragged pitch while retaining previous expression', () => {
    const result = buildRunwayContinuation({
      continuationNote: 'G4',
      count: 1,
      fallbackNote: 'C4',
      maxSteps: 16,
      startStep: 4,
      steps: [[note('E4', 0.55, 2)], [], [], []],
    });

    expect(result.steps[4][0]).toEqual(note('G4', 0.55, 2));
  });

  it('caps the continuation at the pattern limit', () => {
    const result = buildRunwayContinuation({
      count: 8,
      fallbackNote: 'C4',
      maxSteps: 6,
      startStep: 4,
      steps: [[note('G4')], [], [], []],
    });

    expect(result.nextLength).toBe(6);
    expect(result.addedCount).toBe(2);
    expect(result.steps).toHaveLength(6);
  });

  it('does not mutate source events or existing steps', () => {
    const source = note('A3', 0.7, 0.5);
    const steps = [[source], [], [], []];
    const result = buildRunwayContinuation({
      count: 1,
      fallbackNote: 'C4',
      maxSteps: 16,
      startStep: 4,
      steps,
    });

    result.steps[0][0].velocity = 0.1;
    result.steps[4][0].gate = 2;
    expect(source).toEqual(note('A3', 0.7, 0.5));
  });
});
