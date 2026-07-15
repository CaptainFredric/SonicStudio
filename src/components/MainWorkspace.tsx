import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eraser,
  Focus,
  LocateFixed,
  Maximize2,
  Minus,
  Mic,
  Minimize2,
  Music2,
  MousePointer2,
  Pencil,
  Pin,
  Play,
  Plus,
  Repeat2,
  SlidersHorizontal,
  Trash2,
  VolumeX,
  Wand2,
  X,
  Zap,
} from 'lucide-react';

import { meterIntervalForMode } from '../audio/meterTiming';
import { engine } from '../audio/ToneEngine';
import { SUPERSONIC_NOTE_OFFSETS, getTrackAnchorNote, pitchRank, shiftPitch } from '../utils/notePlacement';
import { bestKeyTranspose, pitchClassFromNote } from '../utils/pitch';
import { hasLoopSource, loopFillSteps } from '../utils/loopFill';
import { useAudio, usePlaybackStep } from '../context/AudioContext';
import { SONG_FORM_DEFINITIONS, type SongFormId } from '../context/editor/songFormDefinitions';
import {
  createPatternSegment,
  loadPatternSegments,
  persistPatternSegments,
  type PatternSegment,
} from '../services/patternSegments';
import { FACTORY_LOOP_LIBRARY } from '../services/loopLibrary';
import {
  loadCapturedNoteStrings,
  noteStringToPatternSegment,
  saveCapturedNoteStringFromTokens,
  tokensFromPatternSteps,
} from '../services/noteStringLibrary';
import { useQueuedNoteStringId } from '../services/noteStringQueue';
import { listScoresheets, getScoresheetThumbnail } from '../services/scoresheets';
import { getEffectiveKey, laneFitness } from '../services/keyDetector';
import {
  buildSessionPlayerPatternDecks,
  buildSessionPlayerSegments,
  getSessionPlayerTrackTypes,
  SESSION_PLAYER_PROFILES,
} from '../services/sessionPlayers';
import { shiftNote } from './arranger/noteUtils';
import { CollapsedLaneIcon } from './CollapsedLaneIcon';
import { LaneKeyChip } from './LaneKeyChip';
import { TrackMeterBar } from './TrackMeterBar';
import {
  NOTE_GATE_FINE_STEP,
  NOTE_GATE_MAX,
  NOTE_GATE_MIN,
  NOTE_GATE_PRESETS,
  clampNoteGate,
} from '../utils/noteEditing';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';
import { useMediaQuery } from '../utils/useMediaQuery';
import { readString, writeString } from '../utils/safeStorage';
import { TrackMinimap } from './TrackMinimap';
import { PatternColumnMenu } from './PatternColumnMenu';
import { openNotesPanel } from './notesPanelStore';
import { setEditingMode, useEditingMode } from './editingModeStore';
import { SongTimelineGrid } from './SongTimelineGrid';
import { SongSectionManagerDialog } from './SongSectionManager';
import { buildSectionRanges } from './arranger/arrangerSelectors';
import { buildRunwayContinuation } from '../utils/runwayContinuation';
import { getSequencerFollowScrollLeft, getSequencerWheelPanDelta } from '../utils/sequencerViewport';
import { clearPatternRange, copyPatternRange, movePatternRange, writePatternRange } from '../utils/stepRangeEditing';
import {
  mapBeatAfterPatternColumnDelete,
  mapBeatAfterPatternColumnInsert,
  type PatternColumnOperation,
} from '../utils/patternColumnEditing';

const LANE_COLUMN_COLLAPSED_KEY = 'sonicstudio:lane-column-collapsed';
const TRACK_MAP_OPEN_KEY = 'sonicstudio:track-map-open';
const COMPOSE_TOOLS_KEY = 'sonicstudio:compose-tools-open';
const ADD_LANE_OPEN_KEY = 'sonicstudio:add-lane-open';
const SONG_FLATTEN_KEY = 'sonicstudio:song-flatten';
const SONG_TIMELINE_ZOOM_KEY = 'sonicstudio:song-timeline-zoom';
import { MAX_STEPS_PER_PATTERN, MIN_STEPS_PER_PATTERN, type InstrumentType, type NoteEvent, type Track } from '../project/schema';

const TRACK_BUTTONS = [
  { label: 'Kick', type: 'kick' as const, family: 'Rhythm' },
  { label: 'Snare', type: 'snare' as const, family: 'Rhythm' },
  { label: 'Hi-hat', type: 'hihat' as const, family: 'Rhythm' },
  { label: 'Bass', type: 'bass' as const, family: 'Low end' },
  { label: 'Lead', type: 'lead' as const, family: 'Melody' },
  { label: 'Violin', type: 'violin' as const, family: 'Melody' },
  { label: 'Piano', type: 'piano' as const, family: 'Melody' },
  { label: 'Pad', type: 'pad' as const, family: 'Harmony' },
  { label: 'Pluck', type: 'pluck' as const, family: 'Accent' },
  { label: 'Bell', type: 'bell' as const, family: 'Accent' },
  { label: 'FX', type: 'fx' as const, family: 'Texture' },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const QUICK_INTERVALS = [
  { label: '-8va', semitones: -12 },
  { label: '-5th', semitones: -7 },
  { label: '+5th', semitones: 7 },
  { label: '+8va', semitones: 12 },
] as const;
const NOTE_OPTIONS = buildNoteOptions(6, 2);
const STEP_OPTIONS = [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096] as const;
// The lengths that get one-click chips; the rest live in the dropdown so the
// tools row is not a wall of seventeen buttons.
const QUICK_STEP_OPTIONS = [16, 32, 64, 128] as const;
const SEQUENCER_RUNWAY_STEPS = 6;
const RUNWAY_GHOST_STEPS = 5;
const STEP_ZOOM_MIN = 16;
const STEP_ZOOM_STEP = 2;
const SONG_TIMELINE_ZOOM_MIN = 12;
const SONG_TIMELINE_ZOOM_DEFAULT = 24;
const SESSION_PLAYER_PATTERN_COUNT = 4;
const LOOP_BROWSER_FILTERS = [
  { label: 'Matching lane', value: 'MATCHING' as const },
  { label: 'All loops', value: 'ALL' as const },
  { label: 'Rhythm', value: 'RHYTHM' as const },
  { label: 'Musical', value: 'MUSICAL' as const },
] as const;

interface LaneRunwayGesture {
  count: number;
  note?: string;
  pointerId: number;
  startStep: number;
  trackId: string;
}

interface StepRangeSelection {
  end: number;
  start: number;
  trackIds: string[];
}

interface StepRangeMoveGesture {
  anchorStep: number;
  original: StepRangeSelection;
  targetStart: number;
  totalSteps: number;
}

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// Count plus a noun that pluralizes when it should, so summaries never read
// "1 active steps" or "1 notes".
const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const isRhythmTrackType = (trackType: InstrumentType) => (
  trackType === 'kick' || trackType === 'snare' || trackType === 'hihat'
);
const uniqueTrackTypes = (trackTypes: InstrumentType[]) => trackTypes.filter((trackType, index) => (
  trackTypes.indexOf(trackType) === index
));

const formatTrackTypeLabel = (trackType: InstrumentType) => {
  if (trackType === 'hihat') {
    return 'hi-hat';
  }

  return trackType;
};

const formatTrackTypeList = (trackTypes: InstrumentType[]) => (
  uniqueTrackTypes(trackTypes).map((trackType) => formatTrackTypeLabel(trackType)).join(', ')
);

type SessionPlayerApplyMode = 'groove' | 'song';

type ComposeEditorMode = 'select' | 'edit';
type LoadWatchState = 'light' | 'busy' | 'dense';

interface PendingSessionPlayerRequest {
  formId: SongFormId;
  mode: SessionPlayerApplyMode;
  profileId: string;
}

interface PatternActivitySpan {
  activeStepCount: number;
  endStep: number;
  noteCount: number;
  startStep: number;
}

interface LoadWatchSummary {
  activeLaneCount: number;
  baseLatencyMs: number | null;
  frameDriftMs: number;
  label: string;
  peakNotes: number;
  score: number;
  state: LoadWatchState;
  totalNotes: number;
}

const LOAD_WATCH_STYLES: Record<LoadWatchState, { bar: string; text: string }> = {
  busy: {
    bar: 'linear-gradient(90deg, rgba(212,177,106,0.96) 0%, rgba(246,173,85,0.96) 100%)',
    text: 'rgba(246,173,85,0.96)',
  },
  dense: {
    bar: 'linear-gradient(90deg, rgba(248,113,113,0.96) 0%, rgba(239,68,68,0.96) 100%)',
    text: 'rgba(248,113,113,0.96)',
  },
  light: {
    bar: 'linear-gradient(90deg, rgba(130,201,187,0.96) 0%, rgba(124,211,252,0.96) 100%)',
    text: 'rgba(130,201,187,0.96)',
  },
};

const getSongFormDefinition = (formId: SongFormId) => (
  SONG_FORM_DEFINITIONS.find((definition) => definition.id === formId) ?? SONG_FORM_DEFINITIONS[0]
);

const cloneStepEvents = (step: NoteEvent[]) => step.map((event) => ({ ...event }));

const segmentSpanSteps = (segment: PatternSegment) => {
  let lastActiveStep = -1;
  segment.steps.forEach((step, index) => {
    if (step.length > 0) {
      lastActiveStep = index;
    }
  });

  return Math.max(1, Math.min(segment.stepsPerPattern, lastActiveStep >= 0 ? lastActiveStep + 1 : segment.stepsPerPattern));
};

const getPatternActivitySpan = (patternSteps: NoteEvent[][], stepsPerPattern: number): PatternActivitySpan | null => {
  let firstActiveStep = -1;
  let lastEndStep = -1;
  let activeStepCount = 0;
  let noteCount = 0;

  patternSteps.forEach((step, stepIndex) => {
    if (step.length === 0) {
      return;
    }

    if (firstActiveStep === -1) {
      firstActiveStep = stepIndex;
    }

    activeStepCount += 1;
    noteCount += step.length;
    const longestStepGate = step.reduce((maxGate, event) => (
      Math.max(maxGate, Math.max(1, Math.ceil(event.gate)))
    ), 1);
    lastEndStep = Math.max(lastEndStep, Math.min(stepsPerPattern, stepIndex + longestStepGate));
  });

  if (firstActiveStep === -1 || lastEndStep <= firstActiveStep) {
    return null;
  }

  return {
    activeStepCount,
    endStep: lastEndStep,
    noteCount,
    startStep: firstActiveStep,
  };
};

const buildLoadWatchSummary = (
  tracks: Track[],
  currentPattern: number,
  stepsPerPattern: number,
  superSonicMode: boolean,
  liveOutputLevelDb: number,
  baseLatencyMs: number | null,
  frameDriftMs: number,
  isPlaying: boolean,
): LoadWatchSummary => {
  let activeLaneCount = 0;
  let peakNotes = 0;
  let totalNotes = 0;
  let sustainedNotes = 0;
  let activeSampleLanes = 0;

  const patternStepsByTrack = tracks.map((track) => {
    const patternSteps = getTrackPatternSteps(track, currentPattern, stepsPerPattern);
    const hasNotes = patternSteps.some((step) => step.length > 0);

    if (hasNotes) {
      activeLaneCount += 1;
      if (track.source.engine === 'sample') {
        activeSampleLanes += 1;
      }
    }

    return patternSteps;
  });

  for (let stepIndex = 0; stepIndex < stepsPerPattern; stepIndex += 1) {
    let simultaneousNotes = 0;

    patternStepsByTrack.forEach((patternSteps) => {
      const step = patternSteps[stepIndex] ?? [];
      simultaneousNotes += step.length;
      totalNotes += step.length;
      sustainedNotes += step.reduce((count, event) => count + (event.gate > 1.25 ? 1 : 0), 0);
    });

    peakNotes = Math.max(peakNotes, simultaneousNotes);
  }

  const livePlaybackBoost = liveOutputLevelDb > -42 ? 8 : 0;
  const latencyPenalty = baseLatencyMs === null
    ? 0
    : baseLatencyMs > 55
      ? 20
      : baseLatencyMs > 35
        ? 12
        : baseLatencyMs > 24
          ? 6
          : 0;
  const frameDriftPenalty = frameDriftMs > 11
    ? 18
    : frameDriftMs > 7
      ? 10
      : frameDriftMs > 4
        ? 5
        : 0;
  const runtimePressure = latencyPenalty + frameDriftPenalty;
  const playingPenalty = isPlaying ? (latencyPenalty + frameDriftPenalty) : Math.round((latencyPenalty + frameDriftPenalty) * 0.35);
  const score = Math.min(
    100,
    Math.round(
      (activeLaneCount * 9)
      + (activeSampleLanes * 12)
      + (peakNotes * 5)
      + (sustainedNotes * 2)
      + (totalNotes * 0.45)
      + (superSonicMode ? 8 : 0)
      + livePlaybackBoost
      + playingPenalty,
    ),
  );

  if (score >= 82 && runtimePressure >= 8) {
    return {
      activeLaneCount,
      baseLatencyMs,
      frameDriftMs,
      label: 'Dense session',
      peakNotes,
      score,
      state: 'dense',
      totalNotes,
    };
  }

  if (score >= 82) {
    return {
      activeLaneCount,
      baseLatencyMs,
      frameDriftMs,
      label: 'Heavy arrangement',
      peakNotes,
      score,
      state: 'busy',
      totalNotes,
    };
  }

  if (score >= 48) {
    return {
      activeLaneCount,
      baseLatencyMs,
      frameDriftMs,
      label: 'Busy session',
      peakNotes,
      score,
      state: 'busy',
      totalNotes,
    };
  }

  return {
    activeLaneCount,
    baseLatencyMs,
    frameDriftMs,
    label: 'Light load',
    peakNotes,
    score,
    state: 'light',
    totalNotes,
  };
};

interface TrackOverviewStepActivity {
  currentCount: number;
  otherCount: number;
}

interface TrackOverviewRow {
  currentPatternActiveSteps: number;
  currentPatternSteps: NoteEvent[][];
  otherPatternContext: 'bank' | 'song';
  otherPatternActiveSteps: number;
  stepActivity: TrackOverviewStepActivity[];
  totalActiveSteps: number;
  track: Track;
}

const countPatternActiveSteps = (patternSteps?: NoteEvent[][]) => (
  patternSteps?.reduce((count, step) => count + (step.length > 0 ? 1 : 0), 0) ?? 0
);

const getTrackPatternSteps = (track: Track, patternIndex: number, stepsPerPattern: number) => (
  Array.from({ length: stepsPerPattern }, (_, stepIndex) => track.patterns[patternIndex]?.[stepIndex] ?? [])
);

const buildTrackOverviewRow = (
  track: Track,
  currentPattern: number,
  stepsPerPattern: number,
  options: { songPatternIndices: Set<number> | null; transportMode: 'PATTERN' | 'SONG' },
): TrackOverviewRow => {
  const currentPatternSteps = getTrackPatternSteps(track, currentPattern, stepsPerPattern);
  const currentPatternActiveSteps = countPatternActiveSteps(currentPatternSteps);
  const stepActivity = Array.from({ length: stepsPerPattern }, (_, stepIndex) => ({
    currentCount: currentPatternSteps[stepIndex]?.length ?? 0,
    otherCount: 0,
  }));
  const otherPatternContext: 'bank' | 'song' = options.transportMode === 'SONG' ? 'song' : 'bank';
  let otherPatternActiveSteps = 0;

  Object.entries(track.patterns).forEach(([patternKey, patternSteps]) => {
    const patternIndex = Number(patternKey);
    if (patternIndex === currentPattern) {
      return;
    }

    if (options.transportMode === 'SONG' && !options.songPatternIndices?.has(patternIndex)) {
      return;
    }

    otherPatternActiveSteps += countPatternActiveSteps(patternSteps);

    for (let stepIndex = 0; stepIndex < stepsPerPattern; stepIndex += 1) {
      const noteCount = patternSteps?.[stepIndex]?.length ?? 0;
      if (noteCount > stepActivity[stepIndex].otherCount) {
        stepActivity[stepIndex].otherCount = noteCount;
      }
    }
  });

  return {
    currentPatternActiveSteps,
    currentPatternSteps,
    otherPatternContext,
    otherPatternActiveSteps,
    stepActivity,
    totalActiveSteps: currentPatternActiveSteps + otherPatternActiveSteps,
    track,
  };
};

type LaneGroupKey = 'RHYTHM' | 'MUSICAL' | 'TEXTURE';
type LaneSectionKey = LaneGroupKey | 'PINNED';

const LANE_GROUP_LABELS: Record<LaneGroupKey, string> = {
  RHYTHM: 'Rhythm',
  MUSICAL: 'Musical',
  TEXTURE: 'Texture',
};

const getLaneGroup = (trackType: typeof TRACK_BUTTONS[number]['type']): LaneGroupKey => {
  if (trackType === 'kick' || trackType === 'snare' || trackType === 'hihat') {
    return 'RHYTHM';
  }

  if (trackType === 'fx') {
    return 'TEXTURE';
  }

  return 'MUSICAL';
};

// The transport step advances several times a second. Toggling the current-step
// highlight through React state re-renders the whole sequencer each step, and
// that per-step churn allocates enough garbage to trigger GC pauses that stutter
// playback. Instead this leaf subscribes to the step on its own and flips a
// `data-current` attribute on the matching cells; CSS paints the playhead. The
// grid never re-renders, so the allocation rate during playback stays flat.
const SequencerPlayheadDriver = ({
  followPlayhead,
  gridViewportRef,
  laneHeaderWidth,
  markProgrammaticScroll,
  stepCellWidth,
  stepsPerPattern,
}: {
  followPlayhead: boolean;
  gridViewportRef: React.RefObject<HTMLDivElement | null>;
  laneHeaderWidth: number;
  markProgrammaticScroll: () => void;
  stepCellWidth: number;
  stepsPerPattern: number;
}) => {
  const currentStep = usePlaybackStep();
  useEffect(() => {
    if (stepsPerPattern <= 0) {
      return;
    }
    const step = ((currentStep % stepsPerPattern) + stepsPerPattern) % stepsPerPattern;
    const cells = document.querySelectorAll(`[data-seq-cell="true"][data-step-index="${step}"]`);
    cells.forEach((cell) => cell.setAttribute('data-current', 'true'));

    const node = gridViewportRef.current;
    if (followPlayhead && node) {
      const nextLeft = getSequencerFollowScrollLeft({
        clientWidth: node.clientWidth,
        laneHeaderWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
        stepCellWidth,
        stepIndex: step,
      });

      if (nextLeft !== null) {
        markProgrammaticScroll();
        node.scrollTo({ behavior: 'smooth', left: nextLeft });
      }
    }

    return () => {
      cells.forEach((cell) => cell.removeAttribute('data-current'));
    };
  }, [currentStep, followPlayhead, gridViewportRef, laneHeaderWidth, markProgrammaticScroll, stepCellWidth, stepsPerPattern]);
  return null;
};

// The load-watch panel polls the master meter ~8x a second and monitors frame
// drift, both of which change constantly during playback. Living inside
// MainWorkspace, each of those updates re-rendered the entire workspace, which
// was the largest remaining source of per-frame garbage. Isolated here, only
// this small panel re-renders. It is desktop-only, so on mobile the polling and
// the drift loop do not run at all.
const LoadWatchReadout = ({
  tracks,
  currentPattern,
  stepsPerPattern,
  superSonicMode,
  isPlaying,
}: {
  tracks: Track[];
  currentPattern: number;
  stepsPerPattern: number;
  superSonicMode: boolean;
  isPlaying: boolean;
}) => {
  const [masterLevel, setMasterLevel] = useState(-100);
  const [uiFrameDriftMs, setUiFrameDriftMs] = useState(0);
  const [audioBaseLatencyMs, setAudioBaseLatencyMs] = useState<number | null>(() => {
    const latencySeconds = engine.getBaseLatencySeconds();
    return latencySeconds === null ? null : Number((latencySeconds * 1000).toFixed(1));
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMasterLevel(engine.getMasterMeterValue());
    }, 120);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const latencySeconds = engine.getBaseLatencySeconds();
    setAudioBaseLatencyMs(latencySeconds === null ? null : Number((latencySeconds * 1000).toFixed(1)));
  }, [isPlaying, tracks.length, stepsPerPattern, superSonicMode]);

  useEffect(() => {
    if (!isPlaying) {
      setUiFrameDriftMs((current) => (current === 0 ? current : 0));
      return undefined;
    }
    let frameId = 0;
    let lastFrameTime = performance.now();
    let driftAccumulator = 0;
    let sampleCount = 0;
    const tick = (now: number) => {
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      driftAccumulator += Math.max(0, delta - 16.67);
      sampleCount += 1;
      if (sampleCount >= 15) {
        const nextDrift = driftAccumulator / sampleCount;
        setUiFrameDriftMs((current) => {
          const smoothed = Number(((current * 0.65) + (nextDrift * 0.35)).toFixed(2));
          // Skip the re-render when the reading barely moved, so steady playback
          // does not keep re-rendering this panel.
          return Math.abs(smoothed - current) < 0.3 ? current : smoothed;
        });
        driftAccumulator = 0;
        sampleCount = 0;
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const loadWatchSummary = useMemo(() => (
    buildLoadWatchSummary(
      tracks,
      currentPattern,
      stepsPerPattern,
      superSonicMode,
      masterLevel,
      audioBaseLatencyMs,
      uiFrameDriftMs,
      isPlaying,
    )
  ), [audioBaseLatencyMs, currentPattern, isPlaying, masterLevel, stepsPerPattern, superSonicMode, tracks, uiFrameDriftMs]);
  const loadWatchStyle = LOAD_WATCH_STYLES[loadWatchSummary.state];

  return (
    <div className="surface-panel-strong min-w-[196px] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="section-label">Load watch</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: loadWatchStyle.text }}>
          {loadWatchSummary.label}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-black/20">
        <div className="h-full rounded-[2px]" style={{ background: loadWatchStyle.bar, width: `${Math.max(6, loadWatchSummary.score)}%` }} />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        {countLabel(loadWatchSummary.activeLaneCount, 'lane')} · {countLabel(loadWatchSummary.totalNotes, 'note')} · peak {loadWatchSummary.peakNotes}
        {loadWatchSummary.baseLatencyMs !== null ? ` · ${Math.round(loadWatchSummary.baseLatencyMs)}ms base` : ''}
        {isPlaying ? ` · ${loadWatchSummary.frameDriftMs.toFixed(1)}ms drift` : ''}
      </div>
    </div>
  );
};

export const MainWorkspace = () => {
  const isMobileViewport = useMediaQuery('(max-width: 767px)');
  // Below the xl breakpoint the inspector cannot sit beside the grid, so it
  // stacks underneath as a full-width sheet. Treat that whole range like
  // mobile: keep it behind the Show inspector toggle so the grid leads.
  const isNarrowViewport = useMediaQuery('(max-width: 1279px)');
  const {
    applySongForm,
    applyPatternSegment,
    applyPatternStepBatch,
    clearSongRange,
    clearPatternAt,
    clearTrack,
    continuePatternRunway,
    createTrack,
    currentPattern,
    duplicateTrack,
    duplicateSongRange,
    deleteSongRange,
    editPatternColumn,
    loopRangeEndBeat,
    loopRangeStartBeat,
    insertBlankSongSection,
    insertSavedSongSection,
    moveTrack,
    patternCount,
    pinnedTrackIds,
    previewTrack,
    removeTrack,
    removeSavedSongSection,
    audioStabilityMode,
    isPlaying,
    selectedTrackId,
    setActiveView,
    setCurrentPattern,
    setLoopRange,
    setPatternCount,
    setSelectedTrackId,
    setStepsPerPattern,
    setTransportMode,
    transportMode,
    shiftPattern,
    stepsPerPattern,
    superSonicMode,
    superSonicPreferences,
    toggleStep,
    togglePatternStep,
    placeSongStep,
    toggleMute,
    setTrackParams,
    togglePinnedTrack,
    toggleSolo,
    tracks,
    arrangerClips,
    songLengthInBeats,
    songMarkers,
    savedSongSections,
    createSongMarker,
    saveSongRange,
    updateSongMarker,
    removeSongMarker,
    renameSavedSongSection,
    resizeSongSectionEnd,
    reorderTrack,
    transposePattern,
    updateStepEvent,
  } = useAudio();
  const [editorMode, setEditorMode] = useState<ComposeEditorMode>('edit');
  // In Song mode the sequencer can flatten the whole arrangement into one
  // scrollable grid so every section's notes are visible, not just the current
  // pattern. Users can flip back to the classic per-pattern editor.
  // Default to the single-pattern step grid, which is height-bounded and fits
  // the screen, rather than the whole-song timeline that grows to the full
  // arrangement height. The "Whole song" toggle switches over and the choice is
  // remembered between sessions.
  const [songFlatten, setSongFlatten] = useState(() => readString(SONG_FLATTEN_KEY) === 'true');
  const showSongGrid = transportMode === 'SONG' && songFlatten;
  const [sectionManagerOpen, setSectionManagerOpen] = useState(false);
  const [managedSectionId, setManagedSectionId] = useState<string | null>(null);
  const closeSectionManager = useCallback(() => setSectionManagerOpen(false), []);
  const songSectionRanges = useMemo(
    () => buildSectionRanges(arrangerClips, songMarkers, songLengthInBeats),
    [arrangerClips, songLengthInBeats, songMarkers],
  );
  // The compose rack and track map collapse by default so the step grid
  // leads the view; roomy desktops open them automatically.
  // Start collapsed so the default view is the pattern grid and the timeline,
  // not the full tools drawer; the "Tools" toggle opens it and the choice is
  // remembered for anyone who wants it open every session.
  const [composeToolsExpanded, setComposeToolsExpanded] = useState(() => readString(COMPOSE_TOOLS_KEY) === 'true');
  const editingMode = useEditingMode();
  const toggleEditingMode = useCallback(() => setEditingMode(!editingMode), [editingMode]);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [stepColumnMenuIndex, setStepColumnMenuIndex] = useState<number | null>(null);
  // A dragged step range (select mode), spanning one lane or several. Feeds
  // Cmd+D duplication and survives the drag, so you can grab a phrase and
  // stamp it forward.
  const [stepRange, setStepRange] = useState<StepRangeSelection | null>(null);
  const [stepRangeMovePreview, setStepRangeMovePreview] = useState<StepRangeSelection | null>(null);
  const stepRangeMoveGestureRef = useRef<StepRangeMoveGesture | null>(null);
  const commitStepRangeMoveRef = useRef<() => void>(() => undefined);
  // The copied block: one steps-array per lane, in lane order. A ref, so it
  // survives pattern switches and pastes across banks.
  const rangeClipboardRef = useRef<{ lanes: NoteEvent[][][]; length: number } | null>(null);
  const [rangeClipboardReady, setRangeClipboardReady] = useState(false);
  const [selectedStepNoteIndex, setSelectedStepNoteIndex] = useState(0);
  const [segmentDraftName, setSegmentDraftName] = useState('');
  const [loopBrowserFilter, setLoopBrowserFilter] = useState<typeof LOOP_BROWSER_FILTERS[number]['value']>('MATCHING');
  const [loopSearchDraft, setLoopSearchDraft] = useState('');
  const [loopBrowserOpen, setLoopBrowserOpen] = useState(false);
  const [sessionPlayerOpen, setSessionPlayerOpen] = useState(false);
  const [stepEditorOpen, setStepEditorOpen] = useState(false);
  const [queuedSegmentId, setQueuedSegmentId] = useState<string | null>(null);
  const [sessionPlayerFormId, setSessionPlayerFormId] = useState<SongFormId>('full-arc');
  const [pendingSessionPlayerRequest, setPendingSessionPlayerRequest] = useState<PendingSessionPlayerRequest | null>(null);
  const [sessionPlayerNotice, setSessionPlayerNotice] = useState<string | null>(null);
  const [stitchHover, setStitchHover] = useState<{ trackId: string; stepIndex: number } | null>(null);
  const [supersonicHoverCell, setSupersonicHoverCell] = useState<{ trackId: string; stepIndex: number } | null>(null);
  const [laneScope, setLaneScope] = useState<'ALL' | 'ACTIVE' | 'FOCUSED' | 'PINNED' | 'DRUMS' | 'MUSICAL'>('ALL');
  const [compactLanes, setCompactLanes] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));
  const [laneColumnCollapsed, setLaneColumnCollapsed] = useState(() => (
    readString(LANE_COLUMN_COLLAPSED_KEY) === 'true'
  ));
  const [patternSegments, setPatternSegments] = useState<PatternSegment[]>(() => loadPatternSegments());
  // Desktop starts near the top of the zoom range: wide, chunky cells that
  // read and tap like the narrow layout, instead of a dense strip.
  const [stepZoom, setStepZoom] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 40 : 76
  ));
  const [songTimelineZoom, setSongTimelineZoom] = useState(() => {
    const stored = Number(readString(SONG_TIMELINE_ZOOM_KEY));
    return Number.isFinite(stored) && stored > 0
      ? clampNumber(stored, SONG_TIMELINE_ZOOM_MIN, 64)
      : SONG_TIMELINE_ZOOM_DEFAULT;
  });
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const followPlayheadRef = useRef(true);
  const programmaticGridScrollUntilRef = useRef(0);
  const [patternFitSnapshot, setPatternFitSnapshot] = useState<{
    stepZoom: number;
    scrollLeft: number;
    patternIndex: number;
    stepsPerPattern: number;
    laneHeaderWidth: number;
    viewportWidth: number;
  } | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  // Track map (the read-only overview) starts closed everywhere; the grid is
  // the editing surface and the map is one click away behind Show map. The
  // choice is remembered.
  const [trackMapOpen, setTrackMapOpen] = useState(() => readString(TRACK_MAP_OPEN_KEY) === 'true');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<LaneSectionKey, boolean>>({
    MUSICAL: false,
    PINNED: false,
    RHYTHM: false,
    TEXTURE: false,
  });
  const gridViewportRef = useRef<HTMLDivElement | null>(null);
  const markProgrammaticGridScroll = useCallback(() => {
    // Smooth scrolling can keep emitting scroll events for several hundred
    // milliseconds after the command. Keep the guard comfortably beyond that
    // tail so our own motion is never mistaken for a manual pan.
    programmaticGridScrollUntilRef.current = performance.now() + 1200;
  }, []);
  // Press-and-drag state for the add-a-bar runway: dragging right grows the
  // pattern a step at a time (left shrinks it), while a plain tap still adds
  // a full bar. GarageBand's grab-the-region-edge gesture, on the step grid.
  const runwayDragRef = useRef<{ pointerId: number; startX: number; startSteps: number; lastSteps: number; alt: boolean; dragged: boolean } | null>(null);
  const [patternLengthPreview, setPatternLengthPreview] = useState<{ fill: boolean; steps: number } | null>(null);
  const laneRunwayGestureRef = useRef<LaneRunwayGesture | null>(null);
  const [laneRunwayPreview, setLaneRunwayPreview] = useState<LaneRunwayGesture | null>(null);
  const addLaneStripRef = useRef<HTMLDivElement | null>(null);
  const [addLaneMaxScrollLeft, setAddLaneMaxScrollLeft] = useState(0);
  const [addLaneScrollLeft, setAddLaneScrollLeft] = useState(0);
  // The add-lane strip is a big row of instrument buttons and a secondary
  // action (scenes already ship with lanes), so it starts collapsed to keep the
  // sequencer header clean; the choice is remembered.
  const [addLaneOpen, setAddLaneOpen] = useState(() => readString(ADD_LANE_OPEN_KEY) === 'true');
  // Two-step arm for the destructive "Delete all lanes" action.
  const [confirmClearLanes, setConfirmClearLanes] = useState(false);
  const [gridScrollLeft, setGridScrollLeft] = useState(0);
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const [gridViewportHeight, setGridViewportHeight] = useState(0);
  const [gridScrollHeight, setGridScrollHeight] = useState(0);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const selectedTrackPattern = selectedTrack?.patterns[currentPattern] ?? Array.from({ length: stepsPerPattern }, () => []);
  const currentPatternLabel = `Pattern ${String.fromCharCode(65 + currentPattern)}`;
  const selectedStep = selectedTrackPattern[selectedStepIndex] ?? [];
  const activeStepIndices = useMemo(() => (
    selectedTrackPattern.reduce<number[]>((indices, step, stepIndex) => {
      if (step.length > 0) {
        indices.push(stepIndex);
      }
      return indices;
    }, [])
  ), [selectedTrackPattern]);
  const selectedLeadEvent = selectedStep[0] ?? null;
  const selectedStepNote = selectedStep[selectedStepNoteIndex] ?? selectedLeadEvent;
  const normalizedSelectedStepNoteIndex = selectedStepNote
    ? Math.max(0, selectedStep.findIndex((event) => event === selectedStepNote))
    : null;
  const isSelectedTrackDrum = selectedTrack ? isRhythmTrackType(selectedTrack.type) : false;
  const canDeepEditSelectedTrack = Boolean(selectedTrack) && (!isSelectedTrackDrum || superSonicMode);
  const selectedTrackPatternSpan = useMemo(() => (
    getPatternActivitySpan(selectedTrackPattern, stepsPerPattern)
  ), [selectedTrackPattern, stepsPerPattern]);
  const hiddenPatternContent = useMemo(() => {
    let hiddenNoteCount = 0;
    let requiredSteps = stepsPerPattern;

    tracks.forEach((track) => {
      const patternSteps = track.patterns[currentPattern] ?? [];
      for (let stepIndex = stepsPerPattern; stepIndex < patternSteps.length; stepIndex += 1) {
        const step = patternSteps[stepIndex] ?? [];
        if (step.length === 0) {
          continue;
        }

        hiddenNoteCount += step.length;
        requiredSteps = Math.max(requiredSteps, stepIndex + 1);
      }
    });

    return {
      hiddenNoteCount,
      requiredSteps: clampNumber(requiredSteps, 16, MAX_STEPS_PER_PATTERN),
    };
  }, [currentPattern, stepsPerPattern, tracks]);
  const hasExplicitLoopRange = loopRangeStartBeat !== null && loopRangeEndBeat !== null;
  const isSelectedTrackLoopActive = selectedTrackPatternSpan !== null
    && loopRangeStartBeat === selectedTrackPatternSpan.startStep
    && loopRangeEndBeat === selectedTrackPatternSpan.endStep;
  const addLaneScrollProgress = addLaneMaxScrollLeft > 0
    ? Math.round((Math.min(addLaneScrollLeft, addLaneMaxScrollLeft) / addLaneMaxScrollLeft) * 100)
    : 0;
  const melodicTrackCount = useMemo(() => (
    tracks.filter((track) => !isRhythmTrackType(track.type)).length
  ), [tracks]);
  const visibleTracks = useMemo(() => tracks.filter((track) => {
    const hasActivePattern = (track.patterns[currentPattern] ?? []).some((step) => step.length > 0);

    switch (laneScope) {
      case 'ACTIVE':
        return hasActivePattern;
      case 'FOCUSED':
        return track.id === selectedTrackId;
      case 'PINNED':
        return pinnedTrackIds.includes(track.id);
      case 'DRUMS':
        return ['kick', 'snare', 'hihat'].includes(track.type);
      case 'MUSICAL':
        return !['kick', 'snare', 'hihat'].includes(track.type);
      default:
        return true;
    }
  }), [currentPattern, laneScope, pinnedTrackIds, selectedTrackId, tracks]);
  const laneHeaderPaddingClass = isMobileViewport
    ? (compactLanes ? 'px-3 py-2.5' : 'px-3.5 py-3')
    : compactLanes ? 'px-4 py-3' : 'px-5 py-4';
  const laneGridPaddingClass = isMobileViewport
    ? (compactLanes ? 'px-1.5 py-1.5' : 'px-2 py-1.5')
    : compactLanes ? 'px-2 py-1.5' : 'px-2 py-2';
  const stepZoomMax = isMobileViewport ? 52 : 82;
  const songTimelineZoomMax = isMobileViewport ? 40 : 64;
  const laneHeaderWidth = laneColumnCollapsed
    ? 38
    : isMobileViewport
      ? (compactLanes ? 188 : 212)
      : compactLanes ? 300 : 340;
  const stepCellWidth = clampNumber(stepZoom, STEP_ZOOM_MIN, stepZoomMax);
  const songTimelineCellWidth = clampNumber(
    songTimelineZoom,
    SONG_TIMELINE_ZOOM_MIN,
    songTimelineZoomMax,
  );
  const patternFitActive = Boolean(
    patternFitSnapshot
    && patternFitSnapshot.patternIndex === currentPattern
    && patternFitSnapshot.stepsPerPattern === stepsPerPattern
    && patternFitSnapshot.laneHeaderWidth === laneHeaderWidth
    && patternFitSnapshot.viewportWidth === gridViewportWidth
  );
  const stepRunwayWidth = Math.max(104, SEQUENCER_RUNWAY_STEPS * stepCellWidth);
  const stepGridWidth = (stepsPerPattern * stepCellWidth) + stepRunwayWidth;
  const maxGridScrollLeft = Math.max(0, (laneHeaderWidth + stepGridWidth) - gridViewportWidth);
  const maxGridScrollTop = Math.max(0, gridScrollHeight - gridViewportHeight);
  const visibleStepStart = Math.min(
    Math.max(0, stepsPerPattern - 1),
    Math.max(0, Math.floor(Math.max(0, gridScrollLeft - laneHeaderWidth) / stepCellWidth)),
  );
  const visibleStepEnd = Math.max(
    visibleStepStart + 1,
    Math.min(stepsPerPattern, Math.ceil(Math.max(0, (gridScrollLeft + gridViewportWidth - laneHeaderWidth)) / stepCellWidth)),
  );
  const pinnedVisibleTracks = useMemo(() => (
    laneScope === 'PINNED'
      ? []
      : visibleTracks.filter((track) => pinnedTrackIds.includes(track.id))
  ), [laneScope, pinnedTrackIds, visibleTracks]);
  const groupedVisibleTracks = useMemo(() => {
    const remainingTracks = laneScope === 'PINNED'
      ? visibleTracks
      : visibleTracks.filter((track) => !pinnedTrackIds.includes(track.id));

    return (
      (['RHYTHM', 'MUSICAL', 'TEXTURE'] as LaneGroupKey[]).map((groupKey) => ({
      groupKey,
      label: LANE_GROUP_LABELS[groupKey],
        tracks: remainingTracks.filter((track) => getLaneGroup(track.type) === groupKey),
    })).filter((group) => group.tracks.length > 0)
    );
  }, [laneScope, pinnedTrackIds, visibleTracks]);
  const visibleTrackSections = useMemo(() => {
    const sections: Array<{ key: LaneSectionKey; label: string; tracks: typeof visibleTracks }> = [];

    if (pinnedVisibleTracks.length > 0) {
      sections.push({ key: 'PINNED', label: 'Pinned', tracks: pinnedVisibleTracks });
    }

    groupedVisibleTracks.forEach((group) => {
      sections.push({ key: group.groupKey, label: group.label, tracks: group.tracks });
    });

    return sections;
  }, [groupedVisibleTracks, pinnedVisibleTracks]);
  // The lanes in the order they render, so a marquee can span rows.
  const visibleLaneOrder = useMemo(
    () => visibleTrackSections.flatMap((section) => section.tracks.map((entry) => entry.id)),
    [visibleTrackSections],
  );
  const selectedVisibleLaneIndex = selectedTrackId ? visibleLaneOrder.indexOf(selectedTrackId) : -1;
  const displayedStepRange = stepRangeMovePreview ?? stepRange;
  const movingStepRange = Boolean(
    stepRangeMovePreview
    && stepRange
    && stepRangeMovePreview.start !== stepRange.start
  );
  const selectedRangeStats = useMemo(() => {
    if (!stepRange) return null;
    const noteCount = stepRange.trackIds.reduce((total, laneId) => {
      const track = tracks.find((entry) => entry.id === laneId);
      if (!track) return total;
      const steps = track.patterns[currentPattern] || [];
      for (let index = stepRange.start; index <= stepRange.end; index += 1) {
        total += steps[index]?.length ?? 0;
      }
      return total;
    }, 0);
    return {
      laneCount: stepRange.trackIds.length,
      noteCount,
      stepCount: stepRange.end - stepRange.start + 1,
    };
  }, [currentPattern, stepRange, tracks]);
  const songPatternIndicesByTrack = useMemo(() => {
    const lookup = new Map<string, Set<number>>();

    arrangerClips.forEach((clip) => {
      if (!lookup.has(clip.trackId)) {
        lookup.set(clip.trackId, new Set<number>());
      }

      lookup.get(clip.trackId)?.add(clip.patternIndex);
    });

    return lookup;
  }, [arrangerClips]);
  const overviewTracks = useMemo(() => {
    const trackLimit = isMobileViewport ? 6 : 10;

    return visibleTracks
      .map((track) => buildTrackOverviewRow(track, currentPattern, stepsPerPattern, {
        songPatternIndices: songPatternIndicesByTrack.get(track.id) ?? null,
        transportMode,
      }))
      .sort((left, right) => {
        const leftSelected = left.track.id === selectedTrackId ? 1 : 0;
        const rightSelected = right.track.id === selectedTrackId ? 1 : 0;
        if (leftSelected !== rightSelected) {
          return rightSelected - leftSelected;
        }

        if (left.currentPatternActiveSteps !== right.currentPatternActiveSteps) {
          return right.currentPatternActiveSteps - left.currentPatternActiveSteps;
        }

        if (left.otherPatternActiveSteps !== right.otherPatternActiveSteps) {
          return right.otherPatternActiveSteps - left.otherPatternActiveSteps;
        }

        if (left.totalActiveSteps !== right.totalActiveSteps) {
          return right.totalActiveSteps - left.totalActiveSteps;
        }

        return left.track.name.localeCompare(right.track.name);
      })
      .slice(0, trackLimit);
  }, [currentPattern, isMobileViewport, selectedTrackId, songPatternIndicesByTrack, stepsPerPattern, transportMode, visibleTracks]);
  const showTrackOverviewLimit = visibleTracks.length > overviewTracks.length;
  const activeSessionPlayerForm = useMemo(() => getSongFormDefinition(sessionPlayerFormId), [sessionPlayerFormId]);
  const sessionPlayerSegments = useMemo(() => (
    Object.fromEntries(SESSION_PLAYER_PROFILES.map((profile) => [profile.id, buildSessionPlayerSegments(profile.id)]))
  ), []);
  const sessionPlayerPatternDecks = useMemo(() => (
    Object.fromEntries(SESSION_PLAYER_PROFILES.map((profile) => [profile.id, buildSessionPlayerPatternDecks(profile.id)]))
  ), []);
  const librarySegments = useMemo<PatternSegment[]>(() => [
    ...FACTORY_LOOP_LIBRARY,
    ...patternSegments,
  ], [patternSegments]);
  const loopSearchQuery = loopSearchDraft.trim().toLowerCase();
  const filteredFactoryLoops = useMemo(() => FACTORY_LOOP_LIBRARY.filter((loop) => {
    const matchesScope = loopBrowserFilter === 'ALL'
      ? true
      : loopBrowserFilter === 'MATCHING'
        ? (selectedTrack ? loop.sourceTrackType === selectedTrack.type : true)
        : loopBrowserFilter === 'RHYTHM'
          ? isRhythmTrackType(loop.sourceTrackType)
          : !isRhythmTrackType(loop.sourceTrackType);

    if (!matchesScope) {
      return false;
    }

    if (!loopSearchQuery) {
      return true;
    }

    const haystack = [
      loop.name,
      loop.description,
      loop.genre,
      loop.energy,
      loop.sourceTrackType,
      ...loop.tags,
    ].join(' ').toLowerCase();

    return haystack.includes(loopSearchQuery);
  }), [loopBrowserFilter, loopSearchQuery, selectedTrack]);
  const displayedFactoryLoops = filteredFactoryLoops.slice(0, 6);
  const showMoreFactoryLoops = filteredFactoryLoops.length > displayedFactoryLoops.length;
  const queuedSegment = queuedSegmentId
    ? librarySegments.find((segment) => segment.id === queuedSegmentId) ?? null
    : null;
  const queuedSegmentSpan = queuedSegment ? segmentSpanSteps(queuedSegment) : 0;

  useEffect(() => {
    if (isMobileViewport) {
      setCompactLanes(true);
      return;
    }

    setMobileInspectorOpen(false);
  }, [isMobileViewport]);

  useEffect(() => {
    if (!sessionPlayerNotice || typeof window === 'undefined') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSessionPlayerNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [sessionPlayerNotice]);

  useEffect(() => {
    setStepZoom((current) => clampNumber(current, STEP_ZOOM_MIN, stepZoomMax));
  }, [stepZoomMax]);


  useEffect(() => {
    if (!selectedTrack) {
      setSelectedStepIndex(0);
      setSelectedStepNoteIndex(0);
      return;
    }

    const pattern = selectedTrack.patterns[currentPattern] ?? [];
    const firstActiveStep = pattern.findIndex((step) => step.length > 0);
    setSelectedStepIndex(firstActiveStep >= 0 ? firstActiveStep : 0);
    setSelectedStepNoteIndex(0);
  }, [currentPattern, selectedTrack?.id]);

  useEffect(() => {
    setSelectedStepIndex((current) => Math.min(current, Math.max(0, stepsPerPattern - 1)));
  }, [stepsPerPattern]);

  useEffect(() => {
    if (stepColumnMenuIndex === null) {
      return undefined;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-step-column-menu-root="true"]')) {
        return;
      }
      setStepColumnMenuIndex(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStepColumnMenuIndex(null);
      }
    };

    window.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [stepColumnMenuIndex]);

  useEffect(() => {
    if (selectedStep.length === 0) {
      setSelectedStepNoteIndex(0);
      return;
    }

    setSelectedStepNoteIndex((current) => Math.min(current, selectedStep.length - 1));
  }, [selectedStep.length, selectedStepIndex]);

  useEffect(() => {
    const node = gridViewportRef.current;
    if (!node) {
      return undefined;
    }

    const syncGridViewport = () => {
      setGridScrollLeft(node.scrollLeft);
      setGridScrollTop(node.scrollTop);
      setGridViewportWidth(node.clientWidth);
      setGridViewportHeight(node.clientHeight);
      setGridScrollHeight(node.scrollHeight);
    };

    let previousScrollLeft = node.scrollLeft;

    const handleGridScroll = () => {
      const movedHorizontally = Math.abs(node.scrollLeft - previousScrollLeft) > 0.5;
      previousScrollLeft = node.scrollLeft;
      syncGridViewport();
      if (
        movedHorizontally
        && followPlayheadRef.current
        && performance.now() > programmaticGridScrollUntilRef.current
      ) {
        followPlayheadRef.current = false;
        setFollowPlayhead(false);
      }
      if (movedHorizontally) {
        setStepColumnMenuIndex(null);
      }
    };

    syncGridViewport();
    node.addEventListener('scroll', handleGridScroll, { passive: true });
    window.addEventListener('resize', syncGridViewport);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(syncGridViewport);
    resizeObserver?.observe(node);
    if (node.firstElementChild) {
      resizeObserver?.observe(node.firstElementChild);
    }

    return () => {
      node.removeEventListener('scroll', handleGridScroll);
      window.removeEventListener('resize', syncGridViewport);
      resizeObserver?.disconnect();
    };
  }, [compactLanes, laneScope, laneHeaderWidth, stepCellWidth, stepsPerPattern, visibleTrackSections.length]);

  // Mouse wheel scrolls the step grid sideways: with Shift, when the wheel is
  // already horizontal, or when the lanes fit (so a plain vertical wheel has
  // nothing to scroll down). Lane scrolling still wins when lanes overflow.
  useEffect(() => {
    const node = gridViewportRef.current;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.altKey) {
        event.preventDefault();
        const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        updateStepZoom(stepCellWidth + (dominantDelta < 0 ? 6 : -6), event.clientX);
        return;
      }

      const delta = getSequencerWheelPanDelta({
        clientHeight: node.clientHeight,
        clientWidth: node.clientWidth,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        scrollHeight: node.scrollHeight,
        scrollLeft: node.scrollLeft,
        scrollTop: node.scrollTop,
        scrollWidth: node.scrollWidth,
        shiftKey: event.shiftKey,
      });
      if (delta === null) return;
      event.preventDefault();
      node.scrollLeft += delta;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [stepCellWidth, stepZoomMax]);

  // These layout choices persist from their toggle handlers, not from mount
  // effects: writing on mount would freeze a mere default into a stored
  // "choice" the user never made, and defaults could then never improve.


  useEffect(() => {
    const node = addLaneStripRef.current;
    if (!node) {
      setAddLaneMaxScrollLeft(0);
      setAddLaneScrollLeft(0);
      return undefined;
    }

    const syncStripViewport = () => {
      setAddLaneScrollLeft(node.scrollLeft);
      setAddLaneMaxScrollLeft(Math.max(0, node.scrollWidth - node.clientWidth));
    };

    syncStripViewport();
    node.addEventListener('scroll', syncStripViewport, { passive: true });
    window.addEventListener('resize', syncStripViewport);

    return () => {
      node.removeEventListener('scroll', syncStripViewport);
      window.removeEventListener('resize', syncStripViewport);
    };
  }, [isMobileViewport]);

  const updateStepZoom = (
    nextWidth: number,
    anchorClientX?: number,
    options?: { preserveFitToggle?: boolean },
  ) => {
    if (!options?.preserveFitToggle) {
      setPatternFitSnapshot(null);
    }

    setStepZoom((currentWidth) => {
      const clampedWidth = clampNumber(
        Math.round(nextWidth / STEP_ZOOM_STEP) * STEP_ZOOM_STEP,
        STEP_ZOOM_MIN,
        stepZoomMax,
      );

      if (clampedWidth === currentWidth) {
        return currentWidth;
      }

      const node = gridViewportRef.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        const anchorOffset = clampNumber(
          anchorClientX !== undefined ? anchorClientX - rect.left : node.clientWidth * 0.5,
          0,
          node.clientWidth,
        );
        const anchorStep = Math.max(0, ((node.scrollLeft + anchorOffset) - laneHeaderWidth) / currentWidth);

        window.requestAnimationFrame(() => {
          const activeNode = gridViewportRef.current;
          if (!activeNode) {
            return;
          }

          const nextLeft = clampNumber(
            (laneHeaderWidth + (anchorStep * clampedWidth)) - anchorOffset,
            0,
            Math.max(0, activeNode.scrollWidth - activeNode.clientWidth),
          );
          activeNode.scrollLeft = nextLeft;
        });
      }

      return clampedWidth;
    });
  };

  const updateSongTimelineZoom = (nextWidth: number) => {
    const clampedWidth = clampNumber(
      Math.round(nextWidth / STEP_ZOOM_STEP) * STEP_ZOOM_STEP,
      SONG_TIMELINE_ZOOM_MIN,
      songTimelineZoomMax,
    );
    setSongTimelineZoom(clampedWidth);
    writeString(SONG_TIMELINE_ZOOM_KEY, String(clampedWidth));
  };

  const fitPatternToViewport = () => {
    const node = gridViewportRef.current;
    if (!node) {
      return;
    }

    if (patternFitActive && patternFitSnapshot) {
      const previousView = patternFitSnapshot;
      setPatternFitSnapshot(null);
      updateStepZoom(
        previousView.stepZoom,
        node.getBoundingClientRect().left + laneHeaderWidth,
        { preserveFitToggle: true },
      );
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          gridViewportRef.current?.scrollTo({ behavior: 'smooth', left: previousView.scrollLeft });
        });
      });
      return;
    }

    setPatternFitSnapshot({
      stepZoom: stepCellWidth,
      scrollLeft: node.scrollLeft,
      patternIndex: currentPattern,
      stepsPerPattern,
      laneHeaderWidth,
      viewportWidth: gridViewportWidth,
    });

    const availableStepWidth = Math.max(
      STEP_ZOOM_MIN * stepsPerPattern,
      node.clientWidth - laneHeaderWidth - Math.max(104, SEQUENCER_RUNWAY_STEPS * STEP_ZOOM_MIN),
    );
    updateStepZoom(
      availableStepWidth / Math.max(1, stepsPerPattern),
      node.getBoundingClientRect().left + laneHeaderWidth,
      { preserveFitToggle: true },
    );
    window.requestAnimationFrame(() => node.scrollTo({ behavior: 'smooth', left: 0 }));
  };

  const togglePlayheadFollow = () => {
    const nextFollow = !followPlayhead;
    followPlayheadRef.current = nextFollow;
    setFollowPlayhead(nextFollow);

    if (!nextFollow) {
      return;
    }

    const node = gridViewportRef.current;
    if (!node || stepsPerPattern <= 0) {
      return;
    }

    const currentStep = ((Math.floor(engine.currentStep) % stepsPerPattern) + stepsPerPattern) % stepsPerPattern;
    const nextLeft = getSequencerFollowScrollLeft({
      clientWidth: node.clientWidth,
      forceCenter: true,
      laneHeaderWidth,
      scrollLeft: node.scrollLeft,
      scrollWidth: node.scrollWidth,
      stepCellWidth,
      stepIndex: currentStep,
    });
    markProgrammaticGridScroll();
    node.scrollTo({ behavior: 'smooth', left: nextLeft ?? node.scrollLeft });
  };

  const scrollGridByViewport = (direction: -1 | 1) => {
    const node = gridViewportRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      behavior: 'smooth',
      left: Math.max(0, Math.min(maxGridScrollLeft, node.scrollLeft + direction * Math.max(180, node.clientWidth * 0.72))),
    });
  };

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!event.shiftKey || event.target !== event.currentTarget) return;
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      scrollGridByViewport(event.key === 'PageUp' ? -1 : 1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      gridViewportRef.current?.scrollTo({
        behavior: 'smooth',
        left: event.key === 'Home' ? 0 : maxGridScrollLeft,
      });
    }
  };

  const scrollGridLanesByViewport = (direction: -1 | 1) => {
    const node = gridViewportRef.current;
    if (!node) return;

    node.scrollTo({
      behavior: 'smooth',
      left: node.scrollLeft,
      top: clampNumber(
        node.scrollTop + direction * Math.max(120, node.clientHeight * 0.68),
        0,
        Math.max(0, node.scrollHeight - node.clientHeight),
      ),
    });
  };

  const scrollTrackIntoView = (trackId: string) => {
    const node = gridViewportRef.current;
    if (!node) return;
    let lane: HTMLElement | null = null;
    node.querySelectorAll('[data-seq-lane-row]').forEach((entry) => {
      if (!lane && entry instanceof HTMLElement && entry.dataset.trackId === trackId) {
        lane = entry;
      }
    });
    if (!lane) return;

    const nodeRect = node.getBoundingClientRect();
    const laneRect = lane.getBoundingClientRect();
    const stickyRulerHeight = 48;
    const workingHeight = Math.max(laneRect.height, node.clientHeight - stickyRulerHeight);
    const nextTop = node.scrollTop
      + laneRect.top
      - nodeRect.top
      - stickyRulerHeight
      - Math.max(0, (workingHeight - laneRect.height) * 0.42);
    node.scrollTo({
      behavior: 'smooth',
      left: node.scrollLeft,
      top: clampNumber(nextTop, 0, Math.max(0, node.scrollHeight - node.clientHeight)),
    });
  };

  const revealSelectedTrack = () => {
    if (!selectedTrackId) return;
    const section = visibleTrackSections.find((entry) => (
      entry.tracks.some((track) => track.id === selectedTrackId)
    ));

    if (section && collapsedGroups[section.key]) {
      setCollapsedGroups((current) => ({ ...current, [section.key]: false }));
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => scrollTrackIntoView(selectedTrackId));
      });
      return;
    }

    scrollTrackIntoView(selectedTrackId);
  };

  const scrollAddLaneStrip = (direction: -1 | 1) => {
    const node = addLaneStripRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      behavior: 'smooth',
      left: Math.max(0, Math.min(addLaneMaxScrollLeft, node.scrollLeft + (direction * Math.max(140, node.clientWidth * 0.48)))),
    });
  };

  const jumpToStep = (stepIndex: number, trackId?: string) => {
    if (trackId) {
      setSelectedTrackId(trackId);
    }

    selectStep(stepIndex);

    const node = gridViewportRef.current;
    if (!node) {
      return;
    }

    const nextLeft = clampNumber(
      (laneHeaderWidth + (stepIndex * stepCellWidth)) - Math.max(stepCellWidth, node.clientWidth * 0.42),
      0,
      maxGridScrollLeft,
    );
    node.scrollTo({ behavior: 'smooth', left: nextLeft });
  };

  const selectStep = (stepIndex: number, noteIndex = 0) => {
    setSelectedStepIndex(stepIndex);
    setSelectedStepNoteIndex(noteIndex);
  };

  const setPatternLength = useCallback((stepCount: number) => {
    const nextStepsPerPattern = clampNumber(
      Math.round(stepCount),
      16,
      MAX_STEPS_PER_PATTERN,
    );

    if (nextStepsPerPattern === stepsPerPattern) {
      return;
    }

    setStepsPerPattern(nextStepsPerPattern);

    if (loopRangeStartBeat !== null && loopRangeEndBeat !== null) {
      if (loopRangeStartBeat >= nextStepsPerPattern) {
        setLoopRange(null, null);
      } else if (loopRangeEndBeat > nextStepsPerPattern) {
        setLoopRange(loopRangeStartBeat, nextStepsPerPattern);
      }
    }
  }, [loopRangeEndBeat, loopRangeStartBeat, setLoopRange, setStepsPerPattern, stepsPerPattern]);

  const extendPatternBy = useCallback((stepDelta: number) => {
    setPatternLength(stepsPerPattern + stepDelta);
  }, [setPatternLength, stepsPerPattern]);

  // Pattern resizing previews locally while the pointer moves, then commits
  // once on release. Alt-fill repeats every lane through the same atomic edit,
  // so one Undo restores both the notes and the former pattern length.
  const commitPatternResize = useCallback((oldLength: number, newLength: number, fill: boolean) => {
    const nextLength = clampNumber(Math.round(newLength), 16, MAX_STEPS_PER_PATTERN);
    if (nextLength === oldLength) return false;
    if (fill && nextLength > oldLength) {
      const segments = tracks.flatMap((track) => {
        const steps = track.patterns[currentPattern] || [];
        return hasLoopSource(steps, oldLength)
          ? [{ steps: loopFillSteps(steps, oldLength, nextLength), trackId: track.id }]
          : [];
      });
      if (segments.length > 0) {
        applyPatternStepBatch(currentPattern, segments, nextLength);
        return true;
      }
    }
    setPatternLength(nextLength);
    return true;
  }, [applyPatternStepBatch, currentPattern, setPatternLength, tracks]);

  const runPatternColumnOperation = useCallback((stepIndex: number, operation: PatternColumnOperation) => {
    if (operation === 'move-left' && stepIndex === 0) return;
    if (operation === 'move-right' && stepIndex === stepsPerPattern - 1) return;
    if (operation === 'delete' && stepsPerPattern <= MIN_STEPS_PER_PATTERN) return;
    if ((operation === 'duplicate' || operation === 'insert') && stepsPerPattern >= MAX_STEPS_PER_PATTERN) return;

    const structuralEdit = operation === 'delete' || operation === 'duplicate' || operation === 'insert';
    const nextStepCount = operation === 'delete'
      ? stepsPerPattern - 1
      : operation === 'duplicate' || operation === 'insert'
        ? stepsPerPattern + 1
        : stepsPerPattern;
    const nextSelectedStep = operation === 'move-left'
      ? stepIndex - 1
      : operation === 'move-right' || operation === 'duplicate' || operation === 'insert'
        ? stepIndex + 1
        : Math.min(stepIndex, nextStepCount - 1);

    editPatternColumn(currentPattern, stepIndex, operation);

    if (structuralEdit && loopRangeStartBeat !== null && loopRangeEndBeat !== null) {
      const mapBeat = operation === 'delete'
        ? (beat: number) => mapBeatAfterPatternColumnDelete(beat, stepIndex, stepsPerPattern)
        : (beat: number) => mapBeatAfterPatternColumnInsert(beat, stepIndex, stepsPerPattern);
      const nextLoopStart = mapBeat(loopRangeStartBeat);
      const nextLoopEnd = mapBeat(loopRangeEndBeat);
      if (nextLoopEnd > nextLoopStart) {
        setLoopRange(nextLoopStart, nextLoopEnd);
      } else {
        setLoopRange(null, null);
      }
    }

    setSelectedStepIndex(Math.max(0, nextSelectedStep));
    setSelectedStepNoteIndex(0);
    setStepRange(null);
    setStepRangeMovePreview(null);
    stepRangeMoveGestureRef.current = null;
    setStepColumnMenuIndex(null);
  }, [
    currentPattern,
    editPatternColumn,
    loopRangeEndBeat,
    loopRangeStartBeat,
    setLoopRange,
    stepsPerPattern,
  ]);

  // A selection range only makes sense within the pattern and mode it was
  // dragged in; switching either drops it.
  useEffect(() => {
    setStepRange(null);
    setStepRangeMovePreview(null);
    stepRangeMoveGestureRef.current = null;
  }, [editorMode, currentPattern]);

  const copyStepRange = (range: StepRangeSelection | null = stepRange) => {
    if (!range) return false;
    const lanes = range.trackIds
      .map((laneId) => tracks.find((entry) => entry.id === laneId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((track) => {
        const steps = track.patterns[currentPattern] || [];
        return copyPatternRange(steps, range.start, range.end);
      });
    if (lanes.length === 0) return false;
    rangeClipboardRef.current = { lanes, length: range.end - range.start + 1 };
    setRangeClipboardReady(true);
    return true;
  };

  const pasteCopiedRange = () => {
    const clipboard = rangeClipboardRef.current;
    const anchorTrackId = stepRange?.trackIds[0] ?? selectedTrack?.id;
    if (!clipboard || !anchorTrackId) return false;
    const anchorLane = visibleLaneOrder.indexOf(anchorTrackId);
    if (anchorLane < 0) return false;
    const targetStart = stepRange?.start ?? selectedStepIndex;
    const needed = targetStart + clipboard.length;
    const total = Math.max(needed, stepsPerPattern);
    const pastedLaneIds: string[] = [];
    const segments: Array<{ steps: NoteEvent[][]; trackId: string }> = [];
    clipboard.lanes.forEach((laneSteps, laneOffset) => {
      const laneId = visibleLaneOrder[anchorLane + laneOffset];
      if (!laneId) return;
      const track = tracks.find((entry) => entry.id === laneId);
      if (!track) return;
      const steps = track.patterns[currentPattern] || [];
      const next = writePatternRange(steps, laneSteps, targetStart, total);
      segments.push({ steps: next, trackId: laneId });
      pastedLaneIds.push(laneId);
    });
    if (pastedLaneIds.length === 0) return false;
    applyPatternStepBatch(currentPattern, segments, total > stepsPerPattern ? total : undefined);
    setStepRange({ trackIds: pastedLaneIds, start: targetStart, end: needed - 1 });
    setSelectedTrackId(pastedLaneIds[0]);
    selectStep(targetStart);
    return true;
  };

  // Duplicate stamps the selected phrase immediately after itself. Keeping the
  // copy selected makes repeated presses tile a motif across the pattern.
  const duplicateStepRange = (range: StepRangeSelection | null = stepRange) => {
    const sourceRange = range
      ?? (selectedTrack ? { trackIds: [selectedTrack.id], start: selectedStepIndex, end: selectedStepIndex } : null);
    if (!sourceRange) return false;
    const laneIds = sourceRange.trackIds.filter((id) => tracks.some((entry) => entry.id === id));
    if (laneIds.length === 0) return false;
    const length = sourceRange.end - sourceRange.start + 1;
    const targetStart = sourceRange.end + 1;
    const needed = targetStart + length;
    const total = Math.max(needed, stepsPerPattern);
    const segments = laneIds.flatMap((laneId) => {
      const track = tracks.find((entry) => entry.id === laneId);
      if (!track) return [];
      const steps = track.patterns[currentPattern] || [];
      const source = copyPatternRange(steps, sourceRange.start, sourceRange.end);
      const next = writePatternRange(steps, source, targetStart, total);
      return [{ steps: next, trackId: laneId }];
    });
    applyPatternStepBatch(currentPattern, segments, total > stepsPerPattern ? total : undefined);
    setStepRange({ trackIds: laneIds, start: targetStart, end: needed - 1 });
    setSelectedTrackId(laneIds[0]);
    selectStep(targetStart);
    return true;
  };

  const clearSelectedRange = () => {
    if (!stepRange) return false;
    const segments = stepRange.trackIds.flatMap((laneId) => {
      const track = tracks.find((entry) => entry.id === laneId);
      if (!track) return [];
      const steps = track.patterns[currentPattern] || [];
      const next = clearPatternRange(steps, stepRange.start, stepRange.end, stepsPerPattern);
      return [{ steps: next, trackId: laneId }];
    });
    if (segments.length === 0) return false;
    applyPatternStepBatch(currentPattern, segments);
    return true;
  };

  const moveStepRangeTo = (
    targetStart: number,
    range: StepRangeSelection | null = stepRange,
  ) => {
    if (!range) return false;
    const length = range.end - range.start + 1;
    const nextStart = clampNumber(Math.round(targetStart), 0, Math.max(0, stepsPerPattern - length));
    if (nextStart === range.start) return false;
    const laneIds = range.trackIds.filter((id) => tracks.some((entry) => entry.id === id));
    const segments = laneIds.flatMap((laneId) => {
      const track = tracks.find((entry) => entry.id === laneId);
      if (!track) return [];
      const steps = track.patterns[currentPattern] || [];
      return [{
        steps: movePatternRange(steps, range.start, range.end, nextStart, stepsPerPattern),
        trackId: laneId,
      }];
    });
    if (segments.length === 0) return false;
    applyPatternStepBatch(currentPattern, segments);
    if (loopRangeStartBeat === range.start && loopRangeEndBeat === range.end + 1) {
      setLoopRange(nextStart, nextStart + length);
    }
    setStepRange({ trackIds: laneIds, start: nextStart, end: nextStart + length - 1 });
    setSelectedTrackId(laneIds[0]);
    selectStep(nextStart);
    return true;
  };

  const nudgeSelectedRange = (direction: -1 | 1, distance = 1) => (
    stepRange ? moveStepRangeTo(stepRange.start + (direction * distance), stepRange) : false
  );

  useEffect(() => {
    commitStepRangeMoveRef.current = () => {
      const gesture = stepRangeMoveGestureRef.current;
      stepRangeMoveGestureRef.current = null;
      setStepRangeMovePreview(null);
      if (gesture && gesture.targetStart !== gesture.original.start) {
        moveStepRangeTo(gesture.targetStart, gesture.original);
      }
    };
  });

  const loopSelectedRange = () => {
    if (!stepRange) return false;
    setTransportMode('PATTERN');
    setLoopRange(stepRange.start, stepRange.end + 1);
    jumpToStep(stepRange.start, stepRange.trackIds[0]);
    return true;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'Escape') {
        setStepRange(null);
        setStepRangeMovePreview(null);
        stepRangeMoveGestureRef.current = null;
        return;
      }
      if ((event.key === 'Backspace' || event.key === 'Delete') && stepRange) {
        event.preventDefault();
        clearSelectedRange();
        return;
      }
      if (stepRange && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !(event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        nudgeSelectedRange(event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey ? 16 : 1);
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      const handled = key === 'c'
        ? copyStepRange()
        : key === 'v'
          ? pasteCopiedRange()
          : key === 'd'
            ? duplicateStepRange()
            : false;
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleToggleSelectedTrackLoop = () => {
    if (!selectedTrackPatternSpan || !selectedTrack) {
      return;
    }

    if (isSelectedTrackLoopActive) {
      setLoopRange(null, null);
      return;
    }

    setTransportMode('PATTERN');
    setLoopRange(selectedTrackPatternSpan.startStep, selectedTrackPatternSpan.endStep);
    jumpToStep(selectedTrackPatternSpan.startStep, selectedTrack.id);
  };

  const handleClearLoopRange = () => {
    setLoopRange(null, null);
  };

  const jumpToAdjacentActiveStep = (direction: 'next' | 'previous') => {
    if (!selectedTrack || activeStepIndices.length === 0) {
      return;
    }

    const nextStep = direction === 'next'
      ? activeStepIndices.find((stepIndex) => stepIndex > selectedStepIndex) ?? activeStepIndices[0]
      : [...activeStepIndices].reverse().find((stepIndex) => stepIndex < selectedStepIndex) ?? activeStepIndices[activeStepIndices.length - 1];

    jumpToStep(nextStep, selectedTrack.id);
  };

  const handleClearSelectedTrackNotes = () => {
    if (!selectedTrack) {
      return;
    }

    clearTrack(selectedTrack.id);
    if (isSelectedTrackLoopActive) {
      setLoopRange(null, null);
    }
    selectStep(0);
  };

  const paintStateRef = useRef<{ trackId: string; mode: 'add' | 'remove' | 'select' | 'move'; visited: Set<string>; note?: string; anchor?: number } | null>(null);
  // SuperSonic touch placement: a preview cell that tracks the finger so a
  // note can be aimed before it commits on release.
  const [placementCursor, setPlacementCursor] = useState<{ trackId: string; stepIndex: number } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const resetPaint = () => {
      paintStateRef.current = null;
      laneRunwayGestureRef.current = null;
      setLaneRunwayPreview(null);
    };
    const trackRangeMove = (event: PointerEvent) => {
      const gesture = stepRangeMoveGestureRef.current;
      if (!gesture) return;
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-seq-cell="true"]');
      const stepIndex = Number(cell?.dataset.stepIndex);
      if (!Number.isFinite(stepIndex)) return;
      const length = gesture.original.end - gesture.original.start + 1;
      const targetStart = clampNumber(
        gesture.original.start + (stepIndex - gesture.anchorStep),
        0,
        Math.max(0, gesture.totalSteps - length),
      );
      if (gesture.targetStart === targetStart) return;
      gesture.targetStart = targetStart;
      setStepRangeMovePreview({
        ...gesture.original,
        start: targetStart,
        end: targetStart + length - 1,
      });
    };
    const finishPaint = () => {
      commitStepRangeMoveRef.current();
      resetPaint();
    };
    const cancelPaint = () => {
      stepRangeMoveGestureRef.current = null;
      setStepRangeMovePreview(null);
      resetPaint();
    };
    window.addEventListener('pointermove', trackRangeMove);
    window.addEventListener('pointerup', finishPaint);
    window.addEventListener('pointercancel', cancelPaint);
    return () => {
      window.removeEventListener('pointermove', trackRangeMove);
      window.removeEventListener('pointerup', finishPaint);
      window.removeEventListener('pointercancel', cancelPaint);
    };
  }, []);

  // Remember whether the lane column is collapsed so a returning session
  // keeps the workspace the way it was left.
  useEffect(() => {
    writeString(LANE_COLUMN_COLLAPSED_KEY, laneColumnCollapsed ? 'true' : 'false');
  }, [laneColumnCollapsed]);

  // Adding a lane: route every "new lane" action through here so the
  // fresh lane announces itself — it auditions its voice and scrolls
  // into view — rather than appearing silently off-screen.
  const laneJustAddedRef = useRef(false);
  // A captured note string to drop onto the next lane this component creates.
  const pendingCaptureSegmentRef = useRef<PatternSegment | null>(null);
  const prevTrackCountRef = useRef(tracks.length);
  const handleCreateLane = useCallback((trackType: InstrumentType) => {
    laneJustAddedRef.current = true;
    createTrack(trackType);
  }, [createTrack]);

  // Spin up a fresh melodic lane seeded from the most recent saved capture.
  const handleCreateLaneFromCapture = useCallback(() => {
    const captures = loadCapturedNoteStrings();
    if (captures.length === 0) {
      // Nothing captured yet, so this button would otherwise feel dead. Open the
      // quick-capture overlay so a hum, note, or nearby sound can be turned into
      // a lane right away, then this button picks it up on the next press.
      setSessionPlayerNotice('Nothing captured yet. Sing, hum, or play a sound and it lands here as a new lane.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sonicstudio:open-quick-capture'));
      }
      return;
    }
    const captured = captures[0];
    const segment = noteStringToPatternSegment(captured, captured.name, 'lead');
    // Transpose the captured phrase into the detected session key so the new
    // lane sits in the song instead of clashing with it (a transpose, so the
    // phrase keeps its own shape).
    const sessionKey = getEffectiveKey(tracks);
    const pitchClasses: number[] = [];
    for (const step of segment.steps) {
      for (const event of step) {
        const pc = pitchClassFromNote(event.note);
        if (pc !== null) pitchClasses.push(pc);
      }
    }
    const shift = bestKeyTranspose(pitchClasses, sessionKey.root, sessionKey.mode);
    pendingCaptureSegmentRef.current = shift === 0
      ? segment
      : {
        ...segment,
        steps: segment.steps.map((step) => step.map((event) => ({
          ...event,
          note: shiftPitch(event.note, shift) ?? event.note,
        }))),
      };
    laneJustAddedRef.current = true;
    createTrack('lead');
  }, [createTrack, tracks]);

  useEffect(() => {
    const grew = tracks.length > prevTrackCountRef.current;
    prevTrackCountRef.current = tracks.length;
    if (!grew || !laneJustAddedRef.current) {
      return;
    }
    laneJustAddedRef.current = false;
    const newest = tracks[tracks.length - 1];
    if (!newest) {
      pendingCaptureSegmentRef.current = null;
      return;
    }
    const pendingSegment = pendingCaptureSegmentRef.current;
    if (pendingSegment) {
      pendingCaptureSegmentRef.current = null;
      applyPatternSegment(newest.id, currentPattern, pendingSegment.steps, pendingSegment.automation);
      setSessionPlayerNotice(`Added "${pendingSegment.name}" from your captures, tuned to your session key.`);
    }
    void previewTrack(newest.id);
    window.requestAnimationFrame(() => {
      const scrollEl = gridViewportRef.current;
      if (!scrollEl) {
        return;
      }
      const newLaneHeader = scrollEl.querySelector('.grid-freeze-col[data-selected="true"]');
      newLaneHeader?.closest('.flex.border-b')?.scrollIntoView({ block: 'nearest' });
    });
  }, [tracks, previewTrack, applyPatternSegment, currentPattern]);

  const handleSeqCellPointerDown = (
    trackId: string,
    stepIndex: number,
    stepEvents: NoteEvent[],
    event: React.PointerEvent<HTMLElement>,
    note?: string,
  ) => {
    if (event.button !== 0) return;
    const isTouchPointer = event.pointerType === 'touch';
    // SuperSonic + touch: deliberate drag-to-place. Pressing an empty cell
    // opens a placement preview that follows the finger and commits the
    // note on release; pressing a filled cell still removes it at once.
    if (superSonicMode && isTouchPointer && editorMode !== 'select') {
      const targetHasNote = note
        ? stepEvents.some((entry) => entry.note === note)
        : stepEvents.length > 0;
      if (!targetHasNote) {
        event.preventDefault();
        setSelectedTrackId(trackId);
        selectStep(stepIndex);
        setPlacementCursor({ trackId, stepIndex });
        void previewTrack(trackId, note);
        return;
      }
    }
    if (!isTouchPointer || editorMode === 'edit') {
      event.preventDefault();
    }
    setSelectedTrackId(trackId);
    selectStep(stepIndex);

    if (editorMode === 'select') {
      const pressesCurrentRange = Boolean(
        stepRange
        && stepRange.trackIds.includes(trackId)
        && stepIndex >= stepRange.start
        && stepIndex <= stepRange.end
      );
      if (pressesCurrentRange && stepRange) {
        event.preventDefault();
        const original = { ...stepRange, trackIds: [...stepRange.trackIds] };
        stepRangeMoveGestureRef.current = {
          anchorStep: stepIndex,
          original,
          targetStart: original.start,
          totalSteps: stepsPerPattern,
        };
        setStepRangeMovePreview(original);
        paintStateRef.current = { trackId, mode: 'move', visited: new Set(), anchor: stepIndex };
        return;
      }
      stepRangeMoveGestureRef.current = null;
      setStepRangeMovePreview(null);
      paintStateRef.current = { trackId, mode: 'select', note, visited: new Set([`${stepIndex}`]), anchor: stepIndex };
      setStepRange({ trackIds: [trackId], start: stepIndex, end: stepIndex });
      return;
    }

    const hasTargetNote = note
      ? stepEvents.some((entry) => entry.note === note)
      : stepEvents.length > 0;
    const mode: 'add' | 'remove' = hasTargetNote ? 'remove' : 'add';
    paintStateRef.current = { trackId, mode, note, visited: new Set([`${stepIndex}`]) };
    toggleStep(trackId, stepIndex, note);
    // Sound the note as it lands, so placing a step gives instant feedback.
    if (mode === 'add') {
      void previewTrack(trackId, note);
    }
  };

  const handleSeqCellPointerEnter = (
    trackId: string,
    stepIndex: number,
    stepEvents: NoteEvent[],
  ) => {
    const state = paintStateRef.current;
    if (!state) return;
    if (state.mode === 'move') {
      const gesture = stepRangeMoveGestureRef.current;
      if (!gesture) return;
      const length = gesture.original.end - gesture.original.start + 1;
      const stepDelta = stepIndex - gesture.anchorStep;
      const targetStart = clampNumber(
        gesture.original.start + stepDelta,
        0,
        Math.max(0, stepsPerPattern - length),
      );
      if (gesture.targetStart === targetStart) return;
      gesture.targetStart = targetStart;
      setStepRangeMovePreview({
        ...gesture.original,
        start: targetStart,
        end: targetStart + length - 1,
      });
      return;
    }
    if (state.mode === 'select') {
      // No visited gate, and no same-lane guard: the marquee sweeps across
      // lanes as well as steps, and dragging back shrinks it again.
      const anchorStep = state.anchor ?? stepIndex;
      const anchorLane = visibleLaneOrder.indexOf(state.trackId);
      const currentLane = visibleLaneOrder.indexOf(trackId);
      const trackIds = anchorLane < 0 || currentLane < 0
        ? [state.trackId]
        : visibleLaneOrder.slice(Math.min(anchorLane, currentLane), Math.max(anchorLane, currentLane) + 1);
      setStepRange({ trackIds, start: Math.min(anchorStep, stepIndex), end: Math.max(anchorStep, stepIndex) });
      setSelectedTrackId(trackId);
      selectStep(stepIndex);
      return;
    }
    if (state.trackId !== trackId) return;
    const key = `${stepIndex}`;
    if (state.visited.has(key)) return;
    state.visited.add(key);
    const hasTargetNote = state.note
      ? stepEvents.some((entry) => entry.note === state.note)
      : stepEvents.length > 0;
    if (state.mode === 'add' && !hasTargetNote) {
      toggleStep(trackId, stepIndex, state.note);
      void previewTrack(trackId, state.note);
    } else if (state.mode === 'remove' && hasTargetNote) {
      toggleStep(trackId, stepIndex, state.note);
    }
  };

  const runwayCountFromPointer = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const distance = Math.max(0, event.clientX - rect.left);
    return clampNumber(Math.floor(distance / Math.max(12, stepCellWidth)) + 1, 1, 16);
  };

  const beginLaneRunwayGesture = (
    trackId: string,
    event: React.PointerEvent<HTMLElement>,
    note?: string,
    capturePointer = false,
  ) => {
    if (
      stepsPerPattern >= MAX_STEPS_PER_PATTERN
      || (capturePointer && event.pointerType === 'mouse' && event.button !== 0)
    ) return;
    event.preventDefault();
    const gesture: LaneRunwayGesture = {
      count: runwayCountFromPointer(event),
      note,
      pointerId: event.pointerId,
      startStep: stepsPerPattern,
      trackId,
    };
    laneRunwayGestureRef.current = gesture;
    setLaneRunwayPreview(gesture);
    setSelectedTrackId(trackId);
    selectStep(Math.max(0, stepsPerPattern - 1));
    if (capturePointer) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
    }
  };

  const updateLaneRunwayGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = laneRunwayGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const count = runwayCountFromPointer(event);
    if (count === gesture.count) return;
    const next = { ...gesture, count };
    laneRunwayGestureRef.current = next;
    setLaneRunwayPreview(next);
  };

  const handleLaneRunwayPointerMove = (
    trackId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (!laneRunwayGestureRef.current && event.buttons === 1) {
      const paint = paintStateRef.current;
      if (paint?.trackId === trackId && paint.mode === 'add') {
        beginLaneRunwayGesture(trackId, event, paint.note);
      }
    }
    updateLaneRunwayGesture(event);
  };

  const cancelLaneRunwayGesture = (event?: React.PointerEvent<HTMLElement>) => {
    if (event) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* synthetic events */ }
    }
    laneRunwayGestureRef.current = null;
    setLaneRunwayPreview(null);
  };

  const commitLaneRunwayGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = laneRunwayGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const track = tracks.find((entry) => entry.id === gesture.trackId);
    if (!track) {
      cancelLaneRunwayGesture(event);
      return;
    }

    const patternSteps = track.patterns[currentPattern] ?? [];
    const result = buildRunwayContinuation({
      continuationNote: gesture.note,
      count: gesture.count,
      fallbackNote: getTrackAnchorNote(track, patternSteps, gesture.startStep),
      maxSteps: MAX_STEPS_PER_PATTERN,
      startStep: gesture.startStep,
      steps: patternSteps,
    });
    cancelLaneRunwayGesture(event);
    if (result.addedCount === 0) return;

    continuePatternRunway(track.id, currentPattern, result.nextLength, result.steps);
    selectStep(gesture.startStep);
    void previewTrack(track.id, result.steps[gesture.startStep]?.[0]?.note);
    window.requestAnimationFrame(() => jumpToStep(gesture.startStep, track.id));
  };

  // While a SuperSonic touch placement is open, move the preview to the
  // cell under the finger. Uses elementFromPoint so it works through the
  // touch pointer-capture that stops onPointerEnter firing on siblings.
  const handlePlacementMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!placementCursor) return;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const cell = under instanceof Element ? under.closest('[data-seq-cell="true"]') : null;
    if (!(cell instanceof HTMLElement)) return;
    const trackId = cell.dataset.trackId;
    const stepRaw = cell.dataset.stepIndex;
    if (!trackId || stepRaw === undefined) return;
    const stepIndex = Number(stepRaw);
    if (placementCursor.trackId === trackId && placementCursor.stepIndex === stepIndex) return;
    setPlacementCursor({ trackId, stepIndex });
    setSelectedTrackId(trackId);
    selectStep(stepIndex);
    void previewTrack(trackId);
  };

  // Release commits the previewed note. Lifting off the grid cancels it.
  const handlePlacementCommit = (event: React.PointerEvent<HTMLElement>) => {
    const target = placementCursor;
    if (!target) return;
    setPlacementCursor(null);
    const released = document.elementFromPoint(event.clientX, event.clientY);
    const overCell = released instanceof Element ? released.closest('[data-seq-cell="true"]') : null;
    if (!overCell) return;
    const track = tracks.find((entry) => entry.id === target.trackId);
    const existing = track?.patterns[currentPattern]?.[target.stepIndex];
    if (existing && existing.length > 0) return;
    toggleStep(target.trackId, target.stepIndex);
    void previewTrack(target.trackId);
  };

  const updateSelectedStepNote = (noteIndex: number, updates: Parameters<typeof updateStepEvent>[3]) => {
    if (!selectedTrack) {
      return;
    }

    updateStepEvent(selectedTrack.id, selectedStepIndex, noteIndex, updates);
    setSelectedStepNoteIndex(noteIndex);
  };

  const addIntervalToSelectedStep = (semitones: number) => {
    if (!selectedTrack || isSelectedTrackDrum) {
      return;
    }

    const baseNote = selectedStepNote?.note ?? selectedLeadEvent?.note;
    if (!baseNote) {
      return;
    }

    const nextNote = shiftNote(baseNote, semitones);
    const existingNoteIndex = selectedStep.findIndex((event) => event.note === nextNote);
    if (existingNoteIndex >= 0) {
      setSelectedStepNoteIndex(existingNoteIndex);
      return;
    }

    toggleStep(selectedTrack.id, selectedStepIndex, nextNote);
    setSelectedStepNoteIndex(selectedStep.length);
  };

  const handleSavePatternSegment = () => {
    if (!selectedTrack) {
      return;
    }

    const nextSegment = createPatternSegment(
      selectedTrack,
      currentPattern,
      stepsPerPattern,
      segmentDraftName || undefined,
    );

    setPatternSegments((current) => persistPatternSegments([nextSegment, ...current]));
    setSegmentDraftName('');
  };

  const applySegmentToTrack = useCallback((trackId: string, segment: PatternSegment) => {
    if (segment.stepsPerPattern > stepsPerPattern) {
      setStepsPerPattern(segment.stepsPerPattern);
    }

    applyPatternSegment(trackId, currentPattern, segment.steps, segment.automation);
  }, [applyPatternSegment, currentPattern, setStepsPerPattern, stepsPerPattern]);

  const [queuedNoteStringId, setQueuedNoteStringId] = useQueuedNoteStringId();

  // Hover-audition timer for lane headers. A short dwell prevents a
  // pointer flyby from peppering the engine with previewTrack calls,
  // while still letting a deliberate hover audition the lane's voice.
  const laneHoverAuditionRef = useRef<number | null>(null);
  const clearLaneHoverAudition = () => {
    if (laneHoverAuditionRef.current !== null) {
      window.clearTimeout(laneHoverAuditionRef.current);
      laneHoverAuditionRef.current = null;
    }
  };
  useEffect(() => () => clearLaneHoverAudition(), []);

  // Mirror the queued state onto <html> so CSS can light up valid drop
  // surfaces (cells, lane headers, arrangement rows) for touch users
  // who can't see the HTML5-drag drop-target outline.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (queuedNoteStringId) {
      document.documentElement.dataset.noteStringQueued = 'true';
    } else {
      delete document.documentElement.dataset.noteStringQueued;
    }
    return () => {
      delete document.documentElement.dataset.noteStringQueued;
    };
  }, [queuedNoteStringId]);

  const handleNoteStringDrop = useCallback((stringId: string, trackId: string) => {
    if (!stringId) return false;
    const targetTrack = tracks.find((entry) => entry.id === trackId);
    if (!targetTrack) return false;
    const captured = loadCapturedNoteStrings().find((entry) => entry.id === stringId);
    if (!captured) return false;
    const segment = noteStringToPatternSegment(captured, targetTrack.name, targetTrack.type);
    applySegmentToTrack(trackId, segment);
    setSelectedTrackId(trackId);
    return true;
  }, [applySegmentToTrack, setSelectedTrackId, tracks]);

  // Drop a saved scoresheet onto a lane: find the scoresheet's most
  // active melodic lane, save its pattern 0 as a CapturedNoteString
  // on the shelf, and apply that string to the target lane. The
  // current session is untouched apart from the target lane.
  const handleScoresheetMelodyDrop = useCallback((scoresheetId: string, trackId: string): boolean => {
    if (!scoresheetId) return false;
    const sheet = listScoresheets().find((entry) => entry.id === scoresheetId);
    if (!sheet) return false;
    const thumb = getScoresheetThumbnail(sheet);
    if (!thumb) return false;
    const sourceTracks = sheet.session.project.tracks;
    const sourceTrack = sourceTracks.find((entry) => entry.color === thumb.color)
      ?? sourceTracks.find((entry) => !['kick', 'snare', 'hihat'].includes(entry.type))
      ?? sourceTracks[0];
    if (!sourceTrack) return false;
    const pattern = sourceTrack.patterns[0] ?? [];
    const tokens = tokensFromPatternSteps(pattern);
    if (tokens.length === 0) return false;
    const updated = saveCapturedNoteStringFromTokens({
      name: `${sheet.name} · ${sourceTrack.name}`,
      tokens,
      source: 'typed',
    });
    if (!updated || !updated[0]) return false;
    return handleNoteStringDrop(updated[0].id, trackId);
  }, [handleNoteStringDrop]);

  const handleApplyPatternSegment = (segment: PatternSegment) => {
    if (!selectedTrack) {
      return;
    }

    applySegmentToTrack(selectedTrack.id, segment);
  };

  const handleStitchPatternSegment = (trackId: string, segment: PatternSegment, startStep: number) => {
    const targetTrack = tracks.find((entry) => entry.id === trackId);
    if (!targetTrack) {
      return;
    }

    const nextStepsPerPattern = Math.max(stepsPerPattern, segment.stepsPerPattern);

    if (nextStepsPerPattern > stepsPerPattern) {
      setStepsPerPattern(nextStepsPerPattern);
    }

    const baseSteps = Array.from({ length: nextStepsPerPattern }, (_, stepIndex) => cloneStepEvents(targetTrack.patterns[currentPattern]?.[stepIndex] ?? []));
    const automationBase = targetTrack.automation?.[currentPattern] ?? {
      level: Array.from({ length: nextStepsPerPattern }, () => 0.5),
      tone: Array.from({ length: nextStepsPerPattern }, () => 0.5),
    };
    const nextAutomation = {
      level: Array.from({ length: nextStepsPerPattern }, (_, stepIndex) => automationBase.level[stepIndex] ?? 0.5),
      tone: Array.from({ length: nextStepsPerPattern }, (_, stepIndex) => automationBase.tone[stepIndex] ?? 0.5),
    };

    for (let segmentStep = 0; segmentStep < segment.steps.length; segmentStep += 1) {
      const destinationStep = startStep + segmentStep;
      if (destinationStep >= nextStepsPerPattern) {
        break;
      }

      const sourceEvents = segment.steps[segmentStep] ?? [];
      if (sourceEvents.length === 0) {
        continue;
      }

      const mergedStep = [...baseSteps[destinationStep]];
      sourceEvents.forEach((event) => {
        const eventIndex = mergedStep.findIndex((entry) => entry.note === event.note);
        if (eventIndex >= 0) {
          mergedStep[eventIndex] = { ...event };
        } else {
          mergedStep.push({ ...event });
        }
      });
      baseSteps[destinationStep] = mergedStep;

      nextAutomation.level[destinationStep] = segment.automation.level[segmentStep] ?? nextAutomation.level[destinationStep] ?? 0.5;
      nextAutomation.tone[destinationStep] = segment.automation.tone[segmentStep] ?? nextAutomation.tone[destinationStep] ?? 0.5;
    }

    applyPatternSegment(trackId, currentPattern, baseSteps, nextAutomation);
    setSelectedTrackId(trackId);
    selectStep(startStep);
  };

  // Drop a captured note string onto a specific cell. Reuses the stitch
  // path so it composes with whatever notes were already at the target
  // steps. Defined after handleStitchPatternSegment so the dependency
  // is resolvable in TypeScript's strict block scope.
  const handleNoteStringStitch = (stringId: string, trackId: string, stepIndex: number) => {
    if (!stringId) return false;
    const targetTrack = tracks.find((entry) => entry.id === trackId);
    if (!targetTrack) return false;
    const captured = loadCapturedNoteStrings().find((entry) => entry.id === stringId);
    if (!captured) return false;
    const segment = noteStringToPatternSegment(captured, targetTrack.name, targetTrack.type);
    handleStitchPatternSegment(trackId, segment, stepIndex);
    return true;
  };

  const handleDeletePatternSegment = (segmentId: string) => {
    setPatternSegments((current) => persistPatternSegments(current.filter((segment) => segment.id !== segmentId)));
  };

  const applySessionPlayerProfile = useCallback((profileId: string) => {
    const profile = SESSION_PLAYER_PROFILES.find((entry) => entry.id === profileId);
    if (!profile) {
      return;
    }

    const segments = sessionPlayerSegments[profile.id] ?? [];
    const requiredTrackTypes = uniqueTrackTypes(segments.map((segment) => segment.sourceTrackType));
    const missingTrackTypes = requiredTrackTypes.filter((trackType) => !tracks.some((track) => track.type === trackType));

    if (missingTrackTypes.length > 0) {
      setPendingSessionPlayerRequest({ formId: sessionPlayerFormId, mode: 'groove', profileId: profile.id });
      missingTrackTypes.forEach((trackType) => createTrack(trackType));
      setSessionPlayerNotice(`Adding ${formatTrackTypeList(missingTrackTypes)} lanes for ${profile.label}...`);
      return;
    }

    const nextStepsPerPattern = Math.max(
      stepsPerPattern,
      ...segments.map((segment) => segment.stepsPerPattern),
    );
    if (nextStepsPerPattern > stepsPerPattern) {
      setStepsPerPattern(nextStepsPerPattern);
    }

    let firstTrackId: string | null = null;

    segments.forEach((segment) => {
      const targetTrack = tracks.find((track) => track.type === segment.sourceTrackType);
      if (!targetTrack) {
        return;
      }

      applyPatternSegment(targetTrack.id, currentPattern, segment.steps, segment.automation);
      firstTrackId = firstTrackId ?? targetTrack.id;
    });

    if (firstTrackId) {
      setSelectedTrackId(firstTrackId);
    }

    setSessionPlayerNotice(`${profile.label} loaded into the current pattern. Build a song form when you want sections.`);
  }, [applyPatternSegment, createTrack, currentPattern, sessionPlayerFormId, sessionPlayerSegments, setSelectedTrackId, setStepsPerPattern, stepsPerPattern, tracks]);

  const buildSessionPlayerSong = useCallback((profileId: string, formId: SongFormId) => {
    const profile = SESSION_PLAYER_PROFILES.find((entry) => entry.id === profileId);
    if (!profile) {
      return;
    }

    const patternDecks = sessionPlayerPatternDecks[profile.id] ?? [];
    const requiredTrackTypes = getSessionPlayerTrackTypes(profile.id);
    const missingTrackTypes = requiredTrackTypes.filter((trackType) => !tracks.some((track) => track.type === trackType));

    if (missingTrackTypes.length > 0) {
      setPendingSessionPlayerRequest({ formId, mode: 'song', profileId: profile.id });
      missingTrackTypes.forEach((trackType) => createTrack(trackType));
      setSessionPlayerNotice(`Adding ${formatTrackTypeList(missingTrackTypes)} lanes for ${profile.label}...`);
      return;
    }

    const nextStepsPerPattern = Math.max(
      stepsPerPattern,
      ...patternDecks.flatMap((deck) => deck.segments.map((segment) => segment.stepsPerPattern)),
    );

    if (nextStepsPerPattern > stepsPerPattern) {
      setStepsPerPattern(nextStepsPerPattern);
    }

    if (patternCount < SESSION_PLAYER_PATTERN_COUNT) {
      setPatternCount(SESSION_PLAYER_PATTERN_COUNT);
    }

    requiredTrackTypes.forEach((trackType) => {
      const targetTrack = tracks.find((track) => track.type === trackType);
      if (!targetTrack) {
        return;
      }

      patternDecks.forEach((deck) => {
        clearPatternAt(targetTrack.id, deck.patternIndex);
      });
    });

    patternDecks.forEach((deck) => {
      deck.segments.forEach((segment) => {
        const targetTrack = tracks.find((track) => track.type === segment.sourceTrackType);
        if (!targetTrack) {
          return;
        }

        applyPatternSegment(targetTrack.id, deck.patternIndex, segment.steps, segment.automation);
      });
    });

    setCurrentPattern(0);
    applySongForm(formId);
    setActiveView('SEQUENCER');
    setSessionPlayerNotice(`${profile.label} built as ${getSongFormDefinition(formId).label}. Open the Arrangement panel to shape it.`);
  }, [applyPatternSegment, applySongForm, clearPatternAt, createTrack, patternCount, sessionPlayerPatternDecks, setActiveView, setCurrentPattern, setPatternCount, setStepsPerPattern, stepsPerPattern, tracks]);

  useEffect(() => {
    if (!pendingSessionPlayerRequest) {
      return;
    }

    const requiredTrackTypes = pendingSessionPlayerRequest.mode === 'song'
      ? getSessionPlayerTrackTypes(pendingSessionPlayerRequest.profileId)
      : uniqueTrackTypes((sessionPlayerSegments[pendingSessionPlayerRequest.profileId] ?? []).map((segment) => segment.sourceTrackType));
    const missingTrackTypes = requiredTrackTypes.filter((trackType) => !tracks.some((track) => track.type === trackType));

    if (missingTrackTypes.length > 0) {
      return;
    }

    const request = pendingSessionPlayerRequest;
    setPendingSessionPlayerRequest(null);

    if (request.mode === 'song') {
      buildSessionPlayerSong(request.profileId, request.formId);
      return;
    }

    applySessionPlayerProfile(request.profileId);
  }, [applySessionPlayerProfile, buildSessionPlayerSong, pendingSessionPlayerRequest, sessionPlayerSegments, tracks]);

  return (
    <section
      className="sequencer-workspace surface-panel flex flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden"
      data-editing-mode={editingMode ? 'true' : undefined}
    >
      <SequencerPlayheadDriver
        followPlayhead={editingMode && followPlayhead}
        gridViewportRef={gridViewportRef}
        laneHeaderWidth={laneHeaderWidth}
        markProgrammaticScroll={markProgrammaticGridScroll}
        stepCellWidth={stepCellWidth}
        stepsPerPattern={stepsPerPattern}
      />
      <div className={`sequencer-panel-header flex flex-col gap-3 border-b border-[var(--border-soft)] px-5 py-3 md:flex-row md:items-center md:justify-between md:gap-4 ${editingMode ? 'hidden' : ''}`}>
        <div className="min-w-0 shrink-0">
          <div className="flex items-baseline gap-2">
            <div className="section-label">Sequencer</div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Pattern grid</h2>
          </div>
          <p className="mt-1 hidden text-sm text-[var(--text-secondary)] xl:block">Build the current pattern here before you move it into Song view.</p>
        </div>
        <div className={`surface-panel-muted min-w-0 p-2 ${addLaneOpen ? 'w-full sm:max-w-full md:max-w-[700px] md:flex-1' : 'w-full md:w-auto'}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="section-label shrink-0">Add lane</span>
            <div className="flex items-center gap-1.5">
              {tracks.length > 0 && (
                <button
                  aria-label={confirmClearLanes ? 'Confirm delete all lanes' : 'Delete all lanes'}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] border px-2.5 transition-colors"
                  onClick={() => {
                    if (confirmClearLanes) {
                      tracks.forEach((track) => removeTrack(track.id));
                      setConfirmClearLanes(false);
                    } else {
                      setConfirmClearLanes(true);
                      window.setTimeout(() => setConfirmClearLanes(false), 3500);
                    }
                  }}
                  style={{
                    borderColor: confirmClearLanes ? 'var(--danger)' : 'var(--border-soft)',
                    background: confirmClearLanes ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.02)',
                    color: confirmClearLanes ? 'var(--danger)' : 'var(--text-tertiary)',
                  }}
                  title={confirmClearLanes ? 'Tap again to remove every lane' : 'Delete all lanes'}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{confirmClearLanes ? 'Confirm' : 'Delete all'}</span>
                </button>
              )}
              {addLaneOpen && (
                <>
                  <button
                    aria-label="Scroll the add-lane palette left"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    disabled={addLaneScrollLeft <= 2}
                    onClick={() => scrollAddLaneStrip(-1)}
                    title="Scroll left"
                    type="button"
                  >
                    <ArrowUp className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                  <button
                    aria-label="Scroll the add-lane palette right"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    disabled={addLaneScrollLeft >= (addLaneMaxScrollLeft - 2)}
                    onClick={() => scrollAddLaneStrip(1)}
                    title="Scroll right"
                    type="button"
                  >
                    <ArrowDown className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                </>
              )}
              <button
                aria-expanded={addLaneOpen}
                className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                data-ui-sound="tab"
                onClick={() => {
                  const next = !addLaneOpen;
                  writeString(ADD_LANE_OPEN_KEY, next ? 'true' : 'false');
                  setAddLaneOpen(next);
                }}
                title={addLaneOpen ? 'Minimise the add-lane strip' : 'Show the add-lane strip'}
                type="button"
              >
                {addLaneOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {addLaneOpen && (
          <>
          <div
            className="add-lane-strip mt-2 flex items-stretch gap-2 overflow-x-auto pb-1"
            ref={addLaneStripRef}
          >
            <button
              className="add-lane-pill shrink-0 rounded-[4px] border px-2.5 py-2 text-left transition-colors"
              onClick={handleCreateLaneFromCapture}
              style={{ borderColor: 'var(--accent-strong)', background: 'rgba(114,217,255,0.08)' }}
              title="Add a new lane from your most recent capture or recording"
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-[var(--accent-strong)] bg-[rgba(114,217,255,0.12)] text-[var(--accent-strong)]">
                  <Mic className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                    <Plus className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={3} />From capture
                  </span>
                  <span className="block text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">recorded</span>
                </span>
              </div>
            </button>
            {TRACK_BUTTONS.map((button) => (
              <button
                className="control-chip add-lane-pill shrink-0 px-2.5 py-2 text-left"
                key={button.type}
                onClick={() => handleCreateLane(button.type)}
                title={`Add a ${button.label} lane`}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.04)] text-[var(--accent-strong)]">
                    <TrackIcon className="h-3.5 w-3.5" type={button.type} />
                  </span>
                  <span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                      <Plus className="h-3 w-3 text-[var(--accent)]" strokeWidth={3} />{button.label}
                    </span>
                    <span className="block text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{button.family}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              aria-label="Add lane strip scroll"
              className="sonic-scroll-strip flex-1"
              max={Math.max(1, addLaneMaxScrollLeft)}
              min={0}
              onChange={(event) => {
                const target = Number(event.target.value);
                setAddLaneScrollLeft(target);
                if (addLaneStripRef.current) {
                  addLaneStripRef.current.scrollLeft = target;
                }
              }}
              step={1}
              type="range"
              value={Math.min(addLaneScrollLeft, Math.max(1, addLaneMaxScrollLeft))}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{addLaneScrollProgress}</span>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Items stretch (the default) on purpose: with items-start the column
          chain loses its definite height, and a flex-1 grid inside an
          indefinite chain resolves to its max-height and paints past the
          panel background, the black-void-on-scroll bug. */}
      <div className={`sequencer-workspace-body flex flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden xl:flex-row ${editingMode ? 'gap-0 p-0' : 'gap-3 p-4'}`}>
        <div className="sequencer-main-column flex min-w-0 flex-col overflow-visible md:min-h-0 md:flex-1">
          <div className={`sequencer-compose-summary surface-panel-muted mb-2 px-4 py-2.5 sm:mb-3 sm:py-3 ${editingMode ? 'hidden' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-label hidden sm:block">Compose</div>
                <div className="text-sm font-medium text-[var(--text-primary)] sm:mt-1">
                  {selectedTrack ? `${selectedTrack.name} in Pattern ${String.fromCharCode(65 + currentPattern)}` : 'Pick a lane to start writing'}
                </div>
                <div className="mt-1 hidden text-[11px] text-[var(--text-secondary)] sm:block">
                  {selectedTrack
                    ? `${countLabel(selectedTrackPattern.filter((step) => step.length > 0).length, 'active step')} · ${countLabel(selectedTrackPattern.reduce((sum, step) => sum + step.length, 0), 'note')} · ${isSelectedTrackDrum ? 'drum lane' : 'melodic lane'}`
                    : `${countLabel(tracks.length, 'track')} · ${countLabel(melodicTrackCount, 'melodic lane')}`}
                </div>
              </div>
              <button
                aria-expanded={composeToolsExpanded}
                className="control-chip flex h-8 shrink-0 items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-ui-sound="tab"
                onClick={() => {
                  const next = !composeToolsExpanded;
                  writeString(COMPOSE_TOOLS_KEY, next ? 'true' : 'false');
                  setComposeToolsExpanded(next);
                }}
                title={composeToolsExpanded ? 'Hide step, zoom, lane, and map tools' : 'Step length, zoom, lane, and map tools'}
                type="button"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{composeToolsExpanded ? 'Hide tools' : 'Tools'}</span>
                {composeToolsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {composeToolsExpanded && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="surface-panel-strong flex flex-wrap items-center gap-1 p-1">
                  <span className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Steps</span>
                  {QUICK_STEP_OPTIONS.map((option) => (
                    <button
                      className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      data-active={stepsPerPattern === option}
                      key={option}
                      onClick={() => setPatternLength(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                  <select
                    aria-label="Pattern length in steps"
                    className="control-chip h-[30px] cursor-pointer px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onChange={(event) => setPatternLength(Number(event.target.value))}
                    value={stepsPerPattern}
                  >
                    {!(STEP_OPTIONS as readonly number[]).includes(stepsPerPattern) && (
                      <option value={stepsPerPattern}>{stepsPerPattern}</option>
                    )}
                    {STEP_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <button
                    className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => extendPatternBy(-16)}
                    type="button"
                  >
                    -1 bar
                  </button>
                  <button
                    className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => extendPatternBy(16)}
                    type="button"
                  >
                    +1 bar
                  </button>
                  <button
                    className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => extendPatternBy(32)}
                    type="button"
                  >
                    +2 bars
                  </button>
                </div>
                {hiddenPatternContent.hiddenNoteCount > 0 ? (
                  <div className="surface-panel-strong flex flex-wrap items-center gap-2 px-2 py-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--warning)]">
                      {countLabel(hiddenPatternContent.hiddenNoteCount, 'hidden note')} beyond {stepsPerPattern}
                    </span>
                    <button
                      className="control-chip px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => setPatternLength(hiddenPatternContent.requiredSteps)}
                      type="button"
                    >
                      Restore length to {hiddenPatternContent.requiredSteps}
                    </button>
                  </div>
                ) : null}
                <div className="surface-panel-strong flex flex-wrap items-center gap-2 p-1">
                  <span className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Zoom</span>
                  <button
                    aria-label="Zoom the step grid out"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    onClick={() => updateStepZoom(stepCellWidth - 6)}
                    title="Zoom out"
                    type="button"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    aria-label="Step grid zoom"
                    className="sonic-scroll-strip w-24"
                    max={stepZoomMax}
                    min={STEP_ZOOM_MIN}
                    onChange={(event) => updateStepZoom(Number(event.target.value))}
                    step={STEP_ZOOM_STEP}
                    type="range"
                    value={stepCellWidth}
                  />
                  <button
                    aria-label="Zoom the step grid in"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    onClick={() => updateStepZoom(stepCellWidth + 6)}
                    title="Zoom in"
                    type="button"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{stepCellWidth}px</span>
                </div>
                <div className="surface-panel-strong flex flex-wrap items-center gap-1 p-1">
                  <span className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Editor</span>
                  {(['select', 'edit'] as const).map((mode) => (
                    <button
                      className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      data-active={editorMode === mode}
                      key={mode}
                      onClick={() => setEditorMode(mode)}
                      type="button"
                    >
                      {mode === 'select' ? 'Select' : 'Draw'}
                    </button>
                  ))}
                </div>
                {!isMobileViewport && (
                  <LoadWatchReadout
                    currentPattern={currentPattern}
                    isPlaying={isPlaying}
                    stepsPerPattern={stepsPerPattern}
                    superSonicMode={superSonicMode}
                    tracks={tracks}
                  />
                )}
                {superSonicMode && superSonicPreferences.guidanceBadges && (
                  <div className="surface-panel-strong flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                    <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Macro lane view ready
                  </div>
                )}
                {(['ALL', 'ACTIVE', 'FOCUSED', 'PINNED', 'DRUMS', 'MUSICAL'] as const).map((scope) => (
                  <div key={scope}>
                    <ScopeChip
                      active={laneScope === scope}
                      label={scope === 'ALL' ? 'All lanes' : scope === 'ACTIVE' ? 'Active' : scope === 'FOCUSED' ? 'Focused' : scope === 'PINNED' ? 'Pinned' : scope === 'DRUMS' ? 'Drums' : 'Musical'}
                      onClick={() => setLaneScope(scope)}
                    />
                  </div>
                ))}
                <ScopeChip
                  active={compactLanes}
                  label={compactLanes ? 'Compact on' : 'Compact off'}
                  onClick={() => setCompactLanes((current) => !current)}
                />
                {selectedTrack && (
                  <>
                    <button
                      className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => void previewTrack(selectedTrack.id)}
                      type="button"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Audition
                    </button>
                    <button
                      className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      data-active={isSelectedTrackLoopActive}
                      disabled={!selectedTrackPatternSpan}
                      onClick={handleToggleSelectedTrackLoop}
                      type="button"
                    >
                      <Music2 className="h-3.5 w-3.5" />
                      {isSelectedTrackLoopActive ? 'Loop on' : 'Loop phrase'}
                    </button>
                    <button
                      className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => { setActiveView('SEQUENCER'); if (canDeepEditSelectedTrack) openNotesPanel(); }}
                      type="button"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {canDeepEditSelectedTrack ? 'Deep edit' : 'Song tools'}
                    </button>
                    {isNarrowViewport && (
                      <button
                        className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        onClick={() => setMobileInspectorOpen((current) => !current)}
                        type="button"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {mobileInspectorOpen ? 'Hide inspector' : 'Show inspector'}
                      </button>
                    )}
                  </>
                )}
              </div>
              )}
            </div>
          </div>

          {editingMode && (
            <div className="editing-canvas-toolbar flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-3 py-1.5">
              {showSongGrid ? (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <Music2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="section-label shrink-0">Song timeline</span>
                    <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:inline">
                      {Math.max(1, Math.ceil(songLengthInBeats / stepsPerPattern))} bars · {songSectionRanges.length} sections
                    </span>
                    <div aria-label="Song editing view" className="ml-1 flex shrink-0 overflow-hidden rounded-[3px] border border-[var(--border-soft)]" role="group">
                      <button
                        aria-pressed="true"
                        className="editing-tool-button flex h-8 items-center px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        data-active="true"
                        type="button"
                      >
                        Timeline
                      </button>
                      <button
                        className="editing-tool-button flex h-8 items-center border-l border-[var(--border-soft)] px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
                        onClick={() => { writeString(SONG_FLATTEN_KEY, 'false'); setSongFlatten(false); }}
                        type="button"
                      >
                        Pattern
                      </button>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      className="control-chip flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      onClick={() => {
                        setManagedSectionId(null);
                        setSectionManagerOpen(true);
                      }}
                      title="Add, rename, save, duplicate, clear, or delete song sections"
                      type="button"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Sections
                      <span className="font-mono text-[9px] text-[var(--accent-strong)]">{songSectionRanges.length}</span>
                    </button>
                    <div aria-label="Song timeline zoom" className="flex h-8 items-center overflow-hidden rounded-[3px] border border-[var(--border-soft)]" role="group">
                      <button
                        aria-label="Zoom the song timeline out"
                        className="control-chip flex h-full w-8 shrink-0 items-center justify-center border-0"
                        onClick={() => updateSongTimelineZoom(songTimelineCellWidth - 4)}
                        title="Zoom out"
                        type="button"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        aria-label="Song timeline zoom"
                        className="sonic-scroll-strip mx-2 hidden w-24 sm:block"
                        max={songTimelineZoomMax}
                        min={SONG_TIMELINE_ZOOM_MIN}
                        onChange={(event) => updateSongTimelineZoom(Number(event.target.value))}
                        step={STEP_ZOOM_STEP}
                        type="range"
                        value={songTimelineCellWidth}
                      />
                      <button
                        aria-label="Zoom the song timeline in"
                        className="editing-canvas-zoom-in control-chip flex h-full w-8 shrink-0 items-center justify-center border-0 border-l border-[var(--border-soft)]"
                        onClick={() => updateSongTimelineZoom(songTimelineCellWidth + 4)}
                        title="Zoom in"
                        type="button"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      aria-label={compactLanes ? 'Use roomy song lanes' : 'Use compact song lanes'}
                      className="control-chip flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      data-active={compactLanes ? 'true' : undefined}
                      onClick={() => setCompactLanes((current) => !current)}
                      title={compactLanes ? 'Make song lanes taller' : 'Fit more song lanes on screen'}
                      type="button"
                    >
                      {compactLanes ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                      <span className="hidden md:inline">{compactLanes ? 'Roomy' : 'Compact'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="section-label shrink-0">Pattern {String.fromCharCode(65 + currentPattern)}</span>
                    <span className="hidden max-w-[220px] truncate text-[11px] text-[var(--text-secondary)] xl:inline">
                      {selectedTrack?.name ?? `${visibleTracks.length} lanes`}
                    </span>
                    <div aria-label="Sequencer editing tool" className="ml-1 flex shrink-0 overflow-hidden rounded-[3px] border border-[var(--border-soft)]" role="group">
                      <button
                        aria-label="Use the Draw tool"
                        aria-pressed={editorMode === 'edit'}
                        className="editing-tool-button flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
                        data-active={editorMode === 'edit' ? 'true' : undefined}
                        onClick={() => setEditorMode('edit')}
                        title="Draw or erase notes by clicking and dragging"
                        type="button"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Draw</span>
                      </button>
                      <button
                        aria-label="Use the Select tool"
                        aria-pressed={editorMode === 'select'}
                        className="editing-tool-button flex h-8 items-center gap-1.5 border-l border-[var(--border-soft)] px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
                        data-active={editorMode === 'select' ? 'true' : undefined}
                        onClick={() => setEditorMode('select')}
                        title="Select a phrase across steps and lanes"
                        type="button"
                      >
                        <MousePointer2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Select</span>
                      </button>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    {transportMode === 'SONG' && (
                      <button
                        className="control-chip flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        onClick={() => { writeString(SONG_FLATTEN_KEY, 'true'); setSongFlatten(true); }}
                        title="Edit every section on one continuous timeline"
                        type="button"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Song timeline
                      </button>
                    )}
                    <button
                      aria-label={patternFitActive ? 'Restore the previous track zoom' : 'Fit pattern to the track editor'}
                      className="control-chip h-8 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      data-active={patternFitActive ? 'true' : undefined}
                      onClick={fitPatternToViewport}
                      title={patternFitActive ? 'Return to the zoom and position you had before fitting' : 'Fit the current pattern across the available canvas'}
                      type="button"
                    >
                      {patternFitActive ? 'Restore zoom' : 'Fit pattern'}
                    </button>
                    <button
                      aria-label="Center the selected step in the track editor"
                      className="control-chip flex h-8 shrink-0 items-center gap-1.5 px-2"
                      onClick={() => jumpToStep(selectedStepIndex, selectedTrack?.id)}
                      title={`Center selected step ${selectedStepIndex + 1}`}
                      type="button"
                    >
                      <LocateFixed className="h-3.5 w-3.5" />
                      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] lg:inline">Selected</span>
                    </button>
                    <button
                      aria-label={followPlayhead ? 'Stop following the playhead' : 'Follow the playhead'}
                      aria-pressed={followPlayhead}
                      className="control-chip flex h-8 shrink-0 items-center gap-1.5 px-2.5"
                      data-active={followPlayhead ? 'true' : undefined}
                      onClick={togglePlayheadFollow}
                      title={followPlayhead ? 'Following the playhead; manual scrolling pauses follow' : 'Keep the playhead visible during playback'}
                      type="button"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Follow</span>
                    </button>
                    <button
                      aria-label="Zoom the step grid out"
                      className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                      onClick={() => updateStepZoom(stepCellWidth - 6)}
                      title="Zoom out"
                      type="button"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      aria-label="Step grid zoom"
                      className="sonic-scroll-strip hidden w-24 sm:block"
                      max={stepZoomMax}
                      min={STEP_ZOOM_MIN}
                      onChange={(event) => updateStepZoom(Number(event.target.value))}
                      step={STEP_ZOOM_STEP}
                      type="range"
                      value={stepCellWidth}
                    />
                    <button
                      aria-label="Zoom the step grid in"
                      className="editing-canvas-zoom-in control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                      onClick={() => updateStepZoom(stepCellWidth + 6)}
                      title="Zoom in"
                      type="button"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="hidden min-w-9 text-right font-mono text-[10px] text-[var(--text-tertiary)] xl:inline">
                      {stepCellWidth}px
                    </span>
                    <button
                      className="control-chip hidden h-8 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] md:block"
                      data-active={compactLanes ? 'true' : undefined}
                      onClick={() => setCompactLanes((current) => !current)}
                      title="Toggle compact lane height"
                      type="button"
                    >
                      {compactLanes ? 'Roomy lanes' : 'Compact lanes'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {editingMode && editorMode === 'select' && (
            <div className="selection-action-bar flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border-soft)] bg-[rgba(114,217,255,0.045)] px-3 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="section-label shrink-0">Selection</span>
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  {displayedStepRange && selectedRangeStats
                    ? `${movingStepRange ? 'Move to' : countLabel(selectedRangeStats.laneCount, 'lane')} · steps ${displayedStepRange.start + 1}-${displayedStepRange.end + 1} · ${countLabel(selectedRangeStats.noteCount, 'note')}`
                    : 'No range selected'}
                </span>
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                <div aria-label="Move selection" className="flex overflow-hidden rounded-[3px] border border-[var(--border-soft)]" role="group">
                  <button
                    aria-label="Move the selected phrase left"
                    className="control-chip flex h-8 w-8 items-center justify-center border-0"
                    disabled={!stepRange || stepRange.start === 0}
                    onClick={(event) => nudgeSelectedRange(-1, event.shiftKey ? 16 : 1)}
                    title="Move left one step (Left Arrow). Shift-click for one bar."
                    type="button"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="flex h-8 items-center border-x border-[var(--border-soft)] px-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    Move
                  </span>
                  <button
                    aria-label="Move the selected phrase right"
                    className="control-chip flex h-8 w-8 items-center justify-center border-0"
                    disabled={!stepRange || stepRange.end >= stepsPerPattern - 1}
                    onClick={(event) => nudgeSelectedRange(1, event.shiftKey ? 16 : 1)}
                    title="Move right one step (Right Arrow). Shift-click for one bar."
                    type="button"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  aria-label="Duplicate the selected phrase"
                  className="control-chip flex h-8 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  disabled={!stepRange}
                  onClick={() => duplicateStepRange()}
                  title="Duplicate after selection (Cmd/Ctrl+D)"
                  type="button"
                >
                  <CopyPlus className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <button
                  aria-label="Copy the selected phrase"
                  className="control-chip flex h-8 items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  disabled={!stepRange}
                  onClick={() => copyStepRange()}
                  title="Copy selection (Cmd/Ctrl+C)"
                  type="button"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
                <button
                  aria-label="Paste into the selected phrase position"
                  className="control-chip flex h-8 items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  disabled={!rangeClipboardReady || !selectedTrack}
                  onClick={pasteCopiedRange}
                  title="Paste at selection (Cmd/Ctrl+V)"
                  type="button"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
                <button
                  aria-label="Loop the selected phrase"
                  className="control-chip flex h-8 items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  data-active={stepRange && loopRangeStartBeat === stepRange.start && loopRangeEndBeat === stepRange.end + 1 ? 'true' : undefined}
                  disabled={!stepRange}
                  onClick={loopSelectedRange}
                  title="Loop this range during pattern playback"
                  type="button"
                >
                  <Repeat2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Loop</span>
                </button>
                <button
                  aria-label="Clear notes in the selected phrase"
                  className="control-chip flex h-8 items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]"
                  disabled={!stepRange}
                  onClick={clearSelectedRange}
                  title="Clear notes in selection (Delete)"
                  type="button"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Clear</span>
                </button>
                <button
                  aria-label="Deselect the phrase"
                  className="ghost-icon-button flex h-8 w-8 shrink-0 items-center justify-center"
                  disabled={!stepRange}
                  onClick={() => {
                    setStepRange(null);
                    setStepRangeMovePreview(null);
                    stepRangeMoveGestureRef.current = null;
                  }}
                  title="Deselect (Escape)"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="sequencer-canvas-stack flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
            <TrackMinimap />
            {showSongGrid && (
              <SongTimelineGrid
                tracks={visibleTracks}
                arrangerClips={arrangerClips}
                cellWidth={songTimelineCellWidth}
                compactLanes={compactLanes}
                stepsPerPattern={stepsPerPattern}
                songLengthInBeats={songLengthInBeats}
                songMarkers={songMarkers}
                selectedTrackId={selectedTrackId}
                superSonicMode={superSonicMode}
                onSelectTrack={setSelectedTrackId}
                onToggleStep={(trackId, patternIndex, localStep) => {
                  togglePatternStep(trackId, patternIndex, localStep);
                  void previewTrack(trackId);
                }}
                onPlaceNote={(trackId, patternIndex, localStep, note) => {
                  togglePatternStep(trackId, patternIndex, localStep, note);
                  void previewTrack(trackId, note);
                }}
                onAddSongNote={(trackId, songStep, note) => {
                  placeSongStep(trackId, songStep, note);
                  void previewTrack(trackId, note);
                }}
                onEraseStep={(trackId, patternIndex, localStep) => {
                  // Erase drag: clear the step without auditioning, so dragging
                  // across a strip does not machine-gun the lane.
                  togglePatternStep(trackId, patternIndex, localStep);
                }}
                onSeek={(beat) => engine.seekToBeat(beat)}
                onRenameSection={(markerId, name) => updateSongMarker(markerId, { name })}
                onManageSection={(markerId) => {
                  setManagedSectionId(markerId);
                  setSectionManagerOpen(true);
                }}
                onResizeSectionEnd={(_sectionId, startBeat, currentEndBeat, nextEndBeat) => {
                  resizeSongSectionEnd(startBeat, currentEndBeat, nextEndBeat);
                }}
                onReorderTrack={reorderTrack}
                onDeleteTrack={removeTrack}
              />
            )}
            <div
              aria-label="Pattern grid. Scroll vertically through lanes and horizontally through steps."
              className={`sequencer-grid-scroll overflow-auto rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] min-h-[clamp(340px,50vh,640px)] md:min-h-0 md:max-h-none md:flex-1 ${showSongGrid ? 'hidden' : ''}`}
              data-scrolled={gridScrollLeft > 1 ? 'true' : undefined}
              onKeyDown={handleGridKeyDown}
              onPointerCancel={() => setPlacementCursor(null)}
              onPointerMove={handlePlacementMove}
              onPointerUp={handlePlacementCommit}
              ref={gridViewportRef}
              role="region"
              tabIndex={0}
            >
              <div style={{ minWidth: `${laneHeaderWidth + stepGridWidth}px` }}>
                <div className="sticky top-0 z-10 flex h-12 border-b border-[var(--border-soft)] bg-[var(--bg-panel-strong)] backdrop-blur">
                  <div
                    className={`grid-freeze-col flex h-full shrink-0 items-center border-r border-[var(--border-soft)] ${laneColumnCollapsed ? 'justify-center' : 'justify-between px-3'}`}
                    style={{ width: `${laneHeaderWidth}px` }}
                  >
                    {laneColumnCollapsed ? (
                      <button
                        aria-label="Show lane labels"
                        className="ghost-icon-button flex h-7 w-7 shrink-0 items-center justify-center"
                        data-ui-sound="tab"
                        onClick={() => setLaneColumnCollapsed(false)}
                        title="Show the lane labels and controls"
                        type="button"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <div className="flex min-w-0 items-center gap-2">
                          <Music2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                          <span className="section-label truncate">Tracks</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            aria-label={editingMode ? 'Leave editing mode' : 'Enter editing mode'}
                            className="track-edit-mode-button control-chip flex h-8 shrink-0 items-center gap-1.5 px-2.5"
                            data-active={editingMode ? 'true' : undefined}
                            onClick={toggleEditingMode}
                            title={editingMode ? 'Restore the complete studio' : 'Open the full-width track editor'}
                            type="button"
                          >
                            {editingMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">{editingMode ? 'Done' : 'Edit view'}</span>
                          </button>
                          <button
                            aria-label="Hide lane labels"
                            className="ghost-icon-button flex h-7 w-7 shrink-0 items-center justify-center"
                            data-ui-sound="tab"
                            onClick={() => setLaneColumnCollapsed(true)}
                            title="Collapse the lane labels to free up grid space"
                            type="button"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex" style={{ width: `${stepGridWidth}px` }}>
                    {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => {
                      const menuOpen = stepColumnMenuIndex === stepIndex;
                      const selected = selectedStepIndex === stepIndex;
                      return (
                        <div
                          className={`step-ruler-cell relative shrink-0 border-r border-[var(--border-soft)] ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.035)]' : ''}`}
                          data-menu-open={menuOpen ? 'true' : undefined}
                          data-selected={selected ? 'true' : undefined}
                          data-step-column-menu-root="true"
                          key={stepIndex}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            selectStep(stepIndex);
                            setStepColumnMenuIndex(stepIndex);
                          }}
                          style={{ width: `${stepCellWidth}px` }}
                        >
                          <button
                            aria-label={`Select step ${stepIndex + 1}`}
                            className="flex h-full w-full items-center justify-center"
                            onClick={() => {
                              selectStep(stepIndex);
                              setStepColumnMenuIndex(null);
                            }}
                            title={`Step ${stepIndex + 1}. Right-click or use the menu for whole-column tools.`}
                            type="button"
                          >
                            <span className={`font-mono text-[11px] ${selected ? 'text-[var(--accent-strong)]' : stepIndex % 4 === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                              {stepIndex + 1}
                            </span>
                          </button>
                          <PatternColumnMenu
                            currentPattern={currentPattern}
                            onOpenChange={(open) => {
                              if (open) selectStep(stepIndex);
                              setStepColumnMenuIndex(open ? stepIndex : null);
                            }}
                            onOperation={(operation) => runPatternColumnOperation(stepIndex, operation)}
                            open={menuOpen}
                            selected={selected}
                            stepIndex={stepIndex}
                            stepsPerPattern={stepsPerPattern}
                          />
                        </div>
                      );
                    })}
                    <button
                      aria-label={patternLengthPreview
                        ? `Release to set the pattern to ${patternLengthPreview.steps} steps${patternLengthPreview.fill ? ' and fill the new space' : ''}`
                        : 'Add a bar tap +16 · drag to size · alt fills'}
                      className="pattern-length-runway group relative flex shrink-0 cursor-ew-resize touch-none flex-col items-center justify-center border-l border-dashed border-[var(--border-soft)] bg-[linear-gradient(90deg,rgba(255,255,255,0.03),rgba(114,217,255,0.08))] transition-colors hover:border-[rgba(114,217,255,0.28)] hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(114,217,255,0.12))]"
                      data-active={patternLengthPreview ? 'true' : undefined}
                      onPointerCancel={() => {
                        runwayDragRef.current = null;
                        setPatternLengthPreview(null);
                      }}
                      onPointerDown={(event) => {
                        runwayDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startSteps: stepsPerPattern, lastSteps: stepsPerPattern, alt: event.altKey, dragged: false };
                        setPatternLengthPreview({ fill: event.altKey, steps: stepsPerPattern });
                        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
                      }}
                      onPointerMove={(event) => {
                        const drag = runwayDragRef.current;
                        if (!drag || drag.pointerId !== event.pointerId) return;
                        const dx = event.clientX - drag.startX;
                        if (Math.abs(dx) > 6) drag.dragged = true;
                        if (event.altKey) drag.alt = true;
                        const next = clampNumber(drag.startSteps + Math.round(dx / stepCellWidth), 16, MAX_STEPS_PER_PATTERN);
                        drag.lastSteps = next;
                        setPatternLengthPreview({ fill: drag.alt, steps: next });
                      }}
                      onPointerUp={(event) => {
                        const drag = runwayDragRef.current;
                        runwayDragRef.current = null;
                        setPatternLengthPreview(null);
                        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* synthetic events */ }
                        if (!drag) return;
                        const alt = drag.alt || event.altKey;
                        if (!drag.dragged) {
                          commitPatternResize(drag.startSteps, drag.startSteps + 16, alt);
                          window.requestAnimationFrame(() => jumpToStep(drag.startSteps));
                        } else {
                          commitPatternResize(drag.startSteps, drag.lastSteps, alt);
                        }
                      }}
                      style={{ width: `${stepRunwayWidth}px` }}
                      title="Tap to add a bar, or drag to size the pattern step by step. Hold Alt to fill the new steps with the pattern so far."
                      type="button"
                    >
                      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                        <Plus className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={3} />
                        {patternLengthPreview ? `${patternLengthPreview.steps} steps` : 'Add a bar'}
                      </span>
                      <span className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                        {patternLengthPreview
                          ? `${patternLengthPreview.steps - stepsPerPattern >= 0 ? '+' : ''}${patternLengthPreview.steps - stepsPerPattern} on release${patternLengthPreview.fill ? ' · fill on' : ''}`
                          : 'tap +16 · drag to size · alt fills'}
                      </span>
                    </button>
                  </div>
                </div>

              {visibleTracks.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
                  Show off your musical prowess by adding a lane and placing some notes. Use the track map above to jump around as your pattern grows.
                </div>
              ) : visibleTrackSections.map(({ key, label, tracks: groupedTracks }) => (
                <div key={key}>
                  <button
                    className="flex w-full items-center justify-between border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-left"
                    onClick={() => setCollapsedGroups((current) => ({ ...current, [key]: !current[key] }))}
                  >
                    <div className="flex items-center gap-3">
                      <span className="section-label">{label}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                        {groupedTracks.length} lane{groupedTracks.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{collapsedGroups[key] ? '+' : '−'}</span>
                  </button>
                  {!collapsedGroups[key] && groupedTracks.map((track) => {
                    const patternSteps = track.patterns[currentPattern] || Array.from({ length: stepsPerPattern }, () => []);
                    const selected = selectedTrackId === track.id;
                    const pinned = pinnedTrackIds.includes(track.id);
                    const runwayAnchorNote = getTrackAnchorNote(track, patternSteps, stepsPerPattern);
                    const activeRunwayPreview = laneRunwayPreview?.trackId === track.id ? laneRunwayPreview : null;

                    return (
                      <div
                        className={`group/lane flex border-b border-[var(--border-soft)] transition-colors ${selected ? 'bg-[rgba(125,211,252,0.06)]' : 'bg-transparent hover:bg-[rgba(255,255,255,0.02)]'}`}
                        data-seq-lane-row
                        data-track-id={track.id}
                        key={track.id}
                      >
                        <div
                          className={`group grid-freeze-col shrink-0 overflow-hidden border-r border-[var(--border-soft)] text-left cursor-pointer ${laneColumnCollapsed ? 'flex items-center justify-center py-2' : laneHeaderPaddingClass}`}
                          data-selected={selected ? 'true' : undefined}
                          onClick={() => {
                            clearLaneHoverAudition();
                            if (queuedNoteStringId) {
                              const applied = handleNoteStringDrop(queuedNoteStringId, track.id);
                              if (applied) {
                                setQueuedNoteStringId(null);
                                return;
                              }
                            }
                            setSelectedTrackId(track.id);
                          }}
                          onPointerEnter={(event) => {
                            if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
                            if (queuedNoteStringId) return;
                            clearLaneHoverAudition();
                            laneHoverAuditionRef.current = window.setTimeout(() => {
                              void previewTrack(track.id);
                            }, 320);
                          }}
                          onPointerLeave={clearLaneHoverAudition}
                          onDragEnter={(event) => {
                            if (
                              event.dataTransfer.types.includes('application/x-sonicstudio-note-string')
                              || event.dataTransfer.types.includes('application/x-sonicstudio-scoresheet')
                            ) {
                              event.preventDefault();
                              event.currentTarget.dataset.dropTarget = 'note-string';
                            }
                          }}
                          onDragLeave={(event) => {
                            if (event.currentTarget === event.target) {
                              delete event.currentTarget.dataset.dropTarget;
                            }
                          }}
                          onDragOver={(event) => {
                            if (
                              event.dataTransfer.types.includes('application/x-sonicstudio-note-string')
                              || event.dataTransfer.types.includes('application/x-sonicstudio-scoresheet')
                            ) {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = 'copy';
                            }
                          }}
                          onDrop={(event) => {
                            const stringId = event.dataTransfer.getData('application/x-sonicstudio-note-string');
                            if (stringId) {
                              event.preventDefault();
                              delete event.currentTarget.dataset.dropTarget;
                              handleNoteStringDrop(stringId, track.id);
                              return;
                            }
                            const scoresheetId = event.dataTransfer.getData('application/x-sonicstudio-scoresheet');
                            if (scoresheetId) {
                              event.preventDefault();
                              delete event.currentTarget.dataset.dropTarget;
                              handleScoresheetMelodyDrop(scoresheetId, track.id);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedTrackId(track.id);
                            }
                          }}
                          role="button"
                          style={{ width: `${laneHeaderWidth}px` }}
                          tabIndex={0}
                        >
                          {selected && <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full" style={{ backgroundColor: track.color }} />}
                          {laneColumnCollapsed ? (
                            <CollapsedLaneIcon active={isPlaying} color={track.color} intervalMs={meterIntervalForMode(130, audioStabilityMode)} title={`${track.name} · ${track.type} lane`} trackId={track.id}>
                              <TrackIcon type={track.type} className="h-3.5 w-3.5" />
                            </CollapsedLaneIcon>
                          ) : (
                          <>
                          <div className="flex min-w-0 items-center gap-2">
                            <div
                              className="shrink-0 flex h-7 w-7 items-center justify-center"
                              style={{ borderRadius: '2px', border: `1px solid ${track.color}55`, background: `${track.color}1a`, color: track.color }}
                              title={getTrackPersonality(track.type).blurb}
                            >
                              <TrackIcon type={track.type} className="h-3.5 w-3.5" />
                            </div>
                            <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</span>
                          </div>
                          <TrackMeterBar
                            active={isPlaying}
                            className="mt-1.5"
                            color={track.color}
                            intervalMs={meterIntervalForMode(110, audioStabilityMode)}
                            offKey={(() => {
                              const fitness = laneFitness(track, getEffectiveKey(tracks));
                              return fitness.ratio !== null && fitness.ratio < 0.7;
                            })()}
                            trackId={track.id}
                          />
                          {/* Engine, source, and volume live in the Sound desk and
                              Mixer for the selected lane, so the per-lane row keeps
                              only the glanceables: type, key, pin state, and notes. */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</span>
                            <LaneKeyChip track={track} />
                            {pinned && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">Pinned</span>}
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                              {countLabel(patternSteps.reduce((sum, step) => sum + step.length, 0), 'note')}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1 pt-1 border-t border-[var(--border-soft)]/60">
                            <StateActionBtn
                              active={track.muted}
                              label={track.muted ? 'Unmute lane' : 'Mute lane'}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleMute(track.id);
                              }}
                            >
                              <VolumeX className="h-3.5 w-3.5" />
                            </StateActionBtn>
                            <StateActionBtn
                              active={track.solo}
                              label={track.solo ? 'Release solo' : 'Solo lane'}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSolo(track.id);
                              }}
                            >
                              <Focus className="h-3.5 w-3.5" />
                            </StateActionBtn>
                            {/* The rarer per-lane actions stay out of the way until
                                the lane is hovered, keyboard-focused, or selected,
                                so a full scene is not a wall of buttons. Hidden
                                buttons also drop pointer events, so an invisible
                                Delete can't be hit by accident. */}
                            <span className={`flex flex-wrap items-center gap-1 transition-opacity ${selected ? '' : 'pointer-events-none opacity-0 group-focus-within/lane:pointer-events-auto group-focus-within/lane:opacity-100 group-hover/lane:pointer-events-auto group-hover/lane:opacity-100'}`}>
                            <StateActionBtn
                              active={pinned}
                              label={pinned ? 'Unpin lane' : 'Pin lane'}
                              onClick={(event) => {
                                event.stopPropagation();
                                togglePinnedTrack(track.id);
                              }}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </StateActionBtn>
                            <StateActionBtn
                              active={(track.params.humanize ?? 0) > 0}
                              label={(track.params.humanize ?? 0) > 0 ? 'Humanize on · loosen timing and velocity' : 'Humanize off · play exactly on the grid'}
                              onClick={(event) => {
                                event.stopPropagation();
                                setTrackParams(track.id, { humanize: (track.params.humanize ?? 0) > 0 ? 0 : 0.5 });
                              }}
                            >
                              <Wand2 className="h-3.5 w-3.5" />
                            </StateActionBtn>
                            {!isMobileViewport && <RowActionBtn label="Move track up" onClick={(event) => {
                              event.stopPropagation();
                              moveTrack(track.id, 'up');
                            }}>
                              <ArrowUp className="h-3.5 w-3.5" />
                            </RowActionBtn>}
                            {!isMobileViewport && <RowActionBtn label="Move track down" onClick={(event) => {
                              event.stopPropagation();
                              moveTrack(track.id, 'down');
                            }}>
                              <ArrowDown className="h-3.5 w-3.5" />
                            </RowActionBtn>}
                            {!isMobileViewport && <RowActionBtn label="Duplicate track" onClick={(event) => {
                              event.stopPropagation();
                              duplicateTrack(track.id);
                            }}>
                              <Copy className="h-3.5 w-3.5" />
                            </RowActionBtn>}
                            <RowActionBtn label="Add same lane type at bottom" onClick={(event) => {
                              event.stopPropagation();
                              handleCreateLane(track.type);
                            }}>
                              <Plus className="h-3.5 w-3.5" />
                            </RowActionBtn>
                            <RowActionBtn label="Delete all notes in this pattern" onClick={(event) => {
                              event.stopPropagation();
                              clearTrack(track.id);
                            }}>
                              <Eraser className="h-3.5 w-3.5" />
                            </RowActionBtn>
                            <RowActionBtn label="Delete track" onClick={(event) => {
                              event.stopPropagation();
                              removeTrack(track.id);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </RowActionBtn>
                            </span>
                          </div>
                          </>
                          )}
                        </div>

                        <div className={`flex gap-[2px] ${laneGridPaddingClass}`} style={{ width: `${stepGridWidth}px` }}>
                          {patternSteps.map((value, stepIndex) => {
                            const isActive = value.length > 0;
                            const isSelectedStep = selectedStepIndex === stepIndex;
                            const inRange = displayedStepRange !== null && displayedStepRange.trackIds.includes(track.id) && stepIndex >= displayedStepRange.start && stepIndex <= displayedStepRange.end;
                            const inMoveSource = movingStepRange && stepRange !== null && stepRange.trackIds.includes(track.id) && stepIndex >= stepRange.start && stepIndex <= stepRange.end;
                            const inMoveTarget = movingStepRange && stepRangeMovePreview !== null && stepRangeMovePreview.trackIds.includes(track.id) && stepIndex >= stepRangeMovePreview.start && stepIndex <= stepRangeMovePreview.end;
                            const leadEvent = value[0];
                            const extraNotes = Math.max(0, value.length - 1);
                            const maxGate = value.reduce((gate, event) => Math.max(gate, event.gate), 0);
                            const showStepNoteLabel = stepCellWidth >= 36;
                            const anchorNote = getTrackAnchorNote(track, patternSteps, stepIndex);
                            // SuperSonic shows a chord as bright sub-bars nested in
                            // a faint full-cell block, so the big note and its
                            // subnotes overlap, matching the whole-song grid.
                            const showSubnoteStack = superSonicMode && isActive && value.length > 1;

                            return (
                              <button
                                aria-label={`${track.name} step ${stepIndex + 1}`}
                                aria-pressed={isActive}
                                className={`group relative shrink-0 touch-none border transition-colors ${editorMode === 'select' ? (inRange && !movingStepRange ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer') : 'cursor-crosshair'} ${compactLanes ? 'min-h-[38px]' : 'min-h-[48px]'} ${isActive ? 'border-transparent' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]'} ${inRange ? 'ring-2 ring-inset ring-[rgba(125,211,252,0.4)]' : isSelectedStep ? 'outline outline-1 outline-offset-0 outline-[rgba(125,211,252,0.26)]' : ''} ${placementCursor && placementCursor.trackId === track.id && placementCursor.stepIndex === stepIndex ? 'seq-place-cursor' : ''}`}
                                data-seq-cell="true"
                                data-range-move-source={inMoveSource ? 'true' : undefined}
                                data-range-move-target={inMoveTarget ? 'true' : undefined}
                                data-step-index={stepIndex}
                                data-track-id={track.id}
                                key={`${track.id}-${stepIndex}`}
                                onDragEnter={(event) => {
                                  if (event.dataTransfer.types.includes('application/x-sonicstudio-note-string')) {
                                    event.preventDefault();
                                    event.currentTarget.dataset.dropTarget = 'note-string';
                                  }
                                }}
                                onDragLeave={(event) => {
                                  if (event.currentTarget === event.target) {
                                    delete event.currentTarget.dataset.dropTarget;
                                  }
                                }}
                                onDragOver={(event) => {
                                  if (event.dataTransfer.types.includes('application/x-sonicstudio-note-string')) {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'copy';
                                  }
                                }}
                                onDrop={(event) => {
                                  const stringId = event.dataTransfer.getData('application/x-sonicstudio-note-string');
                                  if (!stringId) return;
                                  event.preventDefault();
                                  delete event.currentTarget.dataset.dropTarget;
                                  handleNoteStringStitch(stringId, track.id, stepIndex);
                                }}
                                onPointerDown={(event) => {
                                  if (queuedNoteStringId) {
                                    if (event.button !== 0) {
                                      return;
                                    }
                                    event.preventDefault();
                                    const applied = handleNoteStringStitch(queuedNoteStringId, track.id, stepIndex);
                                    if (applied) {
                                      setQueuedNoteStringId(null);
                                      return;
                                    }
                                  }
                                  if (queuedSegment) {
                                    if (event.button !== 0) {
                                      return;
                                    }
                                    event.preventDefault();
                                    handleStitchPatternSegment(track.id, queuedSegment, stepIndex);
                                    return;
                                  }

                                  handleSeqCellPointerDown(track.id, stepIndex, value, event);
                                }}
                                onPointerEnter={() => {
                                  setSupersonicHoverCell({ trackId: track.id, stepIndex });
                                  if (queuedSegment) {
                                    setStitchHover({ trackId: track.id, stepIndex });
                                  }
                                  handleSeqCellPointerEnter(track.id, stepIndex, value);
                                }}
                                onPointerLeave={() => {
                                  setSupersonicHoverCell((current) => (
                                    current?.trackId === track.id && current.stepIndex === stepIndex ? null : current
                                  ));
                                  setStitchHover((current) => (
                                    current?.trackId === track.id && current.stepIndex === stepIndex ? null : current
                                  ));
                                }}
                                style={(isActive
                                  ? {
                                      background: showSubnoteStack
                                        ? `${track.color}33`
                                        : `${track.color}cc`,
                                      boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.12)',
                                      width: `${stepCellWidth - 2}px`,
                                      touchAction: editorMode === 'edit' ? 'none' : 'pan-y',
                                      '--lane-glow': `${track.color}55`,
                                      '--lane-tint': `${track.color}1f`,
                                    }
                                  : {
                                      width: `${stepCellWidth - 2}px`,
                                      touchAction: editorMode === 'edit' ? 'none' : 'pan-y',
                                      '--lane-glow': `${track.color}55`,
                                      '--lane-tint': `${track.color}1f`,
                                    }) as React.CSSProperties}
                                type="button"
                              >
                                {showSubnoteStack && (
                                  <span aria-hidden className="absolute inset-x-[2px] inset-y-[4px] flex flex-col gap-px overflow-hidden rounded-[2px]">
                                    {[...value].sort((left, right) => pitchRank(right.note) - pitchRank(left.note)).map((event, noteIndex) => (
                                      <span
                                        className="min-h-0 flex-1 rounded-[1px]"
                                        key={`${event.note}-${noteIndex}`}
                                        style={{ background: track.color, opacity: 0.95 - noteIndex * 0.12 }}
                                        title={event.note}
                                      />
                                    ))}
                                  </span>
                                )}
                                {isActive && showStepNoteLabel && (track.source.engine === 'sample' || !['kick', 'snare', 'hihat'].includes(track.type)) && leadEvent && (
                                  <span className="absolute bottom-1 right-1 font-mono text-[9px] font-medium text-black/60">
                                    {leadEvent.note}
                                    {extraNotes > 0 ? ` +${extraNotes}` : ''}
                                  </span>
                                )}
                                {isActive && (
                                  <span
                                    className="absolute bottom-1 left-1 rounded-full bg-black/20"
                                    style={{ height: '3px', width: `${Math.max(8, Math.min(34, maxGate * 4.5))}px` }}
                                  />
                                )}
                                {superSonicMode && !queuedSegment && !isActive && anchorNote && supersonicHoverCell?.trackId === track.id && supersonicHoverCell.stepIndex === stepIndex && (
                                  <span
                                    className="supersonic-ladder absolute inset-0 z-[2]"
                                    style={{ '--supersonic-ladder-count': String(SUPERSONIC_NOTE_OFFSETS.length) } as React.CSSProperties}
                                  >
                                    {SUPERSONIC_NOTE_OFFSETS.map((offset) => {
                                      const targetNote = shiftPitch(anchorNote, offset);
                                      if (!targetNote) {
                                        return (
                                          <span
                                            className="supersonic-ladder-step"
                                            key={`${track.id}-${stepIndex}-seq-${offset}`}
                                            style={{ '--ladder-fill': '0.44', '--ladder-glow': track.color } as React.CSSProperties}
                                          />
                                        );
                                      }

                                      return (
                                        <span
                                          className="supersonic-ladder-step"
                                          data-center={offset === 0 ? 'true' : 'false'}
                                          key={`${track.id}-${stepIndex}-seq-${offset}`}
                                          onPointerDown={(event) => {
                                            event.stopPropagation();
                                            handleSeqCellPointerDown(track.id, stepIndex, value, event, targetNote);
                                          }}
                                          style={{
                                            '--ladder-color': track.color,
                                            '--ladder-fill': `${Math.max(0.38, 0.94 - (Math.abs(offset) * 0.08))}`,
                                            '--ladder-glow': offset === 0 ? 'rgba(255,255,255,0.88)' : `${track.color}88`,
                                          } as React.CSSProperties}
                                          title={`Place ${targetNote}`}
                                        />
                                      );
                                    })}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          <div
                            className="lane-runway flex min-h-[38px] shrink-0 overflow-hidden border border-dashed border-[var(--border-soft)]"
                            data-active={activeRunwayPreview ? 'true' : 'false'}
                            style={{ width: `${stepRunwayWidth - 2}px` }}
                          >
                            <button
                              aria-label={`Continue ${track.name} with repeated ${activeRunwayPreview?.note ?? runwayAnchorNote} notes`}
                              className="lane-runway-paint group relative flex min-w-0 flex-1 touch-none items-center gap-1 overflow-hidden px-2"
                              disabled={stepsPerPattern >= MAX_STEPS_PER_PATTERN}
                              onPointerCancel={cancelLaneRunwayGesture}
                              onPointerDown={(event) => beginLaneRunwayGesture(track.id, event, undefined, true)}
                              onPointerEnter={(event) => {
                                const paint = paintStateRef.current;
                                if (!laneRunwayGestureRef.current && paint?.trackId === track.id && paint.mode === 'add') {
                                  beginLaneRunwayGesture(track.id, event, paint.note);
                                }
                              }}
                              onPointerMove={(event) => handleLaneRunwayPointerMove(track.id, event)}
                              onPointerUp={commitLaneRunwayGesture}
                              title="Drag right to extend this lane with repeated notes. The bright previews will be added when you release."
                              type="button"
                            >
                              {Array.from({ length: RUNWAY_GHOST_STEPS }, (_, ghostIndex) => {
                                const isCommittedPreview = Boolean(activeRunwayPreview && ghostIndex < activeRunwayPreview.count);
                                const ghostOpacity = Math.max(0.16, 0.72 - ghostIndex * 0.12);
                                return (
                                  <span
                                    aria-hidden
                                    className="lane-runway-ghost relative h-[58%] min-w-[8px] flex-1 rounded-[2px] border"
                                    data-preview={isCommittedPreview ? 'true' : 'false'}
                                    key={`${track.id}-runway-${ghostIndex}`}
                                    style={{
                                      '--runway-color': track.color,
                                      opacity: isCommittedPreview ? 1 : ghostOpacity,
                                    } as React.CSSProperties}
                                  >
                                    {ghostIndex === 0 && (
                                      <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-[var(--text-primary)] opacity-0 transition-opacity group-hover:opacity-100">
                                        {activeRunwayPreview?.note ?? runwayAnchorNote}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                              {activeRunwayPreview && activeRunwayPreview.count > RUNWAY_GHOST_STEPS && (
                                <span className="shrink-0 font-mono text-[9px] text-[var(--accent-strong)]">+{activeRunwayPreview.count}</span>
                              )}
                              <span className="lane-runway-hint pointer-events-none absolute inset-x-0 bottom-1 text-center font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                                {activeRunwayPreview ? `release +${activeRunwayPreview.count}` : 'drag notes'}
                              </span>
                            </button>
                            <button
                              aria-label={`Add an empty bar to ${track.name}`}
                              className="lane-runway-add flex w-12 shrink-0 flex-col items-center justify-center border-l border-[var(--border-soft)] font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]"
                              disabled={stepsPerPattern >= MAX_STEPS_PER_PATTERN}
                              onClick={() => {
                                setSelectedTrackId(track.id);
                                extendPatternBy(16);
                                window.requestAnimationFrame(() => jumpToStep(stepsPerPattern, track.id));
                              }}
                              title="Add an empty 16-step bar"
                              type="button"
                            >
                              <Plus className="h-3 w-3" strokeWidth={2.5} />
                              16
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              </div>
            </div>
            {!showSongGrid && (
              <nav
                aria-label="Pattern viewport navigation"
                className="sequencer-viewport-dock"
                data-editing-mode={editingMode ? 'true' : undefined}
              >
                <div className="sequencer-timeline-navigator">
                  <span className="viewport-dock-label section-label">Timeline</span>
                  <button
                    aria-label="Scroll the timeline left one screen"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    disabled={gridScrollLeft <= 1}
                    onClick={() => scrollGridByViewport(-1)}
                    title="Earlier steps"
                    type="button"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <span className="viewport-dock-readout font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    {visibleStepStart + 1}-{visibleStepEnd}
                    <span className="text-[var(--text-tertiary)]"> / {stepsPerPattern}</span>
                  </span>
                  <input
                    aria-label="Scroll horizontally through pattern steps"
                    aria-valuetext={`Showing steps ${visibleStepStart + 1} through ${visibleStepEnd} of ${stepsPerPattern}`}
                    className="sonic-scroll-strip timeline-scroll-strip"
                    disabled={maxGridScrollLeft <= 1}
                    max={Math.max(1, maxGridScrollLeft)}
                    min={0}
                    onChange={(event) => {
                      const node = gridViewportRef.current;
                      if (!node) return;
                      node.scrollLeft = Number(event.target.value);
                    }}
                    step={Math.max(STEP_ZOOM_STEP, Math.round(stepCellWidth / 2))}
                    type="range"
                    value={Math.min(gridScrollLeft, Math.max(1, maxGridScrollLeft))}
                  />
                  <button
                    aria-label="Scroll the timeline right one screen"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    disabled={gridScrollLeft >= maxGridScrollLeft - 1}
                    onClick={() => scrollGridByViewport(1)}
                    title="Later steps"
                    type="button"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="sequencer-lane-navigator">
                  <span className="lane-position-label font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    Lane {selectedVisibleLaneIndex >= 0 ? selectedVisibleLaneIndex + 1 : '-'} / {visibleLaneOrder.length}
                  </span>
                  <button
                    aria-label="Scroll up through lanes"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    disabled={gridScrollTop <= 1}
                    onClick={() => scrollGridLanesByViewport(-1)}
                    title="Previous lanes"
                    type="button"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <input
                    aria-label="Scroll vertically through lanes"
                    className="sonic-scroll-strip lane-scroll-strip"
                    disabled={maxGridScrollTop <= 1}
                    max={Math.max(1, maxGridScrollTop)}
                    min={0}
                    onChange={(event) => {
                      const node = gridViewportRef.current;
                      if (!node) return;
                      node.scrollTop = Number(event.target.value);
                    }}
                    step={24}
                    type="range"
                    value={Math.min(gridScrollTop, Math.max(1, maxGridScrollTop))}
                  />
                  <button
                    aria-label="Reveal the selected lane"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    disabled={!selectedTrackId || selectedVisibleLaneIndex < 0}
                    onClick={revealSelectedTrack}
                    title="Center selected lane"
                    type="button"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Scroll down through lanes"
                    className="control-chip flex h-8 w-8 shrink-0 items-center justify-center"
                    disabled={gridScrollTop >= maxGridScrollTop - 1}
                    onClick={() => scrollGridLanesByViewport(1)}
                    title="Next lanes"
                    type="button"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </nav>
            )}
          </div>

          {visibleTracks.length > 0 && composeToolsExpanded && (
            <div className="surface-panel-muted mt-3 px-4 py-3">
              <div className={`flex items-center justify-between gap-2 ${trackMapOpen ? 'mb-3 border-b border-[var(--border-soft)] pb-3' : ''}`}>
                <span className="section-label">Track map</span>
                <button
                  aria-expanded={trackMapOpen}
                  className="control-chip inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  onClick={() => {
                    const next = !trackMapOpen;
                    writeString(TRACK_MAP_OPEN_KEY, next ? 'true' : 'false');
                    setTrackMapOpen(next);
                  }}
                  type="button"
                >
                  {trackMapOpen ? 'Hide map' : 'Show map'}
                  {trackMapOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
              {trackMapOpen ? (
                <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    {transportMode === 'SONG'
                      ? `Song mode is active. Ghost marks can play from clip patterns outside ${currentPatternLabel}.`
                      : `Pattern mode is active. Ghost marks are notes stored in other pattern banks and won't play until you switch patterns or Song mode.`}
                  </div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  View {visibleStepStart + 1}-{Math.max(visibleStepStart + 1, visibleStepEnd)} of {stepsPerPattern}
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {overviewTracks.map((overview) => {
                  const {
                    currentPatternActiveSteps,
                    currentPatternSteps,
                    otherPatternContext,
                    otherPatternActiveSteps,
                    stepActivity,
                    track,
                  } = overview;
                  const activityLabel = currentPatternActiveSteps > 0 && otherPatternActiveSteps > 0
                    ? `${currentPatternActiveSteps} active · ${otherPatternActiveSteps} ${otherPatternContext === 'song' ? 'in song clips' : 'stored elsewhere'}`
                    : currentPatternActiveSteps > 0
                      ? `${currentPatternActiveSteps} active`
                      : otherPatternActiveSteps > 0
                        ? `${otherPatternActiveSteps} ${otherPatternContext === 'song' ? 'in song clips' : 'stored in other patterns'}`
                        : '0 active';

                  return (
                    <div className="grid grid-cols-[minmax(0,120px)_1fr] items-center gap-3" key={`overview-${track.id}`}>
                      <button
                        className="min-w-0 text-left"
                        onClick={() => setSelectedTrackId(track.id)}
                        type="button"
                      >
                        <div className="truncate text-[12px] font-medium text-[var(--text-primary)]">{track.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{activityLabel}</div>
                      </button>
                      <div className="relative flex h-7 overflow-hidden rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
                        {currentPatternSteps.map((step, stepIndex) => {
                          const stepState = stepActivity[stepIndex];
                          const hasCurrentActivity = stepState.currentCount > 0;
                          const hasOtherPatternActivity = stepState.otherCount > 0;

                          return (
                            <button
                              className={`relative h-full border-r border-[var(--border-soft)]/50 last:border-r-0 ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''}`}
                              key={`${track.id}-overview-step-${stepIndex}`}
                              onClick={() => {
                                if (queuedSegment) {
                                  handleStitchPatternSegment(track.id, queuedSegment, stepIndex);
                                  return;
                                }

                                jumpToStep(stepIndex, track.id);
                              }}
                              onPointerEnter={() => {
                                if (!queuedSegment) {
                                  return;
                                }
                                setStitchHover({ trackId: track.id, stepIndex });
                              }}
                              onPointerLeave={() => {
                                setStitchHover((current) => (current?.trackId === track.id && current.stepIndex === stepIndex ? null : current));
                              }}
                              style={{
                                background: hasCurrentActivity
                                  ? `${track.color}${selectedTrackId === track.id ? 'f0' : 'bf'}`
                                  : hasOtherPatternActivity
                                    ? `${track.color}3a`
                                    : undefined,
                                boxShadow: hasCurrentActivity
                                  ? 'inset 0 0 0 1px rgba(15, 23, 42, 0.12)'
                                  : hasOtherPatternActivity
                                    ? `inset 0 0 0 1px ${track.color}28`
                                    : undefined,
                                width: `${100 / stepsPerPattern}%`,
                              }}
                              title={queuedSegment
                                ? `Stitch ${queuedSegment.name} at step ${stepIndex + 1}`
                                : hasCurrentActivity
                                  ? `Jump to step ${stepIndex + 1}`
                                  : hasOtherPatternActivity
                                    ? `Jump to step ${stepIndex + 1} · ${otherPatternContext === 'song' ? 'playback can come from song clips using other patterns' : 'notes are stored in other pattern banks'}`
                                    : `Jump to step ${stepIndex + 1}`}
                              type="button"
                            >
                              {!hasCurrentActivity && hasOtherPatternActivity && (
                                <span className="pointer-events-none absolute inset-x-[16%] top-1/2 h-[1px] -translate-y-1/2 bg-black/35" />
                              )}
                              {selectedTrackId === track.id && selectedStepIndex === stepIndex && (
                                <span className="absolute inset-y-0 left-0 w-[2px] bg-white/75" />
                              )}
                            </button>
                          );
                        })}
                        {queuedSegment && stitchHover?.trackId === track.id && (
                          <div
                            className="pointer-events-none absolute inset-y-0 z-[3] border border-[rgba(114,217,255,0.64)] bg-[rgba(114,217,255,0.22)]"
                            style={{
                              left: `${(stitchHover.stepIndex / stepsPerPattern) * 100}%`,
                              width: `${(Math.min(queuedSegmentSpan, stepsPerPattern - stitchHover.stepIndex) / stepsPerPattern) * 100}%`,
                            }}
                          />
                        )}
                        <div
                          className="pointer-events-none absolute inset-y-0 border border-white/22 bg-white/6"
                          style={{
                            left: `${(visibleStepStart / stepsPerPattern) * 100}%`,
                            width: `${(Math.max(1, visibleStepEnd - visibleStepStart) / stepsPerPattern) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {showTrackOverviewLimit && (
                <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Showing the {overviewTracks.length} most relevant lanes. Narrow the scope to focus the rest.
                </div>
              )}
              {queuedSegment && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[3px] border border-[rgba(114,217,255,0.24)] bg-[rgba(114,217,255,0.09)] px-3 py-2 text-[11px] text-[var(--accent-strong)]">
                  <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Stitch mode ready: click any sequencer cell or track-map step to place {queuedSegment.name}.
                  <button
                    className="control-chip ml-auto px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => {
                      setQueuedSegmentId(null);
                      setStitchHover(null);
                    }}
                    type="button"
                  >
                    Clear queue
                  </button>
                </div>
              )}
              {queuedNoteStringId && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[3px] border border-[rgba(114,217,255,0.24)] bg-[rgba(114,217,255,0.09)] px-3 py-2 text-[11px] text-[var(--accent-strong)]">
                  <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Note string queued. Tap any cell, lane header, or arrangement row to drop it.
                  <button
                    className="control-chip ml-auto min-h-[2rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => setQueuedNoteStringId(null)}
                    type="button"
                  >
                    Clear queue
                  </button>
                </div>
              )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {!editingMode && (!isNarrowViewport || mobileInspectorOpen) && (
        <aside className="surface-panel-strong sonic-sidebar w-full shrink-0 overflow-auto p-4 xl:min-w-[280px] xl:w-[min(32vw,320px)] 2xl:w-[320px]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Compose inspector</span>
          </div>

          {selectedTrack ? (
            <div className="mt-4 space-y-4">
              <div className="loop-browser-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3">
                <div className="section-label">Selected lane</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{selectedTrack.name}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {selectedTrack.type} · {selectedTrack.source.engine} · step {selectedStepIndex + 1}
                    </div>
                  </div>
                  <button
                    className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => setActiveView(canDeepEditSelectedTrack ? 'PIANO_ROLL' : 'SEQUENCER')}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {canDeepEditSelectedTrack ? 'Deep edit' : 'Song tools'}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <StateInspectorButton
                    active={selectedTrack.muted}
                    label={selectedTrack.muted ? 'Muted' : 'Mute'}
                    onClick={() => toggleMute(selectedTrack.id)}
                  />
                  <StateInspectorButton
                    active={selectedTrack.solo}
                    label={selectedTrack.solo ? 'Soloed' : 'Solo'}
                    onClick={() => toggleSolo(selectedTrack.id)}
                  />
                  <div className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {visibleTracks.length} visible
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="section-label">Humanize</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      {Math.round((selectedTrack.params.humanize ?? 0) * 100)}%
                    </span>
                  </div>
                  <input
                    aria-label="How loosely this lane plays its timing and velocity"
                    className="sonic-scroll-strip mt-1.5 w-full"
                    max={1}
                    min={0}
                    onChange={(event) => setTrackParams(selectedTrack.id, { humanize: Number(event.target.value) })}
                    step={0.05}
                    type="range"
                    value={selectedTrack.params.humanize ?? 0}
                  />
                  <div className="mt-1 text-[11px] leading-4 text-[var(--text-secondary)]">
                    Loosens timing and velocity so repeats stop sounding identical.
                  </div>
                </div>
                {!isMobileViewport && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="section-label">Jump to</span>
                    <div className="flex gap-2">
                      <button className="control-chip h-8 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => setActiveView('SEQUENCER')} type="button">Seq</button>
                      <button className="control-chip h-8 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => { setActiveView('SEQUENCER'); openNotesPanel(); }} type="button">Roll</button>
                      <button className="control-chip h-8 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => setActiveView('MIXER')} type="button">Mix</button>
                    </div>
                  </div>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    className="control-chip flex min-h-9 items-center justify-center gap-2 px-3 py-1.5 text-center leading-tight text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-active={isSelectedTrackLoopActive}
                    disabled={!selectedTrackPatternSpan}
                    onClick={handleToggleSelectedTrackLoop}
                    type="button"
                  >
                    <Music2 className="h-3.5 w-3.5" />
                    {isSelectedTrackLoopActive ? 'Loop on' : 'Loop phrase'}
                  </button>
                  <button
                    className="control-chip flex min-h-9 items-center justify-center gap-2 px-3 py-1.5 text-center leading-tight text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-active={hasExplicitLoopRange && !isSelectedTrackLoopActive ? 'true' : 'false'}
                    disabled={!hasExplicitLoopRange}
                    onClick={handleClearLoopRange}
                    type="button"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Full pattern
                  </button>
                  <button
                    className="control-chip flex min-h-9 items-center justify-center gap-2 px-3 py-1.5 text-center leading-tight text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                    onClick={handleClearSelectedTrackNotes}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete all notes
                  </button>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  {selectedTrackPatternSpan
                    ? `Phrase: steps ${selectedTrackPatternSpan.startStep + 1}-${selectedTrackPatternSpan.endStep} in ${currentPatternLabel}`
                    : hasExplicitLoopRange
                      ? `Loop window: steps ${loopRangeStartBeat! + 1}-${loopRangeEndBeat}`
                      : 'Add notes to loop or clear this lane.'}
                </div>
              </div>

              <div className="loop-browser-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3">
                <div className="section-label">Pattern actions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="control-chip flex min-h-9 items-center justify-center gap-2 px-3 py-1.5 text-center leading-tight text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => shiftPattern(selectedTrack.id, 'left')}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
                    Shift left
                  </button>
                  <button
                    className="control-chip flex min-h-9 items-center justify-center gap-2 px-3 py-1.5 text-center leading-tight text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => shiftPattern(selectedTrack.id, 'right')}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Shift right
                  </button>
                  {!isSelectedTrackDrum && (
                    <>
                      <button
                        className="control-chip h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        onClick={() => transposePattern(selectedTrack.id, -1)}
                      >
                        Note down
                      </button>
                      <button
                        className="control-chip h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        onClick={() => transposePattern(selectedTrack.id, 1)}
                      >
                        Note up
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="inspector-disclosure loop-browser-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3" data-open={loopBrowserOpen}>
                <button
                  aria-expanded={loopBrowserOpen}
                  className="inspector-disclosure-summary flex w-full cursor-pointer items-start justify-between gap-3 text-left"
                  onClick={() => setLoopBrowserOpen((open) => !open)}
                  type="button"
                >
                  <div>
                    <div className="section-label">Loop browser</div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Save phrases or pull matching loops into this lane.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {patternSegments.length} saved · {filteredFactoryLoops.length} factory
                    </div>
                    <ChevronDown className={`inspector-disclosure-chevron h-4 w-4 shrink-0 text-[var(--text-tertiary)] ${loopBrowserOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {loopBrowserOpen ? <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className="control-field min-w-0 flex-1 px-3 py-2 text-sm"
                    onChange={(event) => setSegmentDraftName(event.target.value)}
                    placeholder={`${selectedTrack.name} ${String.fromCharCode(65 + currentPattern)}`}
                    type="text"
                    value={segmentDraftName}
                  />
                  <button
                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={handleSavePatternSegment}
                    type="button"
                  >
                    Save piece
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="surface-panel-strong flex flex-wrap items-center gap-2 p-2">
                    {LOOP_BROWSER_FILTERS.map((filterOption) => (
                      <button
                        className={`control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${loopBrowserFilter === filterOption.value ? 'text-[var(--accent-strong)]' : ''}`}
                        data-active={loopBrowserFilter === filterOption.value ? 'true' : 'false'}
                        key={filterOption.value}
                        onClick={() => setLoopBrowserFilter(filterOption.value)}
                        type="button"
                      >
                        {filterOption.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="control-field w-full px-3 py-2 text-sm"
                    onChange={(event) => setLoopSearchDraft(event.target.value)}
                    placeholder={selectedTrack ? `Search ${formatTrackTypeLabel(selectedTrack.type)} loops` : 'Search factory loops'}
                    type="text"
                    value={loopSearchDraft}
                  />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="section-label">My pieces</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Queue or apply
                    </div>
                  </div>
                  {patternSegments.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {patternSegments.slice(0, 6).map((segment) => {
                        const activeSteps = segment.steps.filter((step) => step.length > 0).length;
                        const isCrossLane = segment.sourceTrackType !== selectedTrack.type;
                        const isQueued = queuedSegmentId === segment.id;

                        return (
                          <div
                            className="loop-browser-card px-3 py-2"
                            data-queued={isQueued ? 'true' : 'false'}
                            data-tone="saved"
                            key={segment.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-[var(--text-primary)]">{segment.name}</div>
                                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                                  {segment.sourceTrackType} · {segment.stepsPerPattern} steps · {activeSteps} active{isCrossLane ? ' · cross-lane' : ''}
                                </div>
                              </div>
                              <button
                                className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] transition-colors hover:text-[var(--danger)]"
                                onClick={() => handleDeletePatternSegment(segment.id)}
                                type="button"
                              >
                                Forget
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                onClick={() => handleApplyPatternSegment(segment)}
                                type="button"
                              >
                                Apply here
                              </button>
                              <button
                                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                data-active={isQueued ? 'true' : 'false'}
                                onClick={() => {
                                  setQueuedSegmentId((current) => (current === segment.id ? null : segment.id));
                                  setStitchHover(null);
                                }}
                                type="button"
                              >
                                {isQueued ? 'Click grid to place' : 'Queue for grid stitch'}
                              </button>
                              <span className="text-[11px] text-[var(--text-secondary)]">
                                From {segment.sourceTrackName}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-[var(--text-secondary)]">No saved pattern pieces yet.</div>
                  )}
                </div>

                <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="section-label">Factory loops</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {displayedFactoryLoops.length} showing
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                    {selectedTrack
                      ? `Focused on ${selectedTrack.name}. Matching lane mode keeps the browser tied to ${formatTrackTypeLabel(selectedTrack.type)} material.`
                      : 'Pick a lane to narrow the browser to the most relevant loop family.'}
                  </div>
                  {displayedFactoryLoops.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {displayedFactoryLoops.map((loop) => {
                        const activeSteps = loop.steps.filter((step) => step.length > 0).length;
                        const isQueued = queuedSegmentId === loop.id;

                        return (
                          <div
                            className="loop-browser-card px-3 py-3"
                            data-queued={isQueued ? 'true' : 'false'}
                            data-tone="factory"
                            key={loop.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-[var(--text-primary)]">{loop.name}</div>
                                <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{loop.description}</div>
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                                {loop.genre}
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                              <span>{formatTrackTypeLabel(loop.sourceTrackType)}</span>
                              <span>{loop.energy}</span>
                              <span>{loop.stepsPerPattern} steps</span>
                              <span>{activeSteps} active</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {loop.tags.slice(0, 3).map((tag) => (
                                <span
                                  className="loop-browser-tag px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]"
                                  key={`${loop.id}-${tag}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                onClick={() => handleApplyPatternSegment(loop)}
                                type="button"
                              >
                                Apply here
                              </button>
                              <button
                                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                data-active={isQueued ? 'true' : 'false'}
                                onClick={() => {
                                  setQueuedSegmentId((current) => (current === loop.id ? null : loop.id));
                                  setStitchHover(null);
                                }}
                                type="button"
                              >
                                {isQueued ? 'Click grid to place' : 'Queue for stitch'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-[var(--text-secondary)]">No factory loops match the current filter. Try another lane family or a broader search.</div>
                  )}
                  {showMoreFactoryLoops && (
                    <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Refine the search to see the rest of the browser.
                    </div>
                  )}
                </div>
                </div> : null}
              </div>

              <div className="inspector-disclosure session-player-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3" data-open={sessionPlayerOpen}>
                <button
                  aria-expanded={sessionPlayerOpen}
                  className="inspector-disclosure-summary flex w-full cursor-pointer items-start justify-between gap-3 text-left"
                  onClick={() => setSessionPlayerOpen((open) => !open)}
                  type="button"
                >
                  <div>
                    <div className="section-label">Build a song</div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Load a groove or generate a complete multi-section arrangement.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {pendingSessionPlayerRequest ? 'building lanes' : `${SESSION_PLAYER_PROFILES.length} players`}
                    </div>
                    <ChevronDown className={`inspector-disclosure-chevron h-4 w-4 shrink-0 text-[var(--text-tertiary)] ${sessionPlayerOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {sessionPlayerOpen ? <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
                <div className="session-player-form-strip mt-3">
                  <div className="section-label">Song layout</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SONG_FORM_DEFINITIONS.map((definition) => (
                      <button
                        className={`control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${sessionPlayerFormId === definition.id ? 'text-[var(--accent-strong)]' : ''}`}
                        data-active={sessionPlayerFormId === definition.id ? 'true' : 'false'}
                        key={definition.id}
                        onClick={() => setSessionPlayerFormId(definition.id)}
                        type="button"
                      >
                        {definition.label}
                      </button>
                    ))}
                  </div>
                  <div className="session-player-form-summary mt-2">
                    {activeSessionPlayerForm.summary}
                  </div>
                </div>
                {sessionPlayerNotice && (
                  <div className="mt-3 rounded-[3px] border border-[rgba(114,217,255,0.22)] bg-[rgba(114,217,255,0.08)] px-3 py-2 text-[11px] leading-5 text-[var(--accent-strong)]">
                    {sessionPlayerNotice}
                  </div>
                )}
                <div className="mt-3 grid gap-2">
                  {SESSION_PLAYER_PROFILES.map((profile) => {
                    const profileSegments = sessionPlayerSegments[profile.id] ?? [];
                    const profileDecks = sessionPlayerPatternDecks[profile.id] ?? [];
                    const profileTrackTypes = getSessionPlayerTrackTypes(profile.id);
                    const missingTrackTypes = profileTrackTypes.filter((trackType) => !tracks.some((track) => track.type === trackType));
                    const isGroovePending = pendingSessionPlayerRequest?.profileId === profile.id && pendingSessionPlayerRequest.mode === 'groove';
                    const isSongPending = pendingSessionPlayerRequest?.profileId === profile.id && pendingSessionPlayerRequest.mode === 'song';

                    return (
                      <div
                        className="session-player-card px-3 py-3"
                        data-pending={isGroovePending || isSongPending ? 'true' : 'false'}
                        key={profile.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">{profile.label}</div>
                            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{profile.description}</div>
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            {profile.focus}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {profileTrackTypes.map((trackType) => (
                            <span
                              className="loop-browser-tag px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]"
                              key={`${profile.id}-${trackType}`}
                            >
                              {formatTrackTypeLabel(trackType)}
                            </span>
                          ))}
                        </div>
                        <div className="session-player-deck-grid mt-3">
                          {profileDecks.map((deck) => (
                            <div
                              className="session-player-deck-chip"
                              data-role={deck.role}
                              key={`${profile.id}-${deck.patternIndex}`}
                            >
                              <span>{deck.label}</span>
                              <span>{countLabel(deck.segments.length, 'lane')}</span>
                            </div>
                          ))}
                        </div>
                        {missingTrackTypes.length > 0 && (
                          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                            Will add {formatTrackTypeList(missingTrackTypes)} before loading the pattern bed.
                          </div>
                        )}
                        <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                          Best with {getSongFormDefinition(profile.defaultFormId).label}. Current build target: {activeSessionPlayerForm.label}.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                            onClick={() => applySessionPlayerProfile(profile.id)}
                            type="button"
                          >
                            {isGroovePending ? 'Building lanes...' : 'Load groove'}
                          </button>
                          <button
                            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                            data-active={activeSessionPlayerForm.id === profile.defaultFormId ? 'true' : 'false'}
                            onClick={() => buildSessionPlayerSong(profile.id, sessionPlayerFormId)}
                            type="button"
                          >
                            {isSongPending ? 'Building lanes...' : `Build ${activeSessionPlayerForm.label}`}
                          </button>
                          {profileSegments[0] && (
                            <button
                              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              onClick={() => {
                                setQueuedSegmentId((current) => (current === profileSegments[0].id ? null : profileSegments[0].id));
                                setStitchHover(null);
                              }}
                              type="button"
                            >
                              Queue groove
                            </button>
                          )}
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          Groove pattern plus four section decks ready for song form generation.
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div> : null}
              </div>

              <div className="inspector-disclosure loop-browser-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3" data-open={stepEditorOpen}>
                <button
                  aria-expanded={stepEditorOpen}
                  className="inspector-disclosure-summary flex w-full cursor-pointer items-start justify-between gap-3 text-left"
                  onClick={() => setStepEditorOpen((open) => !open)}
                  type="button"
                >
                  <div>
                    <div className="section-label">Step editor</div>
                    <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">Step {selectedStepIndex + 1}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      {selectedStep.length} note{selectedStep.length === 1 ? '' : 's'}
                    </div>
                    <ChevronDown className={`inspector-disclosure-chevron h-4 w-4 shrink-0 text-[var(--text-tertiary)] ${stepEditorOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  {selectedStepNote
                    ? `${selectedStepNote.note} · velocity ${Math.round(selectedStepNote.velocity * 100)} · gate ${selectedStepNote.gate.toFixed(2)}`
                    : 'This step is empty. Click the grid to place a note or hit.'}
                </div>
                {stepEditorOpen ? <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
                {activeStepIndices.length > 0 && (
                  <div className="mt-3 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="section-label">Active steps</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        {activeStepIndices.length} filled
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Jump between filled steps to edit notes faster, or switch the loop back to the full pattern when a short phrase keeps repeating.
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <button
                        className="control-chip px-2 py-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.1em]"
                        onClick={() => jumpToAdjacentActiveStep('previous')}
                        type="button"
                      >
                        Prev step
                      </button>
                      <button
                        className="control-chip px-2 py-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.1em]"
                        onClick={() => jumpToAdjacentActiveStep('next')}
                        type="button"
                      >
                        Next step
                      </button>
                      <button
                        className="control-chip px-2 py-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.1em]"
                        disabled={!hasExplicitLoopRange}
                        onClick={handleClearLoopRange}
                        type="button"
                      >
                        Full pattern
                      </button>
                    </div>
                  </div>
                )}
                {!isSelectedTrackDrum && selectedStepNote && normalizedSelectedStepNoteIndex !== null && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="section-label">Pitch</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">Note {normalizedSelectedStepNoteIndex + 1}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          onClick={() => updateSelectedStepNote(normalizedSelectedStepNoteIndex, { note: shiftNote(selectedStepNote.note, -1) })}
                          type="button"
                        >
                          -1
                        </button>
                        <select
                          className="min-w-0 flex-1 rounded-sm border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--text-primary)]"
                          onChange={(event) => updateSelectedStepNote(normalizedSelectedStepNoteIndex, { note: event.target.value })}
                          value={selectedStepNote.note}
                        >
                          {NOTE_OPTIONS.map((note) => (
                            <option key={note} value={note}>{note}</option>
                          ))}
                        </select>
                        <button
                          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          onClick={() => updateSelectedStepNote(normalizedSelectedStepNoteIndex, { note: shiftNote(selectedStepNote.note, 1) })}
                          type="button"
                        >
                          +1
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {QUICK_INTERVALS.map((interval) => (
                          <button
                            className="control-chip px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            key={interval.label}
                            onClick={() => addIntervalToSelectedStep(interval.semitones)}
                            type="button"
                          >
                            {interval.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="section-label">Velocity</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{Math.round(selectedStepNote.velocity * 100)}</span>
                      </div>
                      <input
                        aria-label="Note velocity"
                        aria-valuetext={`${Math.round(selectedStepNote.velocity * 100)} percent`}
                        className="mt-3"
                        max="1"
                        min="0.1"
                        onChange={(event) => updateSelectedStepNote(normalizedSelectedStepNoteIndex, { velocity: Number(event.target.value) })}
                        step="0.01"
                        type="range"
                        value={selectedStepNote.velocity}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="section-label">Gate</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{selectedStepNote.gate.toFixed(2)}</span>
                      </div>
                      <input
                        aria-label="Note length"
                        aria-valuetext={`${selectedStepNote.gate.toFixed(2)} steps`}
                        className="mt-3"
                        max={NOTE_GATE_MAX}
                        min={NOTE_GATE_MIN}
                        onChange={(event) => updateSelectedStepNote(normalizedSelectedStepNoteIndex, { gate: clampNoteGate(Number(event.target.value)) })}
                        step={NOTE_GATE_FINE_STEP}
                        type="range"
                        value={selectedStepNote.gate}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {NOTE_GATE_PRESETS.map((preset) => (
                          <button
                            className={`control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${Math.abs(selectedStepNote.gate - preset) < NOTE_GATE_FINE_STEP ? 'text-[var(--accent-strong)]' : ''}`}
                            key={preset}
                            onClick={() => updateSelectedStepNote(normalizedSelectedStepNoteIndex, { gate: preset })}
                            type="button"
                          >
                            {preset}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedStep.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {selectedStep.map((event, noteIndex) => (
                      <div
                        className={`flex items-center gap-2 rounded-[3px] border px-3 py-2 transition-colors ${noteIndex === normalizedSelectedStepNoteIndex ? 'border-[rgba(124,211,252,0.34)] bg-[rgba(124,211,252,0.08)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]'}`}
                        key={`${event.note}-${noteIndex}`}
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedStepNoteIndex(noteIndex)}
                          type="button"
                        >
                          <div>
                            <div className="font-mono text-[12px] text-[var(--text-primary)]">{event.note}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                              Vel {Math.round(event.velocity * 100)} · Gate {event.gate.toFixed(2)}
                            </div>
                          </div>
                        </button>
                        {!isSelectedTrackDrum && (
                          <button
                            className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] transition-colors hover:text-[var(--danger)]"
                            onClick={() => {
                              toggleStep(selectedTrack.id, selectedStepIndex, event.note);
                              setSelectedStepNoteIndex(Math.max(0, noteIndex - 1));
                            }}
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </div> : null}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Select a lane to edit notes, dynamics, and pattern movement.</p>
          )}
        </aside>
        )}
      </div>
      {sectionManagerOpen && (
        <SongSectionManagerDialog
          currentPatternCount={patternCount}
          currentStep={engine.currentStep}
          focusedSectionId={managedSectionId}
          loopRangeEndBeat={loopRangeEndBeat}
          loopRangeStartBeat={loopRangeStartBeat}
          onClearSection={clearSongRange}
          onClose={closeSectionManager}
          onCreateMarker={createSongMarker}
          onDeleteSavedSection={removeSavedSongSection}
          onDeleteSection={deleteSongRange}
          onDuplicateSection={duplicateSongRange}
          onInsertBlankSection={insertBlankSongSection}
          onInsertSavedSection={insertSavedSongSection}
          onJumpToSection={(beat) => engine.seekToBeat(beat)}
          onMoveMarker={(markerId, beat) => updateSongMarker(markerId, { beat })}
          onRemoveMarker={(markerId) => {
            removeSongMarker(markerId);
            if (managedSectionId === markerId) setManagedSectionId(null);
          }}
          onRenameMarker={(markerId, name) => updateSongMarker(markerId, { name })}
          onRenameSavedSection={renameSavedSongSection}
          onSaveSection={saveSongRange}
          onSetLoopRange={setLoopRange}
          savedSections={savedSongSections}
          sectionRanges={songSectionRanges}
          songLengthInBeats={songLengthInBeats}
        />
      )}
    </section>
  );
};

const RowActionBtn = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <button
    aria-label={label}
    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
    data-ui-sound="tab"
    onClick={onClick}
  >
    {children}
  </button>
);

const ScopeChip = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className={`control-chip h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${active ? 'text-[var(--accent-strong)]' : ''}`}
    data-active={active ? 'true' : 'false'}
    onClick={onClick}
  >
    {label}
  </button>
);

const StateActionBtn = ({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <button
    aria-label={label}
    className={`ghost-icon-button flex h-9 w-9 items-center justify-center ${active ? 'border-[rgba(124,211,252,0.3)] bg-[rgba(124,211,252,0.1)] text-[var(--accent-strong)]' : ''}`}
    data-ui-sound="tab"
    onClick={onClick}
  >
    {children}
  </button>
);

const StateInspectorButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className={`control-chip h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${active ? 'text-[var(--accent-strong)]' : ''}`}
    onClick={onClick}
  >
    {label}
  </button>
);

function buildNoteOptions(highOctave: number, lowOctave: number) {
  const notes: string[] = [];

  for (let octave = highOctave; octave >= lowOctave; octave -= 1) {
    for (let noteIndex = NOTE_NAMES.length - 1; noteIndex >= 0; noteIndex -= 1) {
      notes.push(`${NOTE_NAMES[noteIndex]}${octave}`);
    }
  }

  return notes;
}
