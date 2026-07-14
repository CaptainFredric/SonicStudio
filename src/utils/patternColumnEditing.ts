import type { NoteEvent, PatternAutomation } from '../project/schema';

export type PatternColumnOperation =
  | 'clear'
  | 'delete'
  | 'duplicate'
  | 'insert'
  | 'move-left'
  | 'move-right';

export interface PatternColumnTransformResult {
  automation: PatternAutomation;
  changed: boolean;
  steps: NoteEvent[][];
}

const cloneStep = (step: NoteEvent[]) => step.map((event) => ({ ...event }));

const stepsMatch = (left: NoteEvent[], right: NoteEvent[]) => (
  left.length === right.length
  && left.every((event, index) => {
    const candidate = right[index];
    return candidate
      && candidate.gate === event.gate
      && candidate.note === event.note
      && candidate.sampleSliceIndex === event.sampleSliceIndex
      && candidate.velocity === event.velocity;
  })
);

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
};

export const transformPatternColumn = (
  steps: NoteEvent[][],
  automation: PatternAutomation | undefined,
  operation: PatternColumnOperation,
  stepIndex: number,
  visibleStepCount: number,
): PatternColumnTransformResult => {
  const columnIndex = Math.max(0, Math.min(visibleStepCount - 1, Math.round(stepIndex)));
  const preservedLength = Math.max(
    visibleStepCount,
    steps.length,
    automation?.level.length ?? 0,
    automation?.tone.length ?? 0,
  );
  const nextSteps = Array.from({ length: preservedLength }, (_, index) => cloneStep(steps[index] ?? []));
  const level = Array.from({ length: preservedLength }, (_, index) => automation?.level[index] ?? 0.5);
  const tone = Array.from({ length: preservedLength }, (_, index) => automation?.tone[index] ?? 0.5);

  if (operation === 'clear') {
    const changed = nextSteps[columnIndex].length > 0 || level[columnIndex] !== 0.5 || tone[columnIndex] !== 0.5;
    nextSteps[columnIndex] = [];
    level[columnIndex] = 0.5;
    tone[columnIndex] = 0.5;
    return { automation: { level, tone }, changed, steps: nextSteps };
  }

  if (operation === 'delete') {
    nextSteps.splice(columnIndex, 1);
    level.splice(columnIndex, 1);
    tone.splice(columnIndex, 1);
    return { automation: { level, tone }, changed: true, steps: nextSteps };
  }

  if (operation === 'insert' || operation === 'duplicate') {
    const insertionIndex = columnIndex + 1;
    nextSteps.splice(insertionIndex, 0, operation === 'duplicate' ? cloneStep(nextSteps[columnIndex]) : []);
    level.splice(insertionIndex, 0, operation === 'duplicate' ? level[columnIndex] : 0.5);
    tone.splice(insertionIndex, 0, operation === 'duplicate' ? tone[columnIndex] : 0.5);
    return { automation: { level, tone }, changed: true, steps: nextSteps };
  }

  const targetIndex = operation === 'move-left' ? columnIndex - 1 : columnIndex + 1;
  if (targetIndex < 0 || targetIndex >= visibleStepCount) {
    return { automation: { level, tone }, changed: false, steps: nextSteps };
  }

  const changed = !stepsMatch(nextSteps[columnIndex], nextSteps[targetIndex])
    || level[columnIndex] !== level[targetIndex]
    || tone[columnIndex] !== tone[targetIndex];
  moveItem(nextSteps, columnIndex, targetIndex);
  moveItem(level, columnIndex, targetIndex);
  moveItem(tone, columnIndex, targetIndex);
  return { automation: { level, tone }, changed, steps: nextSteps };
};

export const mapBeatAfterPatternColumnDelete = (
  beat: number,
  stepIndex: number,
  oldStepCount: number,
): number => {
  const safeBeat = Math.max(0, Math.round(beat));
  const cycle = Math.floor(safeBeat / oldStepCount);
  const localBeat = safeBeat % oldStepCount;
  return (cycle * (oldStepCount - 1)) + localBeat - (localBeat > stepIndex ? 1 : 0);
};

export const mapBeatAfterPatternColumnInsert = (
  beat: number,
  stepIndex: number,
  oldStepCount: number,
): number => {
  const safeBeat = Math.max(0, Math.round(beat));
  const cycle = Math.floor(safeBeat / oldStepCount);
  const localBeat = safeBeat % oldStepCount;
  return (cycle * (oldStepCount + 1)) + localBeat + (localBeat > stepIndex ? 1 : 0);
};
