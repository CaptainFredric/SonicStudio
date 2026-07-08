import type { NoteEvent } from '../project/schema';

// Fill the steps a pattern gained when it was extended by repeating the
// material that was already there, the way GarageBand loops a region's
// content when you drag its edge out. Step oldLength + n copies step
// n % oldLength, so an 8-step riff extended to 32 plays four times instead
// of once followed by silence. Events are cloned so later edits to the
// copies never mutate the originals.
export const loopFillSteps = (
  steps: NoteEvent[][],
  oldLength: number,
  newLength: number,
): NoteEvent[][] => {
  const filled: NoteEvent[][] = [];
  for (let index = 0; index < newLength; index += 1) {
    if (index < oldLength) {
      filled.push(steps[index] ?? []);
      continue;
    }
    const source = oldLength > 0 ? steps[index % oldLength] ?? [] : [];
    filled.push(source.map((event) => ({ ...event })));
  }
  return filled;
};

// True when the pattern has anything to loop; extending an empty pattern
// with fill on should behave like a plain extend instead of copying silence.
export const hasLoopSource = (steps: NoteEvent[][], oldLength: number): boolean => (
  steps.slice(0, oldLength).some((step) => (step?.length ?? 0) > 0)
);
