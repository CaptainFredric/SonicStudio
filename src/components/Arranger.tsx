import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Eraser, Layers3, Minus, MoveHorizontal, Plus, Scissors, StretchHorizontal, Trash2 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { defaultNoteForTrack, type ArrangementClip, type Track } from '../project/schema';

const PIXELS_PER_STEP = 22;
const CLIP_SNAP = 4;
const MIN_CLIP_LENGTH = CLIP_SNAP;

type DragMode = 'move' | 'trim-start' | 'trim-end';

interface DragState {
  clipId: string;
  mode: DragMode;
  originX: number;
  previewBeatLength: number;
  previewStartBeat: number;
  sourceBeatLength: number;
  sourceStartBeat: number;
}

const snapStepDelta = (offsetPx: number) => (
  Math.round(offsetPx / PIXELS_PER_STEP / CLIP_SNAP) * CLIP_SNAP
);

const isDrumTrack = (track: Track) => (
  track.type === 'kick' || track.type === 'snare' || track.type === 'hihat'
);

export const Arranger = () => {
  const {
    addArrangerClip,
    arrangerClips,
    bpm,
    clearPatternAt,
    currentStep,
    currentPattern,
    duplicateArrangerClip,
    makeClipPatternUnique,
    splitArrangerClip,
    loopArrangerClip,
    patternCount,
    removeArrangerClip,
    setActiveView,
    selectedTrackId,
    setCurrentPattern,
    setSelectedTrackId,
    shiftPatternAt,
    songLengthInBeats,
    stepsPerPattern,
    togglePatternStep,
    tracks,
    transposePatternAt,
    transportMode,
    updateArrangerClip,
    updatePatternAutomationStep,
  } = useAudio();
  const [selectedClipId, setSelectedClipId] = useState<string | null>(arrangerClips[0]?.id ?? null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedPhraseStepIndex, setSelectedPhraseStepIndex] = useState(0);

  useEffect(() => {
    if (selectedClipId && arrangerClips.some((clip) => clip.id === selectedClipId)) {
      return;
    }

    setSelectedClipId(arrangerClips[0]?.id ?? null);
  }, [arrangerClips, selectedClipId]);

  useEffect(() => {
    setSelectedPhraseStepIndex(0);
  }, [selectedClipId]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const stepDelta = snapStepDelta(event.clientX - dragState.originX);

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

    const commitDrag = () => {
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
    window.addEventListener('pointerup', commitDrag, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', commitDrag);
    };
  }, [arrangerClips, dragState, updateArrangerClip]);

  const selectedClip = arrangerClips.find((clip) => clip.id === selectedClipId) ?? null;
  const selectedClipTrack = tracks.find((track) => track.id === selectedClip?.trackId) ?? null;
  const linkedPhraseCount = selectedClip
    ? arrangerClips.filter((clip) => (
        clip.trackId === selectedClip.trackId
        && clip.patternIndex === selectedClip.patternIndex
      )).length
    : 0;
  const canMakeUnique = linkedPhraseCount > 1 && selectedClip && selectedClipTrack
    ? Array.from({ length: patternCount }, (_, patternIndex) => patternIndex).some((patternIndex) => (
        patternIndex !== selectedClip.patternIndex
        && !arrangerClips.some((clip) => (
          clip.trackId === selectedClip.trackId
          && clip.id !== selectedClip.id
          && clip.patternIndex === patternIndex
        ))
      ))
    : false;
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
  const selectedPhraseActiveSteps = selectedClipPattern.filter((step) => step.length > 0).length;
  const selectedPhraseNoteCount = selectedClipPattern.reduce((sum, step) => sum + step.length, 0);
  const selectedPhraseLeadNote = selectedPhraseStep[0]?.note ?? null;
  const selectedAutomationLevel = selectedClipAutomation.level[selectedPhraseStepIndex] ?? 0.5;
  const selectedAutomationTone = selectedClipAutomation.tone[selectedPhraseStepIndex] ?? 0.5;
  const timelineSteps = Math.max(songLengthInBeats, 32);
  const timelineWidth = timelineSteps * PIXELS_PER_STEP;
  const totalDurationSeconds = songLengthInBeats * (60 / bpm) * 0.25;
  const totalBars = Math.max(2, Math.ceil(timelineSteps / 16));

  const laneData = useMemo(() => (
    tracks.map((track) => ({
      clips: arrangerClips.filter((clip) => clip.trackId === track.id),
      track,
    }))
  ), [arrangerClips, tracks]);

  const selectClip = (clipId: string) => {
    const clip = arrangerClips.find((candidate) => candidate.id === clipId);
    if (!clip) {
      return;
    }

    setSelectedClipId(clipId);
    setSelectedTrackId(clip.trackId);
    setCurrentPattern(clip.patternIndex);
  };

  const nudgeClip = (clipId: string, amount: number) => {
    const clip = arrangerClips.find((candidate) => candidate.id === clipId);
    if (!clip) {
      return;
    }

    updateArrangerClip(clipId, { startBeat: Math.max(0, clip.startBeat + amount) });
  };

  const resizeClip = (clipId: string, amount: number) => {
    const clip = arrangerClips.find((candidate) => candidate.id === clipId);
    if (!clip) {
      return;
    }

    updateArrangerClip(clipId, { beatLength: Math.max(CLIP_SNAP, clip.beatLength + amount) });
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

  return (
    <section className="surface-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Arranger</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Clip lanes</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            Song mode already reads this timeline. This pass makes phrase building faster by selecting, dragging, trimming, splitting, and duplicating clips directly from the lane view instead of relying on numeric edits alone.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="section-label">Song span</div>
            <div className="mt-1 font-mono text-sm text-[var(--text-primary)]">{songLengthInBeats} steps · {totalDurationSeconds.toFixed(1)}s</div>
            <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{transportMode === 'SONG' ? 'Live transport follows these clips' : 'Switch to song mode to play this timeline'}</div>
          </div>
          <button
            className="control-field flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
            onClick={() => addArrangerClip(selectedTrackId ?? undefined)}
          >
            <Plus className="h-4 w-4" />
            Add clip
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-5">
        <div className="surface-panel-strong sonic-sidebar w-[300px] shrink-0 overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-[var(--accent)]" />
            <div className="section-label">Clip inspector</div>
          </div>

          {selectedClip && selectedClipTrack ? (
            <div className="space-y-4">
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedClipTrack.color }} />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedClipTrack.name}</span>
                    </div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      Pattern {String.fromCharCode(65 + selectedClip.patternIndex)} · {selectedClip.beatLength} steps
                    </div>
                  </div>
                  <button
                    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                    onClick={() => {
                      removeArrangerClip(selectedClip.id);
                      setSelectedClipId(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <label className="text-xs text-[var(--text-secondary)]">
                    <span className="section-label mb-1 block">Pattern</span>
                    <select
                      className="control-field h-9 w-full px-2 text-xs"
                      onChange={(event) => {
                        const nextPattern = Number(event.target.value);
                        updateArrangerClip(selectedClip.id, { patternIndex: nextPattern });
                        setCurrentPattern(nextPattern);
                      }}
                      value={selectedClip.patternIndex}
                    >
                      {Array.from({ length: patternCount }, (_, patternIndex) => (
                        <option key={patternIndex} value={patternIndex}>
                          {String.fromCharCode(65 + patternIndex)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-[var(--text-secondary)]">
                    <span className="section-label mb-1 block">Start</span>
                    <input
                      className="control-field h-9 w-full px-2 text-xs"
                      min={0}
                      onChange={(event) => updateArrangerClip(selectedClip.id, { startBeat: Number(event.target.value) })}
                      type="number"
                      value={selectedClip.startBeat}
                    />
                  </label>
                  <label className="text-xs text-[var(--text-secondary)]">
                    <span className="section-label mb-1 block">Length</span>
                    <input
                      className="control-field h-9 w-full px-2 text-xs"
                      min={CLIP_SNAP}
                      onChange={(event) => updateArrangerClip(selectedClip.id, { beatLength: Number(event.target.value) })}
                      step={CLIP_SNAP}
                      type="number"
                      value={selectedClip.beatLength}
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-2">
                <QuickActionRow
                  icon={<MoveHorizontal className="h-4 w-4" />}
                  label="Nudge"
                  primaryLabel={`-${CLIP_SNAP}`}
                  primaryAction={() => nudgeClip(selectedClip.id, -CLIP_SNAP)}
                  secondaryLabel={`+${CLIP_SNAP}`}
                  secondaryAction={() => nudgeClip(selectedClip.id, CLIP_SNAP)}
                />
                <QuickActionRow
                  icon={<StretchHorizontal className="h-4 w-4" />}
                  label="Length"
                  primaryLabel={`-${CLIP_SNAP}`}
                  primaryAction={() => resizeClip(selectedClip.id, -CLIP_SNAP)}
                  secondaryLabel={`+${CLIP_SNAP}`}
                  secondaryAction={() => resizeClip(selectedClip.id, CLIP_SNAP)}
                />
                <QuickActionRow
                  icon={<Copy className="h-4 w-4" />}
                  label="Phrase"
                  primaryLabel="Duplicate"
                  primaryAction={() => duplicateArrangerClip(selectedClip.id)}
                  secondaryLabel="Repeat x4"
                  secondaryAction={() => loopArrangerClip(selectedClip.id, 3)}
                />
                <QuickActionRow
                  icon={<Scissors className="h-4 w-4" />}
                  label="Edit"
                  primaryLabel="Split"
                  primaryAction={() => splitArrangerClip(selectedClip.id)}
                  secondaryLabel="Focus"
                  secondaryAction={() => {
                    setSelectedTrackId(selectedClip.trackId);
                    setCurrentPattern(selectedClip.patternIndex);
                  }}
                />
              </div>

              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="section-label">Session cues</div>
                <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                  <p>Selected pattern matches top-bar pattern {String.fromCharCode(65 + currentPattern)} when you focus a clip, which keeps song editing and note editing in sync.</p>
                  <p>Bar snap is currently {CLIP_SNAP} steps. Drag the body to move a clip and drag either edge to trim it without breaking alignment.</p>
                </div>
                <div className="mt-3 rounded-[14px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.14)] px-3 py-3">
                  <div className="section-label">Phrase linkage</div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">
                    {linkedPhraseCount > 1
                      ? `This clip shares pattern ${String.fromCharCode(65 + selectedClip.patternIndex)} with ${linkedPhraseCount - 1} other clip${linkedPhraseCount === 2 ? '' : 's'} on this track.`
                      : 'This clip already points at its own phrase slot on this track.'}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={!canMakeUnique}
                      onClick={() => selectedClip && makeClipPatternUnique(selectedClip.id)}
                    >
                      Make unique
                    </button>
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => {
                        setSelectedTrackId(selectedClip.trackId);
                        setCurrentPattern(selectedClip.patternIndex);
                        setActiveView('PIANO_ROLL');
                      }}
                    >
                      Edit notes
                    </button>
                  </div>
                </div>
              </div>

              {selectedClip && selectedClipTrack && (
                <div className="rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="section-label">Phrase sketch</div>
                      <div className="mt-2 text-sm text-[var(--text-secondary)]">
                        Edit pattern {String.fromCharCode(65 + selectedClip.patternIndex)} directly from song view. Click steps to add or clear notes, then use the piano roll for finer note shaping.
                      </div>
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                      {selectedPhraseActiveSteps} active · {selectedPhraseNoteCount} notes
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => shiftPatternAt(selectedClip.trackId, selectedClip.patternIndex, 'left')}
                    >
                      Shift left
                    </button>
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => shiftPatternAt(selectedClip.trackId, selectedClip.patternIndex, 'right')}
                    >
                      Shift right
                    </button>
                    {!isDrumTrack(selectedClipTrack) && (
                      <>
                        <button
                          className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          onClick={() => transposePatternAt(selectedClip.trackId, selectedClip.patternIndex, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                          Down 1
                        </button>
                        <button
                          className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          onClick={() => transposePatternAt(selectedClip.trackId, selectedClip.patternIndex, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Up 1
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {selectedClipPattern.map((step, stepIndex) => {
                      const isSelectedStep = selectedPhraseStepIndex === stepIndex;
                      const isActiveStep = step.length > 0;
                      const leadNote = step[0]?.note ?? null;

                      return (
                        <button
                          className={`rounded-[12px] border px-2 py-3 text-left transition-colors ${isSelectedStep ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'}`}
                          key={`${selectedClip.id}-${stepIndex}`}
                          onClick={() => {
                            setSelectedPhraseStepIndex(stepIndex);
                            togglePatternStep(
                              selectedClip.trackId,
                              selectedClip.patternIndex,
                              stepIndex,
                              step.length > 0 ? undefined : defaultNoteForTrack(selectedClipTrack),
                            );
                          }}
                        >
                          <div className="font-mono text-[10px] text-[var(--text-tertiary)]">{stepIndex + 1}</div>
                          <div className={`mt-2 text-xs font-semibold ${isActiveStep ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            {isDrumTrack(selectedClipTrack) ? (isActiveStep ? 'TRIG' : 'Rest') : (leadNote ?? 'Rest')}
                          </div>
                          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            {step.length > 1 ? `${step.length} notes` : isActiveStep ? '1 note' : 'empty'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.14)] px-3 py-3">
                    <div className="min-w-0">
                      <div className="section-label">Selected step</div>
                      <div className="mt-2 text-sm text-[var(--text-primary)]">
                        Step {selectedPhraseStepIndex + 1}{selectedPhraseLeadNote ? ` · ${selectedPhraseLeadNote}` : ' · Rest'}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {selectedPhraseStep.length > 0
                          ? `${selectedPhraseStep.length} note${selectedPhraseStep.length === 1 ? '' : 's'} in this step`
                          : 'Click a step to place the default note for this track'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        onClick={() => clearPatternAt(selectedClip.trackId, selectedClip.patternIndex)}
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        Clear phrase
                      </button>
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        onClick={() => {
                          setSelectedTrackId(selectedClip.trackId);
                          setCurrentPattern(selectedClip.patternIndex);
                          setActiveView('PIANO_ROLL');
                        }}
                      >
                        Deep edit
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[14px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.14)] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="section-label">Automation</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">
                          Level and tone are per phrase step and affect playback in song mode and pattern mode.
                        </div>
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                        Step {selectedPhraseStepIndex + 1}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <AutomationLaneRow
                        label="Level"
                        onSelectStep={setSelectedPhraseStepIndex}
                        selectedStepIndex={selectedPhraseStepIndex}
                        values={selectedClipAutomation.level}
                      />
                      <AutomationLaneRow
                        label="Tone"
                        onSelectStep={setSelectedPhraseStepIndex}
                        selectedStepIndex={selectedPhraseStepIndex}
                        values={selectedClipAutomation.tone}
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
                          onChange={(event) => selectedClip && updatePatternAutomationStep(
                            selectedClip.trackId,
                            selectedClip.patternIndex,
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
                          onChange={(event) => selectedClip && updatePatternAutomationStep(
                            selectedClip.trackId,
                            selectedClip.patternIndex,
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
              )}
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-secondary)]">
              Select a clip to nudge, stretch, duplicate, or retarget its pattern.
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="section-label">Timeline</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {totalBars} bars · snap {CLIP_SNAP} steps
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-[18px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.24)]">
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
                        style={{ width: `${PIXELS_PER_STEP}px` }}
                      >
                        <span className={`font-mono text-[10px] ${stepIndex % 16 === 0 ? 'text-[var(--accent-strong)]' : stepIndex % 4 === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                          {stepIndex % 16 === 0 ? `B${Math.floor(stepIndex / 16) + 1}` : stepIndex + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-[rgba(124,211,252,0.8)]"
                    style={{ left: `${currentStep * PIXELS_PER_STEP}px` }}
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
                                left: `${stepIndex * PIXELS_PER_STEP}px`,
                                width: `${PIXELS_PER_STEP}px`,
                              }}
                            />
                          ))}
                        </div>
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 z-[1] w-[2px] bg-[rgba(124,211,252,0.8)]"
                          style={{ left: `${currentStep * PIXELS_PER_STEP}px` }}
                        />
                        <div className="relative z-[2] flex h-20 items-center">
                          {clips.map((clip) => {
                            const isSelectedClip = selectedClipId === clip.id;
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
                                  left: `${frame.startBeat * PIXELS_PER_STEP}px`,
                                  width: `${frame.beatLength * PIXELS_PER_STEP}px`,
                                }}
                                tabIndex={0}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 z-[3] w-2 cursor-ew-resize bg-[rgba(255,255,255,0.08)] opacity-0 transition-opacity group-hover:opacity-100"
                                  onPointerDown={(event) => beginClipDrag(clip, event, 'trim-start')}
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
                                      nudgeClip(clip.id, -CLIP_SNAP);
                                    }}
                                  >
                                    <span className="font-mono text-xs">{'<'}</span>
                                  </button>
                                  <button
                                    className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      nudgeClip(clip.id, CLIP_SNAP);
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
                                  className="absolute inset-y-0 right-0 z-[3] w-2 cursor-ew-resize bg-[rgba(255,255,255,0.08)] opacity-0 transition-opacity group-hover:opacity-100"
                                  onPointerDown={(event) => beginClipDrag(clip, event, 'trim-end')}
                                />
                              </div>
                            );
                          })}
                          <button
                            className={`absolute top-1/2 flex h-14 -translate-y-1/2 items-center justify-center border border-dashed px-4 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${isSelectedTrack ? 'border-[rgba(124,211,252,0.26)] bg-[rgba(124,211,252,0.08)] text-[#d9f2ff]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            onClick={() => addArrangerClip(track.id)}
                            style={{
                              borderRadius: '4px',
                              left: `${clips.reduce((maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength), 0) * PIXELS_PER_STEP}px`,
                              width: `${Math.max(4, Math.floor(PIXELS_PER_STEP * 3.5))}px`,
                            }}
                          >
                            +
                          </button>
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

const QuickActionRow = ({
  icon,
  label,
  primaryAction,
  primaryLabel,
  secondaryAction,
  secondaryLabel,
}: {
  icon: React.ReactNode;
  label: string;
  primaryAction: () => void;
  primaryLabel: string;
  secondaryAction: () => void;
  secondaryLabel: string;
}) => (
  <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[var(--accent)]">{icon}</span>
      <span className="section-label">{label}</span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={primaryAction}>
        {primaryLabel}
      </button>
      <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={secondaryAction}>
        {secondaryLabel}
      </button>
    </div>
  </div>
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
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        step-focused lane
      </span>
    </div>
    <div className="grid grid-cols-4 gap-2">
      {values.map((value, stepIndex) => (
        <button
          className={`rounded-[10px] border px-1 py-2 transition-colors ${selectedStepIndex === stepIndex ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'}`}
          key={`${label}-${stepIndex}`}
          onClick={() => onSelectStep(stepIndex)}
        >
          <div className="mx-auto flex h-12 w-full items-end justify-center rounded-[8px] bg-[rgba(255,255,255,0.03)] px-1">
            <span
              className="w-full rounded-[6px] bg-[var(--accent)]"
              style={{ height: `${Math.max(12, value * 100)}%` }}
            />
          </div>
          <div className="mt-2 font-mono text-[9px] text-[var(--text-tertiary)]">{stepIndex + 1}</div>
        </button>
      ))}
    </div>
  </div>
);
