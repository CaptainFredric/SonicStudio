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

    default:
      return null;
  }
};
