import { cloneProject } from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  ensurePinnedTrackIds,
  ensureSelectedTrackId,
  HISTORY_LIMIT,
} from './reducerUtils';

export const handleHistoryAction = (state: EditorState, action: EditorAction): EditorState | null => {
  switch (action.type) {
    case 'UNDO': {
      if (state.history.past.length === 0) {
        return state;
      }

      const previous = cloneProject(state.history.past[state.history.past.length - 1]);
      return {
        history: {
          future: [cloneProject(state.history.present), ...state.history.future].slice(0, HISTORY_LIMIT),
          past: state.history.past.slice(0, -1),
          present: previous,
        },
        ui: {
          ...state.ui,
          pinnedTrackIds: ensurePinnedTrackIds(previous, state.ui.pinnedTrackIds),
          selectedTrackId: ensureSelectedTrackId(previous, state.ui.selectedTrackId),
        },
      };
    }

    case 'REDO': {
      if (state.history.future.length === 0) {
        return state;
      }

      const [nextProject, ...remainingFuture] = state.history.future;
      const restoredProject = cloneProject(nextProject);

      return {
        history: {
          future: remainingFuture,
          past: [...state.history.past, cloneProject(state.history.present)].slice(-HISTORY_LIMIT),
          present: restoredProject,
        },
        ui: {
          ...state.ui,
          pinnedTrackIds: ensurePinnedTrackIds(restoredProject, state.ui.pinnedTrackIds),
          selectedTrackId: ensureSelectedTrackId(restoredProject, state.ui.selectedTrackId),
        },
      };
    }

    default:
      return null;
  }
};
