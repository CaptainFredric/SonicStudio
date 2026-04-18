import type { EditorAction, EditorState } from '../editorTypes';
import {
  ensurePinnedTrackIds,
  ensureSelectedArrangerClipId,
  ensureSelectedTrackId,
} from './reducerUtils';

export const handleUiAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'HYDRATE_SESSION':
      return {
        history: {
          future: [],
          past: [],
          present: action.session.project,
        },
        ui: {
          ...action.session.ui,
          pinnedTrackIds: ensurePinnedTrackIds(action.session.project, action.session.ui.pinnedTrackIds),
          selectedArrangerClipId: ensureSelectedArrangerClipId(action.session.project, action.session.ui.selectedArrangerClipId),
          selectedTrackId: ensureSelectedTrackId(action.session.project, action.session.ui.selectedTrackId),
        },
      };

    case 'SET_ACTIVE_VIEW':
      return state.ui.activeView === action.view
        ? state
        : { ...state, ui: { ...state.ui, activeView: action.view } };

    case 'TOGGLE_SETTINGS':
      return { ...state, ui: { ...state.ui, isSettingsOpen: !state.ui.isSettingsOpen } };

    case 'SET_SELECTED_TRACK_ID': {
      const nextSelectedTrackId = ensureSelectedTrackId(present, action.trackId);
      return nextSelectedTrackId === state.ui.selectedTrackId
        ? state
        : { ...state, ui: { ...state.ui, selectedTrackId: nextSelectedTrackId } };
    }

    case 'SET_SELECTED_ARRANGER_CLIP': {
      const nextSelectedClipId = ensureSelectedArrangerClipId(present, action.clipId);
      return nextSelectedClipId === state.ui.selectedArrangerClipId
        ? state
        : { ...state, ui: { ...state.ui, selectedArrangerClipId: nextSelectedClipId } };
    }

    case 'TOGGLE_PINNED_TRACK': {
      if (!present.tracks.some((track) => track.id === action.trackId)) {
        return state;
      }

      const pinnedTrackIds = state.ui.pinnedTrackIds.includes(action.trackId)
        ? state.ui.pinnedTrackIds.filter((trackId) => trackId !== action.trackId)
        : [...state.ui.pinnedTrackIds, action.trackId];

      return {
        ...state,
        ui: {
          ...state.ui,
          pinnedTrackIds,
        },
      };
    }

    case 'SET_LOOP_RANGE': {
      const nextStartBeat = action.startBeat !== null ? Math.max(0, Math.round(action.startBeat)) : null;
      const nextEndBeat = action.endBeat !== null ? Math.max(1, Math.round(action.endBeat)) : null;
      const hasValidRange = nextStartBeat !== null && nextEndBeat !== null && nextEndBeat > nextStartBeat;

      if (
        state.ui.loopRangeStartBeat === (hasValidRange ? nextStartBeat : null)
        && state.ui.loopRangeEndBeat === (hasValidRange ? nextEndBeat : null)
      ) {
        return state;
      }

      return {
        ...state,
        ui: {
          ...state.ui,
          loopRangeEndBeat: hasValidRange ? nextEndBeat : null,
          loopRangeStartBeat: hasValidRange ? nextStartBeat : null,
        },
      };
    }

    default:
      return null;
  }
};
