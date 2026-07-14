import { type ArrangementClip } from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  duplicateArrangerClipProject,
  makeClipPatternUniqueProject,
  splitArrangerClipProject,
  syncArrangerClips,
} from '../projectMutations';
import { buildSongFormProject } from '../songFormBuilder';
import {
  clearSongRange,
  deleteSongRange,
  duplicateSongRange,
  insertBlankSongSection,
  insertSavedSongSection,
  removeSavedSongSection,
  renameSavedSongSection,
  saveSongRange,
} from '../songSectionEditing';
import {
  ARRANGER_SNAP,
  commitProject,
  updateStepPattern,
} from './reducerUtils';

const withInsertedLoopTime = (
  state: EditorState,
  nextState: EditorState,
  atBeat: number,
  beatLength: number,
): EditorState => {
  const { loopRangeEndBeat, loopRangeStartBeat } = state.ui;
  if (loopRangeStartBeat === null || loopRangeEndBeat === null || nextState === state) return nextState;

  return {
    ...nextState,
    ui: {
      ...nextState.ui,
      loopRangeEndBeat: loopRangeEndBeat > atBeat ? loopRangeEndBeat + beatLength : loopRangeEndBeat,
      loopRangeStartBeat: loopRangeStartBeat >= atBeat ? loopRangeStartBeat + beatLength : loopRangeStartBeat,
    },
  };
};

const withDeletedLoopTime = (
  state: EditorState,
  nextState: EditorState,
  startBeat: number,
  endBeat: number,
): EditorState => {
  const { loopRangeEndBeat, loopRangeStartBeat } = state.ui;
  if (loopRangeStartBeat === null || loopRangeEndBeat === null || nextState === state) return nextState;
  const length = Math.max(0, endBeat - startBeat);
  const overlaps = loopRangeStartBeat < endBeat && loopRangeEndBeat > startBeat;

  return {
    ...nextState,
    ui: {
      ...nextState.ui,
      loopRangeEndBeat: overlaps ? null : loopRangeEndBeat >= endBeat ? loopRangeEndBeat - length : loopRangeEndBeat,
      loopRangeStartBeat: overlaps ? null : loopRangeStartBeat >= endBeat ? loopRangeStartBeat - length : loopRangeStartBeat,
    },
  };
};

export const handleArrangerAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'APPLY_SONG_FORM': {
      const result = buildSongFormProject(present, action.formId);
      if (!result) {
        return state;
      }

      return commitProject(
        state,
        result.project,
        result.selectedTrackId,
        result.selectedArrangerClipId,
      );
    }

    case 'DUPLICATE_SONG_RANGE': {
      const nextState = commitProject(
        state,
        duplicateSongRange(present, action.startBeat, action.endBeat, action.label),
      );
      return withInsertedLoopTime(state, nextState, action.endBeat, Math.max(0, action.endBeat - action.startBeat));
    }

    case 'INSERT_BLANK_SONG_SECTION': {
      const nextState = commitProject(
        state,
        insertBlankSongSection(present, action.atBeat, action.beatLength, action.name),
      );
      return withInsertedLoopTime(state, nextState, action.atBeat, action.beatLength);
    }

    case 'CLEAR_SONG_RANGE':
      return commitProject(state, clearSongRange(present, action.startBeat, action.endBeat));

    case 'DELETE_SONG_RANGE': {
      const nextState = commitProject(state, deleteSongRange(present, action.startBeat, action.endBeat));
      return withDeletedLoopTime(state, nextState, action.startBeat, action.endBeat);
    }

    case 'SAVE_SONG_RANGE':
      return commitProject(state, saveSongRange(present, action.startBeat, action.endBeat, action.name));

    case 'INSERT_SAVED_SONG_SECTION': {
      const section = present.savedSongSections.find((candidate) => candidate.id === action.savedSectionId);
      const nextState = commitProject(
        state,
        insertSavedSongSection(present, action.savedSectionId, action.atBeat),
      );
      return section
        ? withInsertedLoopTime(state, nextState, action.atBeat, section.beatLength)
        : nextState;
    }

    case 'REMOVE_SAVED_SONG_SECTION':
      return commitProject(state, removeSavedSongSection(present, action.savedSectionId));

    case 'RENAME_SAVED_SONG_SECTION':
      return commitProject(state, renameSavedSongSection(present, action.savedSectionId, action.name));

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

    case 'PLACE_SONG_STEP': {
      const track = present.tracks.find((candidate) => candidate.id === action.trackId);
      if (!track) {
        return state;
      }
      const stepsPer = present.transport.stepsPerPattern;
      // Resolve the clicked song step to a clip that already covers it.
      const covering = present.arrangerClips
        .filter((clip) => clip.trackId === action.trackId)
        .find((clip) => action.songStep >= clip.startBeat && action.songStep < clip.startBeat + clip.beatLength);

      let patternIndex: number;
      let localStep: number;
      let clips = present.arrangerClips;
      let newClipId: string | undefined;

      if (covering) {
        patternIndex = covering.patternIndex;
        localStep = (action.songStep - covering.startBeat) % stepsPer;
      } else {
        // No clip here yet: drop a one-pattern clip on the bar the user clicked
        // (snapped to the pattern grid) using the current pattern, so the note
        // has somewhere to live and the song grows to meet the click.
        patternIndex = present.transport.currentPattern;
        const startBeat = Math.floor(action.songStep / stepsPer) * stepsPer;
        localStep = action.songStep - startBeat;
        newClipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        clips = [
          ...present.arrangerClips,
          { beatLength: stepsPer, id: newClipId, patternIndex, startBeat, trackId: action.trackId } satisfies ArrangementClip,
        ];
      }

      const nextTracks = present.tracks.map((candidate) => (
        candidate.id === action.trackId
          ? updateStepPattern(candidate, patternIndex, stepsPer, localStep, action.note)
          : candidate
      ));

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(clips, nextTracks, present.transport.patternCount),
        tracks: nextTracks,
      }, action.trackId, newClipId);
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
