import type { NoteEvent } from '../project/schema';

const cloneStep = (step: NoteEvent[]) => step.map((event) => ({ ...event }));

export const copyPatternRange = (
  steps: NoteEvent[][],
  start: number,
  end: number,
): NoteEvent[][] => Array.from(
  { length: Math.max(0, end - start + 1) },
  (_, offset) => cloneStep(steps[start + offset] ?? []),
);

export const writePatternRange = (
  steps: NoteEvent[][],
  source: NoteEvent[][],
  targetStart: number,
  totalSteps: number,
): NoteEvent[][] => Array.from({ length: totalSteps }, (_, index) => (
  index >= targetStart && index < targetStart + source.length
    ? cloneStep(source[index - targetStart] ?? [])
    : cloneStep(steps[index] ?? [])
));

export const clearPatternRange = (
  steps: NoteEvent[][],
  start: number,
  end: number,
  totalSteps: number,
): NoteEvent[][] => Array.from({ length: totalSteps }, (_, index) => (
  index >= start && index <= end ? [] : cloneStep(steps[index] ?? [])
));
