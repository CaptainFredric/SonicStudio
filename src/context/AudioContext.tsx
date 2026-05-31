import React, {
  useCallback,
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
import { type StudioRouteState } from '../app/routeController';

import { engine } from '../audio/ToneEngine';
import { isUiSoundVariant, playUiSound } from '../audio/uiSounds';
import {
  type ArrangementClip,
  type AppView,
  type BounceHistoryEntry,
  type InstrumentType,
  type MasterSnapshot,
  type MasterSettings,
  type NoteEvent,
  type PatternAutomation,
  type SampleSliceMemory,
  type SessionTemplateId,
  type SongMarker,
  type SynthParams,
  type Track,
  type TrackSnapshot,
  type TrackSource,
  type TransportMode,
  type StudioSession,
} from '../project/schema';
import type { SongFormId } from './editor/songFormDefinitions';
import {
  ACCENT_PRESETS,
  DEFAULT_STUDIO_PREFERENCES,
  type CaptureAnalysisProfile,
  type CapturePreferences,
  type CaptureSuggestionCount,
  type AccentColor,
  type DefaultWorkspace,
  type Density,
  type MotionMode,
  type SuperSonicPreferences,
  type AudioStabilityMode,
  type SuperSonicWaveIntensity,
  loadStudioPreferences,
  persistStudioPreferences,
} from '../project/preferences';
import { type PersistedCheckpoint } from '../project/storage';
import {
  downloadTrainingCorpus,
  summarizeTrainingCorpus,
  type TrainingCorpusSummary,
} from '../services/aiTrainingCorpus';
import { listStudioCheckpoints, persistStudioSession } from '../services/sessionWorkflow';
import {
  type Scoresheet,
  deleteScoresheet as deleteScoresheetService,
  listScoresheets,
  loadScoresheet as loadScoresheetService,
} from '../services/scoresheets';
import { setManualKeyOverride } from '../services/manualKeyOverride';
import {
  renameScoresheet as renameScoresheetService,
  saveScoresheet as saveScoresheetService,
} from '../services/scoresheets';
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
import {
  clampCurrentStepToLoopBounds,
  createInitialEditorState,
  songLengthFromProject,
} from './editor/reducer/reducerUtils';
import { createSessionController } from './editor/sessionController';
import { createTransportController } from './editor/transportController';

export type { BounceNormalizationMode, BounceTailMode, ExportScope } from '../services/workflowTypes';

export interface StudioNotice {
  detail?: string;
  id: number;
  title: string;
  tone: 'info' | 'success' | 'error';
}

interface AudioContextType {
  activeView: AppView;
  addArrangerClip: (trackId?: string) => void;
  applySongForm: (formId: SongFormId) => void;
  applyTrackVoicePreset: (trackId: string, presetId: string) => void;
  applyTrackSnapshot: (trackId: string, snapshotId: string) => void;
  applyMasterSnapshot: (snapshotId: string) => void;
  applyPatternSegment: (trackId: string, patternIndex: number, steps: NoteEvent[][], automation?: PatternAutomation) => void;
  arrangerClips: ArrangementClip[];
  bounceHistory: BounceHistoryEntry[];
  bpm: number;
  canRedo: boolean;
  canUndo: boolean;
  countInActive: boolean;
  countInBars: number;
  countInBeatsRemaining: number;
  currentSession: StudioSession;
  clearPatternAt: (trackId: string, patternIndex: number) => void;
  clearAllTrackNotes: () => void;
  clearTrack: (trackId: string) => void;
  createTrack: (trackType: InstrumentType) => void;
  createSampleSlice: (trackId: string, slice?: Partial<SampleSliceMemory>) => void;
  currentPattern: number;
  duplicateArrangerClip: (clipId: string) => void;
  exportAudioMix: (scope?: ExportScope, options?: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId }) => Promise<void>;
  exportMidi: (scope?: ExportScope) => Promise<void>;
  exportTrackStems: (scope?: ExportScope, options?: { normalization?: BounceNormalizationMode; tailMode?: BounceTailMode; targetProfileId?: RenderTargetProfileId }) => Promise<void>;
  master: MasterSettings;
  loopArrangerClip: (clipId: string, copies: number) => void;
  makeClipPatternUnique: (clipId: string) => void;
  moveTrack: (trackId: string, direction: 'up' | 'down') => void;
  motionMode: MotionMode;
  capturePreferences: CapturePreferences;
  accentColor: AccentColor;
  density: Density;
  defaultWorkspace: DefaultWorkspace;
  superSonicMode: boolean;
  superSonicPreferences: SuperSonicPreferences;
  setCaptureAnalysisProfile: (profile: CaptureAnalysisProfile) => void;
  setCaptureAutoPreviewMatch: (enabled: boolean) => void;
  setCaptureKeepShelfBetweenTakes: (enabled: boolean) => void;
  setCaptureLiveSuggestionCount: (count: CaptureSuggestionCount) => void;
  setAccentColor: (color: AccentColor) => void;
  setDensity: (density: Density) => void;
  setDefaultWorkspace: (workspace: DefaultWorkspace) => void;
  resetStudioPreferences: () => void;
  setSuperSonicMode: (enabled: boolean) => void;
  setSuperSonicGuidanceBadges: (enabled: boolean) => void;
  setSuperSonicWaveIntensity: (intensity: SuperSonicWaveIntensity) => void;
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
  latestNotice: StudioNotice | null;
  loopRangeEndBeat: number | null;
  loopRangeStartBeat: number | null;
  loadSessionTemplate: (templateId: SessionTemplateId) => void;
  loadTranscribedSession: (session: StudioSession) => void;
  newSession: () => void;
  metronomeEnabled: boolean;
  patternCount: number;
  previewTrack: (trackId: string, note?: string, sampleSliceIndex?: number, velocity?: number) => Promise<void>;
  auditionTrackVoicePreset: (trackId: string, presetId: string) => Promise<void>;
  auditionInstrumentNote: (type: import('../project/schema').InstrumentType, note: string, velocity?: number) => Promise<void>;
  projectName: string;
  projectCheckpoints: PersistedCheckpoint[];
  scoresheets: Scoresheet[];
  saveScoresheet: (name: string, options?: { replaceId?: string }) => void;
  loadScoresheet: (id: string) => void;
  renameScoresheet: (id: string, name: string) => void;
  deleteScoresheet: (id: string) => void;
  redo: () => void;
  renderState: RenderState;
  removeArrangerClip: (clipId: string) => void;
  removeSongMarker: (markerId: string) => void;
  removeTrack: (trackId: string) => void;
  renameProject: (name: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  restoreCheckpoint: (checkpointId: string) => boolean;
  saveProject: () => void;
  exportTrainingCorpus: () => void;
  trainingCorpusSummary: TrainingCorpusSummary;
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
  setSettingsOpen: (open: boolean) => void;
  setSelectedTrackId: (id: string | null) => void;
  setStepsPerPattern: (stepsPerPattern: number) => void;
  setTrackParams: (id: string, params: Partial<SynthParams>) => void;
  setTrackSource: (id: string, source: Partial<TrackSource>) => void;
  setMotionMode: (mode: MotionMode) => void;
  setUiSoundsEnabled: (enabled: boolean) => void;
  setMidiInputEnabled: (enabled: boolean) => void;
  setMidiRecordEnabled: (enabled: boolean) => void;
  setStickyMobileTransport: (enabled: boolean) => void;
  setAudioStabilityMode: (mode: AudioStabilityMode) => void;
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
  requestDemoPlayback: () => void;
  toggleClipPatternStep: (clipId: string, stepIndex: number, note?: string, mode?: 'add' | 'remove' | 'toggle') => void;
  toggleMute: (trackId: string) => void;
  togglePlay: () => Promise<void>;
  togglePatternStep: (trackId: string, patternIndex: number, stepIndex: number, note?: string) => void;
  toggleRecording: () => Promise<void>;
  toggleSettings: () => void;
  toggleSolo: (trackId: string) => void;
  toggleStep: (trackId: string, stepIndex: number, note?: string) => void;
  recordStepNote: (trackId: string, stepIndex: number, note: string) => void;
  tracks: Track[];
  createSongMarker: (beat: number, name?: string) => void;
  duplicateSongRange: (startBeat: number, endBeat: number, label?: string) => void;
  togglePinnedTrack: (trackId: string) => void;
  transformClipPattern: (clipId: string, transform: 'clear' | 'double-density' | 'halve-density' | 'randomize-velocity' | 'reset-automation' | 'shift-left' | 'shift-right' | 'transpose', value?: number) => void;
  transposePatternAt: (trackId: string, patternIndex: number, semitones: number) => void;
  transposePattern: (trackId: string, semitones: number) => void;
  humanizePattern: (trackId: string, amount?: number) => void;
  stampChord: (trackId: string, stepIndex: number, notes: string[], options?: { gate?: number; velocity?: number }) => void;
  moveNoteToStep: (trackId: string, fromStepIndex: number, fromNoteIndex: number, toStepIndex: number, newGate?: number) => void;
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
  uiSoundsEnabled: boolean;
  midiInputEnabled: boolean;
  midiRecordEnabled: boolean;
  stickyMobileTransport: boolean;
  audioStabilityMode: AudioStabilityMode;
}

const AudioContext = createContext<AudioContextType | null>(null);
const PlaybackStepContext = createContext(0);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }

  return context;
};

export const usePlaybackStep = () => useContext(PlaybackStepContext);

export const AudioProvider = ({
  children,
  routeState,
}: {
  children: ReactNode;
  routeState?: StudioRouteState;
}) => {
  const [editorState, dispatch] = useReducer(editorReducer, routeState, createInitialEditorState);
  const [preferences, setPreferences] = useState(() => loadStudioPreferences());
  const [currentStep, setCurrentStep] = useState(0);
  const [countInActive, setCountInActive] = useState(false);
  const [countInBeatsRemaining, setCountInBeatsRemaining] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [projectCheckpoints, setProjectCheckpoints] = useState<PersistedCheckpoint[]>(() => listStudioCheckpoints());
  const [scoresheets, setScoresheets] = useState<Scoresheet[]>(() => listScoresheets());
  const [renderState, setRenderState] = useState<RenderState>(IDLE_RENDER_STATE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [latestNotice, setLatestNotice] = useState<StudioNotice | null>(null);
  const countInTokenRef = useRef(0);
  const manualSavePendingRef = useRef(false);
  const noticeIdRef = useRef(0);
  const saveErrorNoticeActiveRef = useRef(false);
  // One-shot flag: when a demo is requested, the next project sync starts
  // playback so a single click both loads and plays the scene. Held in a ref
  // so it survives the load re-render without being a dependency.
  const demoAutoplayRef = useRef(false);
  const togglePlayRef = useRef<(() => Promise<void>) | null>(null);

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
  const currentSession = useMemo<StudioSession>(() => ({
    project,
    ui: editorState.ui,
  }), [project, editorState.ui]);

  const publishNotice = useCallback((tone: StudioNotice['tone'], title: string, detail?: string) => {
    noticeIdRef.current += 1;
    setLatestNotice({ detail, id: noticeIdRef.current, title, tone });
  }, []);

  useEffect(() => {
    persistStudioPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.motionMode = preferences.motionMode;
  }, [preferences.motionMode]);

  // Name the browser tab after the current project so the showcase is easy to
  // pick out among other tabs, and falls back to the product name when unnamed.
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const name = project.metadata.name?.trim();
    document.title = name ? `${name} · SonicStudio` : 'SonicStudio';
  }, [project.metadata.name]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const tokens = ACCENT_PRESETS[preferences.accentColor];
    const root = document.documentElement;
    root.dataset.accent = preferences.accentColor;
    // SuperSonic ships its own cream-and-red accent theme (the
    // data-supersonic block in index.css). The accent presets are tuned
    // for the dark theme — painting them over SuperSonic leaves a cool
    // accent fighting the warm surfaces and a near-white accent-strong
    // that is illegible on cream. So in SuperSonic let the theme stand.
    if (preferences.superSonicMode) {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-strong');
      root.style.removeProperty('--accent-muted');
      root.style.removeProperty('--chrome-line');
    } else {
      root.style.setProperty('--accent', tokens.accent);
      root.style.setProperty('--accent-strong', tokens.accentStrong);
      root.style.setProperty('--accent-muted', tokens.accentMuted);
      root.style.setProperty('--chrome-line', tokens.chromeLine);
    }
  }, [preferences.accentColor, preferences.superSonicMode]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.dataset.density = preferences.density;
  }, [preferences.density]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.supersonic = preferences.superSonicMode ? 'true' : 'false';
  }, [preferences.superSonicMode]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.supersonicWaveIntensity = preferences.superSonic.waveIntensity;
    document.documentElement.dataset.supersonicGuidance = preferences.superSonic.guidanceBadges ? 'true' : 'false';
  }, [preferences.superSonic.guidanceBadges, preferences.superSonic.waveIntensity]);

  useEffect(() => {
    engine.setAudioStabilityMode(preferences.audioStabilityMode);
  }, [preferences.audioStabilityMode]);

  const playInterfaceSound = useEffectEvent((variant: string) => {
    if (!preferences.uiSoundsEnabled || !isUiSoundVariant(variant)) {
      return;
    }

    playUiSound(variant, preferences.superSonicMode ? 'supersonic' : 'classic');
  });

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const trigger = target.closest<HTMLElement>('[data-ui-sound]');
      if (trigger && !trigger.hasAttribute('disabled') && trigger.getAttribute('aria-disabled') !== 'true') {
        const variant = trigger.dataset.uiSound;
        if (variant) {
          playInterfaceSound(variant);
        }
        return;
      }

      // Default tick for any non-note button so the whole interface
      // ticks back. Note grid cells (inside .sequencer-grid-scroll) have
      // their own instrument feedback, and anything can opt out with
      // data-no-ui-sound.
      const button = target.closest<HTMLElement>('button, [role="button"]');
      if (!button) {
        return;
      }
      if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') {
        return;
      }
      if (button.closest('.sequencer-grid-scroll, [data-no-ui-sound]')) {
        return;
      }
      playInterfaceSound('tab');
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [playInterfaceSound]);

  useEffect(() => {
    engine.syncProject(project);
    setCurrentStep((current) => clampCurrentStepToLoopBounds(project, current, loopRangeStartBeat, loopRangeEndBeat));
    // A demo was requested: the engine now holds the freshly loaded scene, so
    // start playback on this same project. This runs after syncProject so the
    // transport never starts on the previous scene.
    if (demoAutoplayRef.current) {
      demoAutoplayRef.current = false;
      void togglePlayRef.current?.();
    }
  }, [project]);

  useEffect(() => {
    engine.setLoopRange(
      loopRangeStartBeat !== null && loopRangeEndBeat !== null
        ? { endBeat: loopRangeEndBeat, startBeat: loopRangeStartBeat }
        : null,
    );
    setCurrentStep((current) => clampCurrentStepToLoopBounds(project, current, loopRangeStartBeat, loopRangeEndBeat));
  }, [loopRangeEndBeat, loopRangeStartBeat]);

  useEffect(() => engine.onStep((step) => {
    setCurrentStep(step);
  }), []);

  useEffect(() => {
    if (routeState?.requestedView) {
      dispatch({ type: 'SET_ACTIVE_VIEW', view: routeState.requestedView });
    }

    dispatch({ type: 'SET_SETTINGS_OPEN', open: routeState?.shouldOpenSettings ?? false });
  }, [routeState?.requestedView, routeState?.shouldOpenSettings]);

  const hasPersistedOnceRef = useRef(false);
  const persistCurrentSession = useEffectEvent(() => {
    const envelope = persistStudioSession(currentSession);

    if (envelope) {
      setLastSavedAt(envelope.savedAt);
      setSaveStatus('saved');
      hasPersistedOnceRef.current = true;
      saveErrorNoticeActiveRef.current = false;
      if (manualSavePendingRef.current) {
        publishNotice('success', 'Session saved', 'Stored locally in this browser.');
      }
      manualSavePendingRef.current = false;
      return;
    }

    setSaveStatus('error');
    if (manualSavePendingRef.current || !saveErrorNoticeActiveRef.current) {
      publishNotice('error', 'Could not save session', 'Browser storage rejected the latest save.');
      saveErrorNoticeActiveRef.current = true;
    }
    manualSavePendingRef.current = false;
  });

  useEffect(() => {
    if (hasPersistedOnceRef.current) {
      setSaveStatus('saving');
    }

    const timeoutId = window.setTimeout(() => {
      persistCurrentSession();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // persistCurrentSession is a useEffectEvent and is intentionally omitted —
    // including it caused the effect to re-fire after each save, leaving the
    // status indicator stuck in 'saving'.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState.history.present, editorState.ui]);

  const initAudio = useCallback(async () => {
    await engine.init();
    engine.syncProject(project);
    setIsInitialized(true);
  }, [project]);

  // First-pointer audio unlock. Browser audio policy requires a user gesture
  // to start AudioContext. Rather than waiting for the user to find the Wake
  // audio button or press play, we silently arm the engine on the first
  // pointer/touch/keydown anywhere on the page. The handler is one-shot.
  const initAudioRef = useRef(initAudio);
  initAudioRef.current = initAudio;
  useEffect(() => {
    if (isInitialized) return;
    const wake = () => { void initAudioRef.current(); };
    const opts: AddEventListenerOptions = { once: true, passive: true };
    document.addEventListener('pointerdown', wake, opts);
    document.addEventListener('keydown', wake, opts);
    return () => {
      document.removeEventListener('pointerdown', wake);
      document.removeEventListener('keydown', wake);
    };
  }, [isInitialized]);

  const {
    auditionInstrumentNote,
    auditionTrackVoicePreset,
    previewTrack,
    resetTransportState,
    stop,
    togglePlay,
    toggleRecording,
  } = useMemo(() => createTransportController({
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
  }), [countInActive, initAudio, isInitialized, isPlaying, isRecording, project]);

  // Keep the latest togglePlay reachable from the project-sync effect without
  // making it a dependency (matches the initAudioRef pattern above).
  togglePlayRef.current = togglePlay;

  // Load-and-play: arm the one-shot flag, then the next project sync (from
  // loading a scene) starts playback. Distinct from opening a scene and then
  // pressing Play, which stays load-only.
  const requestDemoPlayback = useCallback(() => {
    demoAutoplayRef.current = true;
  }, []);

  const {
    deleteCheckpoint,
    exportSession: exportSessionToFile,
    importMidiSession: importMidiSessionFromController,
    importSession: importSessionFromController,
    loadSessionTemplate,
    loadTranscribedSession,
    newSession,
    restoreCheckpoint,
    saveCheckpoint,
    saveProject: persistSessionNow,
  } = useMemo(() => createSessionController({
    currentProject: project,
    currentUi: editorState.ui,
    dispatchHydrateSession: (session) => dispatch({ type: 'HYDRATE_SESSION', session }),
    persistCurrentSession,
    resetTransportState,
    setLastSavedAt,
    setProjectCheckpoints,
    setSaveStatus,
  }), [editorState.ui, persistCurrentSession, project, resetTransportState]);

  const saveProject = useCallback(() => {
    manualSavePendingRef.current = true;
    persistSessionNow();
  }, [persistSessionNow]);

  const exportTrainingCorpus = useCallback(() => {
    downloadTrainingCorpus(project);
    const summary = summarizeTrainingCorpus(project);
    publishNotice(
      'success',
      'Training corpus saved',
      `${summary.trackCount} ${summary.trackCount === 1 ? 'track' : 'tracks'}, ${summary.noteCount} ${summary.noteCount === 1 ? 'note' : 'notes'}, ${summary.patternCount} ${summary.patternCount === 1 ? 'pattern' : 'patterns'}. README.md follows.`,
    );
  }, [project]);

  const trainingCorpusSummary = useMemo(() => summarizeTrainingCorpus(project), [project]);

  const importSession = useCallback(async (file: File) => {
    const ok = await importSessionFromController(file);
    publishNotice(
      ok ? 'success' : 'error',
      ok ? 'Session imported' : 'Could not import session',
      ok ? `Loaded ${file.name}.` : 'That file does not match the SonicStudio session format.',
    );
    return ok;
  }, [importSessionFromController]);

  const importMidiSession = useCallback(async (file: File) => {
    const ok = await importMidiSessionFromController(file);
    publishNotice(
      ok ? 'success' : 'error',
      ok ? 'MIDI imported' : 'Could not import MIDI',
      ok ? `Loaded ${file.name}.` : 'Try a standard .mid file and import it again.',
    );
    return ok;
  }, [importMidiSessionFromController]);

  const keyboardShortcutHandler = useEffectEvent(createKeyboardShortcutHandler({
    dispatch,
    isSettingsOpen: editorState.ui.isSettingsOpen,
    project,
    saveProject,
    setSuperSonicMode: (superSonicMode) => setPreferences((current) => ({ ...current, superSonicMode })),
    superSonicMode: preferences.superSonicMode,
    togglePlay,
    toggleRecording,
  }));

  useEffect(() => {
    window.addEventListener('keydown', keyboardShortcutHandler);

    return () => {
      window.removeEventListener('keydown', keyboardShortcutHandler);
    };
  }, [keyboardShortcutHandler]);

  const handleSaveScoresheet = useCallback((name: string, options?: { replaceId?: string }) => {
    const next = saveScoresheetService(name, { project, ui: editorState.ui }, options ?? {});
    setScoresheets(next);
  }, [editorState.ui, project]);
  const handleLoadScoresheet = useCallback((id: string) => {
    const sheet = loadScoresheetService(id);
    if (!sheet) return;
    dispatch({ type: 'HYDRATE_SESSION', session: sheet.session });
    // Restore the manual key override the user had at save time so
    // reopening a scoresheet picks up where the user left off. A
    // sheet saved without an override clears any current pin so the
    // session resumes auto detection.
    setManualKeyOverride(sheet.manualKeyOverride ?? null);
    resetTransportState();
    setSaveStatus('idle');
  }, [resetTransportState]);
  const handleRenameScoresheet = useCallback((id: string, name: string) => {
    setScoresheets(renameScoresheetService(id, name));
  }, []);
  const handleDeleteScoresheet = useCallback((id: string) => {
    setScoresheets(deleteScoresheetService(id));
  }, []);

  const {
    exportAudioMix,
    exportMidi,
    exportTrackStems,
    rerunBounceHistory,
  } = useMemo(() => createRenderController({
    currentProject: project,
    dispatchAppendBounceHistory: (entry) => dispatch({ type: 'APPEND_BOUNCE_HISTORY', entry }),
    loopRangeEndBeat,
    loopRangeStartBeat,
    notify: publishNotice,
    selectedArrangerClipId,
    setRenderState,
  }), [loopRangeEndBeat, loopRangeStartBeat, project, publishNotice, selectedArrangerClipId]);

  const audioContextValue = useMemo<AudioContextType>(() => ({
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
    currentSession,
    exportAudioMix,
    exportMidi,
    exportTrackStems,
    exportSession: exportSessionToFile,
    importMidiSession,
    importSession,
    initAudio,
    isInitialized,
    isPlaying,
    isRecording,
    isSettingsOpen: editorState.ui.isSettingsOpen,
    lastSavedAt,
    latestNotice,
    loadSessionTemplate,
    loadTranscribedSession,
    loopRangeEndBeat,
    loopRangeStartBeat,
    master: project.master,
    masterSnapshots: project.masterSnapshots,
    metronomeEnabled: project.transport.metronomeEnabled,
    motionMode: preferences.motionMode,
    capturePreferences: preferences.capture,
    accentColor: preferences.accentColor,
    density: preferences.density,
    defaultWorkspace: preferences.defaultWorkspace,
    superSonicMode: preferences.superSonicMode,
    superSonicPreferences: preferences.superSonic,
    newSession,
    patternCount: project.transport.patternCount,
    pinnedTrackIds,
    previewTrack,
    auditionInstrumentNote,
    auditionTrackVoicePreset,
    projectCheckpoints,
    scoresheets,
    saveScoresheet: handleSaveScoresheet,
    loadScoresheet: handleLoadScoresheet,
    renameScoresheet: handleRenameScoresheet,
    deleteScoresheet: handleDeleteScoresheet,
    projectName: project.metadata.name,
    renderState,
    rerunBounceHistory,
    restoreCheckpoint,
    saveCheckpoint,
    saveProject,
    exportTrainingCorpus,
    trainingCorpusSummary,
    saveStatus,
    selectedArrangerClipId,
    selectedTrackId,
    songLengthInBeats,
    songMarkers,
    stepsPerPattern: project.transport.stepsPerPattern,
    stop,
    requestDemoPlayback,
    togglePlay,
    toggleRecording,
    tracks: project.tracks,
    trackSnapshots: project.trackSnapshots,
    transportMode: project.transport.mode,
    uiSoundsEnabled: preferences.uiSoundsEnabled,
    midiInputEnabled: preferences.midiInputEnabled,
    midiRecordEnabled: preferences.midiRecordEnabled,
    stickyMobileTransport: preferences.stickyMobileTransport,
    audioStabilityMode: preferences.audioStabilityMode,
    deleteCheckpoint,
    ...dispatchers,
    setMotionMode: (motionMode) => setPreferences((current) => ({ ...current, motionMode })),
    setCaptureAnalysisProfile: (analysisProfile) => setPreferences((current) => ({
      ...current,
      capture: {
        ...current.capture,
        analysisProfile,
      },
    })),
    setCaptureAutoPreviewMatch: (autoPreviewMatch) => setPreferences((current) => ({
      ...current,
      capture: {
        ...current.capture,
        autoPreviewMatch,
      },
    })),
    setCaptureKeepShelfBetweenTakes: (keepShelfBetweenTakes) => setPreferences((current) => ({
      ...current,
      capture: {
        ...current.capture,
        keepShelfBetweenTakes,
      },
    })),
    setCaptureLiveSuggestionCount: (liveSuggestionCount) => setPreferences((current) => ({
      ...current,
      capture: {
        ...current.capture,
        liveSuggestionCount,
      },
    })),
    setSettingsOpen: (open) => dispatch({ type: 'SET_SETTINGS_OPEN', open }),
    setUiSoundsEnabled: (uiSoundsEnabled) => setPreferences((current) => ({ ...current, uiSoundsEnabled })),
    setMidiInputEnabled: (midiInputEnabled) => setPreferences((current) => ({ ...current, midiInputEnabled })),
    setMidiRecordEnabled: (midiRecordEnabled) => setPreferences((current) => ({ ...current, midiRecordEnabled })),
    setStickyMobileTransport: (stickyMobileTransport) => setPreferences((current) => ({ ...current, stickyMobileTransport })),
    setAudioStabilityMode: (audioStabilityMode) => setPreferences((current) => ({ ...current, audioStabilityMode })),
    setAccentColor: (accentColor) => setPreferences((current) => ({ ...current, accentColor })),
    setDensity: (density) => setPreferences((current) => ({ ...current, density })),
    setDefaultWorkspace: (defaultWorkspace) => setPreferences((current) => ({ ...current, defaultWorkspace })),
    resetStudioPreferences: () => setPreferences(DEFAULT_STUDIO_PREFERENCES),
    setSuperSonicMode: (superSonicMode) => setPreferences((current) => ({ ...current, superSonicMode })),
    setSuperSonicGuidanceBadges: (guidanceBadges) => setPreferences((current) => ({
      ...current,
      superSonic: {
        ...current.superSonic,
        guidanceBadges,
      },
    })),
    setSuperSonicWaveIntensity: (waveIntensity) => setPreferences((current) => ({
      ...current,
      superSonic: {
        ...current.superSonic,
        waveIntensity,
      },
    })),
  }), [
    activeView,
    arrangerClips,
    countInActive,
    countInBeatsRemaining,
    currentSession,
    deleteCheckpoint,
    dispatchers,
    editorState.history.future.length,
    editorState.history.past.length,
    editorState.ui.isSettingsOpen,
    exportAudioMix,
    exportMidi,
    exportSessionToFile,
    exportTrackStems,
    handleDeleteScoresheet,
    handleLoadScoresheet,
    handleRenameScoresheet,
    handleSaveScoresheet,
    importMidiSession,
    importSession,
    initAudio,
    isInitialized,
    isPlaying,
    isRecording,
    lastSavedAt,
    latestNotice,
    loadSessionTemplate,
    loadTranscribedSession,
    loopRangeEndBeat,
    loopRangeStartBeat,
    newSession,
    pinnedTrackIds,
    preferences.accentColor,
    preferences.capture,
    preferences.defaultWorkspace,
    preferences.density,
    preferences.motionMode,
    preferences.superSonic,
    preferences.superSonicMode,
    preferences.uiSoundsEnabled,
    preferences.midiInputEnabled,
    preferences.midiRecordEnabled,
    preferences.stickyMobileTransport,
    preferences.audioStabilityMode,
    previewTrack,
    auditionInstrumentNote,
    auditionTrackVoicePreset,
    project,
    projectCheckpoints,
    renderState,
    rerunBounceHistory,
    restoreCheckpoint,
    saveCheckpoint,
    saveProject,
    exportTrainingCorpus,
    trainingCorpusSummary,
    saveStatus,
    scoresheets,
    selectedArrangerClipId,
    selectedTrackId,
    songLengthInBeats,
    songMarkers,
    stop,
    requestDemoPlayback,
    togglePlay,
    toggleRecording,
  ]);

  return (
    <PlaybackStepContext.Provider value={currentStep}>
      <AudioContext.Provider value={audioContextValue}>
        {children}
      </AudioContext.Provider>
    </PlaybackStepContext.Provider>
  );
};
