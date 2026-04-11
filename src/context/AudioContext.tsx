import React, {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import { engine } from '../audio/ToneEngine';
import {
  cloneProject,
  createArrangerClip as buildArrangerClip,
  createEmptyPattern,
  createStepEvent,
  createTrack as buildTrack,
  defaultNoteForTrack,
  duplicateTrack as buildDuplicateTrack,
  MAX_PATTERN_COUNT,
  MAX_STEPS_PER_PATTERN,
  MIN_PATTERN_COUNT,
  MIN_STEPS_PER_PATTERN,
  resizeTrackPatterns,
  type ArrangementClip,
  type AppView,
  type InstrumentType,
  type MasterSettings,
  type NoteEvent,
  type Project,
  type SampleSliceMemory,
  type SessionTemplateId,
  type SongMarker,
  type StudioSession,
  type StudioUIState,
  type SynthParams,
  type Track,
  type TrackSource,
  type TransportMode,
} from '../project/schema';
import {
  createSessionFromTemplate,
  createDefaultSession,
  hydrateSessionPayload,
  loadPersistedSession,
  persistSession,
} from '../project/storage';
import {
  convertRecordingBlobToWav,
  downloadBlob,
  sanitizeExportFileName,
} from '../utils/export';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type RenderMode = 'mix' | 'stems' | null;
export type ExportScope = 'pattern' | 'song' | 'clip-window';

interface RenderState {
  active: boolean;
  currentTrackName: string | null;
  etaSeconds: number | null;
  mode: RenderMode;
  phase: string;
  progress: number;
}

const IDLE_RENDER_STATE: RenderState = {
  active: false,
  currentTrackName: null,
  etaSeconds: null,
  mode: null,
  phase: 'Idle',
  progress: 0,
};

interface AudioContextType {
  activeView: AppView;
  addArrangerClip: (trackId?: string) => void;
  arrangerClips: ArrangementClip[];
  bpm: number;
  canRedo: boolean;
  canUndo: boolean;
  clearPatternAt: (trackId: string, patternIndex: number) => void;
  clearTrack: (trackId: string) => void;
  createTrack: (trackType: InstrumentType) => void;
  createSampleSlice: (trackId: string, slice?: Partial<SampleSliceMemory>) => void;
  currentPattern: number;
  currentStep: number;
  duplicateArrangerClip: (clipId: string) => void;
  exportAudioMix: (scope?: ExportScope) => Promise<void>;
  exportTrackStems: (scope?: ExportScope) => Promise<void>;
  master: MasterSettings;
  loopArrangerClip: (clipId: string, copies: number) => void;
  makeClipPatternUnique: (clipId: string) => void;
  duplicateTrack: (trackId: string) => void;
  exportSession: () => void;
  importSession: (file: File) => Promise<boolean>;
  initAudio: () => Promise<void>;
  isInitialized: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  isSettingsOpen: boolean;
  lastSavedAt: string | null;
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  loadSessionTemplate: (templateId: SessionTemplateId) => void;
  newSession: () => void;
  patternCount: number;
  previewTrack: (trackId: string, note?: string, sampleSliceIndex?: number) => Promise<void>;
  projectName: string;
  redo: () => void;
  renderState: RenderState;
  removeArrangerClip: (clipId: string) => void;
  removeSongMarker: (markerId: string) => void;
  removeTrack: (trackId: string) => void;
  renameProject: (name: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  saveProject: () => void;
  saveStatus: SaveStatus;
  pinnedTrackIds: string[];
  selectedArrangerClipId: string | null;
  selectedTrackId: string | null;
  setSelectedArrangerClipId: (id: string | null) => void;
  shiftPattern: (trackId: string, direction: 'left' | 'right') => void;
  setActiveView: (view: AppView) => void;
  setBpm: (bpm: number) => void;
  setMasterSettings: (settings: Partial<MasterSettings>) => void;
  setCurrentPattern: (pattern: number) => void;
  setPatternCount: (patternCount: number) => void;
  setSelectedTrackId: (id: string | null) => void;
  setStepsPerPattern: (stepsPerPattern: number) => void;
  setTrackParams: (id: string, params: Partial<SynthParams>) => void;
  setTrackSource: (id: string, source: Partial<TrackSource>) => void;
  songMarkers: SongMarker[];
  setClipPatternStepSlice: (clipId: string, stepIndex: number, sliceIndex: number | null, note?: string) => void;
  setLoopRange: (startBeat: number | null, endBeat: number | null) => void;
  selectSampleSlice: (trackId: string, sliceIndex: number | null) => void;
  setTransportMode: (mode: TransportMode) => void;
  shiftPatternAt: (trackId: string, patternIndex: number, direction: 'left' | 'right') => void;
  songLengthInBeats: number;
  splitArrangerClip: (clipId: string, splitAtBeat?: number) => void;
  stepsPerPattern: number;
  stop: () => void;
  toggleClipPatternStep: (clipId: string, stepIndex: number, note?: string, mode?: 'add' | 'remove' | 'toggle') => void;
  toggleMute: (trackId: string) => void;
  togglePlay: () => void;
  togglePatternStep: (trackId: string, patternIndex: number, stepIndex: number, note?: string) => void;
  toggleRecording: () => Promise<void>;
  toggleSettings: () => void;
  toggleSolo: (trackId: string) => void;
  toggleStep: (trackId: string, stepIndex: number, note?: string) => void;
  tracks: Track[];
  createSongMarker: (beat: number, name?: string) => void;
  duplicateSongRange: (startBeat: number, endBeat: number, label?: string) => void;
  togglePinnedTrack: (trackId: string) => void;
  transformClipPattern: (clipId: string, transform: 'clear' | 'double-density' | 'halve-density' | 'randomize-velocity' | 'reset-automation' | 'shift-left' | 'shift-right' | 'transpose', value?: number) => void;
  transposePatternAt: (trackId: string, patternIndex: number, semitones: number) => void;
  transposePattern: (trackId: string, semitones: number) => void;
  transportMode: TransportMode;
  undo: () => void;
  updateArrangerClip: (clipId: string, updates: Partial<ArrangementClip>) => void;
  updateClipPatternAutomationStep: (clipId: string, stepIndex: number, lane: 'level' | 'tone', value: number) => void;
  updateClipPatternStepEvent: (clipId: string, stepIndex: number, noteIndex: number, updates: Partial<NoteEvent>) => void;
  updatePatternAutomationStep: (trackId: string, patternIndex: number, stepIndex: number, lane: 'level' | 'tone', value: number) => void;
  updatePatternStepEvent: (trackId: string, patternIndex: number, stepIndex: number, noteIndex: number, updates: Partial<NoteEvent>) => void;
  updateStepEvent: (trackId: string, stepIndex: number, noteIndex: number, updates: Partial<NoteEvent>) => void;
  updateSongMarker: (markerId: string, updates: Partial<Omit<SongMarker, 'id'>>) => void;
  updateSampleSlice: (trackId: string, sliceIndex: number, updates: Partial<SampleSliceMemory>) => void;
  updateTrackPan: (trackId: string, pan: number) => void;
  updateTrackVolume: (trackId: string, volume: number) => void;
  deleteSampleSlice: (trackId: string, sliceIndex: number) => void;
}

interface HistoryState {
  future: Project[];
  past: Project[];
  present: Project;
}

interface EditorState {
  history: HistoryState;
  ui: StudioUIState;
}

type EditorAction =
  | { type: 'ADD_ARRANGER_CLIP'; trackId?: string }
  | { type: 'CLEAR_TRACK'; trackId: string }
  | { type: 'CLEAR_PATTERN_AT'; trackId: string; patternIndex: number }
  | { type: 'CREATE_SONG_MARKER'; beat: number; name?: string }
  | { type: 'CREATE_TRACK'; trackType: InstrumentType }
  | { type: 'CREATE_SAMPLE_SLICE'; trackId: string; slice?: Partial<SampleSliceMemory> }
  | { type: 'DELETE_SAMPLE_SLICE'; trackId: string; sliceIndex: number }
  | { type: 'DUPLICATE_ARRANGER_CLIP'; clipId: string }
  | { type: 'DUPLICATE_SONG_RANGE'; endBeat: number; label?: string; startBeat: number }
  | { type: 'LOOP_ARRANGER_CLIP'; clipId: string; copies: number }
  | { type: 'MAKE_CLIP_PATTERN_UNIQUE'; clipId: string }
  | { type: 'SPLIT_ARRANGER_CLIP'; clipId: string; splitAtBeat?: number }
  | { type: 'DUPLICATE_TRACK'; trackId: string }
  | { type: 'HYDRATE_SESSION'; session: StudioSession }
  | { type: 'REDO' }
  | { type: 'REMOVE_ARRANGER_CLIP'; clipId: string }
  | { type: 'REMOVE_SONG_MARKER'; markerId: string }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'SET_SELECTED_ARRANGER_CLIP'; clipId: string | null }
  | { type: 'TOGGLE_PINNED_TRACK'; trackId: string }
  | { type: 'SHIFT_PATTERN'; direction: 'left' | 'right'; trackId: string }
  | { type: 'SHIFT_PATTERN_AT'; direction: 'left' | 'right'; trackId: string; patternIndex: number }
  | { type: 'SET_ACTIVE_VIEW'; view: AppView }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_LOOP_RANGE'; endBeat: number | null; startBeat: number | null }
  | { type: 'SET_MASTER_SETTINGS'; settings: Partial<MasterSettings> }
  | { type: 'SET_CURRENT_PATTERN'; pattern: number }
  | { type: 'SET_PATTERN_COUNT'; patternCount: number }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'SET_CLIP_PATTERN_STEP_SLICE'; clipId: string; note?: string; sliceIndex: number | null; stepIndex: number }
  | { type: 'SET_SELECTED_TRACK_ID'; trackId: string | null }
  | { type: 'SELECT_SAMPLE_SLICE'; trackId: string; sliceIndex: number | null }
  | { type: 'SET_STEPS_PER_PATTERN'; stepsPerPattern: number }
  | { type: 'SET_TRACK_NAME'; name: string; trackId: string }
  | { type: 'SET_TRACK_PARAMS'; params: Partial<SynthParams>; trackId: string }
  | { type: 'SET_TRACK_SOURCE'; source: Partial<TrackSource>; trackId: string }
  | { type: 'SET_TRANSPORT_MODE'; mode: TransportMode }
  | { type: 'TOGGLE_MUTE'; trackId: string }
  | { type: 'TOGGLE_PAN'; pan: number; trackId: string }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_SOLO'; trackId: string }
  | { type: 'TOGGLE_CLIP_PATTERN_STEP'; clipId: string; mode?: 'add' | 'remove' | 'toggle'; note?: string; stepIndex: number }
  | { type: 'TOGGLE_STEP'; note?: string; stepIndex: number; trackId: string }
  | { type: 'TOGGLE_PATTERN_STEP'; note?: string; stepIndex: number; trackId: string; patternIndex: number }
  | { type: 'TOGGLE_VOLUME'; trackId: string; volume: number }
  | { type: 'TRANSFORM_CLIP_PATTERN'; clipId: string; transform: 'clear' | 'double-density' | 'halve-density' | 'randomize-velocity' | 'reset-automation' | 'shift-left' | 'shift-right' | 'transpose'; value?: number }
  | { type: 'TRANSPOSE_PATTERN'; semitones: number; trackId: string }
  | { type: 'TRANSPOSE_PATTERN_AT'; semitones: number; trackId: string; patternIndex: number }
  | { type: 'UNDO' }
  | { type: 'UPDATE_ARRANGER_CLIP'; clipId: string; updates: Partial<ArrangementClip> }
  | { type: 'UPDATE_CLIP_PATTERN_AUTOMATION_STEP'; clipId: string; stepIndex: number; lane: 'level' | 'tone'; value: number }
  | { type: 'UPDATE_CLIP_PATTERN_STEP_EVENT'; clipId: string; noteIndex: number; stepIndex: number; updates: Partial<NoteEvent> }
  | { type: 'UPDATE_PATTERN_AUTOMATION_STEP'; trackId: string; patternIndex: number; stepIndex: number; lane: 'level' | 'tone'; value: number }
  | { type: 'UPDATE_PATTERN_STEP_EVENT'; noteIndex: number; stepIndex: number; trackId: string; patternIndex: number; updates: Partial<NoteEvent> }
  | { type: 'UPDATE_SONG_MARKER'; markerId: string; updates: Partial<Omit<SongMarker, 'id'>> }
  | { type: 'UPDATE_SAMPLE_SLICE'; trackId: string; sliceIndex: number; updates: Partial<SampleSliceMemory> }
  | { type: 'UPDATE_STEP_EVENT'; noteIndex: number; stepIndex: number; trackId: string; updates: Partial<NoteEvent> };

const AudioContext = createContext<AudioContextType | null>(null);
const HISTORY_LIMIT = 100;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ARRANGER_SNAP = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cloneStepEvents = (step: NoteEvent[]) => step.map((event) => ({ ...event }));
const compareNotesDescending = (left: string, right: string) => (
  (noteToMidi(right) ?? 0) - (noteToMidi(left) ?? 0)
);

const noteToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
};

const midiToNote = (midi: number): string => {
  const clampedMidi = clamp(Math.round(midi), 24, 96);
  const pitchClass = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${pitchClass}${octave}`;
};

const transposeNote = (note: string, semitones: number): string => {
  const midi = noteToMidi(note);
  if (midi === null) {
    return note;
  }

  return midiToNote(midi + semitones);
};

const syncArrangerClips = (
  arrangerClips: ArrangementClip[],
  tracks: Track[],
  patternCount: number,
): ArrangementClip[] => {
  if (arrangerClips.length === 0 || tracks.length === 0) {
    return [];
  }

  const trackOrder = new Map(tracks.map((track, index) => [track.id, index]));

  return arrangerClips
    .filter((clip) => trackOrder.has(clip.trackId))
    .map((clip) => ({
      ...clip,
      beatLength: clamp(Math.round(clip.beatLength || 16), 4, 128),
      patternIndex: clamp(Math.round(clip.patternIndex || 0), 0, Math.max(patternCount - 1, 0)),
      startBeat: clamp(Math.round(clip.startBeat || 0), 0, 4096),
    }))
    .sort((left, right) => {
      const leftTrackIndex = trackOrder.get(left.trackId) ?? 0;
      const rightTrackIndex = trackOrder.get(right.trackId) ?? 0;

      if (leftTrackIndex !== rightTrackIndex) {
        return leftTrackIndex - rightTrackIndex;
      }

      return left.startBeat - right.startBeat;
    });
};

const syncSongMarkers = (
  markers: SongMarker[],
  maxBeat: number,
): SongMarker[] => (
  markers
    .map((marker, index) => ({
      ...marker,
      beat: clamp(Math.round(marker.beat || 0), 0, Math.max(maxBeat, 0)),
      name: marker.name.trim() ? marker.name.trim().slice(0, 24) : `Marker ${index + 1}`,
    }))
    .sort((left, right) => left.beat - right.beat)
);

const createInitialEditorState = (): EditorState => {
  const session = loadPersistedSession() ?? createDefaultSession();

  return {
    history: {
      future: [],
      past: [],
      present: session.project,
    },
    ui: session.ui,
  };
};

const ensureSelectedTrackId = (project: Project, selectedTrackId: string | null) => {
  if (selectedTrackId && project.tracks.some((track) => track.id === selectedTrackId)) {
    return selectedTrackId;
  }

  return project.tracks[0]?.id ?? null;
};

const ensureSelectedArrangerClipId = (project: Project, selectedArrangerClipId: string | null) => {
  if (selectedArrangerClipId && project.arrangerClips.some((clip) => clip.id === selectedArrangerClipId)) {
    return selectedArrangerClipId;
  }

  return project.arrangerClips[0]?.id ?? null;
};

const ensurePinnedTrackIds = (project: Project, pinnedTrackIds: string[]) => (
  pinnedTrackIds.filter((trackId, index) => (
    project.tracks.some((track) => track.id === trackId)
    && pinnedTrackIds.indexOf(trackId) === index
  ))
);

const songLengthFromProject = (project: Project) => (
  project.arrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    project.transport.stepsPerPattern,
  )
);

const buildSongRangeDuplicate = (
  project: Project,
  startBeat: number,
  endBeat: number,
  label?: string,
): Project => {
  const normalizedStartBeat = clamp(Math.round(startBeat), 0, songLengthFromProject(project));
  const normalizedEndBeat = clamp(Math.round(endBeat), normalizedStartBeat + 1, songLengthFromProject(project));
  const rangeLength = normalizedEndBeat - normalizedStartBeat;

  if (rangeLength <= 0) {
    return project;
  }

  const duplicateClips = project.arrangerClips.flatMap((clip) => {
    const clipStart = clip.startBeat;
    const clipEnd = clip.startBeat + clip.beatLength;
    const overlapStart = Math.max(clipStart, normalizedStartBeat);
    const overlapEnd = Math.min(clipEnd, normalizedEndBeat);

    if (overlapEnd <= overlapStart) {
      return [];
    }

    return [{
      ...clip,
      beatLength: overlapEnd - overlapStart,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      startBeat: normalizedEndBeat + (overlapStart - normalizedStartBeat),
    }];
  });

  if (duplicateClips.length === 0) {
    return project;
  }

  const duplicatedMarkers = project.markers
    .filter((marker) => marker.beat >= normalizedStartBeat && marker.beat < normalizedEndBeat)
    .map((marker) => ({
      ...marker,
      beat: normalizedEndBeat + (marker.beat - normalizedStartBeat),
      id: `marker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: label ? `${label} Copy` : `${marker.name} Copy`,
    }));

  return {
    ...project,
    arrangerClips: syncArrangerClips(
      [...project.arrangerClips, ...duplicateClips],
      project.tracks,
      project.transport.patternCount,
    ),
    markers: syncSongMarkers(
      [...project.markers, ...duplicatedMarkers],
      Math.max(songLengthFromProject(project), normalizedEndBeat + rangeLength),
    ),
  };
};

const stampProjectUpdate = (project: Project): Project => ({
  ...project,
  metadata: {
    ...project.metadata,
    updatedAt: new Date().toISOString(),
  },
});

const commitProject = (
  state: EditorState,
  nextProject: Project,
  selectedTrackId: string | null = state.ui.selectedTrackId,
  selectedArrangerClipId: string | null = state.ui.selectedArrangerClipId,
): EditorState => {
  if (nextProject === state.history.present) {
    return state;
  }

  const nextPast = [...state.history.past, cloneProject(state.history.present)].slice(-HISTORY_LIMIT);

  return {
    history: {
      future: [],
      past: nextPast,
      present: stampProjectUpdate(nextProject),
    },
    ui: {
      ...state.ui,
      pinnedTrackIds: ensurePinnedTrackIds(nextProject, state.ui.pinnedTrackIds),
      selectedArrangerClipId: ensureSelectedArrangerClipId(nextProject, selectedArrangerClipId),
      selectedTrackId: ensureSelectedTrackId(nextProject, selectedTrackId),
    },
  };
};

const getClipContext = (project: Project, clipId: string) => {
  const clip = project.arrangerClips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    return null;
  }

  const track = project.tracks.find((candidate) => candidate.id === clip.trackId);
  if (!track) {
    return null;
  }

  return { clip, track };
};

const getUniqueClipPatternProject = (
  project: Project,
  clipId: string,
): { clip: ArrangementClip; project: Project; track: Track } | null => {
  const context = getClipContext(project, clipId);
  if (!context) {
    return null;
  }

  const { clip, track } = context;
  const linkedClips = project.arrangerClips.filter((candidate) => (
    candidate.trackId === clip.trackId
    && candidate.patternIndex === clip.patternIndex
  ));

  if (linkedClips.length <= 1) {
    return { clip, project, track };
  }

  const occupiedPatternIndices = new Set(
    project.arrangerClips
      .filter((candidate) => candidate.trackId === track.id && candidate.id !== clip.id)
      .map((candidate) => candidate.patternIndex),
  );
  const nextPatternIndex = Array.from(
    { length: project.transport.patternCount },
    (_, patternIndex) => patternIndex,
  ).find((patternIndex) => !occupiedPatternIndices.has(patternIndex) && patternIndex !== clip.patternIndex);

  if (nextPatternIndex === undefined) {
    return { clip, project, track };
  }

  const nextProject = updateTrack(project, track.id, (candidate) => {
    const sourcePattern = candidate.patterns[clip.patternIndex] ?? createEmptyPattern(project.transport.stepsPerPattern);
    const sourceAutomation = candidate.automation?.[clip.patternIndex] ?? {
      level: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
      tone: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
    };

    return {
      ...candidate,
      automation: {
        ...candidate.automation,
        [nextPatternIndex]: {
          level: [...sourceAutomation.level],
          tone: [...sourceAutomation.tone],
        },
      },
      patterns: {
        ...candidate.patterns,
        [nextPatternIndex]: sourcePattern.map(cloneStepEvents),
      },
    };
  });

  const retargetedProject = {
    ...nextProject,
    arrangerClips: syncArrangerClips(
      nextProject.arrangerClips.map((candidate) => (
        candidate.id === clip.id ? { ...candidate, patternIndex: nextPatternIndex } : candidate
      )),
      nextProject.tracks,
      nextProject.transport.patternCount,
    ),
  };

  const nextContext = getClipContext(retargetedProject, clipId);
  return nextContext ? { ...nextContext, project: retargetedProject } : null;
};

const updateTrack = (
  project: Project,
  trackId: string,
  updater: (track: Track) => Track,
): Project => {
  let didChange = false;
  const tracks = project.tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }

    const nextTrack = updater(track);
    if (nextTrack !== track) {
      didChange = true;
    }

    return nextTrack;
  });

  return didChange ? { ...project, tracks } : project;
};

const clampSliceValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeSliceMemory = (
  slice: Partial<SampleSliceMemory> | undefined,
  fallbackLabel: string,
): SampleSliceMemory => {
  const start = clampSliceValue(slice?.start ?? 0, 0, 0.95);
  const requestedEnd = clampSliceValue(slice?.end ?? 1, 0.05, 1);

  return {
    end: Math.max(start + 0.05, requestedEnd),
    gain: clampSliceValue(slice?.gain ?? 1, 0.25, 2),
    label: typeof slice?.label === 'string' && slice.label.trim()
      ? slice.label.trim().slice(0, 16)
      : fallbackLabel,
    reverse: Boolean(slice?.reverse),
    start,
  };
};

const sanitizeActiveSampleSlice = (track: Track, slices: SampleSliceMemory[]) => {
  const { activeSampleSlice } = track.source;

  if (typeof activeSampleSlice !== 'number') {
    return null;
  }

  return activeSampleSlice >= 0 && activeSampleSlice < slices.length ? activeSampleSlice : null;
};

const remapTrackSampleSlices = (
  track: Track,
  remapIndex: (index: number) => number | null,
): Track => ({
  ...track,
  patterns: Object.fromEntries(
    Object.entries(track.patterns).map(([patternIndex, patternSteps]) => ([
      patternIndex,
      patternSteps.map((step) => (
        step.map((event) => {
          if (typeof event.sampleSliceIndex !== 'number') {
            return event;
          }

          const nextSliceIndex = remapIndex(event.sampleSliceIndex);
          if (nextSliceIndex === null) {
            const { sampleSliceIndex: _removed, ...rest } = event;
            return rest;
          }

          return {
            ...event,
            sampleSliceIndex: nextSliceIndex,
          };
        })
      )),
    ])),
  ) as Track['patterns'],
});

const clearOutOfRangeTrackSliceReferences = (
  track: Track,
  sliceCount: number,
): Track => remapTrackSampleSlices(track, (index) => (index >= 0 && index < sliceCount ? index : null));

const mergeTrackSource = (
  track: Track,
  source: Partial<TrackSource>,
): Track => {
  const nextSource = {
    ...track.source,
    ...source,
  };
  const sampleSlices = Array.isArray(nextSource.sampleSlices)
    ? nextSource.sampleSlices
        .slice(0, 8)
        .map((slice, index) => normalizeSliceMemory(slice, `Slice ${index + 1}`))
    : track.source.sampleSlices;
  const activeSampleSlice = nextSource.activeSampleSlice === null
    ? null
    : typeof nextSource.activeSampleSlice === 'number'
      ? (nextSource.activeSampleSlice >= 0 && nextSource.activeSampleSlice < sampleSlices.length
          ? nextSource.activeSampleSlice
          : null)
      : sanitizeActiveSampleSlice({ ...track, source: nextSource }, sampleSlices);

  return {
    ...track,
    source: {
      ...nextSource,
      activeSampleSlice,
      sampleSlices,
    },
  };
};

const resizeProjectTransport = (
  project: Project,
  patternCount: number,
  stepsPerPattern: number,
): Project => {
  const nextPatternCount = clamp(patternCount, MIN_PATTERN_COUNT, MAX_PATTERN_COUNT);
  const nextStepsPerPattern = clamp(stepsPerPattern, MIN_STEPS_PER_PATTERN, MAX_STEPS_PER_PATTERN);

  if (
    nextPatternCount === project.transport.patternCount
    && nextStepsPerPattern === project.transport.stepsPerPattern
  ) {
    return project;
  }

  const tracks = project.tracks.map((track) => (
    resizeTrackPatterns(track, nextPatternCount, nextStepsPerPattern)
  ));

  return {
    ...project,
    arrangerClips: syncArrangerClips(project.arrangerClips, tracks, nextPatternCount),
    tracks,
    transport: {
      ...project.transport,
      currentPattern: clamp(project.transport.currentPattern, 0, nextPatternCount - 1),
      patternCount: nextPatternCount,
      stepsPerPattern: nextStepsPerPattern,
    },
  };
};

const updatePatternSteps = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  updater: (pattern: NoteEvent[][]) => NoteEvent[][],
): Track => {
  const currentPattern = track.patterns[patternIndex] ?? createEmptyPattern(stepsPerPattern);
  const nextPattern = updater(currentPattern.map(cloneStepEvents));

  return {
    ...track,
    patterns: {
      ...track.patterns,
      [patternIndex]: nextPattern,
    },
  };
};

const updateTrackAutomationPattern = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  updater: (pattern: { level: number[]; tone: number[] }) => { level: number[]; tone: number[] },
): Track => {
  const currentPattern = track.automation?.[patternIndex] ?? {
    level: Array.from({ length: stepsPerPattern }, () => 0.5),
    tone: Array.from({ length: stepsPerPattern }, () => 0.5),
  };
  const nextPattern = updater({
    level: [...currentPattern.level],
    tone: [...currentPattern.tone],
  });

  return {
    ...track,
    automation: {
      ...track.automation,
      [patternIndex]: nextPattern,
    },
  };
};

const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
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
      const nextMarker: SongMarker = {
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

    case 'DUPLICATE_SONG_RANGE':
      return commitProject(
        state,
        buildSongRangeDuplicate(present, action.startBeat, action.endBeat, action.label),
      );

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

    case 'SET_MASTER_SETTINGS':
      return commitProject(state, {
        ...present,
        master: {
          ...present.master,
          ...action.settings,
        },
      });

    case 'SET_PATTERN_COUNT':
      return commitProject(state, resizeProjectTransport(present, action.patternCount, present.transport.stepsPerPattern));

    case 'SET_STEPS_PER_PATTERN':
      return commitProject(state, resizeProjectTransport(present, present.transport.patternCount, action.stepsPerPattern));

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

    case 'TOGGLE_STEP': {
      const nextProject = updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);

          if (!action.note) {
            nextSteps[action.stepIndex] = existingStep.length > 0
              ? []
              : [createStepEvent(defaultNoteForTrack(track))];
            return nextSteps;
          }

          const existingNoteIndex = existingStep.findIndex((step) => step.note === action.note);

          if (existingNoteIndex >= 0) {
            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          const templateEvent = existingStep.at(-1);
          nextSteps[action.stepIndex] = [
            ...existingStep,
            createStepEvent(action.note, templateEvent ?? {}),
          ].sort((left, right) => compareNotesDescending(left.note, right.note));

          return nextSteps;
        });
      });

      return commitProject(state, nextProject);
    }

    case 'TOGGLE_PATTERN_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);

          if (!action.note) {
            nextSteps[action.stepIndex] = existingStep.length > 0
              ? []
              : [createStepEvent(defaultNoteForTrack(track))];
            return nextSteps;
          }

          const existingNoteIndex = existingStep.findIndex((step) => step.note === action.note);

          if (existingNoteIndex >= 0) {
            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          const templateEvent = existingStep.at(-1);
          nextSteps[action.stepIndex] = [
            ...existingStep,
            createStepEvent(action.note, templateEvent ?? {}),
          ].sort((left, right) => compareNotesDescending(left.note, right.note));

          return nextSteps;
        })
      )));

    case 'TOGGLE_CLIP_PATTERN_STEP': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => (
        updatePatternSteps(candidate, clip.patternIndex, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);
          const targetNote = action.note ?? defaultNoteForTrack(track);
          const existingNoteIndex = existingStep.findIndex((entry) => entry.note === targetNote);

          if (action.mode === 'add') {
            if (existingNoteIndex >= 0) {
              return nextSteps;
            }

            const templateEvent = existingStep.at(-1);
            nextSteps[action.stepIndex] = [
              ...existingStep,
              createStepEvent(targetNote, templateEvent ?? {}),
            ].sort((left, right) => compareNotesDescending(left.note, right.note));
            return nextSteps;
          }

          if (action.mode === 'remove') {
            if (existingNoteIndex === -1) {
              return nextSteps;
            }

            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          if (!action.note) {
            nextSteps[action.stepIndex] = existingStep.length > 0
              ? []
              : [createStepEvent(targetNote)];
            return nextSteps;
          }

          if (existingNoteIndex >= 0) {
            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          const templateEvent = existingStep.at(-1);
          nextSteps[action.stepIndex] = [
            ...existingStep,
            createStepEvent(targetNote, templateEvent ?? {}),
          ].sort((left, right) => compareNotesDescending(left.note, right.note));
          return nextSteps;
        })
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    case 'SET_CLIP_PATTERN_STEP_SLICE': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => (
        updatePatternSteps(candidate, clip.patternIndex, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);

          if (action.sliceIndex === null) {
            nextSteps[action.stepIndex] = [];
            return nextSteps;
          }

          const normalizedSliceIndex = Math.max(0, action.sliceIndex);
          const targetNote = action.note ?? existingStep[0]?.note ?? defaultNoteForTrack(track);

          if (existingStep.length === 0) {
            nextSteps[action.stepIndex] = [createStepEvent(targetNote, { sampleSliceIndex: normalizedSliceIndex })];
            return nextSteps;
          }

          nextSteps[action.stepIndex] = existingStep.map((event, noteIndex) => (
            noteIndex === 0
              ? createStepEvent(targetNote, { ...event, sampleSliceIndex: normalizedSliceIndex })
              : event
          ));
          return nextSteps;
        })
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    case 'SHIFT_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        });
      }));

    case 'SHIFT_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        })
      )));

    case 'TRANSPOSE_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
      }));

    case 'TRANSPOSE_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        return updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
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

    case 'CLEAR_TRACK':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        return updatePatternSteps(track, patternId, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ));
      }));

    case 'CLEAR_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ))
      )));

    case 'UPDATE_STEP_EVENT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        const currentPattern = track.patterns[patternId] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return track;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep;

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [patternId]: nextSteps,
          },
        };
      }));

    case 'UPDATE_PATTERN_STEP_EVENT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const currentPattern = track.patterns[action.patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return track;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep;

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [action.patternIndex]: nextSteps,
          },
        };
      }));

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

    case 'TRANSFORM_CLIP_PATTERN': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      let nextProject = nextProjectSeed;

      if (action.transform === 'reset-automation') {
        nextProject = updateTrack(nextProject, track.id, (candidate) => (
          updateTrackAutomationPattern(
            candidate,
            clip.patternIndex,
            present.transport.stepsPerPattern,
            () => ({
              level: Array.from({ length: present.transport.stepsPerPattern }, () => 0.5),
              tone: Array.from({ length: present.transport.stepsPerPattern }, () => 0.5),
            }),
          )
        ));

        return commitProject(state, nextProject, clip.trackId, clip.id);
      }

      nextProject = updateTrack(nextProject, track.id, (candidate) => (
        updatePatternSteps(candidate, clip.patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
          switch (action.transform) {
            case 'clear':
              return createEmptyPattern(present.transport.stepsPerPattern);
            case 'shift-left':
              return currentPattern.every((step) => step.length === 0)
                ? currentPattern
                : [...currentPattern.slice(1).map(cloneStepEvents), []];
            case 'shift-right':
              return currentPattern.every((step) => step.length === 0)
                ? currentPattern
                : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
            case 'transpose':
              if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
                return currentPattern;
              }

              return currentPattern.map((step) => (
                step.map((event) => ({ ...event, note: transposeNote(event.note, action.value ?? 0) }))
              ));
            case 'double-density': {
              const nextPattern = currentPattern.map(cloneStepEvents);
              for (let stepIndex = 0; stepIndex < currentPattern.length - 1; stepIndex += 1) {
                if (currentPattern[stepIndex].length > 0 && nextPattern[stepIndex + 1].length === 0) {
                  nextPattern[stepIndex + 1] = cloneStepEvents(currentPattern[stepIndex]);
                }
              }
              return nextPattern;
            }
            case 'halve-density':
              return currentPattern.map((step, stepIndex) => (stepIndex % 2 === 0 ? cloneStepEvents(step) : []));
            case 'randomize-velocity':
              return currentPattern.map((step) => step.map((event) => createStepEvent(event.note, {
                ...event,
                velocity: clamp(event.velocity + ((Math.random() * 0.16) - 0.08), 0.1, 1),
              })));
            default:
              return currentPattern;
          }
        })
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

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
                buildArrangerClip(nextTrack.id, present.transport, {
                  beatLength: present.transport.stepsPerPattern,
                  patternIndex: present.transport.currentPattern,
                  startBeat: 0,
                }),
              ],
              [...present.tracks, nextTrack],
              present.transport.patternCount,
            )
          : present.arrangerClips,
        tracks: [...present.tracks, nextTrack],
      }, nextTrack.id);
    }

    case 'DUPLICATE_ARRANGER_CLIP': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip) {
        return state;
      }

      const duplicatedClip = buildArrangerClip(sourceClip.trackId, present.transport, {
        beatLength: sourceClip.beatLength,
        patternIndex: sourceClip.patternIndex,
        startBeat: sourceClip.startBeat + sourceClip.beatLength,
      });

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [
            ...present.arrangerClips,
            duplicatedClip,
          ],
          present.tracks,
          present.transport.patternCount,
        ),
      }, sourceClip.trackId, duplicatedClip.id);
    }

    case 'LOOP_ARRANGER_CLIP': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip) {
        return state;
      }

      const copies = Math.max(1, Math.min(8, Math.round(action.copies)));
      const loopedClips = Array.from({ length: copies }, (_, index) => (
        buildArrangerClip(sourceClip.trackId, present.transport, {
          beatLength: sourceClip.beatLength,
          patternIndex: sourceClip.patternIndex,
          startBeat: sourceClip.startBeat + sourceClip.beatLength * (index + 1),
        })
      ));

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
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip) {
        return state;
      }

      const sourceTrack = present.tracks.find((track) => track.id === sourceClip.trackId);
      if (!sourceTrack) {
        return state;
      }

      const occupiedPatternIndices = new Set(
        present.arrangerClips
          .filter((clip) => clip.trackId === sourceTrack.id && clip.id !== sourceClip.id)
          .map((clip) => clip.patternIndex),
      );
      const nextPatternIndex = Array.from(
        { length: present.transport.patternCount },
        (_, patternIndex) => patternIndex,
      ).find((patternIndex) => !occupiedPatternIndices.has(patternIndex) && patternIndex !== sourceClip.patternIndex);

      if (nextPatternIndex === undefined) {
        return state;
      }

      const nextProject = updateTrack(present, sourceTrack.id, (track) => {
        const sourcePattern = track.patterns[sourceClip.patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [nextPatternIndex]: sourcePattern.map(cloneStepEvents),
          },
        };
      });

      return commitProject(state, {
        ...nextProject,
        arrangerClips: syncArrangerClips(
          nextProject.arrangerClips.map((clip) => (
            clip.id === sourceClip.id ? { ...clip, patternIndex: nextPatternIndex } : clip
          )),
          nextProject.tracks,
          nextProject.transport.patternCount,
        ),
      }, sourceTrack.id, sourceClip.id);
    }

    case 'SPLIT_ARRANGER_CLIP': {
      const sourceClip = present.arrangerClips.find((clip) => clip.id === action.clipId);
      if (!sourceClip || sourceClip.beatLength < 8) {
        return state;
      }

      const requestedSplitBeat = typeof action.splitAtBeat === 'number'
        ? clamp(
            Math.round(action.splitAtBeat / ARRANGER_SNAP) * ARRANGER_SNAP,
            sourceClip.startBeat + 4,
            sourceClip.startBeat + sourceClip.beatLength - 4,
          )
        : sourceClip.startBeat + clamp(
            Math.floor(sourceClip.beatLength / 8) * 4,
            4,
            sourceClip.beatLength - 4,
          );
      const firstLength = requestedSplitBeat - sourceClip.startBeat;
      const secondLength = sourceClip.beatLength - firstLength;
      const splitClip = buildArrangerClip(sourceClip.trackId, present.transport, {
        beatLength: secondLength,
        patternIndex: sourceClip.patternIndex,
        startBeat: sourceClip.startBeat + firstLength,
      });

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [
            ...present.arrangerClips.map((clip) => (
              clip.id === sourceClip.id
                ? { ...clip, beatLength: firstLength }
                : clip
            )),
            splitClip,
          ],
          present.tracks,
          present.transport.patternCount,
        ),
      }, sourceClip.trackId, splitClip.id);
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
      const nextClip = buildArrangerClip(targetTrackId, present.transport, {
        beatLength: present.transport.stepsPerPattern,
        patternIndex: present.transport.currentPattern,
        startBeat: laneTail,
      });

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
      return state;
  }
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }

  return context;
};

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const [editorState, dispatch] = useReducer(editorReducer, undefined, createInitialEditorState);
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [renderState, setRenderState] = useState<RenderState>(IDLE_RENDER_STATE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const project = editorState.history.present;
  const {
    activeView,
    loopRangeEndBeat,
    loopRangeStartBeat,
    pinnedTrackIds,
    selectedArrangerClipId,
    selectedTrackId,
  } = editorState.ui;
  const arrangerClips = project.arrangerClips ?? [];
  const songMarkers = project.markers ?? [];
  const songLengthInBeats = songLengthFromProject(project);

  useEffect(() => {
    engine.syncProject(project);
  }, [project]);

  useEffect(() => {
    engine.setLoopRange(
      loopRangeStartBeat !== null && loopRangeEndBeat !== null
        ? { endBeat: loopRangeEndBeat, startBeat: loopRangeStartBeat }
        : null,
    );
  }, [loopRangeEndBeat, loopRangeStartBeat]);

  useEffect(() => {
    const unsubscribe = engine.onStep((step) => {
      setCurrentStep(step);
    });

    return unsubscribe;
  }, []);

  const persistCurrentSession = useEffectEvent(() => {
    const envelope = persistSession({
      project: editorState.history.present,
      ui: editorState.ui,
    });

    if (envelope) {
      setLastSavedAt(envelope.savedAt);
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('error');
  });

  useEffect(() => {
    setSaveStatus('saving');
    const timeoutId = window.setTimeout(() => {
      persistCurrentSession();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorState.history.present, editorState.ui]);

  const initAudio = async () => {
    await engine.init();
    engine.syncProject(project);
    setIsInitialized(true);
  };

  const togglePlay = () => {
    setIsPlaying(engine.togglePlayback());
  };

  const stop = () => {
    engine.stop();
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const toggleRecording = async () => {
    if (!isInitialized) {
      await initAudio();
    }

    if (isRecording) {
      await engine.stopRecording();
      setIsRecording(false);
      return;
    }

    await engine.startRecording();
    setIsRecording(true);

    if (!isPlaying) {
      togglePlay();
    }
  };

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    )) {
      return;
    }

    const isModifierPressed = event.metaKey || event.ctrlKey;
    const normalizedKey = event.key.toLowerCase();

    if (isModifierPressed && normalizedKey === 's') {
      event.preventDefault();
      setSaveStatus('saving');
      persistCurrentSession();
      return;
    }

    if (isModifierPressed && normalizedKey === 'z' && event.shiftKey) {
      event.preventDefault();
      dispatch({ type: 'REDO' });
      return;
    }

    if (isModifierPressed && normalizedKey === 'z') {
      event.preventDefault();
      dispatch({ type: 'UNDO' });
      return;
    }

    if (isModifierPressed && normalizedKey === 'y') {
      event.preventDefault();
      dispatch({ type: 'REDO' });
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();

      if (!isInitialized) {
        void initAudio();
        return;
      }

      togglePlay();
      return;
    }

    if (!isModifierPressed && normalizedKey === 'escape' && editorState.ui.isSettingsOpen) {
      dispatch({ type: 'TOGGLE_SETTINGS' });
      return;
    }

    if (!isModifierPressed && /^[1-8]$/.test(normalizedKey)) {
      dispatch({ type: 'SET_CURRENT_PATTERN', pattern: Number(normalizedKey) - 1 });
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcuts);

    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  const saveProject = () => {
    setSaveStatus('saving');
    persistCurrentSession();
  };

  const previewTrack = async (trackId: string, note?: string, sampleSliceIndex?: number) => {
    const track = project.tracks.find((candidate) => candidate.id === trackId);
    if (!track) {
      return;
    }

    if (!isInitialized) {
      await initAudio();
    }

    engine.previewTrack(track, note ?? defaultNoteForTrack(track), sampleSliceIndex);
  };

  const resetTransportState = () => {
    engine.stop();
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const buildRenderProject = (scope: ExportScope): { fileSuffix: string; label: string; project: Project } | null => {
    if (scope === 'pattern') {
      return {
        fileSuffix: 'pattern',
        label: `Pattern ${String.fromCharCode(65 + project.transport.currentPattern)}`,
        project: {
          ...cloneProject(project),
          transport: {
            ...project.transport,
            mode: 'PATTERN',
          },
        },
      };
    }

    if (scope === 'song') {
      return {
        fileSuffix: 'song',
        label: 'Full song',
        project: {
          ...cloneProject(project),
          transport: {
            ...project.transport,
            mode: 'SONG',
          },
        },
      };
    }

    const selectedClip = project.arrangerClips.find((clip) => clip.id === selectedArrangerClipId);
    if (!selectedClip) {
      return null;
    }

    const rangeStart = selectedClip.startBeat;
    const rangeEnd = selectedClip.startBeat + selectedClip.beatLength;
    const clippedProject = cloneProject(project);
    clippedProject.arrangerClips = clippedProject.arrangerClips
      .filter((clip) => clip.startBeat < rangeEnd && clip.startBeat + clip.beatLength > rangeStart)
      .map((clip) => ({
        ...clip,
        beatLength: Math.max(1, Math.min(clip.startBeat + clip.beatLength, rangeEnd) - Math.max(clip.startBeat, rangeStart)),
        startBeat: Math.max(clip.startBeat, rangeStart) - rangeStart,
      }));
    clippedProject.transport = {
      ...clippedProject.transport,
      mode: 'SONG',
    };

    return {
      fileSuffix: `clip-${selectedClip.patternIndex + 1}`,
      label: 'Selected clip window',
      project: clippedProject,
    };
  };

  const newSession = () => {
    resetTransportState();
    setLastSavedAt(null);
    setSaveStatus('idle');
    dispatch({ type: 'HYDRATE_SESSION', session: createDefaultSession() });
  };

  const loadSessionTemplate = (templateId: SessionTemplateId) => {
    resetTransportState();
    setLastSavedAt(null);
    setSaveStatus('idle');
    dispatch({ type: 'HYDRATE_SESSION', session: createSessionFromTemplate(templateId) });
  };

  const exportSession = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = JSON.stringify({
      project: editorState.history.present,
      ui: editorState.ui,
    }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const fileName = project.metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sonicstudio-session';

    anchor.href = url;
    anchor.download = `${fileName}.sonicstudio.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const bounceProjectRecording = async (
    renderProject: Project,
    updateProgress?: (progress: number, etaSeconds: number) => void,
  ) => {
    if (typeof window === 'undefined' || isRecording) {
      return null;
    }

    if (!isInitialized) {
      await initAudio();
    }

    const renderSteps = renderProject.transport.mode === 'SONG'
      ? Math.max(
          renderProject.arrangerClips.reduce(
            (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
            renderProject.transport.stepsPerPattern,
          ),
          renderProject.transport.stepsPerPattern,
        )
      : renderProject.transport.stepsPerPattern;
    const renderDurationSeconds = renderSteps * (60 / renderProject.transport.bpm) * 0.25;
    const tailSeconds = 1.5;
    const bounceDurationMs = Math.max(1200, Math.ceil((renderDurationSeconds + tailSeconds) * 1000));

    stop();
    engine.syncProject(renderProject);

    try {
      await engine.startRecording();
      setIsRecording(true);
      setIsPlaying(engine.togglePlayback());

      await new Promise((resolve) => {
        const startTime = Date.now();
        const intervalId = window.setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(0.99, elapsed / bounceDurationMs);
          const etaSeconds = Math.max(0, Math.ceil((bounceDurationMs - elapsed) / 1000));
          updateProgress?.(progress, etaSeconds);
        }, 120);

        window.setTimeout(() => {
          window.clearInterval(intervalId);
          updateProgress?.(1, 0);
          resolve(null);
        }, bounceDurationMs);
      });

      return await engine.stopRecording(false);
    } finally {
      stop();
      setIsRecording(false);
      engine.syncProject(project);
    }
  };

  const exportAudioMix = async (scope: ExportScope = project.transport.mode === 'SONG' ? 'song' : 'pattern') => {
    const renderPayload = buildRenderProject(scope);
    if (!renderPayload) {
      return;
    }

    setRenderState({
      active: true,
      currentTrackName: null,
      etaSeconds: null,
      mode: 'mix',
      phase: `Printing ${renderPayload.label.toLowerCase()}`,
      progress: 0,
    });

    try {
      const recording = await bounceProjectRecording(renderPayload.project, (progress, etaSeconds) => {
        setRenderState((current) => ({
          ...current,
          etaSeconds,
          progress,
        }));
      });

      if (!recording) {
        return;
      }

      setRenderState((current) => ({
        ...current,
        etaSeconds: null,
        phase: 'Encoding WAV',
        progress: Math.max(current.progress, 0.98),
      }));

      const wavBlob = await convertRecordingBlobToWav(recording);
      downloadBlob(wavBlob, `${sanitizeExportFileName(project.metadata.name)}-${renderPayload.fileSuffix}-mix.wav`);
      setRenderState((current) => ({
        ...current,
        phase: 'Mix ready',
        progress: 1,
      }));
    } finally {
      window.setTimeout(() => {
        setRenderState(IDLE_RENDER_STATE);
      }, 500);
    }
  };

  const exportTrackStems = async (scope: ExportScope = project.transport.mode === 'SONG' ? 'song' : 'pattern') => {
    const renderPayload = buildRenderProject(scope);
    if (!renderPayload) {
      return;
    }

    const baseFileName = sanitizeExportFileName(project.metadata.name);
    const stemTracks = renderPayload.project.tracks;

    setRenderState({
      active: true,
      currentTrackName: stemTracks[0]?.name ?? null,
      etaSeconds: null,
      mode: 'stems',
      phase: `Printing ${renderPayload.label.toLowerCase()} stems 1/${stemTracks.length}`,
      progress: 0,
    });

    try {
      for (const [index, track] of stemTracks.entries()) {
        const stemProject = cloneProject(renderPayload.project);
        stemProject.tracks = stemProject.tracks.map((candidate) => (
          candidate.id === track.id
            ? { ...candidate, muted: false, solo: false }
            : { ...candidate, muted: true, solo: false }
        ));

        const progressBase = index / stemTracks.length;
        const progressWeight = 1 / stemTracks.length;
        setRenderState((current) => ({
          ...current,
          currentTrackName: track.name,
          phase: `Printing ${renderPayload.label.toLowerCase()} stems ${index + 1}/${stemTracks.length}`,
          progress: progressBase,
        }));

        const recording = await bounceProjectRecording(stemProject, (progress, etaSeconds) => {
          setRenderState((current) => ({
            ...current,
            currentTrackName: track.name,
            etaSeconds,
            progress: progressBase + (progress * progressWeight),
          }));
        });
        if (!recording) {
          return;
        }

        setRenderState((current) => ({
          ...current,
          currentTrackName: track.name,
          etaSeconds: null,
          phase: `Encoding ${track.name}`,
          progress: Math.max(current.progress, progressBase + (progressWeight * 0.98)),
        }));

        const wavBlob = await convertRecordingBlobToWav(recording);
        downloadBlob(
          wavBlob,
          `${baseFileName}-${renderPayload.fileSuffix}-${sanitizeExportFileName(track.name)}-stem.wav`,
        );

        if (typeof window !== 'undefined') {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 160);
          });
        }
      }

      setRenderState((current) => ({
        ...current,
        currentTrackName: null,
        phase: 'Stems ready',
        progress: 1,
      }));
    } finally {
      window.setTimeout(() => {
        setRenderState(IDLE_RENDER_STATE);
      }, 500);
    }
  };

  const importSession = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const session = hydrateSessionPayload(parsed);

      if (!session) {
        setSaveStatus('error');
        return false;
      }

      resetTransportState();
      setLastSavedAt(null);
      setSaveStatus('idle');
      dispatch({ type: 'HYDRATE_SESSION', session });
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    }
  };

  return (
    <AudioContext.Provider value={{
      activeView,
      addArrangerClip: (trackId) => dispatch({ type: 'ADD_ARRANGER_CLIP', trackId }),
      arrangerClips,
      bpm: project.transport.bpm,
      canRedo: editorState.history.future.length > 0,
      canUndo: editorState.history.past.length > 0,
      clearPatternAt: (trackId, patternIndex) => dispatch({ type: 'CLEAR_PATTERN_AT', trackId, patternIndex }),
      clearTrack: (trackId) => dispatch({ type: 'CLEAR_TRACK', trackId }),
      createTrack: (trackType) => dispatch({ type: 'CREATE_TRACK', trackType }),
      createSampleSlice: (trackId, slice) => dispatch({ type: 'CREATE_SAMPLE_SLICE', slice, trackId }),
      currentPattern: project.transport.currentPattern,
      currentStep,
      duplicateArrangerClip: (clipId) => dispatch({ type: 'DUPLICATE_ARRANGER_CLIP', clipId }),
      exportAudioMix,
      exportTrackStems,
      loopArrangerClip: (clipId, copies) => dispatch({ type: 'LOOP_ARRANGER_CLIP', clipId, copies }),
      makeClipPatternUnique: (clipId) => dispatch({ type: 'MAKE_CLIP_PATTERN_UNIQUE', clipId }),
      createSongMarker: (beat, name) => dispatch({ type: 'CREATE_SONG_MARKER', beat, name }),
      duplicateSongRange: (startBeat, endBeat, label) => dispatch({ type: 'DUPLICATE_SONG_RANGE', endBeat, label, startBeat }),
      duplicateTrack: (trackId) => dispatch({ type: 'DUPLICATE_TRACK', trackId }),
      exportSession,
      importSession,
      initAudio,
      isInitialized,
      isPlaying,
      isRecording,
      isSettingsOpen: editorState.ui.isSettingsOpen,
      lastSavedAt,
      loopRangeEndBeat,
      loopRangeStartBeat,
      loadSessionTemplate,
      master: project.master,
      newSession,
      patternCount: project.transport.patternCount,
      pinnedTrackIds,
      previewTrack,
      projectName: project.metadata.name,
      redo: () => dispatch({ type: 'REDO' }),
      renderState,
      removeArrangerClip: (clipId) => dispatch({ type: 'REMOVE_ARRANGER_CLIP', clipId }),
      removeSongMarker: (markerId) => dispatch({ type: 'REMOVE_SONG_MARKER', markerId }),
      removeTrack: (trackId) => dispatch({ type: 'REMOVE_TRACK', trackId }),
      renameProject: (name) => dispatch({ type: 'SET_PROJECT_NAME', name }),
      renameTrack: (trackId, name) => dispatch({ type: 'SET_TRACK_NAME', name, trackId }),
      saveProject,
      saveStatus,
      selectedArrangerClipId,
      selectedTrackId,
      setSelectedArrangerClipId: (clipId) => dispatch({ type: 'SET_SELECTED_ARRANGER_CLIP', clipId }),
      shiftPatternAt: (trackId, patternIndex, direction) => dispatch({ type: 'SHIFT_PATTERN_AT', direction, trackId, patternIndex }),
      shiftPattern: (trackId, direction) => dispatch({ type: 'SHIFT_PATTERN', direction, trackId }),
      setActiveView: (view) => dispatch({ type: 'SET_ACTIVE_VIEW', view }),
      setBpm: (bpm) => dispatch({ type: 'SET_BPM', bpm }),
      setMasterSettings: (settings) => dispatch({ type: 'SET_MASTER_SETTINGS', settings }),
      setCurrentPattern: (pattern) => dispatch({ type: 'SET_CURRENT_PATTERN', pattern }),
      setPatternCount: (patternCount) => dispatch({ type: 'SET_PATTERN_COUNT', patternCount }),
      setClipPatternStepSlice: (clipId, stepIndex, sliceIndex, note) => dispatch({ type: 'SET_CLIP_PATTERN_STEP_SLICE', clipId, note, sliceIndex, stepIndex }),
      setLoopRange: (startBeat, endBeat) => dispatch({ type: 'SET_LOOP_RANGE', endBeat, startBeat }),
      setSelectedTrackId: (trackId) => dispatch({ type: 'SET_SELECTED_TRACK_ID', trackId }),
      selectSampleSlice: (trackId, sliceIndex) => dispatch({ type: 'SELECT_SAMPLE_SLICE', sliceIndex, trackId }),
      setStepsPerPattern: (stepsPerPattern) => dispatch({ type: 'SET_STEPS_PER_PATTERN', stepsPerPattern }),
      setTrackParams: (trackId, params) => dispatch({ type: 'SET_TRACK_PARAMS', params, trackId }),
      setTrackSource: (trackId, source) => dispatch({ type: 'SET_TRACK_SOURCE', source, trackId }),
      setTransportMode: (mode) => dispatch({ type: 'SET_TRANSPORT_MODE', mode }),
      songMarkers,
      songLengthInBeats,
      splitArrangerClip: (clipId, splitAtBeat) => dispatch({ type: 'SPLIT_ARRANGER_CLIP', clipId, splitAtBeat }),
      stepsPerPattern: project.transport.stepsPerPattern,
      stop,
      toggleClipPatternStep: (clipId, stepIndex, note, mode) => dispatch({ type: 'TOGGLE_CLIP_PATTERN_STEP', clipId, mode, note, stepIndex }),
      toggleMute: (trackId) => dispatch({ type: 'TOGGLE_MUTE', trackId }),
      togglePlay,
      togglePatternStep: (trackId, patternIndex, stepIndex, note) => dispatch({ type: 'TOGGLE_PATTERN_STEP', note, patternIndex, stepIndex, trackId }),
      toggleRecording,
      toggleSettings: () => dispatch({ type: 'TOGGLE_SETTINGS' }),
      toggleSolo: (trackId) => dispatch({ type: 'TOGGLE_SOLO', trackId }),
      toggleStep: (trackId, stepIndex, note) => dispatch({ type: 'TOGGLE_STEP', note, stepIndex, trackId }),
      tracks: project.tracks,
      togglePinnedTrack: (trackId) => dispatch({ type: 'TOGGLE_PINNED_TRACK', trackId }),
      transformClipPattern: (clipId, transform, value) => dispatch({ type: 'TRANSFORM_CLIP_PATTERN', clipId, transform, value }),
      transposePatternAt: (trackId, patternIndex, semitones) => dispatch({ type: 'TRANSPOSE_PATTERN_AT', semitones, trackId, patternIndex }),
      transposePattern: (trackId, semitones) => dispatch({ type: 'TRANSPOSE_PATTERN', semitones, trackId }),
      transportMode: project.transport.mode,
      undo: () => dispatch({ type: 'UNDO' }),
      updateArrangerClip: (clipId, updates) => dispatch({ type: 'UPDATE_ARRANGER_CLIP', clipId, updates }),
      updateClipPatternAutomationStep: (clipId, stepIndex, lane, value) => dispatch({ type: 'UPDATE_CLIP_PATTERN_AUTOMATION_STEP', clipId, stepIndex, lane, value }),
      updateClipPatternStepEvent: (clipId, stepIndex, noteIndex, updates) => dispatch({ type: 'UPDATE_CLIP_PATTERN_STEP_EVENT', clipId, noteIndex, stepIndex, updates }),
      updatePatternAutomationStep: (trackId, patternIndex, stepIndex, lane, value) => dispatch({ type: 'UPDATE_PATTERN_AUTOMATION_STEP', trackId, patternIndex, stepIndex, lane, value }),
      updatePatternStepEvent: (trackId, patternIndex, stepIndex, noteIndex, updates) => dispatch({ type: 'UPDATE_PATTERN_STEP_EVENT', noteIndex, stepIndex, trackId, patternIndex, updates }),
      updateSongMarker: (markerId, updates) => dispatch({ type: 'UPDATE_SONG_MARKER', markerId, updates }),
      updateSampleSlice: (trackId, sliceIndex, updates) => dispatch({ type: 'UPDATE_SAMPLE_SLICE', sliceIndex, trackId, updates }),
      updateStepEvent: (trackId, stepIndex, noteIndex, updates) => dispatch({ type: 'UPDATE_STEP_EVENT', noteIndex, stepIndex, trackId, updates }),
      updateTrackPan: (trackId, pan) => dispatch({ type: 'TOGGLE_PAN', pan, trackId }),
      updateTrackVolume: (trackId, volume) => dispatch({ type: 'TOGGLE_VOLUME', trackId, volume }),
      deleteSampleSlice: (trackId, sliceIndex) => dispatch({ type: 'DELETE_SAMPLE_SLICE', sliceIndex, trackId }),
    }}>
      {children}
    </AudioContext.Provider>
  );
};
