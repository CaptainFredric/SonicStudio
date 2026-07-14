import { describe, expect, it } from 'vitest';

import type { NoteEvent } from '../project/schema';
import {
  mapBeatAfterPatternColumnDelete,
  mapBeatAfterPatternColumnInsert,
  transformPatternColumn,
} from './patternColumnEditing';

const note = (pitch: string): NoteEvent => ({ gate: 1, note: pitch, velocity: 0.8 });

describe('transformPatternColumn', () => {
  it('moves notes and automation together while preserving hidden tail data', () => {
    const result = transformPatternColumn(
      [[note('C4')], [note('D4')], [note('E4')], [note('F4')]],
      { level: [0.1, 0.2, 0.3, 0.4], tone: [0.5, 0.6, 0.7, 0.8] },
      'move-left',
      2,
      3,
    );

    expect(result.steps.map((step) => step[0]?.note)).toEqual(['C4', 'E4', 'D4', 'F4']);
    expect(result.automation.level).toEqual([0.1, 0.3, 0.2, 0.4]);
    expect(result.automation.tone).toEqual([0.5, 0.7, 0.6, 0.8]);
    expect(result.changed).toBe(true);
  });

  it('clears one column without changing its length', () => {
    const result = transformPatternColumn(
      [[note('C4')], [note('D4')], []],
      { level: [0.5, 0.8, 0.5], tone: [0.5, 0.2, 0.5] },
      'clear',
      1,
      3,
    );

    expect(result.steps).toEqual([[note('C4')], [], []]);
    expect(result.automation).toEqual({ level: [0.5, 0.5, 0.5], tone: [0.5, 0.5, 0.5] });
  });

  it('deletes a column and closes the gap through hidden content', () => {
    const result = transformPatternColumn(
      [[note('C4')], [note('D4')], [note('E4')], [note('F4')]],
      { level: [0.1, 0.2, 0.3, 0.4], tone: [0.5, 0.6, 0.7, 0.8] },
      'delete',
      1,
      3,
    );

    expect(result.steps.map((step) => step[0]?.note)).toEqual(['C4', 'E4', 'F4']);
    expect(result.automation.level).toEqual([0.1, 0.3, 0.4]);
  });

  it('inserts blank time or duplicates the selected column after it', () => {
    const blank = transformPatternColumn(
      [[note('C4')], [note('D4')]],
      { level: [0.2, 0.8], tone: [0.3, 0.7] },
      'insert',
      0,
      2,
    );
    const duplicate = transformPatternColumn(
      [[note('C4')], [note('D4')]],
      { level: [0.2, 0.8], tone: [0.3, 0.7] },
      'duplicate',
      0,
      2,
    );

    expect(blank.steps).toEqual([[note('C4')], [], [note('D4')]]);
    expect(blank.automation.level).toEqual([0.2, 0.5, 0.8]);
    expect(duplicate.steps).toEqual([[note('C4')], [note('C4')], [note('D4')]]);
    expect(duplicate.steps[1][0]).not.toBe(duplicate.steps[0][0]);
    expect(duplicate.automation.tone).toEqual([0.3, 0.3, 0.7]);
  });
});

describe('pattern column timeline mapping', () => {
  it('compresses every pattern cycle around a deleted column', () => {
    expect(mapBeatAfterPatternColumnDelete(19, 19, 22)).toBe(19);
    expect(mapBeatAfterPatternColumnDelete(20, 19, 22)).toBe(19);
    expect(mapBeatAfterPatternColumnDelete(22, 19, 22)).toBe(21);
    expect(mapBeatAfterPatternColumnDelete(44, 19, 22)).toBe(42);
  });

  it('expands every pattern cycle after an inserted column', () => {
    expect(mapBeatAfterPatternColumnInsert(19, 19, 22)).toBe(19);
    expect(mapBeatAfterPatternColumnInsert(20, 19, 22)).toBe(21);
    expect(mapBeatAfterPatternColumnInsert(22, 19, 22)).toBe(23);
    expect(mapBeatAfterPatternColumnInsert(44, 19, 22)).toBe(46);
  });
});
