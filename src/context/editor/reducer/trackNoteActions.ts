import {
  createEmptyPattern,
  createStepEvent,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  cloneStepEvents,
  commitProject,
  transposeNote,
  updatePatternSteps,
  updateStepPattern,
} from './reducerUtils';
import { updateTrack } from '../projectMutations';

const updatePatternNoteEvent = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  stepIndex: number,
  noteIndex: number,
  updates: Parameters<typeof createStepEvent>[1],
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => {
    const currentPattern = track.patterns[patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);
    const targetStep = currentPattern[stepIndex];

    if (!targetStep || !targetStep[noteIndex]) {
      return track;
    }

    const nextSteps = [...currentPattern];
    const nextStep = cloneStepEvents(targetStep);
    const targetEvent = nextStep[noteIndex];
    nextStep[noteIndex] = createStepEvent(targetEvent.note, {
      ...targetEvent,
      ...updates,
    });
    nextSteps[stepIndex] = nextStep;

    return {
      ...track,
      patterns: {
        ...track.patterns,
        [patternIndex]: nextSteps,
      },
    };
  }));
};

export const handleTrackNoteAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'TOGGLE_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updateStepPattern(track, present.transport.currentPattern, present.transport.stepsPerPattern, action.stepIndex, action.note)
      )));

    case 'TOGGLE_PATTERN_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updateStepPattern(track, action.patternIndex, present.transport.stepsPerPattern, action.stepIndex, action.note)
      )));

    case 'UPDATE_STEP_EVENT':
      return updatePatternNoteEvent(
        state,
        action.trackId,
        present.transport.currentPattern,
        action.stepIndex,
        action.noteIndex,
        action.updates,
      );

    case 'UPDATE_PATTERN_STEP_EVENT':
      return updatePatternNoteEvent(
        state,
        action.trackId,
        action.patternIndex,
        action.stepIndex,
        action.noteIndex,
        action.updates,
      );

    case 'SHIFT_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, present.transport.currentPattern, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        })
      )));

    case 'SHIFT_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        })
      )));

    case 'TRANSPOSE_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        return updatePatternSteps(track, present.transport.currentPattern, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
      }));

    case 'TRANSPOSE_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        return updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
      }));

    case 'CLEAR_TRACK':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, present.transport.currentPattern, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ))
      )));

    case 'CLEAR_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ))
      )));

    default:
      return null;
  }
};
