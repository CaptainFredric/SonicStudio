import type { EditorAction, EditorState } from '../editorTypes';
import {
  clearOutOfRangeTrackSliceReferences,
  clamp,
  commitProject,
  mergeTrackSource,
  normalizeSliceMemory,
  remapTrackSampleSlices,
  sanitizeActiveSampleSlice,
} from './reducerUtils';
import { updateTrack } from '../projectMutations';

export const handleTrackSourceAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'SET_TRACK_NAME': {
      const nextName = action.name.trim();
      if (!nextName) {
        return state;
      }

      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        nextName === track.name ? track : { ...track, name: nextName }
      )));
    }

    case 'SET_TRACK_PARAMS':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        params: {
          ...track.params,
          ...action.params,
        },
      })));

    case 'SET_TRACK_SOURCE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const mergedTrack = mergeTrackSource(track, action.source);

        if (Array.isArray(action.source.sampleSlices)) {
          return clearOutOfRangeTrackSliceReferences(mergedTrack, mergedTrack.source.sampleSlices.length);
        }

        return mergedTrack;
      }));

    case 'SELECT_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        source: {
          ...track.source,
          activeSampleSlice: action.sliceIndex !== null
            && action.sliceIndex >= 0
            && action.sliceIndex < track.source.sampleSlices.length
            ? action.sliceIndex
            : null,
        },
      })));

    case 'CREATE_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextSliceIndex = track.source.sampleSlices.length;
        if (nextSliceIndex >= 8) {
          return track;
        }

        const nextSlice = normalizeSliceMemory(
          action.slice ?? {
            end: track.source.sampleEnd,
            gain: track.source.sampleGain,
            reverse: track.source.sampleReverse,
            start: track.source.sampleStart,
          },
          `Slice ${nextSliceIndex + 1}`,
        );

        return {
          ...track,
          source: {
            ...track.source,
            activeSampleSlice: nextSliceIndex,
            sampleSlices: [...track.source.sampleSlices, nextSlice],
          },
        };
      }));

    case 'UPDATE_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (!track.source.sampleSlices[action.sliceIndex]) {
          return track;
        }

        const nextSlices = track.source.sampleSlices.map((slice, index) => (
          index === action.sliceIndex
            ? normalizeSliceMemory({ ...slice, ...action.updates }, slice.label)
            : slice
        ));

        return {
          ...track,
          source: {
            ...track.source,
            activeSampleSlice: sanitizeActiveSampleSlice(track, nextSlices),
            sampleSlices: nextSlices,
          },
        };
      }));

    case 'DELETE_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (!track.source.sampleSlices[action.sliceIndex]) {
          return track;
        }

        const nextSlices = track.source.sampleSlices.filter((_, index) => index !== action.sliceIndex);
        const remappedTrack = remapTrackSampleSlices(track, (index) => {
          if (index === action.sliceIndex) {
            return null;
          }

          return index > action.sliceIndex ? index - 1 : index;
        });

        return {
          ...remappedTrack,
          source: {
            ...remappedTrack.source,
            activeSampleSlice: track.source.activeSampleSlice === action.sliceIndex
              ? (nextSlices[0] ? 0 : null)
              : typeof track.source.activeSampleSlice === 'number' && track.source.activeSampleSlice > action.sliceIndex
                ? track.source.activeSampleSlice - 1
                : sanitizeActiveSampleSlice(remappedTrack, nextSlices),
            sampleSlices: nextSlices,
          },
        };
      }));

    case 'TOGGLE_VOLUME':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextVolume = clamp(action.volume, -60, 6);
        return nextVolume === track.volume ? track : { ...track, volume: nextVolume };
      }));

    case 'TOGGLE_PAN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextPan = clamp(action.pan, -1, 1);
        return nextPan === track.pan ? track : { ...track, pan: nextPan };
      }));

    case 'TOGGLE_MUTE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        muted: !track.muted,
      })));

    case 'TOGGLE_SOLO':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        solo: !track.solo,
      })));

    default:
      return null;
  }
};
