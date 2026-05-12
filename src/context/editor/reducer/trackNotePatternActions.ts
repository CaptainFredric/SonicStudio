import { createEmptyPattern } from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  cloneStepEvents,
  commitProject,
  transposeNote,
  updatePatternSteps,
} from './reducerUtils';
import { updateTrack } from '../projectMutations';

const shiftPattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  direction: 'left' | 'right',
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
      if (currentPattern.every((step) => step.length === 0)) {
        return currentPattern;
      }

      return direction === 'left'
        ? [...currentPattern.slice(1).map(cloneStepEvents), []]
        : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
    })
  )));
};

const transposePattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  semitones: number,
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => {
    if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
      return track;
    }

    return updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
      currentPattern.map((step) => (
        step.map((event) => ({ ...event, note: transposeNote(event.note, semitones) }))
      ))
    ));
  }));
};

const clearPattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
      currentPattern.some((step) => step.length > 0)
        ? createEmptyPattern(present.transport.stepsPerPattern)
        : currentPattern
    ))
  )));
};

const humanizePattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  amount: number,
) => {
  const { present } = state.history;
  const range = Math.max(0, Math.min(0.5, amount));

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
      let changed = false;
      const next = currentPattern.map((step) => (
        step.map((event) => {
          const jitter = (Math.random() - 0.5) * 2 * range;
          const nextVelocity = Math.max(0.18, Math.min(1, event.velocity + jitter));
          if (Math.abs(nextVelocity - event.velocity) < 0.01) return event;
          changed = true;
          return { ...event, velocity: nextVelocity };
        })
      ));
      return changed ? next : currentPattern;
    })
  )));
};

const stampChord = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  stepIndex: number,
  notes: string[],
  gate: number,
  velocity: number,
) => {
  const { present } = state.history;
  if (stepIndex < 0 || stepIndex >= present.transport.stepsPerPattern) return state;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
      const next = currentPattern.map(cloneStepEvents);
      const targetStep = next[stepIndex] ?? [];
      const existingNotes = new Set(targetStep.map((event) => event.note));
      notes.forEach((note) => {
        if (existingNotes.has(note)) return;
        targetStep.push({ note, velocity, gate });
      });
      next[stepIndex] = targetStep;
      return next;
    })
  )));
};

const moveNoteToStep = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  fromStepIndex: number,
  fromNoteIndex: number,
  toStepIndex: number,
  newGate?: number,
) => {
  const { present } = state.history;
  if (fromStepIndex === toStepIndex && newGate === undefined) return state;
  const stepsPerPattern = present.transport.stepsPerPattern;
  if (toStepIndex < 0 || toStepIndex >= stepsPerPattern) return state;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, stepsPerPattern, (currentPattern) => {
      const source = currentPattern[fromStepIndex];
      const event = source?.[fromNoteIndex];
      if (!event) return currentPattern;
      const next = currentPattern.map(cloneStepEvents);
      // Remove from source
      next[fromStepIndex] = next[fromStepIndex].filter((_, i) => i !== fromNoteIndex);
      // Add to destination (or update if a note with same pitch already there — replace to avoid collision)
      const destStep = next[toStepIndex].filter((existing) => existing.note !== event.note);
      destStep.push({ ...event, gate: newGate ?? event.gate });
      next[toStepIndex] = destStep;
      return next;
    })
  )));
};

export const handleTrackNotePatternAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'SHIFT_PATTERN':
      return shiftPattern(state, action.trackId, present.transport.currentPattern, action.direction);

    case 'SHIFT_PATTERN_AT':
      return shiftPattern(state, action.trackId, action.patternIndex, action.direction);

    case 'TRANSPOSE_PATTERN':
      return transposePattern(state, action.trackId, present.transport.currentPattern, action.semitones);

    case 'TRANSPOSE_PATTERN_AT':
      return transposePattern(state, action.trackId, action.patternIndex, action.semitones);

    case 'CLEAR_TRACK':
      return clearPattern(state, action.trackId, present.transport.currentPattern);

    case 'CLEAR_PATTERN_AT':
      return clearPattern(state, action.trackId, action.patternIndex);

    case 'HUMANIZE_PATTERN':
      return humanizePattern(state, action.trackId, action.patternIndex ?? present.transport.currentPattern, action.amount ?? 0.18);

    case 'MOVE_NOTE_TO_STEP':
      return moveNoteToStep(
        state,
        action.trackId,
        action.patternIndex ?? present.transport.currentPattern,
        action.fromStepIndex,
        action.fromNoteIndex,
        action.toStepIndex,
        action.newGate,
      );

    case 'STAMP_CHORD':
      return stampChord(
        state,
        action.trackId,
        action.patternIndex ?? present.transport.currentPattern,
        action.stepIndex,
        action.notes,
        action.gate ?? 1.25,
        action.velocity ?? 0.78,
      );

    default:
      return null;
  }
};
