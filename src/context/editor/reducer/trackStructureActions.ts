import {
  createTrack as buildTrack,
  duplicateTrack as buildDuplicateTrack,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  commitProject,
  moveItem,
} from './reducerUtils';
import { syncArrangerClips } from '../projectMutations';

export const handleTrackStructureAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'CREATE_TRACK': {
      const nextTrack = buildTrack(action.trackType, {
        patternCount: present.transport.patternCount,
        stepsPerPattern: present.transport.stepsPerPattern,
      });

      return commitProject(state, {
        ...present,
        arrangerClips: present.transport.mode === 'SONG'
          ? syncArrangerClips(
              [
                ...present.arrangerClips,
                {
                  beatLength: present.transport.stepsPerPattern,
                  id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  patternIndex: present.transport.currentPattern,
                  startBeat: 0,
                  trackId: nextTrack.id,
                },
              ],
              [...present.tracks, nextTrack],
              present.transport.patternCount,
            )
          : present.arrangerClips,
        tracks: [...present.tracks, nextTrack],
      }, nextTrack.id);
    }

    case 'DUPLICATE_TRACK': {
      const sourceTrack = present.tracks.find((track) => track.id === action.trackId);
      if (!sourceTrack) {
        return state;
      }

      const duplicatedTrack = buildDuplicateTrack(sourceTrack, present.transport);
      const duplicatedClips = present.arrangerClips
        .filter((clip) => clip.trackId === sourceTrack.id)
        .map((clip) => ({
          ...clip,
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          trackId: duplicatedTrack.id,
        }));

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [...present.arrangerClips, ...duplicatedClips],
          [...present.tracks, duplicatedTrack],
          present.transport.patternCount,
        ),
        tracks: [...present.tracks, duplicatedTrack],
      }, duplicatedTrack.id);
    }

    case 'MOVE_TRACK': {
      const sourceIndex = present.tracks.findIndex((track) => track.id === action.trackId);
      if (sourceIndex < 0) {
        return state;
      }

      const targetIndex = action.direction === 'up' ? sourceIndex - 1 : sourceIndex + 1;
      if (targetIndex < 0 || targetIndex >= present.tracks.length) {
        return state;
      }

      const nextTracks = moveItem(present.tracks, sourceIndex, targetIndex);

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips,
          nextTracks,
          present.transport.patternCount,
        ),
        tracks: nextTracks,
      });
    }

    case 'REMOVE_TRACK': {
      if (!present.tracks.some((track) => track.id === action.trackId)) {
        return state;
      }

      const nextTracks = present.tracks.filter((track) => track.id !== action.trackId);
      const nextSelectedTrackId = state.ui.selectedTrackId === action.trackId
        ? nextTracks[0]?.id ?? null
        : state.ui.selectedTrackId;

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips.filter((clip) => clip.trackId !== action.trackId),
          nextTracks,
          present.transport.patternCount,
        ),
        tracks: nextTracks,
      }, nextSelectedTrackId);
    }

    default:
      return null;
  }
};
