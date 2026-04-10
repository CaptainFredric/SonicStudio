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
  type Project,
  type StudioSession,
  type StudioUIState,
  type SynthParams,
  type Track,
  type TrackSource,
  type TransportMode,
} from '../project/schema';
import {
  createDefaultSession,
  hydrateSessionPayload,
  loadPersistedSession,
  persistSession,
} from '../project/storage';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AudioContextType {
  activeView: AppView;
  addArrangerClip: (trackId?: string) => void;
  arrangerClips: ArrangementClip[];
  bpm: number;
  canRedo: boolean;
  canUndo: boolean;
  clearTrack: (trackId: string) => void;
  createTrack: (trackType: InstrumentType) => void;
  currentPattern: number;
  currentStep: number;
  duplicateTrack: (trackId: string) => void;
  exportSession: () => void;
  importSession: (file: File) => Promise<boolean>;
  initAudio: () => Promise<void>;
  isInitialized: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  isSettingsOpen: boolean;
  lastSavedAt: string | null;
  newSession: () => void;
  patternCount: number;
  projectName: string;
  redo: () => void;
  removeArrangerClip: (clipId: string) => void;
  removeTrack: (trackId: string) => void;
  renameProject: (name: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  saveProject: () => void;
  saveStatus: SaveStatus;
  selectedTrackId: string | null;
  shiftPattern: (trackId: string, direction: 'left' | 'right') => void;
  setActiveView: (view: AppView) => void;
  setBpm: (bpm: number) => void;
  setCurrentPattern: (pattern: number) => void;
  setPatternCount: (patternCount: number) => void;
  setSelectedTrackId: (id: string | null) => void;
  setStepsPerPattern: (stepsPerPattern: number) => void;
  setTrackParams: (id: string, params: Partial<SynthParams>) => void;
  setTrackSource: (id: string, source: Partial<TrackSource>) => void;
  setTransportMode: (mode: TransportMode) => void;
  songLengthInBeats: number;
  stepsPerPattern: number;
  stop: () => void;
  toggleMute: (trackId: string) => void;
  togglePlay: () => void;
  toggleRecording: () => Promise<void>;
  toggleSettings: () => void;
  toggleSolo: (trackId: string) => void;
  toggleStep: (trackId: string, stepIndex: number, note?: string) => void;
  tracks: Track[];
  transposePattern: (trackId: string, semitones: number) => void;
  transportMode: TransportMode;
  undo: () => void;
  updateArrangerClip: (clipId: string, updates: Partial<ArrangementClip>) => void;
  updateTrackPan: (trackId: string, pan: number) => void;
  updateTrackVolume: (trackId: string, volume: number) => void;
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
  | { type: 'CREATE_TRACK'; trackType: InstrumentType }
  | { type: 'DUPLICATE_TRACK'; trackId: string }
  | { type: 'HYDRATE_SESSION'; session: StudioSession }
  | { type: 'REDO' }
  | { type: 'REMOVE_ARRANGER_CLIP'; clipId: string }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'SHIFT_PATTERN'; direction: 'left' | 'right'; trackId: string }
  | { type: 'SET_ACTIVE_VIEW'; view: AppView }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_CURRENT_PATTERN'; pattern: number }
  | { type: 'SET_PATTERN_COUNT'; patternCount: number }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'SET_SELECTED_TRACK_ID'; trackId: string | null }
  | { type: 'SET_STEPS_PER_PATTERN'; stepsPerPattern: number }
  | { type: 'SET_TRACK_NAME'; name: string; trackId: string }
  | { type: 'SET_TRACK_PARAMS'; params: Partial<SynthParams>; trackId: string }
  | { type: 'SET_TRACK_SOURCE'; source: Partial<TrackSource>; trackId: string }
  | { type: 'SET_TRANSPORT_MODE'; mode: TransportMode }
  | { type: 'TOGGLE_MUTE'; trackId: string }
  | { type: 'TOGGLE_PAN'; pan: number; trackId: string }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_SOLO'; trackId: string }
  | { type: 'TOGGLE_STEP'; note?: string; stepIndex: number; trackId: string }
  | { type: 'TOGGLE_VOLUME'; trackId: string; volume: number }
  | { type: 'TRANSPOSE_PATTERN'; semitones: number; trackId: string }
  | { type: 'UNDO' }
  | { type: 'UPDATE_ARRANGER_CLIP'; clipId: string; updates: Partial<ArrangementClip> };

const AudioContext = createContext<AudioContextType | null>(null);
const HISTORY_LIMIT = 100;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
      selectedTrackId: ensureSelectedTrackId(nextProject, selectedTrackId),
    },
  };
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
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        source: {
          ...track.source,
          ...action.source,
        },
      })));

    case 'TOGGLE_STEP': {
      const nextProject = updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        const existingSteps = track.patterns[patternId] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const nextSteps = [...existingSteps];
        const targetNote = action.note ?? nextSteps[action.stepIndex] ?? defaultNoteForTrack(track);

        nextSteps[action.stepIndex] = nextSteps[action.stepIndex] === targetNote ? null : targetNote;

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [patternId]: nextSteps,
          },
        };
      });

      return commitProject(state, nextProject);
    }

    case 'SHIFT_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        const currentPattern = track.patterns[patternId] ?? createEmptyPattern(present.transport.stepsPerPattern);

        if (currentPattern.every((step) => step === null)) {
          return track;
        }

        const nextSteps = action.direction === 'left'
          ? [...currentPattern.slice(1), null]
          : [null, ...currentPattern.slice(0, -1)];

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [patternId]: nextSteps,
          },
        };
      }));

    case 'TRANSPOSE_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        const patternId = present.transport.currentPattern;
        const currentPattern = track.patterns[patternId] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const nextSteps = currentPattern.map((step) => (
          typeof step === 'string' ? transposeNote(step, action.semitones) : step
        ));

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [patternId]: nextSteps,
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

    case 'CLEAR_TRACK':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        const currentPattern = track.patterns[patternId] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const hasActiveSteps = currentPattern.some((step) => step !== null);

        if (!hasActiveSteps) {
          return track;
        }

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [patternId]: createEmptyPattern(present.transport.stepsPerPattern),
          },
        };
      }));

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

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [
            ...present.arrangerClips,
            buildArrangerClip(targetTrackId, present.transport, {
              beatLength: present.transport.stepsPerPattern,
              patternIndex: present.transport.currentPattern,
              startBeat: laneTail,
            }),
          ],
          present.tracks,
          present.transport.patternCount,
        ),
      }, targetTrackId);
    }

    case 'REMOVE_ARRANGER_CLIP':
      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips.filter((clip) => clip.id !== action.clipId),
          present.tracks,
          present.transport.patternCount,
        ),
      });

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
      });

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const project = editorState.history.present;
  const { activeView, selectedTrackId } = editorState.ui;
  const arrangerClips = project.arrangerClips ?? [];
  const songLengthInBeats = arrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    project.transport.stepsPerPattern,
  );

  useEffect(() => {
    engine.syncProject(project);
  }, [project]);

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

  const resetTransportState = () => {
    engine.stop();
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const newSession = () => {
    resetTransportState();
    setLastSavedAt(null);
    setSaveStatus('idle');
    dispatch({ type: 'HYDRATE_SESSION', session: createDefaultSession() });
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
      clearTrack: (trackId) => dispatch({ type: 'CLEAR_TRACK', trackId }),
      createTrack: (trackType) => dispatch({ type: 'CREATE_TRACK', trackType }),
      currentPattern: project.transport.currentPattern,
      currentStep,
      duplicateTrack: (trackId) => dispatch({ type: 'DUPLICATE_TRACK', trackId }),
      exportSession,
      importSession,
      initAudio,
      isInitialized,
      isPlaying,
      isRecording,
      isSettingsOpen: editorState.ui.isSettingsOpen,
      lastSavedAt,
      newSession,
      patternCount: project.transport.patternCount,
      projectName: project.metadata.name,
      redo: () => dispatch({ type: 'REDO' }),
      removeArrangerClip: (clipId) => dispatch({ type: 'REMOVE_ARRANGER_CLIP', clipId }),
      removeTrack: (trackId) => dispatch({ type: 'REMOVE_TRACK', trackId }),
      renameProject: (name) => dispatch({ type: 'SET_PROJECT_NAME', name }),
      renameTrack: (trackId, name) => dispatch({ type: 'SET_TRACK_NAME', name, trackId }),
      saveProject,
      saveStatus,
      selectedTrackId,
      shiftPattern: (trackId, direction) => dispatch({ type: 'SHIFT_PATTERN', direction, trackId }),
      setActiveView: (view) => dispatch({ type: 'SET_ACTIVE_VIEW', view }),
      setBpm: (bpm) => dispatch({ type: 'SET_BPM', bpm }),
      setCurrentPattern: (pattern) => dispatch({ type: 'SET_CURRENT_PATTERN', pattern }),
      setPatternCount: (patternCount) => dispatch({ type: 'SET_PATTERN_COUNT', patternCount }),
      setSelectedTrackId: (trackId) => dispatch({ type: 'SET_SELECTED_TRACK_ID', trackId }),
      setStepsPerPattern: (stepsPerPattern) => dispatch({ type: 'SET_STEPS_PER_PATTERN', stepsPerPattern }),
      setTrackParams: (trackId, params) => dispatch({ type: 'SET_TRACK_PARAMS', params, trackId }),
      setTrackSource: (trackId, source) => dispatch({ type: 'SET_TRACK_SOURCE', source, trackId }),
      setTransportMode: (mode) => dispatch({ type: 'SET_TRANSPORT_MODE', mode }),
      songLengthInBeats,
      stepsPerPattern: project.transport.stepsPerPattern,
      stop,
      toggleMute: (trackId) => dispatch({ type: 'TOGGLE_MUTE', trackId }),
      togglePlay,
      toggleRecording,
      toggleSettings: () => dispatch({ type: 'TOGGLE_SETTINGS' }),
      toggleSolo: (trackId) => dispatch({ type: 'TOGGLE_SOLO', trackId }),
      toggleStep: (trackId, stepIndex, note) => dispatch({ type: 'TOGGLE_STEP', note, stepIndex, trackId }),
      tracks: project.tracks,
      transposePattern: (trackId, semitones) => dispatch({ type: 'TRANSPOSE_PATTERN', semitones, trackId }),
      transportMode: project.transport.mode,
      undo: () => dispatch({ type: 'UNDO' }),
      updateArrangerClip: (clipId, updates) => dispatch({ type: 'UPDATE_ARRANGER_CLIP', clipId, updates }),
      updateTrackPan: (trackId, pan) => dispatch({ type: 'TOGGLE_PAN', pan, trackId }),
      updateTrackVolume: (trackId, volume) => dispatch({ type: 'TOGGLE_VOLUME', trackId, volume }),
    }}>
      {children}
    </AudioContext.Provider>
  );
};
