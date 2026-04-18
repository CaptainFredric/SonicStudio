import React, {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { engine } from '../audio/ToneEngine';
import {
  type ArrangementClip,
  type AppView,
  type BounceHistoryEntry,
  type InstrumentType,
  type MasterSnapshot,
  type MasterSettings,
  type NoteEvent,
  type SampleSliceMemory,
  type SessionTemplateId,
  type SongMarker,
  type SynthParams,
  type Track,
  type TrackSnapshot,
  type TrackSource,
  type TransportMode,
} from '../project/schema';
import { type PersistedCheckpoint } from '../project/storage';
import { listStudioCheckpoints, persistStudioSession } from '../services/sessionWorkflow';
import {
  IDLE_RENDER_STATE,
  type BounceNormalizationMode,
  type BounceTailMode,
  type ExportScope,
  type RenderState,
  type SaveStatus,
} from '../services/workflowTypes';
import { type RenderTargetProfileId } from '../utils/export';
import { createEditorDispatchers } from './editor/editorDispatchers';
import { createKeyboardShortcutHandler } from './editor/keyboardShortcuts';
import { createRenderController } from './editor/renderController';
import { editorReducer } from './editor/reducer/editorReducer';
import { createInitialEditorState, songLengthFromProject } from './editor/reducer/reducerUtils';
import { createSessionController } from './editor/sessionController';
import { createTransportController } from './editor/transportController';

export type { BounceNormalizationMode, BounceTailMode, ExportScope } from '../services/workflowTypes';

interface AudioContextType {
  activeView: AppView;
  addArrangerClip: (trackId?: string) => void;
  applyTrackVoicePreset: (trackId: string, presetId: string) => void;
  applyTrackSnapshot: (trackId: string, snapshotId: string) => void;
  applyMasterSnapshot: (snapshotId: string) => void;
  arrangerClips: ArrangementClip[];
  bounceHistory: BounceHistoryEntry[];
  bpm: number;
  canRedo: boolean;
  canUndo: boolean;
  countInActive: boolean;
  countInBars: number;
  countInBeatsRemaining: number;
  clearPatternAt: (trackId: string, patternIndex: number) => void;
  clearTrack: (trackId: string) => void;
  createTrack: (trackType: InstrumentType) => void;
  createSampleSlice: (trackId: string, slice?: Partial<SampleSliceMemory>) => void;
  currentPattern: number;
  currentStep: number;
  duplicateArrangerClip: (clipId: string) => void;
  exportAudioMix: (scope?: ExportScope, options?: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId }) => Promise<void>;
  exportMidi: (scope?: ExportScope) => Promise<void>;
  exportTrackStems: (scope?: ExportScope, options?: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId }) => Promise<void>;
  master: MasterSettings;
  loopArrangerClip: (clipId: string, copies: number) => void;
  makeClipPatternUnique: (clipId: string) => void;
  moveTrack: (trackId: string, direction: 'up' | 'down') => void;
  duplicateTrack: (trackId: string) => void;
  exportSession: () => void;
  importSession: (file: File) => Promise<boolean>;
  importMidiSession: (file: File) => Promise<boolean>;
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
  metronomeEnabled: boolean;
  patternCount: number;
  previewTrack: (trackId: string, note?: string, sampleSliceIndex?: number) => Promise<void>;
  projectName: string;
  projectCheckpoints: PersistedCheckpoint[];
  redo: () => void;
  renderState: RenderState;
  removeArrangerClip: (clipId: string) => void;
  removeSongMarker: (markerId: string) => void;
  removeTrack: (trackId: string) => void;
  renameProject: (name: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  restoreCheckpoint: (checkpointId: string) => boolean;
  saveProject: () => void;
  saveCheckpoint: (label?: string) => void;
  saveStatus: SaveStatus;
  pinnedTrackIds: string[];
  selectedArrangerClipId: string | null;
  selectedTrackId: string | null;
  setSelectedArrangerClipId: (id: string | null) => void;
  shiftPattern: (trackId: string, direction: 'left' | 'right') => void;
  setActiveView: (view: AppView) => void;
  setBpm: (bpm: number) => void;
  setCountInBars: (bars: number) => void;
  setMasterSettings: (settings: Partial<MasterSettings>) => void;
  setCurrentPattern: (pattern: number) => void;
  setPatternCount: (patternCount: number) => void;
  setSelectedTrackId: (id: string | null) => void;
  setStepsPerPattern: (stepsPerPattern: number) => void;
  setTrackParams: (id: string, params: Partial<SynthParams>) => void;
  setTrackSource: (id: string, source: Partial<TrackSource>) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
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
  togglePlay: () => Promise<void>;
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
  deleteCheckpoint: (checkpointId: string) => void;
  deleteMasterSnapshot: (snapshotId: string) => void;
  deleteTrackSnapshot: (snapshotId: string) => void;
  masterSnapshots: MasterSnapshot[];
  rerunBounceHistory: (entryId: string) => Promise<void>;
  saveMasterSnapshot: (snapshotId?: string | null) => void;
  saveTrackSnapshot: (trackId: string, snapshotId?: string | null) => void;
  trackSnapshots: TrackSnapshot[];
}

const AudioContext = createContext<AudioContextType | null>(null);

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
  const [countInActive, setCountInActive] = useState(false);
  const [countInBeatsRemaining, setCountInBeatsRemaining] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [projectCheckpoints, setProjectCheckpoints] = useState<PersistedCheckpoint[]>(() => listStudioCheckpoints());
  const [renderState, setRenderState] = useState<RenderState>(IDLE_RENDER_STATE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const countInTokenRef = useRef(0);

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
  const dispatchers = useMemo(() => createEditorDispatchers(dispatch), [dispatch]);

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

  useEffect(() => engine.onStep((step) => {
    setCurrentStep(step);
  }), []);

  const persistCurrentSession = useEffectEvent(() => {
    const envelope = persistStudioSession({
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
  }, [editorState.history.present, editorState.ui, persistCurrentSession]);

  const initAudio = async () => {
    await engine.init();
    engine.syncProject(project);
    setIsInitialized(true);
  };

  const {
    previewTrack,
    resetTransportState,
    stop,
    togglePlay,
    toggleRecording,
  } = createTransportController({
    countInActive,
    countInTokenRef,
    currentProject: project,
    engine,
    initAudio,
    isInitialized,
    isPlaying,
    isRecording,
    setCountInActive,
    setCountInBeatsRemaining,
    setCurrentStep,
    setIsPlaying,
    setIsRecording,
    tracks: project.tracks,
  });

  const keyboardShortcutHandler = useEffectEvent(createKeyboardShortcutHandler({
    dispatch,
    isSettingsOpen: editorState.ui.isSettingsOpen,
    persistCurrentSession,
    project,
    setSaveStatus,
    togglePlay,
  }));

  useEffect(() => {
    window.addEventListener('keydown', keyboardShortcutHandler);

    return () => {
      window.removeEventListener('keydown', keyboardShortcutHandler);
    };
  }, [keyboardShortcutHandler]);

  const {
    deleteCheckpoint,
    exportSession,
    importMidiSession,
    importSession,
    loadSessionTemplate,
    newSession,
    restoreCheckpoint,
    saveCheckpoint,
    saveProject,
  } = createSessionController({
    currentProject: project,
    currentUi: editorState.ui,
    dispatchHydrateSession: (session) => dispatch({ type: 'HYDRATE_SESSION', session }),
    persistCurrentSession,
    resetTransportState,
    setLastSavedAt,
    setProjectCheckpoints,
    setSaveStatus,
  });

  const {
    exportAudioMix,
    exportMidi,
    exportTrackStems,
    rerunBounceHistory,
  } = createRenderController({
    currentProject: project,
    dispatchAppendBounceHistory: (entry) => dispatch({ type: 'APPEND_BOUNCE_HISTORY', entry }),
    loopRangeEndBeat,
    loopRangeStartBeat,
    selectedArrangerClipId,
    setRenderState,
  });

  return (
    <AudioContext.Provider value={{
      activeView,
      arrangerClips,
      bpm: project.transport.bpm,
      bounceHistory: project.bounceHistory,
      canRedo: editorState.history.future.length > 0,
      canUndo: editorState.history.past.length > 0,
      countInActive,
      countInBars: project.transport.countInBars,
      countInBeatsRemaining,
      currentPattern: project.transport.currentPattern,
      currentStep,
      exportAudioMix,
      exportMidi,
      exportTrackStems,
      exportSession,
      importMidiSession,
      importSession,
      initAudio,
      isInitialized,
      isPlaying,
      isRecording,
      isSettingsOpen: editorState.ui.isSettingsOpen,
      lastSavedAt,
      loadSessionTemplate,
      loopRangeEndBeat,
      loopRangeStartBeat,
      master: project.master,
      masterSnapshots: project.masterSnapshots,
      metronomeEnabled: project.transport.metronomeEnabled,
      newSession,
      patternCount: project.transport.patternCount,
      pinnedTrackIds,
      previewTrack,
      projectCheckpoints,
      projectName: project.metadata.name,
      renderState,
      rerunBounceHistory,
      restoreCheckpoint,
      saveCheckpoint,
      saveProject,
      saveStatus,
      selectedArrangerClipId,
      selectedTrackId,
      songLengthInBeats,
      songMarkers,
      stepsPerPattern: project.transport.stepsPerPattern,
      stop,
      togglePlay,
      toggleRecording,
      tracks: project.tracks,
      trackSnapshots: project.trackSnapshots,
      transportMode: project.transport.mode,
      deleteCheckpoint,
      ...dispatchers,
    }}>
      {children}
    </AudioContext.Provider>
  );
};
