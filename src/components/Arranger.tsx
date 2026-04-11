import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Braces,
  Copy,
  Eraser,
  Layers3,
  Minus,
  MoveHorizontal,
  PencilLine,
  Plus,
  Scissors,
  Trash2,
  Wand2,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { defaultNoteForTrack, type ArrangementClip, type NoteEvent, type Track } from '../project/schema';

const CLIP_SNAP = 4;
const MIN_CLIP_LENGTH = CLIP_SNAP;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DRAG_HANDLE_WIDTH = 8;

type DragMode = 'move' | 'trim-start' | 'trim-end';
type ZoomPreset = 'PHRASE' | 'SECTION' | 'SONG';
type PaintMode = 'add' | 'remove';

interface DragState {
  clipId: string;
  mode: DragMode;
  originX: number;
  previewBeatLength: number;
  previewStartBeat: number;
  sourceBeatLength: number;
  sourceStartBeat: number;
}

interface PaintState {
  mode: PaintMode;
  note: string;
}

const ZOOM_PIXELS_PER_STEP: Record<ZoomPreset, number> = {
  PHRASE: 30,
  SECTION: 18,
  SONG: 10,
};

const DRUM_ROW_LABELS: Record<Track['type'], string> = {
  bass: 'Bass',
  fx: 'FX',
  hihat: 'Hat',
  kick: 'Kick',
  lead: 'Lead',
  pad: 'Pad',
  pluck: 'Pluck',
  snare: 'Snare',
};

const snapStepDelta = (offsetPx: number, pixelsPerStep: number) => (
  Math.round(offsetPx / pixelsPerStep / CLIP_SNAP) * CLIP_SNAP
);

const isDrumTrack = (track: Track) => (
  track.type === 'kick' || track.type === 'snare' || track.type === 'hihat'
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
  const clampedMidi = Math.max(24, Math.min(96, Math.round(midi)));
  const pitchClass = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${pitchClass}${octave}`;
};

const shiftNote = (note: string, semitones: number) => {
  const midi = noteToMidi(note);
  if (midi === null) {
    return note;
  }

  return midiToNote(midi + semitones);
};

const buildComposerRows = (track: Track, focusNote: string | null) => {
  const rootMidi = noteToMidi(focusNote ?? defaultNoteForTrack(track)) ?? noteToMidi(defaultNoteForTrack(track)) ?? 60;
  return Array.from({ length: 12 }, (_, index) => midiToNote(rootMidi + 7 - index));
};

const getComposerStepCount = (clip: ArrangementClip | null, stepsPerPattern: number) => {
  if (!clip) {
    return Math.min(stepsPerPattern, 16);
  }

  if (clip.beatLength > 16 || stepsPerPattern > 16) {
    return Math.min(stepsPerPattern, 32);
  }

  return Math.min(stepsPerPattern, 16);
};

const formatBars = (steps: number) => Math.max(1, Math.ceil(steps / 16));

const getVisibleRangeLabel = (startStep: number, endStep: number) => (
  `${startStep + 1} to ${Math.max(startStep + 1, endStep)}`
);

export const Arranger = () => {
  const {
    addArrangerClip,
    arrangerClips,
    bpm,
    currentStep,
    duplicateArrangerClip,
    loopArrangerClip,
    makeClipPatternUnique,
    patternCount,
    removeArrangerClip,
    selectedArrangerClipId,
    selectedTrackId,
    setActiveView,
    setCurrentPattern,
    setSelectedArrangerClipId,
    setSelectedTrackId,
    songLengthInBeats,
    splitArrangerClip,
    stepsPerPattern,
    toggleClipPatternStep,
    tracks,
    transformClipPattern,
    transportMode,
    updateArrangerClip,
    updateClipPatternAutomationStep,
    updateClipPatternStepEvent,
  } = useAudio();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [paintState, setPaintState] = useState<PaintState | null>(null);
  const [selectedPhraseStepIndex, setSelectedPhraseStepIndex] = useState(0);
  const [selectedPhraseNoteIndex, setSelectedPhraseNoteIndex] = useState<number | null>(null);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('SECTION');
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const pixelsPerStep = ZOOM_PIXELS_PER_STEP[zoomPreset];

  const selectedClip = arrangerClips.find((clip) => clip.id === selectedArrangerClipId) ?? null;
  const selectedClipTrack = tracks.find((track) => track.id === selectedClip?.trackId) ?? null;
  const linkedPhraseCount = selectedClip
    ? arrangerClips.filter((clip) => (
        clip.trackId === selectedClip.trackId
        && clip.patternIndex === selectedClip.patternIndex
      )).length
    : 0;
  const selectedClipPattern = selectedClip && selectedClipTrack
    ? selectedClipTrack.patterns[selectedClip.patternIndex] ?? Array.from({ length: stepsPerPattern }, () => [])
    : [];
  const selectedClipAutomation = selectedClip && selectedClipTrack
    ? selectedClipTrack.automation[selectedClip.patternIndex] ?? {
        level: Array.from({ length: stepsPerPattern }, () => 0.5),
        tone: Array.from({ length: stepsPerPattern }, () => 0.5),
      }
    : {
        level: Array.from({ length: stepsPerPattern }, () => 0.5),
        tone: Array.from({ length: stepsPerPattern }, () => 0.5),
      };
  const selectedPhraseStep = selectedClipPattern[selectedPhraseStepIndex] ?? [];
  const normalizedSelectedPhraseNoteIndex = selectedPhraseNoteIndex !== null && selectedPhraseStep[selectedPhraseNoteIndex]
    ? selectedPhraseNoteIndex
    : selectedPhraseStep.length > 0 ? 0 : null;
  const selectedPhraseNote = normalizedSelectedPhraseNoteIndex !== null
    ? selectedPhraseStep[normalizedSelectedPhraseNoteIndex]
    : null;
  const composerStepCount = getComposerStepCount(selectedClip, stepsPerPattern);
  const composerSteps = selectedClipPattern.slice(0, composerStepCount);
  const phraseRows = useMemo(() => (
    selectedClipTrack && !isDrumTrack(selectedClipTrack)
      ? buildComposerRows(selectedClipTrack, selectedPhraseNote?.note ?? selectedPhraseStep[0]?.note ?? null)
      : []
  ), [selectedClipTrack, selectedPhraseNote?.note, selectedPhraseStep]);
  const timelineSteps = Math.max(songLengthInBeats, 32);
  const timelineWidth = timelineSteps * pixelsPerStep;
  const totalBars = formatBars(timelineSteps);
  const totalDurationSeconds = songLengthInBeats * (60 / bpm) * 0.25;
  const visibleStartStep = Math.floor(scrollLeft / pixelsPerStep);
  const visibleEndStep = Math.ceil((scrollLeft + viewportWidth) / pixelsPerStep);
  const selectedPhraseActiveSteps = selectedClipPattern.filter((step) => step.length > 0).length;
  const selectedPhraseNoteCount = selectedClipPattern.reduce((sum, step) => sum + step.length, 0);
  const selectedAutomationLevel = selectedClipAutomation.level[selectedPhraseStepIndex] ?? 0.5;
  const selectedAutomationTone = selectedClipAutomation.tone[selectedPhraseStepIndex] ?? 0.5;

  const laneData = useMemo(() => (
    tracks.map((track) => ({
      clips: arrangerClips.filter((clip) => clip.trackId === track.id),
      track,
    }))
  ), [arrangerClips, tracks]);

  useEffect(() => {
    if (selectedArrangerClipId && arrangerClips.some((clip) => clip.id === selectedArrangerClipId)) {
      return;
    }

    setSelectedArrangerClipId(arrangerClips[0]?.id ?? null);
  }, [arrangerClips, selectedArrangerClipId, setSelectedArrangerClipId]);

  useEffect(() => {
    setSelectedPhraseStepIndex(0);
    setSelectedPhraseNoteIndex(null);
  }, [selectedArrangerClipId]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const stepDelta = snapStepDelta(event.clientX - dragState.originX, pixelsPerStep);

      if (dragState.mode === 'move') {
        setDragState((current) => current ? {
          ...current,
          previewStartBeat: Math.max(0, dragState.sourceStartBeat + stepDelta),
        } : current);
        return;
      }

      if (dragState.mode === 'trim-end') {
        setDragState((current) => current ? {
          ...current,
          previewBeatLength: Math.max(MIN_CLIP_LENGTH, dragState.sourceBeatLength + stepDelta),
        } : current);
        return;
      }

      const requestedStart = Math.max(0, dragState.sourceStartBeat + stepDelta);
      const maxStartBeat = dragState.sourceStartBeat + dragState.sourceBeatLength - MIN_CLIP_LENGTH;
      const nextStartBeat = Math.min(requestedStart, maxStartBeat);

      setDragState((current) => current ? {
        ...current,
        previewBeatLength: dragState.sourceBeatLength - (nextStartBeat - dragState.sourceStartBeat),
        previewStartBeat: nextStartBeat,
      } : current);
    };

    const handlePointerUp = () => {
      const clip = arrangerClips.find((candidate) => candidate.id === dragState.clipId);
      if (clip) {
        const updates: Partial<ArrangementClip> = {};

        if (dragState.previewStartBeat !== dragState.sourceStartBeat) {
          updates.startBeat = dragState.previewStartBeat;
        }

        if (dragState.previewBeatLength !== dragState.sourceBeatLength) {
          updates.beatLength = dragState.previewBeatLength;
        }

        if (Object.keys(updates).length > 0) {
          updateArrangerClip(clip.id, updates);
        }
      }

      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [arrangerClips, dragState, pixelsPerStep, updateArrangerClip]);

  useEffect(() => {
    if (!paintState) {
      return undefined;
    }

    const clearPaint = () => setPaintState(null);
    window.addEventListener('pointerup', clearPaint, { once: true });

    return () => {
      window.removeEventListener('pointerup', clearPaint);
    };
  }, [paintState]);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node) {
      return undefined;
    }

    const updateViewport = () => {
      setViewportWidth(node.clientWidth);
      setScrollLeft(node.scrollLeft);
    };

    updateViewport();
    node.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport);

    return () => {
      node.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [zoomPreset]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      )) {
        return;
      }

      if (!selectedClip) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'd' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        duplicateArrangerClip(selectedClip.id);
        return;
      }

      if (key === 'u' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        makeClipPatternUnique(selectedClip.id);
        return;
      }

      if (key === 'backspace' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        removeArrangerClip(selectedClip.id);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        updateArrangerClip(selectedClip.id, { startBeat: Math.max(0, selectedClip.startBeat - CLIP_SNAP) });
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        updateArrangerClip(selectedClip.id, { startBeat: selectedClip.startBeat + CLIP_SNAP });
        return;
      }

      if (event.key === '[') {
        event.preventDefault();
        transformClipPattern(selectedClip.id, 'transpose', -1);
        return;
      }

      if (event.key === ']') {
        event.preventDefault();
        transformClipPattern(selectedClip.id, 'transpose', 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [duplicateArrangerClip, makeClipPatternUnique, removeArrangerClip, selectedClip, transformClipPattern, updateArrangerClip]);

  const selectClip = (clipId: string) => {
    const clip = arrangerClips.find((candidate) => candidate.id === clipId);
    if (!clip) {
      return;
    }

    setSelectedArrangerClipId(clip.id);
    setSelectedTrackId(clip.trackId);
    setCurrentPattern(clip.patternIndex);
  };

  const beginClipDrag = (clip: ArrangementClip, event: React.PointerEvent<HTMLDivElement>, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    selectClip(clip.id);
    setDragState({
      clipId: clip.id,
      mode,
      originX: event.clientX,
      previewBeatLength: clip.beatLength,
      previewStartBeat: clip.startBeat,
      sourceBeatLength: clip.beatLength,
      sourceStartBeat: clip.startBeat,
    });
  };

  const getRenderedClipFrame = (clip: ArrangementClip) => {
    if (!dragState || dragState.clipId !== clip.id) {
      return {
        beatLength: clip.beatLength,
        startBeat: clip.startBeat,
      };
    }

    return {
      beatLength: dragState.previewBeatLength,
      startBeat: dragState.previewStartBeat,
    };
  };

  const getSplitBeat = (clip: ArrangementClip) => {
    const clipCenter = clip.startBeat + Math.floor(clip.beatLength / 2 / CLIP_SNAP) * CLIP_SNAP;
    if (transportMode !== 'SONG') {
      return clipCenter;
    }

    const snappedPlayhead = Math.round(currentStep / CLIP_SNAP) * CLIP_SNAP;
    const minSplit = clip.startBeat + CLIP_SNAP;
    const maxSplit = clip.startBeat + clip.beatLength - CLIP_SNAP;

    if (snappedPlayhead < minSplit || snappedPlayhead > maxSplit) {
      return clipCenter;
    }

    return snappedPlayhead;
  };

  const beginPaint = (note: string, stepIndex: number, isActive: boolean) => {
    if (!selectedClip) {
      return;
    }

    const mode: PaintMode = isActive ? 'remove' : 'add';
    setSelectedPhraseStepIndex(stepIndex);
    setSelectedPhraseNoteIndex(0);
    setPaintState({ mode, note });
    toggleClipPatternStep(selectedClip.id, stepIndex, note, mode);
  };

  const continuePaint = (note: string, stepIndex: number) => {
    if (!paintState || !selectedClip || paintState.note !== note) {
      return;
    }

    setSelectedPhraseStepIndex(stepIndex);
    toggleClipPatternStep(selectedClip.id, stepIndex, note, paintState.mode);
  };

  const phraseSummary = selectedClip && selectedClipTrack
    ? `${selectedClipTrack.name} · Pattern ${String.fromCharCode(65 + selectedClip.patternIndex)} · ${selectedClip.beatLength} steps · ${selectedPhraseActiveSteps} active`
    : 'Select a clip to compose directly in song view';

  return (
    <section className="surface-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-label">Arranger</div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Song composer</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
              This pass keeps phrase editing, arrangement decisions, and note shaping in one place so a solo creator can stay in song view longer.
            </p>
          </div>
          <button
            className="control-field flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
            onClick={() => addArrangerClip(selectedTrackId ?? undefined)}
          >
            <Plus className="h-4 w-4" />
            Add clip
          </button>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_auto_auto]">
          <div className="surface-panel-strong px-4 py-3">
            <div className="section-label">Song overview</div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--text-primary)]">
              <span>{timelineSteps} steps</span>
              <span>{totalBars} bars</span>
              <span>{totalDurationSeconds.toFixed(1)}s</span>
              <span className="text-[var(--text-secondary)]">Visible {getVisibleRangeLabel(visibleStartStep, visibleEndStep)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#7dd3fc,#67e8f9)]"
                style={{
                  marginLeft: `${(visibleStartStep / timelineSteps) * 100}%`,
                  width: `${Math.min(100, ((Math.max(1, visibleEndStep - visibleStartStep)) / timelineSteps) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="surface-panel-strong px-4 py-3">
              <div className="section-label">Zoom</div>
              <div className="mt-2 flex gap-2">
                {(['SONG', 'SECTION', 'PHRASE'] as ZoomPreset[]).map((preset) => (
                  <div key={preset}>
                    <ZoomButton
                      active={zoomPreset === preset}
                      label={preset.charAt(0) + preset.slice(1).toLowerCase()}
                      onClick={() => setZoomPreset(preset)}
                    />
                  </div>
                ))}
              </div>
            </div>

          <div className="surface-panel-strong px-4 py-3">
            <div className="section-label">Current focus</div>
            <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{phraseSummary}</div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-5">
        <div className="surface-panel-strong sonic-sidebar w-[380px] shrink-0 overflow-y-auto p-4">
          <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-[var(--border-soft)] bg-[rgba(8,12,17,0.96)] px-4 py-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[var(--accent)]" />
              <div className="section-label">Clip composer</div>
            </div>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">
              {selectedClip && selectedClipTrack ? phraseSummary : 'Select a clip to compose, transform, and arrange it from one surface.'}
            </div>
          </div>

          {selectedClip && selectedClipTrack ? (
            <div className="space-y-4 pt-4">
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedClipTrack.color }} />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedClipTrack.name}</span>
                    </div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      Pattern {String.fromCharCode(65 + selectedClip.patternIndex)} · {linkedPhraseCount > 1 ? `${linkedPhraseCount} linked clips` : 'unique phrase'}
                    </div>
                  </div>
                  <button
                    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                    onClick={() => removeArrangerClip(selectedClip.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => duplicateArrangerClip(selectedClip.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate forward
                  </button>
                  <button
                    className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => makeClipPatternUnique(selectedClip.id)}
                  >
                    <Braces className="h-3.5 w-3.5" />
                    Make unique
                  </button>
                  <button
                    className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => splitArrangerClip(selectedClip.id, getSplitBeat(selectedClip))}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Split at playhead
                  </button>
                  <button
                    className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => loopArrangerClip(selectedClip.id, 3)}
                  >
                    <Layers3 className="h-3.5 w-3.5" />
                    Repeat x4
                  </button>
                </div>
              </div>

              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="section-label">Phrase operations</div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      These actions target the selected clip’s phrase, not whichever global pattern happens to be selected.
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {composerStepCount} step view
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <OperationButton icon={<MoveHorizontal className="h-3.5 w-3.5" />} label="Shift left" onClick={() => transformClipPattern(selectedClip.id, 'shift-left')} />
                  <OperationButton icon={<MoveHorizontal className="h-3.5 w-3.5" />} label="Shift right" onClick={() => transformClipPattern(selectedClip.id, 'shift-right')} />
                  <OperationButton icon={<Minus className="h-3.5 w-3.5" />} label="Semitone down" onClick={() => transformClipPattern(selectedClip.id, 'transpose', -1)} />
                  <OperationButton icon={<Plus className="h-3.5 w-3.5" />} label="Semitone up" onClick={() => transformClipPattern(selectedClip.id, 'transpose', 1)} />
                  <OperationButton icon={<Minus className="h-3.5 w-3.5" />} label="Octave down" onClick={() => transformClipPattern(selectedClip.id, 'transpose', -12)} />
                  <OperationButton icon={<Plus className="h-3.5 w-3.5" />} label="Octave up" onClick={() => transformClipPattern(selectedClip.id, 'transpose', 12)} />
                  <OperationButton icon={<Copy className="h-3.5 w-3.5" />} label="Double density" onClick={() => transformClipPattern(selectedClip.id, 'double-density')} />
                  <OperationButton icon={<Eraser className="h-3.5 w-3.5" />} label="Halve density" onClick={() => transformClipPattern(selectedClip.id, 'halve-density')} />
                  <OperationButton icon={<Wand2 className="h-3.5 w-3.5" />} label="Randomize velocity" onClick={() => transformClipPattern(selectedClip.id, 'randomize-velocity')} />
                  <OperationButton icon={<PencilLine className="h-3.5 w-3.5" />} label="Reset automation" onClick={() => transformClipPattern(selectedClip.id, 'reset-automation')} />
                  <OperationButton icon={<Eraser className="h-3.5 w-3.5" />} label="Clear phrase" onClick={() => transformClipPattern(selectedClip.id, 'clear')} />
                  <OperationButton
                    icon={<Layers3 className="h-3.5 w-3.5" />}
                    label="Edit in Piano Roll"
                    onClick={() => {
                      setSelectedTrackId(selectedClip.trackId);
                      setCurrentPattern(selectedClip.patternIndex);
                      setActiveView('PIANO_ROLL');
                    }}
                  />
                </div>
              </div>

              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="section-label">Phrase composer</div>
                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      {isDrumTrack(selectedClipTrack)
                        ? 'Paint drum triggers directly in song view.'
                        : 'Paint notes directly in song view, then use the note stack below for precise shaping.'}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Step {selectedPhraseStepIndex + 1}
                  </span>
                </div>

                {isDrumTrack(selectedClipTrack) ? (
                  <div className="mt-4">
                    <div className="grid grid-cols-[72px_repeat(16,minmax(0,1fr))] gap-1">
                      <div className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                        {DRUM_ROW_LABELS[selectedClipTrack.type]}
                      </div>
                      {composerSteps.map((step, stepIndex) => {
                        const defaultNote = defaultNoteForTrack(selectedClipTrack);
                        const isActive = step.some((event) => event.note === defaultNote);

                        return (
                          <button
                            className={`h-12 rounded-[10px] border transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]'}`}
                            key={`drum-step-${stepIndex}`}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              beginPaint(defaultNote, stepIndex, isActive);
                            }}
                            onPointerEnter={() => continuePaint(defaultNote, stepIndex)}
                          >
                            <div className="font-mono text-[10px]">{stepIndex + 1}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.14em]">
                              {isActive ? 'Trig' : 'Rest'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 overflow-auto rounded-[14px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] p-2">
                    <div className="grid gap-1" style={{ gridTemplateColumns: `72px repeat(${composerStepCount}, minmax(0, 1fr))` }}>
                      <div />
                      {composerSteps.map((_, stepIndex) => (
                        <div
                          className={`flex h-8 items-center justify-center rounded-[8px] text-[10px] font-mono ${selectedPhraseStepIndex === stepIndex ? 'bg-[rgba(124,211,252,0.12)] text-[var(--accent-strong)]' : 'text-[var(--text-tertiary)]'}`}
                          key={`step-label-${stepIndex}`}
                        >
                          {stepIndex + 1}
                        </div>
                      ))}

                      {phraseRows.map((note) => (
                        <React.Fragment key={note}>
                          <div className="flex items-center pr-2 text-[10px] font-mono text-[var(--text-secondary)]">
                            {note}
                          </div>
                          {composerSteps.map((step, stepIndex) => {
                            const noteIndex = step.findIndex((event) => event.note === note);
                            const isActive = noteIndex >= 0;

                            return (
                              <button
                                className={`h-8 rounded-[8px] border transition-colors ${isActive ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.16)] text-[var(--accent-strong)]' : 'border-[rgba(151,163,180,0.1)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'} ${selectedPhraseStepIndex === stepIndex ? 'ring-1 ring-[rgba(125,211,252,0.2)]' : ''}`}
                                key={`${note}-${stepIndex}`}
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  setSelectedPhraseStepIndex(stepIndex);
                                  setSelectedPhraseNoteIndex(noteIndex >= 0 ? noteIndex : 0);
                                  beginPaint(note, stepIndex, isActive);
                                }}
                                onPointerEnter={() => continuePaint(note, stepIndex)}
                              >
                                {isActive ? '●' : ''}
                              </button>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="section-label">Selected step</div>
                    <div className="mt-2 text-sm text-[var(--text-primary)]">
                      Step {selectedPhraseStepIndex + 1} · {selectedPhraseStep.length > 0 ? `${selectedPhraseStep.length} note${selectedPhraseStep.length === 1 ? '' : 's'}` : 'Rest'}
                    </div>
                  </div>
                  {!isDrumTrack(selectedClipTrack) && (
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => {
                        const note = selectedPhraseNote?.note ?? defaultNoteForTrack(selectedClipTrack);
                        toggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, shiftNote(note, 12), 'add');
                        setSelectedPhraseNoteIndex(selectedPhraseStep.length);
                      }}
                    >
                      Add +8va
                    </button>
                  )}
                </div>

                {!isDrumTrack(selectedClipTrack) ? (
                  selectedPhraseStep.length > 0 ? (
                    <>
                      <div className="mt-4 grid gap-2">
                        {selectedPhraseStep.map((event, noteIndex) => (
                          <button
                            className={`flex items-center justify-between rounded-[12px] border px-3 py-3 text-left transition-colors ${normalizedSelectedPhraseNoteIndex === noteIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)] text-[var(--accent-strong)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]'}`}
                            key={`${event.note}-${noteIndex}`}
                            onClick={() => setSelectedPhraseNoteIndex(noteIndex)}
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

                      {selectedPhraseNote && normalizedSelectedPhraseNoteIndex !== null && (
                        <div className="mt-4 grid gap-3">
                          <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] gap-2">
                            <button
                              className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                              onClick={() => updateClipPatternStepEvent(
                                selectedClip.id,
                                selectedPhraseStepIndex,
                                normalizedSelectedPhraseNoteIndex,
                                { note: shiftNote(selectedPhraseNote.note, -1) },
                              )}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <select
                              className="control-field h-10 px-3 text-sm"
                              onChange={(event) => updateClipPatternStepEvent(
                                selectedClip.id,
                                selectedPhraseStepIndex,
                                normalizedSelectedPhraseNoteIndex,
                                { note: event.target.value },
                              )}
                              value={selectedPhraseNote.note}
                            >
                              {phraseRows.map((note) => (
                                <option key={note} value={note}>
                                  {note}
                                </option>
                              ))}
                              {NOTE_NAMES.map((_, index) => {
                                const octaveNote = shiftNote(selectedPhraseNote.note, index - 6);
                                return octaveNote;
                              }).filter((note, index, values) => values.indexOf(note) === index).map((note) => (
                                <option key={`extra-${note}`} value={note}>
                                  {note}
                                </option>
                              ))}
                            </select>
                            <button
                              className="ghost-icon-button flex h-10 w-10 items-center justify-center"
                              onClick={() => updateClipPatternStepEvent(
                                selectedClip.id,
                                selectedPhraseStepIndex,
                                normalizedSelectedPhraseNoteIndex,
                                { note: shiftNote(selectedPhraseNote.note, 1) },
                              )}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <label className="text-xs text-[var(--text-secondary)]">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="section-label">Velocity</span>
                              <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedPhraseNote.velocity * 100)}</span>
                            </div>
                            <input
                              className="w-full"
                              max="1"
                              min="0.1"
                              onChange={(event) => updateClipPatternStepEvent(
                                selectedClip.id,
                                selectedPhraseStepIndex,
                                normalizedSelectedPhraseNoteIndex,
                                { velocity: Number(event.target.value) },
                              )}
                              step="0.01"
                              type="range"
                              value={selectedPhraseNote.velocity}
                            />
                          </label>

                          <label className="text-xs text-[var(--text-secondary)]">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="section-label">Gate</span>
                              <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{selectedPhraseNote.gate.toFixed(2)}</span>
                            </div>
                            <input
                              className="w-full"
                              max="4"
                              min="0.25"
                              onChange={(event) => updateClipPatternStepEvent(
                                selectedClip.id,
                                selectedPhraseStepIndex,
                                normalizedSelectedPhraseNoteIndex,
                                { gate: Number(event.target.value) },
                              )}
                              step="0.25"
                              type="range"
                              value={selectedPhraseNote.gate}
                            />
                          </label>

                          <div className="flex gap-2">
                            <button
                              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                              onClick={() => {
                                toggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, shiftNote(selectedPhraseNote.note, 7), 'add');
                                setSelectedPhraseNoteIndex(selectedPhraseStep.length);
                              }}
                            >
                              Add fifth
                            </button>
                            <button
                              className="control-chip ml-auto flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                              onClick={() => {
                                toggleClipPatternStep(selectedClip.id, selectedPhraseStepIndex, selectedPhraseNote.note, 'remove');
                                setSelectedPhraseNoteIndex(selectedPhraseStep.length > 1 ? Math.max(0, normalizedSelectedPhraseNoteIndex - 1) : null);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 text-xs text-[var(--text-secondary)]">
                      Paint a note in the composer grid to shape pitch, velocity, gate, and harmony here.
                    </div>
                  )
                ) : (
                  <div className="mt-3 text-xs text-[var(--text-secondary)]">
                    Drum clips keep the selected step simple. Use the grid above to add or remove triggers quickly.
                  </div>
                )}
              </div>

              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="section-label">Automation</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      Level and tone stay next to the phrase they shape.
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Step {selectedPhraseStepIndex + 1}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <AutomationLaneRow
                    label="Level"
                    onSelectStep={setSelectedPhraseStepIndex}
                    selectedStepIndex={selectedPhraseStepIndex}
                    values={selectedClipAutomation.level.slice(0, composerStepCount)}
                  />
                  <AutomationLaneRow
                    label="Tone"
                    onSelectStep={setSelectedPhraseStepIndex}
                    selectedStepIndex={selectedPhraseStepIndex}
                    values={selectedClipAutomation.tone.slice(0, composerStepCount)}
                  />
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="text-xs text-[var(--text-secondary)]">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="section-label">Level focus</span>
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedAutomationLevel * 100)}</span>
                    </div>
                    <input
                      className="w-full"
                      max="1"
                      min="0"
                      onChange={(event) => updateClipPatternAutomationStep(
                        selectedClip.id,
                        selectedPhraseStepIndex,
                        'level',
                        Number(event.target.value),
                      )}
                      step="0.01"
                      type="range"
                      value={selectedAutomationLevel}
                    />
                  </label>

                  <label className="text-xs text-[var(--text-secondary)]">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="section-label">Tone focus</span>
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{Math.round(selectedAutomationTone * 100)}</span>
                    </div>
                    <input
                      className="w-full"
                      max="1"
                      min="0"
                      onChange={(event) => updateClipPatternAutomationStep(
                        selectedClip.id,
                        selectedPhraseStepIndex,
                        'tone',
                        Number(event.target.value),
                      )}
                      step="0.01"
                      type="range"
                      value={selectedAutomationTone}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-4 text-sm text-[var(--text-secondary)]">
              Select a clip to open the song-first composer.
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="section-label">Timeline</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {totalBars} bars · snap {CLIP_SNAP} steps · {zoomPreset.toLowerCase()} zoom
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-[18px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.24)]" ref={timelineRef}>
            <div className="min-h-full p-4" style={{ minWidth: `${timelineWidth}px` }}>
              <div className="grid" style={{ gridTemplateColumns: '220px minmax(0, 1fr)' }}>
                <div className="sticky left-0 z-10 border-b border-r border-[var(--border-soft)] bg-[rgba(8,12,17,0.96)] px-4 py-3 backdrop-blur">
                  <div className="section-label">Track lanes</div>
                </div>
                <div className="relative border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
                  <div className="flex h-full min-w-full">
                    {Array.from({ length: timelineSteps }, (_, stepIndex) => (
                      <div
                        className={`flex h-14 items-center justify-center border-r border-[rgba(151,163,180,0.08)] ${stepIndex % 16 === 0 ? 'bg-[rgba(114,217,255,0.05)]' : stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.025)]' : ''}`}
                        key={stepIndex}
                        style={{ width: `${pixelsPerStep}px` }}
                      >
                        <span className={`font-mono text-[10px] ${stepIndex % 16 === 0 ? 'text-[var(--accent-strong)]' : stepIndex % 4 === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                          {stepIndex % 16 === 0 ? `B${Math.floor(stepIndex / 16) + 1}` : stepIndex + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-[rgba(124,211,252,0.8)]"
                    style={{ left: `${currentStep * pixelsPerStep}px` }}
                  />
                </div>

                {laneData.map(({ clips, track }) => {
                  const isSelectedTrack = selectedTrackId === track.id;

                  return (
                    <React.Fragment key={track.id}>
                      <button
                        className={`sticky left-0 z-10 flex items-center gap-3 border-b border-r border-[var(--border-soft)] px-4 py-4 text-left transition-colors ${isSelectedTrack ? 'bg-[rgba(124,211,252,0.09)]' : 'bg-[rgba(8,12,17,0.96)] hover:bg-[rgba(255,255,255,0.03)]'}`}
                        onClick={() => setSelectedTrackId(track.id)}
                      >
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: track.color }} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{track.name}</div>
                          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</div>
                        </div>
                      </button>
                      <div className="relative border-b border-[var(--border-soft)] py-3">
                        <div className="absolute inset-0">
                          {Array.from({ length: timelineSteps }, (_, stepIndex) => (
                            <div
                              className={`${stepIndex % 16 === 0 ? 'bg-[rgba(114,217,255,0.03)]' : stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.03)]' : 'bg-transparent'} absolute inset-y-0 border-r border-[rgba(151,163,180,0.08)]`}
                              key={stepIndex}
                              style={{
                                left: `${stepIndex * pixelsPerStep}px`,
                                width: `${pixelsPerStep}px`,
                              }}
                            />
                          ))}
                        </div>
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 z-[1] w-[2px] bg-[rgba(124,211,252,0.8)]"
                          style={{ left: `${currentStep * pixelsPerStep}px` }}
                        />
                        <div className="relative z-[2] flex h-20 items-center">
                          {clips.map((clip) => {
                            const isSelectedClip = selectedArrangerClipId === clip.id;
                            const frame = getRenderedClipFrame(clip);

                            return (
                              <div
                                className={`group absolute top-1/2 flex h-14 -translate-y-1/2 overflow-hidden border px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.24)] transition-all ${isSelectedClip ? 'ring-1 ring-[rgba(255,255,255,0.28)]' : ''}`}
                                key={clip.id}
                                onClick={() => selectClip(clip.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    selectClip(clip.id);
                                  }
                                }}
                                onPointerDown={(event) => beginClipDrag(clip, event, 'move')}
                                role="button"
                                style={{
                                  background: `linear-gradient(135deg, ${track.color}40, ${track.color}1a)`,
                                  borderColor: isSelectedClip ? `${track.color}aa` : `${track.color}66`,
                                  borderRadius: isSelectedClip ? '6px' : '4px',
                                  left: `${frame.startBeat * pixelsPerStep}px`,
                                  width: `${frame.beatLength * pixelsPerStep}px`,
                                }}
                                tabIndex={0}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 z-[3] cursor-ew-resize bg-[rgba(255,255,255,0.08)] opacity-0 transition-opacity group-hover:opacity-100"
                                  onPointerDown={(event) => beginClipDrag(clip, event, 'trim-start')}
                                  style={{ width: `${DRAG_HANDLE_WIDTH}px` }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                    {track.name}
                                  </div>
                                  <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-[var(--text-secondary)]">
                                    <span>Pattern {String.fromCharCode(65 + clip.patternIndex)}</span>
                                    <span>{frame.beatLength} steps</span>
                                  </div>
                                </div>
                                <div className="ml-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateArrangerClip(clip.id, { startBeat: Math.max(0, clip.startBeat - CLIP_SNAP) });
                                    }}
                                  >
                                    <span className="font-mono text-xs">{'<'}</span>
                                  </button>
                                  <button
                                    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateArrangerClip(clip.id, { startBeat: clip.startBeat + CLIP_SNAP });
                                    }}
                                  >
                                    <span className="font-mono text-xs">{'>'}</span>
                                  </button>
                                  <button
                                    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      duplicateArrangerClip(clip.id);
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div
                                  className="absolute inset-y-0 right-0 z-[3] cursor-ew-resize bg-[rgba(255,255,255,0.08)] opacity-0 transition-opacity group-hover:opacity-100"
                                  onPointerDown={(event) => beginClipDrag(clip, event, 'trim-end')}
                                  style={{ width: `${DRAG_HANDLE_WIDTH}px` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ZoomButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
    data-active={active}
    onClick={onClick}
  >
    {label}
  </button>
);

const OperationButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

const AutomationLaneRow = ({
  label,
  onSelectStep,
  selectedStepIndex,
  values,
}: {
  label: string;
  onSelectStep: (stepIndex: number) => void;
  selectedStepIndex: number;
  values: number[];
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <span className="section-label">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        {Math.round((values[selectedStepIndex] ?? 0) * 100)}
      </span>
    </div>
    <div className="grid grid-cols-16 gap-1">
      {values.map((value, stepIndex) => (
        <button
          className={`rounded-[8px] border px-0 py-2 transition-colors ${selectedStepIndex === stepIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'}`}
          key={`${label}-${stepIndex}`}
          onClick={() => onSelectStep(stepIndex)}
        >
          <div className="mx-auto h-8 w-2 rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="w-full rounded-full bg-[var(--accent)]"
              style={{
                height: `${Math.max(8, value * 100)}%`,
                marginTop: `${Math.max(0, 100 - Math.max(8, value * 100))}%`,
              }}
            />
          </div>
        </button>
      ))}
    </div>
  </div>
);
