import type { EditorAction, EditorState } from '../editorTypes';
import {
  clamp,
  commitProject,
  updateTrackAutomationPattern,
} from './reducerUtils';
import {
  getUniqueClipPatternProject,
  updateTrack,
} from '../projectMutations';

export const handleTrackAutomationAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'UPDATE_PATTERN_AUTOMATION_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updateTrackAutomationPattern(
          track,
          action.patternIndex,
          present.transport.stepsPerPattern,
          (patternAutomation) => ({
            ...patternAutomation,
            [action.lane]: patternAutomation[action.lane].map((entry, entryIndex) => (
              entryIndex === action.stepIndex
                ? clamp(action.value, 0, 1)
                : entry
            )),
          }),
        )
      )));

    case 'UPDATE_CLIP_PATTERN_AUTOMATION_STEP': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => (
        updateTrackAutomationPattern(
          candidate,
          clip.patternIndex,
          present.transport.stepsPerPattern,
          (patternAutomation) => ({
            ...patternAutomation,
            [action.lane]: patternAutomation[action.lane].map((entry, entryIndex) => (
              entryIndex === action.stepIndex
                ? clamp(action.value, 0, 1)
                : entry
            )),
          }),
        )
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    default:
      return null;
  }
};
