import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Eraser,
  LayoutGrid,
  Layers3,
  ListPlus,
  Minus,
  Music,
  Plus,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Zap,
} from 'lucide-react';

import { useAudio, usePlaybackStep } from '../context/AudioContext';
import { detectKey, getEffectiveKey } from '../services/keyDetector';
import { saveCapturedNoteStringFromTokens, tokensFromPatternSteps } from '../services/noteStringLibrary';
import { setQueuedNoteStringId } from '../services/noteStringQueue';
import { MAX_STEPS_PER_PATTERN, type NoteEvent } from '../project/schema';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';
import {
  KEY_OPTIONS,
  MAJOR_KEY_TRIADS,
  MINOR_KEY_TRIADS,
  buildChordNotes,
  guessKeyAndOctaveFromTrack,
  type KeyName,
} from '../utils/chords';
import {
  NOTE_GATE_COARSE_STEP,
  NOTE_GATE_FINE_STEP,
  NOTE_GATE_GRID_STEP,
  NOTE_GATE_JUMP_STEP,
  NOTE_GATE_MAX,
  NOTE_GATE_MEDIUM_STEP,
  NOTE_GATE_MIN,
  NOTE_GATE_PRESETS,
  clampNoteGate,
  snapNoteGate,
} from '../utils/noteEditing';
import { useMediaQuery } from '../utils/useMediaQuery';
import { loadRecordedNotePresets, subscribeRecordedNotePresets, type RecordedNotePreset } from '../services/recordedNoteLibrary';
import { captureSuggestionControlsToTrackParams, captureSuggestionControlsToTrackSource } from '../services/audioRecording';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PITCH_CLASS_INDEX_FROM_NAME: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};
const MAJOR_SCALE_PCS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_PCS = [0, 2, 3, 5, 7, 8, 10];

// Snap a note name to the nearest pitch class in the detected key.
// Preserves the octave when the snap is within 1 semitone. Used by
// the Piano Roll's Snap toolbar action so a stray accidental clicks
// into the scale without changing the gesture vocabulary.
const snapNoteToKey = (note: string, key: { root: number; mode: 'major' | 'minor' }): string => {
  const match = note.match(/^([A-G])(#?)(-?\d+)$/);
  if (!match) return note;
  const pc = PITCH_CLASS_INDEX_FROM_NAME[`${match[1]}${match[2]}`];
  if (pc === undefined) return note;
  const octave = Number.parseInt(match[3], 10);
  if (!Number.isFinite(octave)) return note;
  const scale = key.mode === 'major' ? MAJOR_SCALE_PCS : MINOR_SCALE_PCS;
  const inKey = new Set(scale.map((degree) => (key.root + degree) % 12));
  if (inKey.has(pc)) return note;
  // Find the closest in-key pitch class by absolute semitone distance.
  let bestDelta = 12;
  let bestPc = pc;
  for (const candidate of inKey) {
    const forward = (candidate - pc + 12) % 12;
    const backward = (pc - candidate + 12) % 12;
    const delta = Math.min(forward, backward);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestPc = candidate;
    }
  }
  // Use the signed distance (favouring downward snaps for ties) so
  // the resulting MIDI value lands sensibly within the octave.
  const baseMidi = (octave + 1) * 12 + pc;
  const upward = (bestPc - pc + 12) % 12;
  const downward = (pc - bestPc + 12) % 12;
  const signed = upward <= downward ? upward : -downward;
  const targetMidi = Math.max(0, Math.min(127, baseMidi + signed));
  const targetPc = ((targetMidi % 12) + 12) % 12;
  const targetOctave = Math.floor(targetMidi / 12) - 1;
  return `${NOTE_NAMES[targetPc]}${targetOctave}`;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const GRID_LABEL_WIDTH = 88;
const MOBILE_GRID_LABEL_WIDTH = 72;
const STEP_ZOOM_MAX = 120;
const STEP_ZOOM_MIN = 20;
const STEP_ZOOM_STEP = 2;
const STEP_OPTIONS = [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096] as const;
const SUPERSONIC_NOTE_OFFSETS = [4, 3, 2, 1, 0, -1, -2, -3, -4] as const;

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
const NOTE_WINDOWS = {
  HIGH: buildNoteRange(6, 4),
  LOW: buildNoteRange(4, 2),
  MID: buildNoteRange(5, 3),
} as const;
const ALL_NOTES = buildNoteRange(6, 2);
const STEP_ZOOM_PRESETS = {
  CLOSE: 78,
  DETAIL: 62,
  WIDE: 48,
  FAR: 28,
} as const;
const ROW_ZOOM_PRESETS = {
  CLOSE: 44,
  DETAIL: 38,
  WIDE: 32,
} as const;
const GATE_ADJUSTMENT_GROUPS = [
  {
    label: 'Fine',
    steps: [
      { label: '-0.01', value: -NOTE_GATE_FINE_STEP },
      { label: '+0.01', value: NOTE_GATE_FINE_STEP },
    ],
  },
  {
    label: 'Medium',
    steps: [
      { label: '-0.05', value: -NOTE_GATE_MEDIUM_STEP },
      { label: '+0.05', value: NOTE_GATE_MEDIUM_STEP },
    ],
  },
  {
    label: 'Coarse',
    steps: [
      { label: '-0.25', value: -NOTE_GATE_COARSE_STEP },
      { label: '+0.25', value: NOTE_GATE_COARSE_STEP },
    ],
  },
  {
    label: 'Jump',
    steps: [
      { label: '-1', value: -NOTE_GATE_JUMP_STEP },
      { label: '+1', value: NOTE_GATE_JUMP_STEP },
    ],
  },
] as const;

type NoteWindowKey = keyof typeof NOTE_WINDOWS;
type RowZoomKey = keyof typeof ROW_ZOOM_PRESETS;

interface NoteResizeState {
  initialGate: number;
  noteIndex: number;
  startClientX: number;
  stepIndex: number;
  edge?: 'start' | 'end';
}

export const PianoRoll = () => {
  const isMobileViewport = useMediaQuery('(max-width: 767px)');
  const currentStep = usePlaybackStep();
  const {
    applyTrackVoicePreset,
    clearTrack,
    currentPattern,
    humanizePattern,
    moveNoteToStep,
    selectedTrackId,
    setTrackParams,
    setTrackSource,
    setLoopRange,
    previewTrack,
    setStepsPerPattern,
    shiftPattern,
    stampChord,
    stepsPerPattern,
    superSonicMode,
    superSonicPreferences,
    applyPatternSegment,
    toggleStep,
    tracks,
    transposePattern,
    transposePatternAt,
    updateStepEvent,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId);
  const playbackStep = stepsPerPattern > 0 ? currentStep % stepsPerPattern : 0;
  const [noteWindow, setNoteWindow] = useState<NoteWindowKey>('MID');
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [stepZoom, setStepZoom] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 46 : STEP_ZOOM_PRESETS.DETAIL
  ));
  const [rowZoom, setRowZoom] = useState<RowZoomKey>('DETAIL');
  const [autoFitActiveNotes, setAutoFitActiveNotes] = useState(true);
  const [focusSelectedNote, setFocusSelectedNote] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [supersonicHoverCell, setSupersonicHoverCell] = useState<{ note: string; stepIndex: number } | null>(null);
  const [noteResizeState, setNoteResizeState] = useState<NoteResizeState | null>(null);
  const [recordedNoteLibrary, setRecordedNoteLibrary] = useState<RecordedNotePreset[]>([]);
  // Seed the chord palette with the session's detected key on mount.
  // The user can still override via the Key dropdown / Major-Minor
  // toggle, and re-sync at any time with the "Match session" button.
  // Scale lock keeps the palette glued to the detected key as the
  // session evolves so stamps stay diatonic by construction.
  const initialDetected = useMemo(() => getEffectiveKey(tracks), [tracks]);
  const [scaleLocked, setScaleLocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('sonicstudio:piano-roll:scale-locked:v1') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (scaleLocked) {
        window.localStorage.setItem('sonicstudio:piano-roll:scale-locked:v1', '1');
      } else {
        window.localStorage.removeItem('sonicstudio:piano-roll:scale-locked:v1');
      }
    } catch {
      /* storage may be unavailable; ignore */
    }
  }, [scaleLocked]);
  const [chordKey, setChordKey] = useState<KeyName>(() => (
    initialDetected.uncertain ? 'C' : (initialDetected.rootName as KeyName)
  ));
  const [chordMode, setChordMode] = useState<'major' | 'minor'>(() => (
    initialDetected.uncertain ? 'major' : initialDetected.mode
  ));
  const liveDetected = useMemo(() => getEffectiveKey(tracks), [tracks]);
  // While locked, follow the live detected key on every render.
  useEffect(() => {
    if (!scaleLocked || liveDetected.uncertain) return;
    if (chordKey !== liveDetected.rootName) setChordKey(liveDetected.rootName as KeyName);
    if (chordMode !== liveDetected.mode) setChordMode(liveDetected.mode);
  }, [scaleLocked, liveDetected, chordKey, chordMode]);
  const canMatchSession = !scaleLocked
    && !liveDetected.uncertain
    && (liveDetected.rootName !== chordKey || liveDetected.mode !== chordMode);
  const [chordPaletteOpen, setChordPaletteOpen] = useState(false);
  // The control rack collapses by default so the note grid leads the view.
  // It opens automatically on roomy desktops where the space is there.
  const [controlsExpanded, setControlsExpanded] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(min-width: 1280px) and (min-height: 900px)').matches
  ));
  const gridViewportRef = useRef<HTMLDivElement | null>(null);
  const gridOverviewRef = useRef<HTMLDivElement | null>(null);
  const gridOverviewDragRef = useRef(false);
  const [gridScrollLeft, setGridScrollLeft] = useState(0);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);

  useEffect(() => {
    setRecordedNoteLibrary(loadRecordedNotePresets());
    return subscribeRecordedNotePresets(setRecordedNoteLibrary);
  }, []);

  useEffect(() => {
    if (!track) {
      return;
    }

    if (track.type === 'bass') {
      setNoteWindow('LOW');
      return;
    }

    if (track.type === 'fx') {
      setNoteWindow('HIGH');
      return;
    }

    setNoteWindow('MID');
  }, [track?.id, track?.type]);

  useEffect(() => {
    if (!track) {
      setSelectedStepIndex(null);
      setSelectedNoteIndex(null);
      return;
    }

    const steps = track.patterns[currentPattern] ?? [];
    const firstActiveStep = steps.findIndex((step) => step.length > 0);
    const nextStepIndex = firstActiveStep >= 0 ? firstActiveStep : 0;

    setSelectedStepIndex(nextStepIndex);
    setSelectedNoteIndex(steps[nextStepIndex]?.length ? 0 : null);
  }, [currentPattern, stepsPerPattern, track?.id]);

  if (!track) {
    return (
      <section className="surface-panel flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="section-label">Piano roll</div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Pick a track to open the note grid.</p>
        </div>
      </section>
    );
  }

  const isDrum = track.type === 'kick' || track.type === 'snare' || track.type === 'hihat';
  const patternSteps = track.patterns[currentPattern] ?? Array.from({ length: stepsPerPattern }, () => []);
  const activeStepCount = patternSteps.filter((step) => step.length > 0).length;
  const totalNoteCount = patternSteps.reduce((sum, step) => sum + step.length, 0);
  const stackedStepCount = patternSteps.filter((step) => step.length > 1).length;
  const activeNoteBounds = useMemo(() => {
    let minMidi: number | null = null;
    let maxMidi: number | null = null;

    patternSteps.forEach((step) => {
      step.forEach((event) => {
        const midi = noteToMidi(event.note);
        if (midi === null) {
          return;
        }

        minMidi = minMidi === null ? midi : Math.min(minMidi, midi);
        maxMidi = maxMidi === null ? midi : Math.max(maxMidi, midi);
      });
    });

    if (minMidi === null || maxMidi === null) {
      return null;
    }

    return { maxMidi, minMidi };
  }, [patternSteps]);
  const selectedStep = selectedStepIndex !== null ? patternSteps[selectedStepIndex] ?? [] : [];
  const normalizedSelectedNoteIndex = selectedNoteIndex !== null && selectedStep[selectedNoteIndex]
    ? selectedNoteIndex
    : selectedStep.length > 0 ? 0 : null;
  const selectedNote = normalizedSelectedNoteIndex !== null ? selectedStep[normalizedSelectedNoteIndex] : null;
  const noteLabelWidth = isMobileViewport ? MOBILE_GRID_LABEL_WIDTH : GRID_LABEL_WIDTH;
  const stepCellWidth = stepZoom;
  const rowHeight = ROW_ZOOM_PRESETS[rowZoom];
  const maxGridScrollLeft = Math.max(0, (noteLabelWidth + (stepsPerPattern * stepCellWidth)) - gridViewportWidth);
  const visibleStepStart = Math.max(0, Math.floor(Math.max(0, gridScrollLeft - noteLabelWidth) / stepCellWidth));
  const visibleStepEnd = Math.min(stepsPerPattern, Math.ceil(Math.max(0, (gridScrollLeft + gridViewportWidth - noteLabelWidth)) / stepCellWidth));
  const maxNotesPerStep = Math.max(1, ...patternSteps.map((step) => step.length));

  const updateHorizontalZoom = useCallback((nextWidth: number, anchorClientX?: number) => {
    setStepZoom((currentWidth) => {
      const clampedWidth = clamp(Math.round(nextWidth / STEP_ZOOM_STEP) * STEP_ZOOM_STEP, STEP_ZOOM_MIN, STEP_ZOOM_MAX);
      if (clampedWidth === currentWidth) {
        return currentWidth;
      }

      const node = gridViewportRef.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        const anchorOffset = clamp(
          anchorClientX !== undefined ? anchorClientX - rect.left : node.clientWidth * 0.5,
          0,
          node.clientWidth,
        );
        const anchorStep = Math.max(0, ((node.scrollLeft + anchorOffset) - noteLabelWidth) / currentWidth);

        window.requestAnimationFrame(() => {
          const activeNode = gridViewportRef.current;
          if (!activeNode) {
            return;
          }

          const nextMaxScroll = Math.max(0, noteLabelWidth + (stepsPerPattern * clampedWidth) - activeNode.clientWidth);
          activeNode.scrollLeft = clamp(
            (noteLabelWidth + (anchorStep * clampedWidth)) - anchorOffset,
            0,
            nextMaxScroll,
          );
        });
      }

      return clampedWidth;
    });
  }, [noteLabelWidth, stepsPerPattern]);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileInspectorOpen(false);
      return;
    }

    setFocusSelectedNote(true);
    setStepZoom((current) => (current >= STEP_ZOOM_PRESETS.DETAIL ? 46 : current));
  }, [isMobileViewport]);
  const hasNotesOutsideWindow = useMemo(() => {
    if (isDrum || !activeNoteBounds) {
      return false;
    }

    const topWindowMidi = noteToMidi(NOTE_WINDOWS[noteWindow][0]);
    const bottomWindowMidi = noteToMidi(NOTE_WINDOWS[noteWindow][NOTE_WINDOWS[noteWindow].length - 1]);
    if (topWindowMidi === null || bottomWindowMidi === null) {
      return false;
    }

    return activeNoteBounds.maxMidi > topWindowMidi || activeNoteBounds.minMidi < bottomWindowMidi;
  }, [activeNoteBounds, isDrum, noteWindow]);

  const renderNotes = useMemo(() => {
    if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
      return ['C3'];
    }

    if (focusSelectedNote && selectedNote) {
      return buildFocusedNoteRange(selectedNote.note, 7);
    }

    if (autoFitActiveNotes && activeNoteBounds) {
      const span = activeNoteBounds.maxMidi - activeNoteBounds.minMidi;
      const fitPadding = span <= 18 ? 5 : span <= 32 ? 3 : 2;
      return buildAdaptiveNoteRange(activeNoteBounds.minMidi, activeNoteBounds.maxMidi, fitPadding);
    }

    return NOTE_WINDOWS[noteWindow];
  }, [activeNoteBounds, autoFitActiveNotes, focusSelectedNote, noteWindow, selectedNote, track.type]);

  // Pitch classes that fit the session's effective key, used to tint
  // grid rows whose pitch falls inside the diatonic set. Null when
  // the key is uncertain so the grid keeps its neutral look.
  const inKeyPitchClasses = useMemo<Set<number> | null>(() => {
    if (liveDetected.uncertain) return null;
    const degrees = liveDetected.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
    return new Set(degrees.map((degree) => (liveDetected.root + degree) % 12));
  }, [liveDetected]);

  const rowPitchClassFromName = (note: string): number | null => {
    const match = note.match(/^([A-G])(#?)/);
    if (!match) return null;
    return PITCH_CLASS_INDEX_FROM_NAME[`${match[1]}${match[2]}`] ?? null;
  };

  const selectStep = (stepIndex: number) => {
    setSelectedStepIndex(stepIndex);
    const nextStep = patternSteps[stepIndex] ?? [];
    setSelectedNoteIndex(nextStep.length > 0 ? 0 : null);
  };

  const handleGridToggle = (stepIndex: number, note: string) => {
    const currentStepNotes = patternSteps[stepIndex] ?? [];
    const existingIndex = currentStepNotes.findIndex((event) => event.note === note);

    setSelectedStepIndex(stepIndex);

    if (existingIndex >= 0) {
      const remainingLength = currentStepNotes.length - 1;
      setSelectedNoteIndex(remainingLength > 0 ? Math.min(existingIndex, remainingLength - 1) : null);
    } else {
      const nextStep = sortStepNotes([
        ...currentStepNotes,
        createPreviewEvent(note, selectedNote ?? currentStepNotes.at(-1)),
      ]);
      setSelectedNoteIndex(nextStep.findIndex((event) => event.note === note));
      // Sound the note as it lands, so placing it gives instant feedback.
      void previewTrack(track.id, note);
    }

    toggleStep(track.id, stepIndex, note);
  };

  const paintStateRef = useRef<{ mode: 'add' | 'remove'; snapToKey: boolean; visited: Set<string>; lastClientX?: number; lastClientY?: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const trackPointer = (event: PointerEvent) => {
      if (!paintStateRef.current) return;
      paintStateRef.current.lastClientX = event.clientX;
      paintStateRef.current.lastClientY = event.clientY;
    };
    const endPaint = () => {
      const state = paintStateRef.current;
      paintStateRef.current = null;
      if (!state) return;
      // If user painted 2+ cells in add mode, surface a Loop-this chip
      if (state.mode !== 'add' || state.visited.size < 2) return;
      // Compute painted step range
      const steps: number[] = [];
      state.visited.forEach((key) => {
        const stepStr = key.split(':')[0];
        const n = Number(stepStr);
        if (Number.isFinite(n)) steps.push(n);
      });
      if (steps.length < 2) return;
      const startStep = Math.min(...steps);
      const endStep = Math.max(...steps);
      const x = state.lastClientX ?? 0;
      const y = (state.lastClientY ?? 0) + 12;
      setLoopChipState({ x, y, startStep, endStep });
      window.setTimeout(() => {
        setLoopChipState((current) => (current?.startStep === startStep && current?.endStep === endStep ? null : current));
      }, 3200);
    };
    window.addEventListener('pointermove', trackPointer);
    window.addEventListener('pointerup', endPaint);
    window.addEventListener('pointercancel', endPaint);
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      window.removeEventListener('pointerup', endPaint);
      window.removeEventListener('pointercancel', endPaint);
    };
  }, []);

  const handleCellPointerDown = (stepIndex: number, note: string, hasNote: boolean, event: React.PointerEvent<HTMLButtonElement>) => {
    // Right-click / middle-click etc. fall through to default
    if (event.button !== 0) return;
    event.preventDefault();
    const mode: 'add' | 'remove' = hasNote ? 'remove' : 'add';
    // Shift held at paint-start clamps every note placed during the
    // gesture to the nearest in-key pitch. We resolve the snapped
    // note here so removing a freshly-snapped note in the same paint
    // stays consistent with the on-screen pitch the user just placed.
    const snapToKey = mode === 'add' && event.shiftKey && !liveDetected.uncertain;
    const placedNote = snapToKey ? snapNoteToKey(note, liveDetected) : note;
    paintStateRef.current = { mode, snapToKey, visited: new Set([`${stepIndex}:${placedNote}`]) };
    handleGridToggle(stepIndex, placedNote);
  };

  const handleCellPointerEnter = (stepIndex: number, note: string, hasNote: boolean) => {
    const state = paintStateRef.current;
    if (!state) return;
    const placedNote = state.snapToKey && !liveDetected.uncertain
      ? snapNoteToKey(note, liveDetected)
      : note;
    const key = `${stepIndex}:${placedNote}`;
    if (state.visited.has(key)) return;
    state.visited.add(key);
    if (state.mode === 'add' && !hasNote) handleGridToggle(stepIndex, placedNote);
    else if (state.mode === 'remove' && hasNote) handleGridToggle(stepIndex, placedNote);
  };

  const handleSuperSonicPointerDown = (
    stepIndex: number,
    originNote: string,
    semitoneOffset: number,
    event: React.PointerEvent<HTMLSpanElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const targetNote = shiftPitch(originNote, semitoneOffset);
    if (!targetNote) {
      return;
    }

    handleGridToggle(stepIndex, targetNote);
  };

  // --- Note gesture system (drag-to-pitch, velocity drag, click-to-erase, drag-to-erase) ---
  const noteGestureRef = useRef<{
    kind: 'pending' | 'pitch' | 'velocity' | 'erase';
    stepIndex: number;
    noteIndex: number;
    note: string;
    rowIndex: number;
    originalEvent: NoteEvent;
    originX: number;
    originY: number;
    shiftKey: boolean;
    lastNote: string;
  } | null>(null);
  const [loopChipState, setLoopChipState] = useState<{ x: number; y: number; startStep: number; endStep: number } | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{ stepIndex: number; noteIndex: number; note: string; x: number; y: number } | null>(null);

  const handleNotePointerDown = (
    stepIndex: number,
    noteIndex: number,
    note: string,
    eventData: NoteEvent,
    rowIndex: number,
    event: React.PointerEvent,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    noteGestureRef.current = {
      kind: 'pending',
      stepIndex,
      noteIndex,
      note,
      rowIndex,
      originalEvent: { ...eventData },
      originX: event.clientX,
      originY: event.clientY,
      shiftKey: event.shiftKey,
      lastNote: note,
    };
    setSelectedStepIndex(stepIndex);
    setSelectedNoteIndex(noteIndex);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !track) return undefined;
    const ENGAGE_THRESHOLD = 4;
    const VELOCITY_RANGE_PX = 90;

    const onMove = (event: PointerEvent) => {
      const g = noteGestureRef.current;
      if (!g) return;
      const dx = event.clientX - g.originX;
      const dy = event.clientY - g.originY;

      if (g.kind === 'pending') {
        const dist = Math.hypot(dx, dy);
        if (dist < ENGAGE_THRESHOLD) return;
        if (g.shiftKey || event.shiftKey) {
          noteGestureRef.current = { ...g, kind: 'velocity' };
        } else if (Math.abs(dy) > Math.abs(dx)) {
          noteGestureRef.current = { ...g, kind: 'pitch' };
        } else {
          noteGestureRef.current = { ...g, kind: 'erase' };
          paintStateRef.current = { mode: 'remove', visited: new Set([`${g.stepIndex}:${g.note}`]) };
          handleGridToggle(g.stepIndex, g.note);
        }
        return;
      }

      if (g.kind === 'pitch') {
        const rowDelta = Math.round(dy / rowHeight);
        const newRowIndex = Math.max(0, Math.min(renderNotes.length - 1, g.rowIndex + rowDelta));
        const targetNote = renderNotes[newRowIndex];
        if (!targetNote || targetNote === g.lastNote) return;
        // Move by updating the note property
        updateStepEvent(track.id, g.stepIndex, g.noteIndex, { note: targetNote });
        noteGestureRef.current = { ...g, lastNote: targetNote };
        return;
      }

      if (g.kind === 'velocity') {
        const delta = -dy / VELOCITY_RANGE_PX;
        const nextVel = Math.max(0.18, Math.min(1, g.originalEvent.velocity + delta));
        updateStepEvent(track.id, g.stepIndex, g.noteIndex, { velocity: nextVel });
        return;
      }
    };

    const onUp = () => {
      const g = noteGestureRef.current;
      if (g && g.kind === 'pending') {
        // No movement — single click on existing note → delete it
        handleGridToggle(g.stepIndex, g.note);
      }
      noteGestureRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, renderNotes, rowHeight]);

  useEffect(() => {
    const node = gridViewportRef.current;
    if (!node) {
      return undefined;
    }

    const syncViewport = () => {
      setGridScrollLeft(node.scrollLeft);
      setGridViewportWidth(node.clientWidth);
    };

    syncViewport();
    node.addEventListener('scroll', syncViewport, { passive: true });
    window.addEventListener('resize', syncViewport);

    return () => {
      node.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, [stepZoom, rowZoom, stepsPerPattern, noteWindow, focusSelectedNote, track?.id]);

  useEffect(() => {
    const node = gridViewportRef.current;
    if (!node) {
      return undefined;
    }

    const handleGridWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.altKey) {
        event.preventDefault();
        const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        updateHorizontalZoom(stepCellWidth + (dominantDelta < 0 ? 8 : -8), event.clientX);
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
  }, [stepCellWidth, updateHorizontalZoom]);

  useEffect(() => {
    if (selectedStepIndex === null || !gridViewportRef.current) {
      return;
    }

    const node = gridViewportRef.current;
    const targetLeft = Math.max(0, (noteLabelWidth + (selectedStepIndex * stepCellWidth)) - Math.max(0, node.clientWidth * 0.35));
    node.scrollTo({ left: targetLeft });
  }, [noteLabelWidth, selectedStepIndex, stepCellWidth]);

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

  const scrubGridOverview = useCallback((clientX: number) => {
    const node = gridViewportRef.current;
    const overview = gridOverviewRef.current;
    if (!node || !overview) {
      return;
    }

    const rect = overview.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const centeredStep = ratio * stepsPerPattern;
    node.scrollLeft = clamp((noteLabelWidth + (centeredStep * stepCellWidth)) - (node.clientWidth * 0.5), 0, maxGridScrollLeft);
  }, [maxGridScrollLeft, noteLabelWidth, stepCellWidth, stepsPerPattern]);

  const bumpSelectedNote = (updates: Partial<NoteEvent>) => {
    if (!selectedNote || normalizedSelectedNoteIndex === null || selectedStepIndex === null) {
      return;
    }

    updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, updates);
  };

  const updateSelectedGate = (nextGate: number) => {
    if (!selectedNote || normalizedSelectedNoteIndex === null || selectedStepIndex === null) {
      return;
    }

    updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, {
      gate: clampNoteGate(nextGate),
    });
  };

  useEffect(() => {
    if (!noteResizeState) {
      return undefined;
    }

    const isStartEdge = noteResizeState.edge === 'start';

    const handlePointerMove = (event: MouseEvent) => {
      const rawDelta = (event.clientX - noteResizeState.startClientX) / stepCellWidth;
      if (!isStartEdge) {
        const snappedStep = event.shiftKey ? NOTE_GATE_FINE_STEP : NOTE_GATE_GRID_STEP;
        const nextGate = snapNoteGate(noteResizeState.initialGate + rawDelta, snappedStep);
        updateStepEvent(track.id, noteResizeState.stepIndex, noteResizeState.noteIndex, {
          gate: nextGate,
        });
        return;
      }
      // Start-edge: integer step delta moves the note's start while keeping the end position fixed
      const stepDelta = Math.round(rawDelta);
      if (stepDelta === 0) return;
      const newStepIndex = noteResizeState.stepIndex + stepDelta;
      if (newStepIndex < 0 || newStepIndex >= stepsPerPattern) return;
      const originalEnd = noteResizeState.stepIndex + noteResizeState.initialGate;
      const newGate = Math.max(NOTE_GATE_MIN, originalEnd - newStepIndex);
      moveNoteToStep(track.id, noteResizeState.stepIndex, noteResizeState.noteIndex, newStepIndex, newGate);
      setNoteResizeState((current) => current ? {
        initialGate: newGate,
        noteIndex: 0,
        startClientX: event.clientX,
        stepIndex: newStepIndex,
        edge: 'start',
      } : null);
    };

    const stopResizing = () => {
      setNoteResizeState(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResizing);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [noteResizeState, stepCellWidth, stepsPerPattern, track.id, updateStepEvent, moveNoteToStep]);

  useEffect(() => {
    if (!selectedNote || normalizedSelectedNoteIndex === null || selectedStepIndex === null) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (
          target.tagName === 'INPUT'
          || target.tagName === 'SELECT'
          || target.tagName === 'TEXTAREA'
          || target.tagName === 'BUTTON'
          || target.isContentEditable
        )
      ) {
        return;
      }

      if (event.key !== '[' && event.key !== ']') {
        return;
      }

      event.preventDefault();
      const direction = event.key === ']' ? 1 : -1;
      const amount = event.altKey
        ? NOTE_GATE_JUMP_STEP
        : event.shiftKey
          ? NOTE_GATE_COARSE_STEP
          : NOTE_GATE_MEDIUM_STEP;
      updateSelectedGate(selectedNote.gate + (direction * amount));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [normalizedSelectedNoteIndex, selectedNote, selectedStepIndex, updateSelectedGate]);

  const closeContextMenu = () => setContextMenuState(null);

  const applyRecordedNotePresetToContext = (preset: RecordedNotePreset) => {
    if (!contextMenuState) {
      return;
    }

    updateStepEvent(track.id, contextMenuState.stepIndex, contextMenuState.noteIndex, { note: preset.note });

    if (preset.presetId) {
      applyTrackVoicePreset(track.id, preset.presetId);
    }

    setTrackSource(track.id, captureSuggestionControlsToTrackSource(preset.controls));
    setTrackParams(track.id, captureSuggestionControlsToTrackParams(preset.controls));
    closeContextMenu();
  };

  const handleNoteContextAction = (action: 'delete' | 'duplicate' | 'octave-up' | 'octave-down') => {
    if (!contextMenuState) return;
    const { stepIndex, noteIndex, note } = contextMenuState;
    const event = patternSteps[stepIndex]?.[noteIndex];
    if (!event) {
      closeContextMenu();
      return;
    }
    if (action === 'delete') {
      toggleStep(track.id, stepIndex, note);
    } else if (action === 'duplicate') {
      const nextStepIndex = Math.min(stepsPerPattern - 1, stepIndex + Math.max(1, Math.floor(event.gate)));
      stampChord(track.id, nextStepIndex, [note], { gate: event.gate, velocity: event.velocity });
    } else if (action === 'octave-up' || action === 'octave-down') {
      const semitones = action === 'octave-up' ? 12 : -12;
      const targetNote = shiftPitch(note, semitones);
      if (targetNote) updateStepEvent(track.id, stepIndex, noteIndex, { note: targetNote });
    }
    closeContextMenu();
  };

  return (
    <section className="surface-panel flex flex-col overflow-x-hidden md:min-h-0 md:flex-1 md:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="section-label whitespace-nowrap">Piano roll</div>
          <div
            className="flex h-7 w-7 items-center justify-center"
            style={{ borderRadius: '2px', border: `1px solid ${track.color}55`, background: `${track.color}1a`, color: track.color }}
            title={getTrackPersonality(track.type).blurb}
          >
            <TrackIcon type={track.type} className="h-3.5 w-3.5" />
          </div>
          <h2
            className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]"
            title={getTrackPersonality(track.type).blurb}
          >
            {track.name}
          </h2>
          <span className="rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: `${track.color}55`, color: track.color }}>
            {track.type}
          </span>
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="font-mono text-[11px]">{String.fromCharCode(65 + currentPattern)}</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              {activeStepCount}st · {totalNoteCount}n{!isDrum && stackedStepCount > 0 ? ` · ${stackedStepCount}stk` : ''}
            </span>
            <span
              className="hidden lg:inline font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              title="Click and drag across cells to paint a series of notes. Drag from an existing note to erase a range."
            >
              · drag to paint
            </span>
          </div>
        </div>

        <button
          aria-expanded={controlsExpanded}
          className="control-chip flex h-8 shrink-0 items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
          data-ui-sound="tab"
          onClick={() => setControlsExpanded((current) => !current)}
          title={controlsExpanded ? 'Hide step, zoom, and edit tools' : 'Step length, zoom, and edit tools'}
          type="button"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{controlsExpanded ? 'Hide tools' : 'Tools'}</span>
          {controlsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {controlsExpanded && (
        <div className="flex w-full flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center">
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="surface-panel-muted flex max-w-full flex-wrap items-center gap-2 p-1">
            <span className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Steps 16-4096</span>
            {STEP_OPTIONS.map((option) => (
              <React.Fragment key={`steps-${option}`}>
                <WindowButton active={stepsPerPattern === option} label={`${option}`} onClick={() => setStepsPerPattern(option)} />
              </React.Fragment>
            ))}
            <WindowButton active={false} label="-1 bar" onClick={() => setStepsPerPattern(Math.max(16, stepsPerPattern - 16))} />
            <WindowButton active={false} label="+1 bar" onClick={() => setStepsPerPattern(Math.min(MAX_STEPS_PER_PATTERN, stepsPerPattern + 16))} />
            <WindowButton active={false} label="+2 bars" onClick={() => setStepsPerPattern(Math.min(MAX_STEPS_PER_PATTERN, stepsPerPattern + 32))} />
            </div>

            {!isDrum && (
              <div className="surface-panel-muted flex max-w-full flex-wrap items-center gap-2 p-1">
                {(Object.keys(NOTE_WINDOWS) as NoteWindowKey[]).map((windowKey) => (
                  <React.Fragment key={windowKey}>
                    <WindowButton active={noteWindow === windowKey} label={windowKey} onClick={() => setNoteWindow(windowKey)} />
                  </React.Fragment>
                ))}
                <WindowButton
                  active={autoFitActiveNotes}
                  label={autoFitActiveNotes ? 'Fit active on' : 'Fit active off'}
                  onClick={() => setAutoFitActiveNotes((current) => !current)}
                />
              </div>
            )}
          </div>

          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="surface-panel-muted flex max-w-full flex-wrap items-center gap-2 p-1">
            {(Object.keys(STEP_ZOOM_PRESETS) as Array<keyof typeof STEP_ZOOM_PRESETS>).filter((zoomKey) => superSonicMode || zoomKey !== 'FAR').map((zoomKey) => (
              <React.Fragment key={`step-${zoomKey}`}>
                <WindowButton active={stepZoom === STEP_ZOOM_PRESETS[zoomKey]} label={`X ${zoomKey}`} onClick={() => updateHorizontalZoom(STEP_ZOOM_PRESETS[zoomKey])} />
              </React.Fragment>
            ))}
              <div className="flex basis-full flex-wrap items-center gap-2 border-t border-[var(--border-soft)]/80 pt-2 sm:ml-1 sm:basis-auto sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Stretch</span>
              <button
                className="control-chip px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => updateHorizontalZoom(stepCellWidth - 8)}
                type="button"
              >
                -
              </button>
              <input
                className="sonic-scroll-strip w-24"
                max={STEP_ZOOM_MAX}
                min={STEP_ZOOM_MIN}
                onChange={(event) => updateHorizontalZoom(Number(event.target.value))}
                step={STEP_ZOOM_STEP}
                type="range"
                value={stepCellWidth}
              />
              <button
                className="control-chip px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => updateHorizontalZoom(stepCellWidth + 8)}
                type="button"
              >
                +
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{stepCellWidth}px</span>
              </div>
              {!isDrum && (
                <div className="flex max-w-full flex-wrap items-center gap-2">
                  {(Object.keys(ROW_ZOOM_PRESETS) as RowZoomKey[]).map((zoomKey) => (
                    <React.Fragment key={`row-${zoomKey}`}>
                      <WindowButton active={rowZoom === zoomKey} label={`Y ${zoomKey}`} onClick={() => setRowZoom(zoomKey)} />
                    </React.Fragment>
                  ))}
                  <WindowButton
                    active={focusSelectedNote}
                    label="Focus note"
                    onClick={() => setFocusSelectedNote((current) => !current)}
                  />
                  {isMobileViewport && (
                    <WindowButton
                      active={mobileInspectorOpen}
                      label={mobileInspectorOpen ? 'Hide inspector' : 'Show inspector'}
                      onClick={() => setMobileInspectorOpen((current) => !current)}
                    />
                  )}
                </div>
              )}
            </div>

            {superSonicMode && superSonicPreferences.guidanceBadges && !isDrum && (
              <div className="surface-panel-muted flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
                Hover ladders on
              </div>
            )}

            <div className="surface-panel-muted flex max-w-full flex-wrap items-center gap-1 p-1">
            <ToolButton label="Shift left" onClick={() => shiftPattern(track.id, 'left')}>
              <ArrowLeftRight className="h-4 w-4 rotate-180" />
            </ToolButton>
            <ToolButton label="Shift right" onClick={() => shiftPattern(track.id, 'right')}>
              <ArrowLeftRight className="h-4 w-4" />
            </ToolButton>
            {!isDrum && (
              <>
                <ToolButton label="Transpose down" onClick={() => transposePattern(track.id, -1)}>
                  <Minus className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Transpose up" onClick={() => transposePattern(track.id, 1)}>
                  <Plus className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Transpose octave down" onClick={() => transposePattern(track.id, -12)}>
                  <span className="font-mono text-[10px]">-8va</span>
                </ToolButton>
                <ToolButton label="Transpose octave up" onClick={() => transposePattern(track.id, 12)}>
                  <span className="font-mono text-[10px]">+8va</span>
                </ToolButton>
              </>
            )}
            <ToolButton label="Vary note volume. Adds a touch of random loudness so the pattern feels less mechanical." onClick={() => humanizePattern(track.id)}>
              <Shuffle className="h-4 w-4" />
            </ToolButton>
            <ToolButton
              label="Save this pattern to the capture shelf as a note string. Drag it onto any other lane to reuse the melody."
              onClick={() => {
                const steps = track.patterns[currentPattern] ?? [];
                const tokens = tokensFromPatternSteps(steps);
                if (tokens.length === 0) return;
                const patternLabel = String.fromCharCode(65 + currentPattern);
                const updated = saveCapturedNoteStringFromTokens({
                  name: `${track.name} ${patternLabel}`,
                  tokens,
                  source: 'typed',
                });
                if (updated && updated[0]) {
                  setQueuedNoteStringId(updated[0].id);
                }
              }}
            >
              <ListPlus className="h-4 w-4" />
            </ToolButton>
            {!isDrum && !liveDetected.uncertain && (
              <ToolButton
                label={`Snap notes outside ${liveDetected.label} to the nearest in-key pitch.`}
                onClick={() => {
                  const steps = track.patterns[currentPattern] ?? [];
                  const snapped = steps.map((step) => (
                    step.map((event) => ({
                      ...event,
                      note: snapNoteToKey(event.note, liveDetected),
                    }))
                  ));
                  applyPatternSegment(track.id, currentPattern, snapped);
                }}
              >
                <span className="font-mono text-[10px]">Snap</span>
              </ToolButton>
            )}
            {!isDrum && (
              <ToolButton label={chordPaletteOpen ? 'Hide chord palette' : 'Show chord palette'} onClick={() => setChordPaletteOpen((current) => !current)}>
                <Music className="h-4 w-4" />
              </ToolButton>
            )}
            <ToolButton label="Clear pattern" onClick={() => clearTrack(track.id)}>
              <Eraser className="h-4 w-4" />
            </ToolButton>
            </div>
          </div>
        </div>
        )}
      </div>

      {chordPaletteOpen && !isDrum && (
        <div className="border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Music className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="section-label">Chord palette</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Key</span>
              <select
                className="control-field h-7 px-2 text-xs"
                disabled={scaleLocked}
                onChange={(event) => setChordKey(event.target.value as KeyName)}
                value={chordKey}
              >
                {KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <div className="surface-panel-muted flex items-center gap-1 p-1">
              <WindowButton active={chordMode === 'major'} label="Major" disabled={scaleLocked} onClick={() => setChordMode('major')} />
              <WindowButton active={chordMode === 'minor'} label="Minor" disabled={scaleLocked} onClick={() => setChordMode('minor')} />
            </div>
            {!liveDetected.uncertain && (
              <button
                aria-label={scaleLocked ? 'Unlock the chord palette key' : 'Lock the chord palette to the detected session key'}
                aria-pressed={scaleLocked}
                className="control-chip h-7 min-h-[1.75rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-active={scaleLocked ? 'true' : 'false'}
                onClick={() => setScaleLocked((current) => !current)}
                title={scaleLocked
                  ? 'Unlock the palette so you can pick a different key.'
                  : `Lock the palette to ${liveDetected.label}. Stamps stay diatonic.`}
                type="button"
              >
                {scaleLocked ? 'Scale locked' : 'Lock to session'}
              </button>
            )}
            {canMatchSession && (
              <button
                aria-label={`Match the chord palette to the detected key ${liveDetected.label}`}
                className="control-chip h-7 min-h-[1.75rem] inline-flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => {
                  setChordKey(liveDetected.rootName as KeyName);
                  setChordMode(liveDetected.mode);
                }}
                title={`Set the palette to ${liveDetected.label}`}
                type="button"
              >
                Match session ({liveDetected.label})
              </button>
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Stamps at {selectedStepIndex !== null ? `step ${selectedStepIndex + 1}` : 'step 1'} · click any chord
            </span>
            {!liveDetected.uncertain && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Tip · Shift+paint snaps new notes to {liveDetected.label}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(chordMode === 'major' ? MAJOR_KEY_TRIADS : MINOR_KEY_TRIADS).map((triad) => (
              <button
                key={triad.numeral}
                className="control-chip flex flex-col items-center gap-0.5 px-3 py-2 text-xs"
                onClick={() => {
                  const targetStep = selectedStepIndex ?? 0;
                  const baseOctave = guessKeyAndOctaveFromTrack(track.type, track.source.octaveShift).octave;
                  const notes = buildChordNotes(chordKey, triad.degree, triad.quality, baseOctave);
                  stampChord(track.id, targetStep, notes, { gate: 2, velocity: 0.7 });
                  setSelectedStepIndex(targetStep);
                }}
                title={`${triad.label} chord`}
                type="button"
              >
                <span className="font-semibold tracking-wide">{triad.numeral}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{triad.quality}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isDrum && hasNotesOutsideWindow && !autoFitActiveNotes && (
        <div className="border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
            <span>Some active notes sit outside this note window, so they can appear in Sequencer but stay off-screen here.</span>
            <button
              className="control-chip px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              onClick={() => setAutoFitActiveNotes(true)}
              type="button"
            >
              Reveal all notes
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 p-4 md:min-h-0 md:flex-1 xl:flex-row xl:items-stretch">
        <div className="flex min-w-0 flex-col md:min-h-[min(80vh,680px)] md:flex-1 md:overflow-hidden">
          <div
            className="sequencer-grid-scroll overflow-auto rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] md:min-h-0 md:flex-1"
            data-scrolled={gridScrollLeft > 1 ? 'true' : undefined}
            ref={gridViewportRef}
          >
          <div className="inline-flex min-w-max flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="sticky top-0 z-10 flex h-10 border-b border-[var(--border-soft)] bg-[var(--bg-panel-strong)] backdrop-blur">
              <div className="grid-freeze-col shrink-0 border-r border-[var(--border-soft)]" style={{ width: `${noteLabelWidth}px` }} />
              {Array.from({ length: stepsPerPattern }, (_, stepIndex) => {
                const noteCount = patternSteps[stepIndex]?.length ?? 0;

                return (
                  <button
                    className={`relative flex items-center justify-center border-r border-[var(--border-soft)] ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.03)]' : ''} ${selectedStepIndex === stepIndex ? 'text-[var(--accent-strong)]' : ''}`}
                    key={stepIndex}
                    onClick={() => selectStep(stepIndex)}
                    style={{ width: `${stepCellWidth}px` }}
                  >
                    <span className="font-mono text-[10px]">{stepIndex + 1}</span>
                    {noteCount > 1 && (
                      <span className="absolute right-1 top-1 rounded-sm bg-[rgba(10,15,21,0.8)] px-1 font-mono text-[8px] text-[var(--accent-strong)]">
                        {noteCount}
                      </span>
                    )}
                    {playbackStep === stepIndex && <div className="absolute inset-x-1 bottom-1 h-[2px] rounded-full bg-[var(--accent-strong)]" />}
                  </button>
                );
              })}
            </div>

            {renderNotes.map((note, rowIndex) => {
              const isBlackKey = note.includes('#');
              const rowPc = isDrum ? null : rowPitchClassFromName(note);
              const isInKey = inKeyPitchClasses !== null && rowPc !== null && inKeyPitchClasses.has(rowPc);

              return (
                <div className="flex border-b border-[var(--border-soft)]/80 last:border-b-0" key={note} style={{ height: `${rowHeight}px` }}>
                  <div
                    className={`grid-freeze-col flex shrink-0 items-center justify-between border-r border-[var(--border-soft)] px-3 font-mono text-[10px] ${isBlackKey ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}
                    style={{
                      width: `${noteLabelWidth}px`,
                      backgroundImage: `linear-gradient(rgba(255,255,255,${isBlackKey ? '0.02' : '0.05'}),rgba(255,255,255,${isBlackKey ? '0.02' : '0.05'}))`,
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      {isInKey && (
                        <span
                          aria-hidden="true"
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]"
                          title={`In ${liveDetected.label}`}
                        />
                      )}
                      <span>{isDrum ? 'HIT' : note}</span>
                    </span>
                    {!isDrum && note.startsWith('C') && (
                      <span className="text-[9px] text-[var(--text-tertiary)]">oct</span>
                    )}
                  </div>

                  {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => {
                    const step = patternSteps[stepIndex] ?? [];
                    const noteIndex = step.findIndex((event) => event.note === note);
                    const activeEvent = noteIndex >= 0 ? step[noteIndex] : null;
                    const isCurrent = playbackStep === stepIndex;
                    const isSelected = selectedStepIndex === stepIndex;

                    return (
                      <button
                        className={`group relative border-r border-[var(--border-soft)] transition-colors touch-none ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.02)]' : ''} ${isSelected ? 'ring-1 ring-inset ring-[rgba(124,211,252,0.22)]' : ''} hover:bg-[rgba(255,255,255,0.04)]`}
                        key={`${note}-${stepIndex}`}
                        onPointerDown={(event) => handleCellPointerDown(stepIndex, note, !!activeEvent, event)}
                        onPointerEnter={() => {
                          setSupersonicHoverCell({ note, stepIndex });
                          handleCellPointerEnter(stepIndex, note, !!activeEvent);
                        }}
                        onPointerLeave={() => {
                          setSupersonicHoverCell((current) => (
                            current?.note === note && current.stepIndex === stepIndex ? null : current
                          ));
                        }}
                        style={{ width: `${stepCellWidth}px`, touchAction: 'none' }}
                        type="button"
                      >
                        {!activeEvent && (
                          <>
                            {!superSonicMode && (
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-y-[3px] left-[3px] rounded-md opacity-0 transition-opacity group-hover:opacity-30"
                                style={{
                                  background: track.color,
                                  width: `${Math.max(10, stepCellWidth - 6)}px`,
                                }}
                              />
                            )}
                            {superSonicMode && !isDrum && supersonicHoverCell?.note === note && supersonicHoverCell.stepIndex === stepIndex && (
                              <span className="supersonic-ladder absolute inset-0 z-[2]" style={{ '--supersonic-ladder-count': String(SUPERSONIC_NOTE_OFFSETS.length) } as React.CSSProperties}>
                                {SUPERSONIC_NOTE_OFFSETS.map((offset) => {
                                  const targetNote = shiftPitch(note, offset);
                                  if (!targetNote) {
                                    return <span className="supersonic-ladder-step" key={`${note}-${stepIndex}-${offset}`} style={{ '--ladder-color': track.color, '--ladder-fill': '0.24' } as React.CSSProperties} />;
                                  }

                                  return (
                                    <span
                                      className="supersonic-ladder-step"
                                      data-center={offset === 0 ? 'true' : 'false'}
                                      key={`${note}-${stepIndex}-${offset}`}
                                      onPointerDown={(event) => handleSuperSonicPointerDown(stepIndex, note, offset, event)}
                                      style={{
                                        '--ladder-color': track.color,
                                        '--ladder-fill': `${Math.max(0.38, 0.94 - (Math.abs(offset) * 0.08))}`,
                                        '--ladder-glow': offset === 0 ? 'rgba(255,255,255,0.88)' : `${track.color}88`,
                                      }}
                                      title={`Place ${targetNote}`}
                                    />
                                  );
                                })}
                              </span>
                            )}
                          </>
                        )}
                        {activeEvent && (
                          <>
                            <span
                              className="absolute inset-y-[3px] left-[3px] cursor-grab rounded-md"
                              onContextMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setContextMenuState({ stepIndex, noteIndex, note, x: event.clientX, y: event.clientY });
                              }}
                              onPointerDown={(event) => handleNotePointerDown(stepIndex, noteIndex, note, activeEvent, rowIndex, event)}
                              style={{
                                background: track.color,
                                boxShadow: isCurrent
                                  ? `inset 0 0 0 1px rgba(255,255,255,0.74), 0 0 0 1px rgba(15, 23, 42, 0.14), 0 0 18px ${track.color}40`
                                  : 'inset 0 0 0 1px rgba(15, 23, 42, 0.16)',
                                opacity: isCurrent ? 1 : 0.9,
                                width: `${Math.max(10, Math.min((stepCellWidth * NOTE_GATE_MAX) - 6, (activeEvent.gate * stepCellWidth) - 6))}px`,
                                touchAction: 'none',
                              }}
                              title="Drag up or down to change pitch. Shift+drag to change velocity. Right-click for options."
                            />
                            <span
                              className="absolute inset-y-[3px] z-[2] cursor-ew-resize rounded-l-md border-r border-white/20 bg-[rgba(10,15,21,0.32)] transition-colors hover:bg-[rgba(10,15,21,0.55)]"
                              onPointerDown={(event) => { event.stopPropagation(); }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setSelectedStepIndex(stepIndex);
                                setSelectedNoteIndex(noteIndex);
                                setNoteResizeState({
                                  initialGate: activeEvent.gate,
                                  noteIndex,
                                  startClientX: event.clientX,
                                  stepIndex,
                                  edge: 'start',
                                });
                              }}
                              style={{ left: '3px', width: '8px' }}
                              title="Drag to shift the note's start"
                            />
                            <span
                              className="absolute inset-y-[3px] z-[2] cursor-ew-resize rounded-r-md border-l border-white/20 bg-[rgba(10,15,21,0.38)] transition-colors hover:bg-[rgba(10,15,21,0.58)]"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setSelectedStepIndex(stepIndex);
                                setSelectedNoteIndex(noteIndex);
                                setNoteResizeState({
                                  initialGate: activeEvent.gate,
                                  noteIndex,
                                  startClientX: event.clientX,
                                  stepIndex,
                                  edge: 'end',
                                });
                              }}
                              style={{
                                left: `${Math.max(10, Math.min((stepCellWidth * NOTE_GATE_MAX) - 14, (activeEvent.gate * stepCellWidth) - 14))}px`,
                                width: '10px',
                              }}
                              title="Drag to change note length"
                            />
                            <span
                              className="absolute bottom-1 right-1 rounded-full bg-black/25"
                              style={{
                                height: `${Math.max(3, Math.min(14, activeEvent.velocity * 14))}px`,
                                width: '4px',
                              }}
                            />
                            {(isSelected || noteResizeState?.stepIndex === stepIndex && noteResizeState?.noteIndex === noteIndex) && (
                              <span className="absolute bottom-1 left-1 rounded-sm bg-[rgba(10,15,21,0.76)] px-1 font-mono text-[8px] text-[var(--accent-strong)]">
                                {activeEvent.gate.toFixed(2)}x
                              </span>
                            )}
                          </>
                        )}
                        {step.length > 1 && (
                          <span className="absolute left-1 top-1 rounded-sm bg-black/20 px-1 font-mono text-[8px] text-white/80">
                            {step.length}
                          </span>
                        )}
                        {isCurrent && <span className="absolute inset-y-1 left-1 w-[2px] rounded-full bg-white/35" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          </div>
          <div className="mt-3 shrink-0 rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Step overview
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  View {visibleStepStart + 1} to {Math.max(visibleStepStart + 1, visibleStepEnd)} of {stepsPerPattern}
                </div>
              </div>
              <div
                className="mt-3 relative h-16 overflow-hidden rounded-[3px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.34)] touch-none"
                onPointerCancel={(event) => {
                  try {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                  } catch {
                    /* ignore */
                  }
                  gridOverviewDragRef.current = false;
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  gridOverviewDragRef.current = true;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  scrubGridOverview(event.clientX);
                }}
                onPointerMove={(event) => {
                  if (!gridOverviewDragRef.current) {
                    return;
                  }
                  scrubGridOverview(event.clientX);
                }}
                onPointerUp={(event) => {
                  try {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                  } catch {
                    /* ignore */
                  }
                  gridOverviewDragRef.current = false;
                }}
                ref={gridOverviewRef}
              >
                <div className="absolute inset-0 flex items-end gap-px px-1 py-1">
                  {patternSteps.map((step, stepIndex) => {
                    const density = step.length / maxNotesPerStep;
                    const hasNotes = step.length > 0;
                    return (
                      <div className="relative flex-1 self-stretch" key={`overview-${stepIndex}`}>
                        <div
                          className={`absolute inset-x-0 bottom-0 rounded-[1px] ${hasNotes ? '' : 'opacity-30'}`}
                          style={{
                            background: hasNotes ? track.color : 'rgba(255,255,255,0.08)',
                            height: `${Math.max(12, density * 100)}%`,
                            opacity: hasNotes ? 0.75 : 1,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="pointer-events-none absolute bottom-1 top-1 rounded-[3px] border border-[rgba(114,217,255,0.34)] bg-[rgba(114,217,255,0.1)]"
                  style={{
                    left: `${(visibleStepStart / stepsPerPattern) * 100}%`,
                    width: `${Math.max(6, ((visibleStepEnd - visibleStepStart) / stepsPerPattern) * 100)}%`,
                  }}
                />
                <div
                  className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-[rgba(255,255,255,0.42)]"
                  style={{ left: `${(playbackStep / stepsPerPattern) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
                Drag the overview to move around the pattern without changing your zoom.
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                Detailed timing window
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
                  step={stepCellWidth}
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
              </div>
            </div>
            <div className="mt-3 text-[11px] leading-5 text-[var(--text-tertiary)]">
              Hold <span className="font-mono">Alt</span> while scrolling, or pinch on a trackpad, to zoom the grid around where you are working.
            </div>
          </div>
        </div>

        {(!isMobileViewport || mobileInspectorOpen) && (
        <aside className="surface-panel-strong sonic-sidebar w-full shrink-0 overflow-auto p-4 xl:w-[320px]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Step inspector</span>
          </div>

          {selectedStepIndex !== null ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="section-label">Selected step</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-[var(--text-primary)]">Step {selectedStepIndex + 1}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {selectedStep.length} note{selectedStep.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {selectedNote ? `${selectedNote.note} · velocity ${Math.round(selectedNote.velocity * 100)} · gate ${selectedNote.gate.toFixed(2)}` : 'No note on this step yet'}
                </div>
              </div>

              {selectedStep.length > 0 && (
                <div>
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-[var(--accent)]" />
                    <span className="section-label">Note stack</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {selectedStep.map((event, noteIndex) => (
                      <button
                        className={`flex items-center justify-between rounded-[3px] border px-3 py-3 text-left transition-colors ${normalizedSelectedNoteIndex === noteIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]'}`}
                        key={`${event.note}-${noteIndex}`}
                        onClick={() => setSelectedNoteIndex(noteIndex)}
                      >
                        <div>
                          <div className="font-mono text-[12px]">{event.note}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                            Vel {Math.round(event.velocity * 100)} · Gate {event.gate.toFixed(2)}
                          </div>
                        </div>
                        <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em]">
                          {noteIndex + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                  {!isDrum && selectedNote && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                        onClick={() => {
                          const octaveNote = shiftNote(selectedNote.note, 12);
                          const previewStep = patternSteps[selectedStepIndex] ?? [];
                          const noteExists = previewStep.some((event) => event.note === octaveNote);
                          setSelectedNoteIndex(noteExists ? Math.max(0, previewStep.findIndex((event) => event.note === octaveNote) - 1) : sortStepNotes([
                            ...previewStep,
                            createPreviewEvent(octaveNote, selectedNote),
                          ]).findIndex((event) => event.note === octaveNote));
                          toggleStep(track.id, selectedStepIndex, octaveNote);
                        }}
                      >
                        Add +8va
                      </button>
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                        onClick={() => {
                          const octaveNote = shiftNote(selectedNote.note, -12);
                          const previewStep = patternSteps[selectedStepIndex] ?? [];
                          const noteExists = previewStep.some((event) => event.note === octaveNote);
                          setSelectedNoteIndex(noteExists ? Math.max(0, previewStep.findIndex((event) => event.note === octaveNote) - 1) : sortStepNotes([
                            ...previewStep,
                            createPreviewEvent(octaveNote, selectedNote),
                          ]).findIndex((event) => event.note === octaveNote));
                          toggleStep(track.id, selectedStepIndex, octaveNote);
                        }}
                      >
                        Add -8va
                      </button>
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em]"
                        onClick={() => {
                          const fifthNote = shiftNote(selectedNote.note, 7);
                          const previewStep = patternSteps[selectedStepIndex] ?? [];
                          const noteExists = previewStep.some((event) => event.note === fifthNote);
                          setSelectedNoteIndex(noteExists ? Math.max(0, previewStep.findIndex((event) => event.note === fifthNote) - 1) : sortStepNotes([
                            ...previewStep,
                            createPreviewEvent(fifthNote, selectedNote),
                          ]).findIndex((event) => event.note === fifthNote));
                          toggleStep(track.id, selectedStepIndex, fifthNote);
                        }}
                      >
                        Add fifth
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isDrum && (
                <div>
                  <div className="section-label">Pitch</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, -1) })}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <select
                      className="control-field h-10 flex-1 px-3 text-sm"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onChange={(event) => normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: event.target.value })}
                      value={selectedNote?.note ?? ''}
                    >
                      {!selectedNote && <option value="">Place a note first</option>}
                      {ALL_NOTES.map((note) => (
                        <option key={note} value={note}>
                          {note}
                        </option>
                      ))}
                    </select>
                    <button
                      className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, 1) })}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="control-chip h-9 px-3 text-[10px] font-medium uppercase tracking-[0.14em]"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, -12) })}
                    >
                      -8va
                    </button>
                    <button
                      className="control-chip h-9 px-3 text-[10px] font-medium uppercase tracking-[0.14em]"
                      disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                      onClick={() => selectedNote && normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { note: shiftNote(selectedNote.note, 12) })}
                    >
                      +8va
                    </button>
                    <button
                      className="control-chip ml-auto flex h-9 items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--danger)]"
                      disabled={!selectedNote}
                      onClick={() => {
                        if (!selectedNote) {
                          return;
                        }

                        const remainingLength = selectedStep.length - 1;
                        setSelectedNoteIndex(remainingLength > 0 ? Math.max(0, (normalizedSelectedNoteIndex ?? 0) - 1) : null);
                        toggleStep(track.id, selectedStepIndex, selectedNote.note);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {!isDrum && selectedNote && (
                <div>
                  <div className="section-label">Fine edit</div>
                  <div className="mt-3 grid gap-3">
                    <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span className="section-label">Semitone nudges</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{selectedNote.note}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <WindowButton label="-2" active={false} onClick={() => bumpSelectedNote({ note: shiftNote(selectedNote.note, -2) })} />
                        <WindowButton label="-1" active={false} onClick={() => bumpSelectedNote({ note: shiftNote(selectedNote.note, -1) })} />
                        <WindowButton label="+1" active={false} onClick={() => bumpSelectedNote({ note: shiftNote(selectedNote.note, 1) })} />
                        <WindowButton label="+2" active={false} onClick={() => bumpSelectedNote({ note: shiftNote(selectedNote.note, 2) })} />
                      </div>
                    </div>
                    <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span className="section-label">Velocity nudges</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{Math.round(selectedNote.velocity * 100)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <WindowButton label="-1" active={false} onClick={() => bumpSelectedNote({ velocity: clampNumber(selectedNote.velocity - 0.01, 0.1, 1) })} />
                        <WindowButton label="-5" active={false} onClick={() => bumpSelectedNote({ velocity: clampNumber(selectedNote.velocity - 0.05, 0.1, 1) })} />
                        <WindowButton label="+1" active={false} onClick={() => bumpSelectedNote({ velocity: clampNumber(selectedNote.velocity + 0.01, 0.1, 1) })} />
                        <WindowButton label="+5" active={false} onClick={() => bumpSelectedNote({ velocity: clampNumber(selectedNote.velocity + 0.05, 0.1, 1) })} />
                      </div>
                    </div>
                    <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span className="section-label">Gate nudges</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{selectedNote.gate.toFixed(2)}</span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {GATE_ADJUSTMENT_GROUPS.map((group) => (
                          <div className="flex items-center justify-between gap-3" key={group.label}>
                            <span className="section-label text-[10px] text-[var(--text-tertiary)]">{group.label}</span>
                            <div className="flex flex-wrap justify-end gap-2">
                              {group.steps.map((step) => (
                                <React.Fragment key={step.label}>
                                  <WindowButton
                                    active={false}
                                    label={step.label}
                                    onClick={() => updateSelectedGate(selectedNote.gate + step.value)}
                                  />
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {NOTE_GATE_PRESETS.map((preset) => (
                          <React.Fragment key={preset}>
                            <WindowButton
                              active={Math.abs(selectedNote.gate - preset) < NOTE_GATE_FINE_STEP}
                              label={`${preset}x`}
                              onClick={() => updateSelectedGate(preset)}
                            />
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Velocity</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {selectedNote ? Math.round(selectedNote.velocity * 100) : 82}
                  </span>
                </div>
                <input
                  className="mt-3"
                  disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                  max="1"
                  min="0.1"
                  onChange={(event) => normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { velocity: Number(event.target.value) })}
                  step="0.01"
                  type="range"
                  value={selectedNote?.velocity ?? 0.82}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="section-label">Gate</span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {selectedNote ? selectedNote.gate.toFixed(2) : '1.00'}
                  </span>
                </div>
                <input
                  className="mt-3"
                  disabled={!selectedNote || normalizedSelectedNoteIndex === null}
                  max={NOTE_GATE_MAX}
                  min={NOTE_GATE_MIN}
                  onChange={(event) => normalizedSelectedNoteIndex !== null && updateStepEvent(track.id, selectedStepIndex, normalizedSelectedNoteIndex, { gate: clampNoteGate(Number(event.target.value)) })}
                  step={NOTE_GATE_FINE_STEP}
                  type="range"
                  value={selectedNote?.gate ?? 1}
                />
                <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                  Drag the right edge of any note block to resize it directly. Hold Shift while dragging for finer steps. Use [ and ] for quick gate nudges.
                </div>
              </div>

              {!selectedNote && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Click any note cell to place a note. Stacking more notes in the same column now builds chords and octave layers directly inside the pattern.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Choose a step to edit its performance details.</p>
          )}
        </aside>
        )}
      </div>
      {contextMenuState && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={closeContextMenu} onContextMenu={(event) => { event.preventDefault(); closeContextMenu(); }} />
          <div
            className="surface-panel-strong fixed z-[61] min-w-[180px] p-1 shadow-[0_16px_32px_rgba(0,0,0,0.4)]"
            role="menu"
            style={{ left: Math.min(contextMenuState.x, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 200), top: Math.min(contextMenuState.y, (typeof window !== 'undefined' ? window.innerHeight : 700) - 180) }}
          >
            <div className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              {contextMenuState.note}
            </div>
            <ContextMenuItem onClick={() => handleNoteContextAction('octave-up')}>Octave up</ContextMenuItem>
            <ContextMenuItem onClick={() => handleNoteContextAction('octave-down')}>Octave down</ContextMenuItem>
            <ContextMenuItem onClick={() => handleNoteContextAction('duplicate')}>Duplicate</ContextMenuItem>
            {recordedNoteLibrary.length > 0 && (
              <>
                <div className="my-1 border-t border-[var(--border-soft)]" />
                <div className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Saved captures
                </div>
                {recordedNoteLibrary.slice(0, 5).map((preset) => (
                  <React.Fragment key={preset.id}>
                    <ContextMenuItem onClick={() => applyRecordedNotePresetToContext(preset)}>
                      <span>{preset.name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{preset.note}</span>
                    </ContextMenuItem>
                  </React.Fragment>
                ))}
              </>
            )}
            <div className="my-1 border-t border-[var(--border-soft)]" />
            <ContextMenuItem danger onClick={() => handleNoteContextAction('delete')}>Delete note</ContextMenuItem>
          </div>
        </>
      )}
      {loopChipState && (
        <button
          className="fixed z-[55] control-chip flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] shadow-[0_8px_18px_rgba(0,0,0,0.4)]"
          data-active="true"
          onClick={() => {
            setLoopRange(loopChipState.startStep, loopChipState.endStep + 1);
            setLoopChipState(null);
          }}
          style={{ left: loopChipState.x, top: loopChipState.y }}
          type="button"
        >
          Loop this
        </button>
      )}
    </section>
  );
};

const ContextMenuItem = ({ children, danger = false, onClick }: { children: React.ReactNode; danger?: boolean; onClick: () => void }) => (
  <button
    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${danger ? 'text-[var(--danger)] hover:bg-[rgba(255,156,138,0.08)]' : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]'}`}
    onClick={onClick}
    role="menuitem"
    type="button"
  >
    {children}
  </button>
);

const ToolButton = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    aria-label={label}
    className="ghost-icon-button flex h-9 min-w-9 items-center justify-center px-3"
    onClick={onClick}
    title={label}
  >
    {children}
  </button>
);

const WindowButton = ({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="rounded-sm border h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    onClick={onClick}
    style={active
      ? {
          background: 'rgba(124, 211, 252, 0.14)',
          borderColor: 'rgba(124, 211, 252, 0.28)',
          color: '#d9f2ff',
        }
      : {
          background: 'rgba(255,255,255,0.02)',
          borderColor: 'var(--border-soft)',
          color: 'var(--text-secondary)',
        }}
  >
    {label}
  </button>
);

function buildNoteRange(highOctave: number, lowOctave: number) {
  const notes: string[] = [];

  for (let octave = highOctave; octave >= lowOctave; octave -= 1) {
    for (let noteIndex = NOTE_NAMES.length - 1; noteIndex >= 0; noteIndex -= 1) {
      notes.push(`${NOTE_NAMES[noteIndex]}${octave}`);
    }
  }

  return notes;
}

function shiftNote(note: string, semitones: number) {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return note;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return note;
  }

  const midi = (Number(match[2]) + 1) * 12 + pitchClass + semitones;
  const clampedMidi = Math.max(24, Math.min(96, midi));
  const nextPitch = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${nextPitch}${octave}`;
}

function noteToMidi(note: string) {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
}

function sortStepNotes(step: NoteEvent[]) {
  return [...step].sort((left, right) => (noteToMidi(right.note) ?? 0) - (noteToMidi(left.note) ?? 0));
}

function createPreviewEvent(note: string, template?: NoteEvent) {
  return {
    gate: template?.gate ?? 1,
    note,
    velocity: template?.velocity ?? 0.82,
  };
}

function buildFocusedNoteRange(centerNote: string, radius: number) {
  const centerMidi = noteToMidi(centerNote);
  if (centerMidi === null) {
    return NOTE_WINDOWS.MID;
  }

  const notes: string[] = [];
  for (let offset = radius; offset >= -radius; offset -= 1) {
    const nextNote = midiToNote(centerMidi + offset);
    if (nextNote) {
      notes.push(nextNote);
    }
  }
  return notes;
}

function buildAdaptiveNoteRange(minMidi: number, maxMidi: number, padding: number) {
  const clampedMin = Math.max(24, minMidi - padding);
  const clampedMax = Math.min(96, maxMidi + padding);
  const maxVisibleSpan = 42;
  const center = Math.round((clampedMin + clampedMax) / 2);
  const halfSpan = Math.floor(maxVisibleSpan / 2);
  const rangedMin = clampedMax - clampedMin > maxVisibleSpan
    ? Math.max(24, center - halfSpan)
    : clampedMin;
  const rangedMax = clampedMax - clampedMin > maxVisibleSpan
    ? Math.min(96, center + halfSpan)
    : clampedMax;
  const notes: string[] = [];

  for (let midi = rangedMax; midi >= rangedMin; midi -= 1) {
    notes.push(midiToNote(midi));
  }

  return notes;
}

function midiToNote(midi: number) {
  const clampedMidi = Math.max(24, Math.min(96, Math.round(midi)));
  const pitchClass = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${pitchClass}${octave}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
