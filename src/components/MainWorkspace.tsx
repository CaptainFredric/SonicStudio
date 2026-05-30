import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Eraser,
  Focus,
  Minus,
  Music2,
  Pin,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
  VolumeX,
  Zap,
} from 'lucide-react';

import { meterIntervalForMode } from '../audio/meterTiming';
import { engine } from '../audio/ToneEngine';
import { getSamplePresetMeta } from '../audio/sampleLibrary';
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
import { MAX_STEPS_PER_PATTERN, defaultNoteForTrack, type InstrumentType, type NoteEvent, type Track } from '../project/schema';

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
const SEQUENCER_RUNWAY_STEPS = 6;
const STEP_ZOOM_MIN = 16;
const STEP_ZOOM_STEP = 2;
const SUPERSONIC_NOTE_OFFSETS = [4, 3, 2, 1, 0, -1, -2, -3, -4] as const;
const SESSION_PLAYER_PATTERN_COUNT = 4;
const LOOP_BROWSER_FILTERS = [
  { label: 'Matching lane', value: 'MATCHING' as const },
  { label: 'All loops', value: 'ALL' as const },
  { label: 'Rhythm', value: 'RHYTHM' as const },
  { label: 'Musical', value: 'MUSICAL' as const },
] as const;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
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

const shiftPitch = (note: string, semitones: number): string | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  const [, name, octaveStr] = match;
  const semitoneIndex = NOTE_NAMES.indexOf(name);
  if (semitoneIndex < 0) return null;
  const totalSemitones = Number(octaveStr) * 12 + semitoneIndex + semitones;
  const newOctave = Math.floor(totalSemitones / 12);
  const newSemitone = ((totalSemitones % 12) + 12) % 12;
  return `${NOTE_NAMES[newSemitone]}${newOctave}`;
};

const cloneStepEvents = (step: NoteEvent[]) => step.map((event) => ({ ...event }));

const getTrackAnchorNote = (track: Track, patternSteps: NoteEvent[][], stepIndex: number) => {
  const currentNote = patternSteps[stepIndex]?.[0]?.note;
  if (currentNote) {
    return currentNote;
  }

  for (let candidateIndex = stepIndex - 1; candidateIndex >= 0; candidateIndex -= 1) {
    const candidateNote = patternSteps[candidateIndex]?.[0]?.note;
    if (candidateNote) {
      return candidateNote;
    }
  }

  const firstPatternNote = patternSteps.find((step) => step.length > 0)?.[0]?.note;
  return firstPatternNote ?? defaultNoteForTrack(track);
};

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

export const MainWorkspace = () => {
  const isMobileViewport = useMediaQuery('(max-width: 767px)');
  const currentStep = usePlaybackStep();
  const {
    applySongForm,
    applyPatternSegment,
    clearPatternAt,
    clearTrack,
    createTrack,
    currentPattern,
    duplicateTrack,
    loopRangeEndBeat,
    loopRangeStartBeat,
    moveTrack,
    patternCount,
    pinnedTrackIds,
    previewTrack,
    removeTrack,
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
    toggleMute,
    togglePinnedTrack,
    toggleSolo,
    tracks,
    arrangerClips,
    transposePattern,
    updateStepEvent,
  } = useAudio();
  const [editorMode, setEditorMode] = useState<ComposeEditorMode>('edit');
  // The compose rack and track map collapse by default so the step grid
  // leads the view; roomy desktops open them automatically.
  const [composeToolsExpanded, setComposeToolsExpanded] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(min-width: 1280px) and (min-height: 900px)').matches
  ));
  const [masterLevel, setMasterLevel] = useState(-100);
  const [uiFrameDriftMs, setUiFrameDriftMs] = useState(0);
  const [audioBaseLatencyMs, setAudioBaseLatencyMs] = useState<number | null>(() => {
    const latencySeconds = engine.getBaseLatencySeconds();
    return latencySeconds === null ? null : Number((latencySeconds * 1000).toFixed(1));
  });
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [selectedStepNoteIndex, setSelectedStepNoteIndex] = useState(0);
  const [segmentDraftName, setSegmentDraftName] = useState('');
  const [loopBrowserFilter, setLoopBrowserFilter] = useState<typeof LOOP_BROWSER_FILTERS[number]['value']>('MATCHING');
  const [loopSearchDraft, setLoopSearchDraft] = useState('');
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
    typeof window !== 'undefined'
    && window.localStorage.getItem('sonicstudio:lane-column-collapsed') === 'true'
  ));
  const [patternSegments, setPatternSegments] = useState<PatternSegment[]>(() => loadPatternSegments());
  const [stepZoom, setStepZoom] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 40 : 54
  ));
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [mobileTrackMapOpen, setMobileTrackMapOpen] = useState(() => (
    typeof window === 'undefined' ? true : !window.matchMedia('(max-width: 767px)').matches
  ));
  const [collapsedGroups, setCollapsedGroups] = useState<Record<LaneSectionKey, boolean>>({
    MUSICAL: false,
    PINNED: false,
    RHYTHM: false,
    TEXTURE: false,
  });
  const gridViewportRef = useRef<HTMLDivElement | null>(null);
  const addLaneStripRef = useRef<HTMLDivElement | null>(null);
  const [addLaneMaxScrollLeft, setAddLaneMaxScrollLeft] = useState(0);
  const [addLaneScrollLeft, setAddLaneScrollLeft] = useState(0);
  const [addLaneOpen, setAddLaneOpen] = useState(true);
  const [gridScrollLeft, setGridScrollLeft] = useState(0);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const selectedTrackPattern = selectedTrack?.patterns[currentPattern] ?? Array.from({ length: stepsPerPattern }, () => []);
  const currentPatternLabel = `Pattern ${String.fromCharCode(65 + currentPattern)}`;
  const playbackStep = stepsPerPattern > 0 ? currentStep % stepsPerPattern : 0;
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
  const laneHeaderWidth = laneColumnCollapsed
    ? 38
    : isMobileViewport
      ? (compactLanes ? 188 : 212)
      : compactLanes ? 300 : 340;
  const stepCellWidth = clampNumber(stepZoom, STEP_ZOOM_MIN, stepZoomMax);
  const stepRunwayWidth = Math.max(104, SEQUENCER_RUNWAY_STEPS * stepCellWidth);
  const stepGridWidth = (stepsPerPattern * stepCellWidth) + stepRunwayWidth;
  const maxGridScrollLeft = Math.max(0, (laneHeaderWidth + stepGridWidth) - gridViewportWidth);
  const visibleStepStart = Math.max(0, Math.floor(Math.max(0, gridScrollLeft - laneHeaderWidth) / stepCellWidth));
  const visibleStepEnd = Math.min(stepsPerPattern, Math.ceil(Math.max(0, (gridScrollLeft + gridViewportWidth - laneHeaderWidth)) / stepCellWidth));
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
    const interval = window.setInterval(() => {
      setMasterLevel(engine.getMasterMeterValue());
    }, 120);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedTrack) {
      setSelectedStepIndex(0);
      setSelectedStepNoteIndex(0);
      return;
    }

    const pattern = selectedTrack.patterns[currentPattern] ?? Array.from({ length: stepsPerPattern }, () => []);
    const firstActiveStep = pattern.findIndex((step) => step.length > 0);
    setSelectedStepIndex(firstActiveStep >= 0 ? firstActiveStep : 0);
    setSelectedStepNoteIndex(0);
  }, [currentPattern, selectedTrack?.id, stepsPerPattern]);

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
      setGridViewportWidth(node.clientWidth);
    };

    syncGridViewport();
    node.addEventListener('scroll', syncGridViewport, { passive: true });
    window.addEventListener('resize', syncGridViewport);

    return () => {
      node.removeEventListener('scroll', syncGridViewport);
      window.removeEventListener('resize', syncGridViewport);
    };
  }, [compactLanes, laneScope, laneHeaderWidth, stepCellWidth, stepsPerPattern, visibleTrackSections.length]);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileTrackMapOpen(true);
    }
  }, [isMobileViewport]);

  useEffect(() => {
    const latencySeconds = engine.getBaseLatencySeconds();
    setAudioBaseLatencyMs(latencySeconds === null ? null : Number((latencySeconds * 1000).toFixed(1)));
  }, [isPlaying, tracks.length, stepsPerPattern, superSonicMode]);

  useEffect(() => {
    // Only watch frame drift while the transport is running. The readout is
    // playback-only, so a 60fps loop that re-renders the whole workspace
    // while the studio sits idle is pure main-thread churn, the kind that
    // hurts weaker devices most.
    if (!isPlaying) {
      setUiFrameDriftMs((current) => (current === 0 ? current : 0));
      return;
    }

    let frameId = 0;
    let lastFrameTime = performance.now();
    let driftAccumulator = 0;
    let sampleCount = 0;

    const tick = (now: number) => {
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      const drift = Math.max(0, delta - 16.67);
      driftAccumulator += drift;
      sampleCount += 1;

      if (sampleCount >= 15) {
        const nextDrift = driftAccumulator / sampleCount;
        setUiFrameDriftMs((current) => {
          const smoothed = Number(((current * 0.65) + (nextDrift * 0.35)).toFixed(2));
          // Skip the re-render when the smoothed reading barely moved, so a
          // steady playback does not keep re-rendering the workspace.
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

  useEffect(() => {
    const node = gridViewportRef.current;
    if (!node) {
      return undefined;
    }

    const handleGridWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.altKey) {
        event.preventDefault();
        const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        updateStepZoom(stepCellWidth + (dominantDelta < 0 ? 6 : -6), event.clientX);
        return;
      }

      if (!event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }

      if (node.scrollWidth <= node.clientWidth) {
        return;
      }

      event.preventDefault();
      node.scrollLeft += event.deltaY;
    };

    node.addEventListener('wheel', handleGridWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', handleGridWheel);
    };
  }, [laneHeaderWidth, stepCellWidth, stepZoomMax]);

  const updateStepZoom = (nextWidth: number, anchorClientX?: number) => {
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

  const paintStateRef = useRef<{ trackId: string; mode: 'add' | 'remove' | 'select'; visited: Set<string>; note?: string } | null>(null);
  // SuperSonic touch placement: a preview cell that tracks the finger so a
  // note can be aimed before it commits on release.
  const [placementCursor, setPlacementCursor] = useState<{ trackId: string; stepIndex: number } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const endPaint = () => { paintStateRef.current = null; };
    window.addEventListener('pointerup', endPaint);
    window.addEventListener('pointercancel', endPaint);
    return () => {
      window.removeEventListener('pointerup', endPaint);
      window.removeEventListener('pointercancel', endPaint);
    };
  }, []);

  // Remember whether the lane column is collapsed so a returning session
  // keeps the workspace the way it was left.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'sonicstudio:lane-column-collapsed',
      laneColumnCollapsed ? 'true' : 'false',
    );
  }, [laneColumnCollapsed]);

  // Adding a lane: route every "new lane" action through here so the
  // fresh lane announces itself — it auditions its voice and scrolls
  // into view — rather than appearing silently off-screen.
  const laneJustAddedRef = useRef(false);
  const prevTrackCountRef = useRef(tracks.length);
  const handleCreateLane = useCallback((trackType: InstrumentType) => {
    laneJustAddedRef.current = true;
    createTrack(trackType);
  }, [createTrack]);

  useEffect(() => {
    const grew = tracks.length > prevTrackCountRef.current;
    prevTrackCountRef.current = tracks.length;
    if (!grew || !laneJustAddedRef.current) {
      return;
    }
    laneJustAddedRef.current = false;
    const newest = tracks[tracks.length - 1];
    if (!newest) {
      return;
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
  }, [tracks, previewTrack]);

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
      paintStateRef.current = { trackId, mode: 'select', note, visited: new Set([`${stepIndex}`]) };
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
    if (!state || state.trackId !== trackId) return;
    const key = `${stepIndex}`;
    if (state.visited.has(key)) return;
    state.visited.add(key);
    if (state.mode === 'select') {
      setSelectedTrackId(trackId);
      selectStep(stepIndex);
      return;
    }
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
    setActiveView('ARRANGER');
    setSessionPlayerNotice(`${profile.label} built as ${getSongFormDefinition(formId).label}. The arrangement is ready in Song view.`);
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
    <section className="surface-panel flex flex-col overflow-visible md:min-h-0 md:flex-1">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-5 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0 shrink-0">
          <div className="flex items-baseline gap-2">
            <div className="section-label">Sequencer</div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Pattern grid</h2>
          </div>
          <p className="mt-1 hidden text-sm text-[var(--text-secondary)] xl:block">Build the current pattern here before you move it into Song view.</p>
        </div>
        <div className="surface-panel-muted w-full min-w-0 p-2 md:flex-1 sm:max-w-full md:max-w-[700px]">
          <div className="flex items-center justify-between gap-3">
            <span className="section-label shrink-0">Add lane</span>
            <div className="flex items-center gap-1.5">
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
                onClick={() => setAddLaneOpen((current) => !current)}
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
            {TRACK_BUTTONS.map((button) => (
              <button
                className="control-chip add-lane-pill shrink-0 px-2.5 py-2 text-left"
                key={button.type}
                onClick={() => handleCreateLane(button.type)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.04)] text-[var(--accent-strong)]">
                    <TrackIcon className="h-3.5 w-3.5" type={button.type} />
                  </span>
                  <span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">{button.label}</span>
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

      <div className="flex flex-col gap-3 overflow-visible p-4 md:min-h-0 md:flex-1 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-col overflow-visible md:min-h-[min(58vh,520px)] md:flex-1">
          <div className="surface-panel-muted mb-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-label">Compose</div>
                <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {selectedTrack ? `${selectedTrack.name} in Pattern ${String.fromCharCode(65 + currentPattern)}` : 'Pick a lane to start writing'}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  {selectedTrack
                    ? `${selectedTrackPattern.filter((step) => step.length > 0).length} active steps · ${selectedTrackPattern.reduce((sum, step) => sum + step.length, 0)} notes · ${isSelectedTrackDrum ? 'drum lane' : 'melodic lane'}`
                    : `${tracks.length} total tracks · ${melodicTrackCount} melodic lanes`}
                </div>
              </div>
              <button
                aria-expanded={composeToolsExpanded}
                className="control-chip flex h-8 shrink-0 items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-ui-sound="tab"
                onClick={() => setComposeToolsExpanded((current) => !current)}
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
                  <span className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Steps 16-4096</span>
                  {STEP_OPTIONS.map((option) => (
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
                      {hiddenPatternContent.hiddenNoteCount} hidden notes beyond {stepsPerPattern}
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
                      {mode === 'select' ? 'Select' : 'Edit'}
                    </button>
                  ))}
                </div>
                {!isMobileViewport && (
                  <div className="surface-panel-strong min-w-[196px] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="section-label">Load watch</span>
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.14em]"
                        style={{ color: loadWatchStyle.text }}
                      >
                        {loadWatchSummary.label}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-black/20">
                      <div
                        className="h-full rounded-[2px]"
                        style={{
                          background: loadWatchStyle.bar,
                          width: `${Math.max(6, loadWatchSummary.score)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                      {loadWatchSummary.activeLaneCount} lanes · {loadWatchSummary.totalNotes} notes · peak {loadWatchSummary.peakNotes}
                      {loadWatchSummary.baseLatencyMs !== null ? ` · ${Math.round(loadWatchSummary.baseLatencyMs)}ms base` : ''}
                      {isPlaying ? ` · ${loadWatchSummary.frameDriftMs.toFixed(1)}ms drift` : ''}
                    </div>
                  </div>
                )}
                {superSonicMode && superSonicPreferences.guidanceBadges && (
                  <div className="surface-panel-strong flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                    <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Macro lane view ready
                  </div>
                )}
                {!superSonicMode && selectedTrack && (
                  <div className="surface-panel-strong flex flex-wrap items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    <span className="section-label">Classic lane tools</span>
                    <button
                      className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => setLaneScope('FOCUSED')}
                      type="button"
                    >
                      Focus lane
                    </button>
                    <button
                      className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => setLaneScope('ALL')}
                      type="button"
                    >
                      Show all
                    </button>
                  </div>
                )}
                {superSonicMode && selectedTrack && (
                  <div className="surface-panel-strong flex flex-wrap items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                    <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Super lane tools
                    <button
                      className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => setActiveView('PIANO_ROLL')}
                      type="button"
                    >
                      Deep edit roll
                    </button>
                    <button
                      className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      disabled={!selectedTrackPatternSpan}
                      onClick={handleToggleSelectedTrackLoop}
                      type="button"
                    >
                      Pulse loop
                    </button>
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
                    {!isMobileViewport && (
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
                    )}
                    <button
                      className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => setActiveView(canDeepEditSelectedTrack ? 'PIANO_ROLL' : 'ARRANGER')}
                      type="button"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {canDeepEditSelectedTrack ? 'Deep edit' : 'Song tools'}
                    </button>
                    {isMobileViewport && (
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

          {visibleTracks.length > 0 && composeToolsExpanded && (
            <div className="surface-panel-muted mb-3 px-4 py-3">
              {isMobileViewport ? (
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
                  <span className="section-label">Track map</span>
                  <button
                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => setMobileTrackMapOpen((current) => !current)}
                    type="button"
                  >
                    {mobileTrackMapOpen ? 'Hide map' : 'Show map'}
                  </button>
                </div>
              ) : null}
              {!isMobileViewport || mobileTrackMapOpen ? (
                <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="section-label">Track map</div>
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

          <div className="flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
            <div
              className="sequencer-grid-scroll overflow-auto rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] md:min-h-0 md:flex-1"
              data-scrolled={gridScrollLeft > 1 ? 'true' : undefined}
              onPointerCancel={() => setPlacementCursor(null)}
              onPointerMove={handlePlacementMove}
              onPointerUp={handlePlacementCommit}
              ref={gridViewportRef}
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
                      </>
                    )}
                  </div>
                  <div className="flex" style={{ width: `${stepGridWidth}px` }}>
                    {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => (
                      <button
                        className={`shrink-0 border-r border-[var(--border-soft)] flex items-center justify-center ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.035)]' : ''} ${selectedStepIndex === stepIndex ? 'text-[var(--accent-strong)]' : ''}`}
                        key={stepIndex}
                        onClick={() => selectStep(stepIndex)}
                        style={{ width: `${stepCellWidth}px` }}
                      >
                        <span className={`font-mono text-[11px] ${stepIndex % 4 === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                          {stepIndex + 1}
                        </span>
                      </button>
                    ))}
                    <button
                      className="group relative flex shrink-0 flex-col items-center justify-center border-l border-dashed border-[var(--border-soft)] bg-[linear-gradient(90deg,rgba(255,255,255,0.03),rgba(114,217,255,0.08))]"
                      onClick={() => extendPatternBy(16)}
                      style={{ width: `${stepRunwayWidth}px` }}
                      type="button"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">More room</span>
                      <span className="mt-1 text-[10px] text-[var(--text-tertiary)]">extend +16</span>
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
                    const sourceLabel = track.source.engine === 'sample'
                      ? track.source.customSampleName ?? getSamplePresetMeta(track.source.samplePreset).label
                      : waveformLabel(track.source.waveform);

                    return (
                      <div
                        className={`flex border-b border-[var(--border-soft)] transition-colors ${selected ? 'bg-[rgba(125,211,252,0.06)]' : 'bg-transparent hover:bg-[rgba(255,255,255,0.02)]'}`}
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
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</span>
                            <LaneKeyChip track={track} />
                            {pinned && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">Pinned</span>}
                            {!isMobileViewport && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.source.engine}</span>}
                            {!isMobileViewport && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{sourceLabel}</span>}
                            {!isMobileViewport && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.volume.toFixed(0)} dB</span>}
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                              {patternSteps.reduce((sum, step) => sum + step.length, 0)} notes
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
                          </div>
                          </>
                          )}
                        </div>

                        <div className={`flex gap-[2px] ${laneGridPaddingClass}`} style={{ width: `${stepGridWidth}px` }}>
                          {patternSteps.map((value, stepIndex) => {
                            const isActive = value.length > 0;
                            const isCurrent = playbackStep === stepIndex;
                            const isSelectedStep = selectedStepIndex === stepIndex;
                            const leadEvent = value[0];
                            const extraNotes = Math.max(0, value.length - 1);
                            const maxGate = value.reduce((gate, event) => Math.max(gate, event.gate), 0);
                            const showStepNoteLabel = stepCellWidth >= 36;
                            const showStepCount = stepCellWidth >= 26;
                            const anchorNote = getTrackAnchorNote(track, patternSteps, stepIndex);

                            return (
                              <button
                                className={`group relative shrink-0 touch-none border transition-colors ${editorMode === 'select' ? 'cursor-pointer' : 'cursor-crosshair'} ${compactLanes ? 'min-h-[38px]' : 'min-h-[48px]'} ${isActive ? 'border-transparent' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]'} ${isCurrent ? 'ring-1 ring-inset ring-[rgba(255,255,255,0.08)]' : ''} ${isSelectedStep ? 'outline outline-1 outline-offset-0 outline-[rgba(125,211,252,0.26)]' : ''} ${placementCursor && placementCursor.trackId === track.id && placementCursor.stepIndex === stepIndex ? 'seq-place-cursor' : ''}`}
                                data-seq-cell="true"
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
                                style={isActive
                                  ? {
                                      background: isCurrent ? track.color : `${track.color}cc`,
                                      boxShadow: isCurrent
                                        ? `inset 0 0 0 1px rgba(255, 255, 255, 0.76), 0 0 0 1px rgba(15, 23, 42, 0.14), 0 0 18px ${track.color}44`
                                        : 'inset 0 0 0 1px rgba(15, 23, 42, 0.12)',
                                      width: `${stepCellWidth - 2}px`,
                                      touchAction: editorMode === 'edit' ? 'none' : 'pan-y',
                                    }
                                  : {
                                      background: isCurrent ? `${track.color}16` : undefined,
                                      width: `${stepCellWidth - 2}px`,
                                      touchAction: editorMode === 'edit' ? 'none' : 'pan-y',
                                    }}
                                type="button"
                              >
                                {isCurrent && (
                                  <span
                                    aria-hidden
                                    className="absolute inset-x-0 top-0 h-[3px]"
                                    style={{
                                      background: isActive ? 'rgba(255,255,255,0.82)' : track.color,
                                      opacity: isActive ? 1 : 0.74,
                                    }}
                                  />
                                )}
                                {isActive && showStepNoteLabel && !['kick', 'snare', 'hihat'].includes(track.type) && leadEvent && (
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
                                {extraNotes > 0 && showStepCount && (
                                  <span className="absolute left-1 top-1 rounded-sm bg-black/20 px-1 font-mono text-[8px] text-white/80">
                                    {value.length}
                                  </span>
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
                                {isCurrent && <span className="absolute inset-y-1 left-1 w-[2px] rounded-full bg-white/50" />}
                              </button>
                            );
                          })}
                          <button
                            className="group relative shrink-0 border border-dashed border-[var(--border-soft)] bg-[linear-gradient(90deg,rgba(255,255,255,0.025),rgba(114,217,255,0.08))] text-left transition-colors hover:border-[rgba(114,217,255,0.28)] hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(114,217,255,0.12))]"
                            onClick={() => {
                              setSelectedTrackId(track.id);
                              extendPatternBy(16);
                              window.requestAnimationFrame(() => jumpToStep(stepsPerPattern, track.id));
                            }}
                            style={{ width: `${stepRunwayWidth - 2}px` }}
                            type="button"
                          >
                            <div className="flex h-full min-h-[38px] flex-col items-start justify-center px-3">
                              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Keep writing</span>
                              <span className="mt-1 text-[10px] text-[var(--text-tertiary)]">extend this pattern</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              </div>
            </div>
            <div className="mt-3 rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Pattern timeline navigation
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => scrollGridByViewport(-1)}
                    type="button"
                  >
                    Left
                  </button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {visibleStepStart + 1}
                  </span>
                  <input
                    className="sonic-scroll-strip"
                    max={maxGridScrollLeft}
                    min={0}
                    onChange={(event) => {
                      if (!gridViewportRef.current) {
                        return;
                      }

                      gridViewportRef.current.scrollLeft = Number(event.target.value);
                    }}
                    step={Math.max(STEP_ZOOM_STEP, stepCellWidth)}
                    type="range"
                    value={Math.min(gridScrollLeft, maxGridScrollLeft)}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {Math.max(visibleStepStart + 1, visibleStepEnd)}
                  </span>
                  <button
                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => scrollGridByViewport(1)}
                    type="button"
                  >
                    Right
                  </button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    tail stays open
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(!isMobileViewport || mobileInspectorOpen) && (
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
                    onClick={() => setActiveView(canDeepEditSelectedTrack ? 'PIANO_ROLL' : 'ARRANGER')}
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
                <div className="mt-3 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="section-label">Grid mode</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      {editorMode === 'select' ? 'Select' : 'Edit'}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                    {editorMode === 'select'
                      ? 'Select mode keeps the grid read-only so you can highlight steps without placing or deleting notes. Gate and pitch shaping stay active below.'
                      : 'Edit mode lets the grid place, remove, and drag-paint notes directly across steps.'}
                  </div>
                </div>
                {!isMobileViewport && (
                  <div className="mt-3 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                    <div className="section-label">View roles</div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Sequencer shapes timing and groove. Roll handles pitch and phrase detail. Mixer balances level and tone. Arranger lays out full song structure.
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="control-chip h-8 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => setActiveView('SEQUENCER')} type="button">Seq</button>
                      <button className="control-chip h-8 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => setActiveView('PIANO_ROLL')} type="button">Roll</button>
                      <button className="control-chip h-8 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => setActiveView('MIXER')} type="button">Mix</button>
                      <button className="control-chip h-8 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => setActiveView('ARRANGER')} type="button">Arrange</button>
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
                    ? isSelectedTrackLoopActive
                      ? `Phrase loop is on for steps ${selectedTrackPatternSpan.startStep + 1}-${selectedTrackPatternSpan.endStep} in ${currentPatternLabel}. Delete all notes clears this lane in ${currentPatternLabel}.`
                      : `Loop phrase sets playback to steps ${selectedTrackPatternSpan.startStep + 1}-${selectedTrackPatternSpan.endStep} in ${currentPatternLabel}.`
                    : hasExplicitLoopRange
                      ? `A loop window is active from step ${loopRangeStartBeat! + 1} to ${loopRangeEndBeat}. Add notes here to define a lane phrase, or choose Full pattern.`
                      : 'Add a few notes, then loop the active span or clear this lane without hunting through row controls.'}
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

              <div className="loop-browser-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="section-label">Loop browser</div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Save your own phrases, then pull from factory loops to fill a lane fast or queue them for stitch placement on the grid.
                    </div>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {patternSegments.length} saved · {filteredFactoryLoops.length} factory
                  </div>
                </div>

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
              </div>

              <div className="session-player-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="section-label">Session player</div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Load a groove into the current pattern or build a full intro, verse, lift, and break scaffold directly into Song view. Missing lanes are created first.
                    </div>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {pendingSessionPlayerRequest ? 'building lanes' : `${SESSION_PLAYER_PROFILES.length} players`}
                  </div>
                </div>
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
                              <span>{deck.segments.length} lanes</span>
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
              </div>

              <div className="loop-browser-panel rounded-[4px] border border-[var(--border-soft)] px-3 py-3">
                <div className="section-label">Selected step</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[var(--text-primary)]">Step {selectedStepIndex + 1}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {selectedStep.length} note{selectedStep.length === 1 ? '' : 's'}
                  </div>
                </div>
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
                <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  {selectedStepNote
                    ? `${selectedStepNote.note} · velocity ${Math.round(selectedStepNote.velocity * 100)} · gate ${selectedStepNote.gate.toFixed(2)}`
                    : 'This step is empty. Click the grid to place a note or hit.'}
                </div>
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
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Select a lane to edit notes, dynamics, and pattern movement.</p>
          )}
        </aside>
        )}
      </div>
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

const waveformLabel = (waveform: 'sine' | 'triangle' | 'sawtooth' | 'square') => {
  switch (waveform) {
    case 'sawtooth':
      return 'Saw';
    case 'triangle':
      return 'Triangle';
    default:
      return waveform.charAt(0).toUpperCase() + waveform.slice(1);
  }
};

function buildNoteOptions(highOctave: number, lowOctave: number) {
  const notes: string[] = [];

  for (let octave = highOctave; octave >= lowOctave; octave -= 1) {
    for (let noteIndex = NOTE_NAMES.length - 1; noteIndex >= 0; noteIndex -= 1) {
      notes.push(`${NOTE_NAMES[noteIndex]}${octave}`);
    }
  }

  return notes;
}
