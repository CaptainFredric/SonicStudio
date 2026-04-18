import type { EditorAction, EditorState } from '../editorTypes';
import {
  buildMasterSnapshotName,
  buildTrackSnapshotName,
  clamp,
  commitProject,
  resizeProjectTransport,
  resolveTrackVoicePreset,
  applyTrackVoicePresetDefinition,
  songLengthFromProject,
  syncSongMarkers,
} from './reducerUtils';
import { updateTrack } from '../projectMutations';

export const handleProjectAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'APPEND_BOUNCE_HISTORY':
      return commitProject(state, {
        ...present,
        bounceHistory: [action.entry, ...present.bounceHistory].slice(0, 12),
      });

    case 'APPLY_MASTER_SNAPSHOT': {
      const snapshot = present.masterSnapshots.find((candidate) => candidate.id === action.snapshotId);
      if (!snapshot) {
        return state;
      }

      return commitProject(state, {
        ...present,
        master: {
          ...snapshot.settings,
        },
      });
    }

    case 'APPLY_TRACK_VOICE_PRESET': {
      const track = present.tracks.find((candidate) => candidate.id === action.trackId);
      if (!track) {
        return state;
      }

      const preset = resolveTrackVoicePreset(track, action.presetId);
      if (!preset) {
        return state;
      }

      return commitProject(state, updateTrack(present, action.trackId, (candidate) => (
        applyTrackVoicePresetDefinition(candidate, preset)
      )));
    }

    case 'APPLY_TRACK_SNAPSHOT': {
      const track = present.tracks.find((candidate) => candidate.id === action.trackId);
      if (!track) {
        return state;
      }

      const snapshot = present.trackSnapshots.find((candidate) => candidate.id === action.snapshotId);
      if (!snapshot || snapshot.trackType !== track.type) {
        return state;
      }

      return commitProject(state, updateTrack(present, action.trackId, (candidate) => ({
        ...candidate,
        pan: snapshot.pan,
        params: { ...snapshot.params },
        source: { ...snapshot.source },
        volume: snapshot.volume,
      })));
    }

    case 'SET_PROJECT_NAME': {
      const nextName = action.name.trim();
      if (!nextName || nextName === present.metadata.name) {
        return state;
      }

      return commitProject(state, {
        ...present,
        metadata: {
          ...present.metadata,
          name: nextName,
        },
      });
    }

    case 'CREATE_SONG_MARKER': {
      const nextMarker = {
        beat: clamp(Math.round(action.beat), 0, Math.max(
          present.arrangerClips.reduce((maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength), present.transport.stepsPerPattern),
          present.transport.stepsPerPattern,
        )),
        id: `marker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: action.name?.trim() ? action.name.trim().slice(0, 24) : `Marker ${present.markers.length + 1}`,
      };

      return commitProject(state, {
        ...present,
        markers: syncSongMarkers([...present.markers, nextMarker], Math.max(songLengthFromProject(present), nextMarker.beat)),
      });
    }

    case 'UPDATE_SONG_MARKER':
      return commitProject(state, {
        ...present,
        markers: syncSongMarkers(
          present.markers.map((marker) => (
            marker.id === action.markerId
              ? {
                  ...marker,
                  ...action.updates,
                }
              : marker
          )),
          songLengthFromProject(present),
        ),
      });

    case 'REMOVE_SONG_MARKER':
      return commitProject(state, {
        ...present,
        markers: present.markers.filter((marker) => marker.id !== action.markerId),
      });

    case 'SET_TRANSPORT_MODE': {
      if (present.transport.mode === action.mode) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          mode: action.mode,
        },
      });
    }

    case 'SET_CURRENT_PATTERN': {
      const nextPattern = clamp(action.pattern, 0, present.transport.patternCount - 1);
      if (nextPattern === present.transport.currentPattern) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          currentPattern: nextPattern,
        },
      });
    }

    case 'SET_BPM': {
      const nextBpm = clamp(action.bpm, 40, 240);
      if (nextBpm === present.transport.bpm) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          bpm: nextBpm,
        },
      });
    }

    case 'SET_METRONOME_ENABLED': {
      if (present.transport.metronomeEnabled === action.enabled) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          metronomeEnabled: action.enabled,
        },
      });
    }

    case 'SET_COUNT_IN_BARS': {
      const nextBars = clamp(Math.round(action.bars), 0, 2);
      if (nextBars === present.transport.countInBars) {
        return state;
      }

      return commitProject(state, {
        ...present,
        transport: {
          ...present.transport,
          countInBars: nextBars,
        },
      });
    }

    case 'SET_MASTER_SETTINGS':
      return commitProject(state, {
        ...present,
        master: {
          ...present.master,
          ...action.settings,
        },
      });

    case 'SAVE_MASTER_SNAPSHOT': {
      const timestamp = new Date().toISOString();

      if (action.snapshotId) {
        const didUpdate = present.masterSnapshots.some((snapshot) => snapshot.id === action.snapshotId);
        if (!didUpdate) {
          return state;
        }

        return commitProject(state, {
          ...present,
          masterSnapshots: present.masterSnapshots.map((snapshot) => (
            snapshot.id === action.snapshotId
              ? {
                  ...snapshot,
                  settings: { ...present.master },
                  updatedAt: timestamp,
                }
              : snapshot
          )),
        });
      }

      return commitProject(state, {
        ...present,
        masterSnapshots: [
          ...present.masterSnapshots.slice(-7),
          {
            id: `master-snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: buildMasterSnapshotName(present),
            settings: { ...present.master },
            updatedAt: timestamp,
          },
        ],
      });
    }

    case 'SAVE_TRACK_SNAPSHOT': {
      const track = present.tracks.find((candidate) => candidate.id === action.trackId);
      if (!track) {
        return state;
      }

      const timestamp = new Date().toISOString();

      if (action.snapshotId) {
        const didUpdate = present.trackSnapshots.some((snapshot) => snapshot.id === action.snapshotId && snapshot.trackType === track.type);
        if (!didUpdate) {
          return state;
        }

        return commitProject(state, {
          ...present,
          trackSnapshots: present.trackSnapshots.map((snapshot) => (
            snapshot.id === action.snapshotId
              ? {
                  ...snapshot,
                  pan: track.pan,
                  params: { ...track.params },
                  source: { ...track.source },
                  updatedAt: timestamp,
                  volume: track.volume,
                }
              : snapshot
          )),
        });
      }

      return commitProject(state, {
        ...present,
        trackSnapshots: [
          ...present.trackSnapshots.slice(-15),
          {
            id: `track-snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: buildTrackSnapshotName(present, track),
            pan: track.pan,
            params: { ...track.params },
            source: { ...track.source },
            trackType: track.type,
            updatedAt: timestamp,
            volume: track.volume,
          },
        ],
      });
    }

    case 'SET_PATTERN_COUNT':
      return commitProject(state, resizeProjectTransport(present, action.patternCount, present.transport.stepsPerPattern));

    case 'SET_STEPS_PER_PATTERN':
      return commitProject(state, resizeProjectTransport(present, present.transport.patternCount, action.stepsPerPattern));

    case 'DELETE_MASTER_SNAPSHOT':
      return commitProject(state, {
        ...present,
        masterSnapshots: present.masterSnapshots.filter((snapshot) => snapshot.id !== action.snapshotId),
      });

    case 'DELETE_TRACK_SNAPSHOT':
      return commitProject(state, {
        ...present,
        trackSnapshots: present.trackSnapshots.filter((snapshot) => snapshot.id !== action.snapshotId),
      });

    default:
      return null;
  }
};
