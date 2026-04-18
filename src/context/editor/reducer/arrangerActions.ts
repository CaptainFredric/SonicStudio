import { type ArrangementClip } from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  duplicateArrangerClipProject,
  makeClipPatternUniqueProject,
  splitArrangerClipProject,
  syncArrangerClips,
} from '../projectMutations';
import {
  ARRANGER_SNAP,
  buildSongRangeDuplicate,
  commitProject,
} from './reducerUtils';

export const handleArrangerAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'DUPLICATE_SONG_RANGE':
      return commitProject(
        state,
        buildSongRangeDuplicate(present, action.startBeat, action.endBeat, action.label),
      );

    case 'DUPLICATE_ARRANGER_CLIP': {
      const mutation = duplicateArrangerClipProject(present, action.clipId);
      if (!mutation) {
        return state;
      }

      return commitProject(
        state,
        mutation.project,
        mutation.selectedTrackId,
        mutation.selectedArrangerClipId,
      );
    }

    case 'LOOP_ARRANGER_CLIP': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip) {
        return state;
      }

      const copies = Math.max(1, Math.min(8, Math.round(action.copies)));
      const loopedClips = Array.from({ length: copies }, (_, index) => ({
        ...sourceClip,
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        startBeat: sourceClip.startBeat + sourceClip.beatLength * (index + 1),
      } satisfies ArrangementClip));

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [...present.arrangerClips, ...loopedClips],
          present.tracks,
          present.transport.patternCount,
        ),
      }, sourceClip.trackId, sourceClip.id);
    }

    case 'MAKE_CLIP_PATTERN_UNIQUE': {
      const mutation = makeClipPatternUniqueProject(present, action.clipId);
      if (!mutation) {
        return state;
      }

      return commitProject(
        state,
        mutation.project,
        mutation.selectedTrackId,
        mutation.selectedArrangerClipId,
      );
    }

    case 'SPLIT_ARRANGER_CLIP': {
      const mutation = splitArrangerClipProject(present, action.clipId, action.splitAtBeat, ARRANGER_SNAP);
      if (!mutation) {
        return state;
      }

      return commitProject(
        state,
        mutation.project,
        mutation.selectedTrackId,
        mutation.selectedArrangerClipId,
      );
    }

    case 'ADD_ARRANGER_CLIP': {
      const targetTrackId = action.trackId
        ?? state.ui.selectedTrackId
        ?? present.tracks[0]?.id;

      if (!targetTrackId) {
        return state;
      }

      const laneTail = present.arrangerClips
        .filter((clip) => clip.trackId === targetTrackId)
        .reduce((maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength), 0);
      const nextClip = {
        beatLength: present.transport.stepsPerPattern,
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        patternIndex: present.transport.currentPattern,
        startBeat: laneTail,
        trackId: targetTrackId,
      } satisfies ArrangementClip;

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [
            ...present.arrangerClips,
            nextClip,
          ],
          present.tracks,
          present.transport.patternCount,
        ),
      }, targetTrackId, nextClip.id);
    }

    case 'REMOVE_ARRANGER_CLIP': {
      const nextArrangerClips = syncArrangerClips(
        present.arrangerClips.filter((clip) => clip.id !== action.clipId),
        present.tracks,
        present.transport.patternCount,
      );
      const fallbackClipId = nextArrangerClips[0]?.id ?? null;

      return commitProject(state, {
        ...present,
        arrangerClips: nextArrangerClips,
      }, state.ui.selectedTrackId, state.ui.selectedArrangerClipId === action.clipId ? fallbackClipId : state.ui.selectedArrangerClipId);
    }

    case 'UPDATE_ARRANGER_CLIP':
      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips.map((clip) => (
            clip.id === action.clipId ? { ...clip, ...action.updates } : clip
          )),
          present.tracks,
          present.transport.patternCount,
        ),
      }, state.ui.selectedTrackId, action.clipId);

    default:
      return null;
  }
};
