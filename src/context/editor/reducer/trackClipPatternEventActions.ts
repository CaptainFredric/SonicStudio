import {
  createEmptyPattern,
  createStepEvent,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  cloneStepEvents,
  commitProject,
  compareNotesDescending,
} from './reducerUtils';
import {
  getUniqueClipPatternProject,
  updateTrack,
} from '../projectMutations';

export const handleTrackClipPatternEventAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'UPDATE_CLIP_PATTERN_STEP_EVENT': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => {
        const currentPattern = candidate.patterns[clip.patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return candidate;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep.sort((left, right) => compareNotesDescending(left.note, right.note));

        return {
          ...candidate,
          patterns: {
            ...candidate.patterns,
            [clip.patternIndex]: nextSteps,
          },
        };
      });

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    default:
      return null;
  }
};
