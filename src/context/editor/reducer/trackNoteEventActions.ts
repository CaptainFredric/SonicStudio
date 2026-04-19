import {
  createEmptyPattern,
  createStepEvent,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  cloneStepEvents,
  commitProject,
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

export const handleTrackNoteEventAction = (state: EditorState, action: EditorAction): EditorState | null => {
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

    default:
      return null;
  }
};
