import { createStepEvent, type NoteEvent } from '../project/schema';

interface RunwayContinuationOptions {
  continuationNote?: string;
  count: number;
  fallbackNote: string;
  maxSteps: number;
  startStep: number;
  steps: NoteEvent[][];
}

export interface RunwayContinuationResult {
  addedCount: number;
  nextLength: number;
  steps: NoteEvent[][];
}

const cloneStep = (step: NoteEvent[] | undefined): NoteEvent[] => (
  (step ?? []).map((event) => ({ ...event }))
);

const findPreviousEvent = (steps: NoteEvent[][], startStep: number): NoteEvent | null => {
  for (let index = Math.min(startStep, steps.length) - 1; index >= 0; index -= 1) {
    const event = steps[index]?.[0];
    if (event) return event;
  }
  return null;
};

// Extend a lane with repeated notes while preserving the nearest note's
// velocity, gate, and sample slice. The result is a complete cloned pattern so
// the UI can commit the gesture as one history entry.
export const buildRunwayContinuation = ({
  count,
  continuationNote,
  fallbackNote,
  maxSteps,
  startStep,
  steps,
}: RunwayContinuationOptions): RunwayContinuationResult => {
  const safeStart = Math.max(0, Math.min(Math.round(startStep), maxSteps));
  const nextLength = Math.max(safeStart, Math.min(maxSteps, safeStart + Math.max(0, Math.round(count))));
  const previous = findPreviousEvent(steps, safeStart);
  const source = previous
    ? createStepEvent(continuationNote ?? previous.note, previous)
    : createStepEvent(continuationNote ?? fallbackNote);
  const nextSteps = Array.from({ length: nextLength }, (_, index) => cloneStep(steps[index]));

  for (let index = safeStart; index < nextLength; index += 1) {
    if (nextSteps[index].length === 0) {
      nextSteps[index] = [{ ...source }];
    }
  }

  return {
    addedCount: Math.max(0, nextLength - safeStart),
    nextLength,
    steps: nextSteps,
  };
};
