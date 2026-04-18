import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Copy,
  Eraser,
  Focus,
  Music2,
  Pin,
  Play,
  SlidersHorizontal,
  Trash2,
  VolumeX,
} from 'lucide-react';

import { getSamplePresetMeta } from '../audio/sampleLibrary';
import { useAudio } from '../context/AudioContext';
import {
  NOTE_GATE_FINE_STEP,
  NOTE_GATE_MAX,
  NOTE_GATE_MIN,
  clampNoteGate,
} from '../utils/noteEditing';

const TRACK_BUTTONS = [
  { label: 'Kick', type: 'kick' as const },
  { label: 'Snr', type: 'snare' as const },
  { label: 'Hat', type: 'hihat' as const },
  { label: 'Bass', type: 'bass' as const },
  { label: 'Lead', type: 'lead' as const },
  { label: 'Pad', type: 'pad' as const },
  { label: 'Pluck', type: 'pluck' as const },
  { label: 'FX', type: 'fx' as const },
];

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
  const {
    clearTrack,
    createTrack,
    currentStep,
    currentPattern,
    duplicateTrack,
    moveTrack,
    pinnedTrackIds,
    previewTrack,
    removeTrack,
    selectedTrackId,
    setActiveView,
    setSelectedTrackId,
    shiftPattern,
    stepsPerPattern,
    toggleStep,
    toggleMute,
    togglePinnedTrack,
    toggleSolo,
    tracks,
    transposePattern,
    updateStepEvent,
  } = useAudio();
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [laneScope, setLaneScope] = useState<'ALL' | 'ACTIVE' | 'FOCUSED' | 'PINNED' | 'DRUMS' | 'MUSICAL'>('ALL');
  const [compactLanes, setCompactLanes] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<LaneSectionKey, boolean>>({
    MUSICAL: false,
    PINNED: false,
    RHYTHM: false,
    TEXTURE: false,
  });
  const gridViewportRef = useRef<HTMLDivElement | null>(null);
  const [gridScrollLeft, setGridScrollLeft] = useState(0);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const selectedTrackPattern = selectedTrack?.patterns[currentPattern] ?? Array.from({ length: stepsPerPattern }, () => []);
  const selectedStep = selectedTrackPattern[selectedStepIndex] ?? [];
  const selectedLeadEvent = selectedStep[0] ?? null;
  const isSelectedTrackDrum = selectedTrack ? ['kick', 'snare', 'hihat'].includes(selectedTrack.type) : false;
  const melodicTrackCount = useMemo(() => (
    tracks.filter((track) => !['kick', 'snare', 'hihat'].includes(track.type)).length
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
  const laneHeaderWidthClass = compactLanes ? 'w-[252px]' : 'w-[284px]';
  const laneHeaderPaddingClass = compactLanes ? 'px-4 py-3' : 'px-5 py-4';
  const laneGridPaddingClass = compactLanes ? 'px-2 py-1.5' : 'px-2 py-2';
  const laneHeaderWidth = compactLanes ? 252 : 284;
  const stepCellWidth = compactLanes ? 54 : 64;
  const stepGridWidth = stepsPerPattern * stepCellWidth;
  const maxGridScrollLeft = Math.max(0, stepGridWidth - gridViewportWidth);
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

  useEffect(() => {
    if (!selectedTrack) {
      setSelectedStepIndex(0);
      return;
    }

    const firstActiveStep = selectedTrackPattern.findIndex((step) => step.length > 0);
    setSelectedStepIndex(firstActiveStep >= 0 ? firstActiveStep : 0);
  }, [currentPattern, selectedTrack?.id, selectedTrackPattern]);

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
  }, [compactLanes, laneScope, stepsPerPattern, visibleTrackSections.length]);

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

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Sequencer</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Pattern grid</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Build patterns lane by lane here, then move into notes or song view for deeper edits.</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="section-label shrink-0">Add lane</span>
          {TRACK_BUTTONS.map((button) => (
            <button
              className="control-chip shrink-0 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em]"
              key={button.type}
              onClick={() => createTrack(button.type)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="surface-panel-muted mb-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-label">Compose</div>
                <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {selectedTrack ? `${selectedTrack.name} in Pattern ${String.fromCharCode(65 + currentPattern)}` : 'Pick a lane to start composing'}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  {selectedTrack
                    ? `${selectedTrackPattern.filter((step) => step.length > 0).length} active steps · ${selectedTrackPattern.reduce((sum, step) => sum + step.length, 0)} notes · ${isSelectedTrackDrum ? 'drum lane' : 'melodic lane'}`
                    : `${tracks.length} total tracks · ${melodicTrackCount} melodic lanes ready for note editing`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
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
                    >
                      <Play className="h-3.5 w-3.5" />
                      Audition
                    </button>
                    <button
                      className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => setActiveView(isSelectedTrackDrum ? 'ARRANGER' : 'PIANO_ROLL')}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {isSelectedTrackDrum ? 'Song tools' : 'Deep edit'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="flex-1 overflow-auto rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]"
              onWheel={(event) => {
                const node = gridViewportRef.current;
                if (!node || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
                  return;
                }

                if (node.scrollWidth <= node.clientWidth) {
                  return;
                }

                event.preventDefault();
                node.scrollLeft += event.deltaY;
              }}
              ref={gridViewportRef}
            >
              <div style={{ minWidth: `${laneHeaderWidth + stepGridWidth}px` }}>
                <div className="sticky top-0 z-10 flex h-12 border-b border-[var(--border-soft)] bg-[rgba(8,12,17,0.96)] backdrop-blur">
                  <div className={`${laneHeaderWidthClass} shrink-0 border-r border-[var(--border-soft)] px-5 py-3`}>
                    <div className="flex items-center gap-2">
                      <Music2 className="h-4 w-4 text-[var(--accent)]" />
                      <span className="section-label">Tracks</span>
                    </div>
                  </div>
                  <div className="flex" style={{ width: `${stepGridWidth}px` }}>
                    {Array.from({ length: stepsPerPattern }, (_, stepIndex) => stepIndex).map((stepIndex) => (
                      <button
                        className={`shrink-0 border-r border-[var(--border-soft)] flex items-center justify-center ${stepIndex % 4 === 0 ? 'bg-[rgba(255,255,255,0.035)]' : ''} ${selectedStepIndex === stepIndex ? 'text-[var(--accent-strong)]' : ''}`}
                        key={stepIndex}
                        onClick={() => setSelectedStepIndex(stepIndex)}
                        style={{ width: `${stepCellWidth}px` }}
                      >
                        <span className={`font-mono text-[11px] ${stepIndex % 4 === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                          {stepIndex + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

              {visibleTracks.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No lanes match the current scope. Change the filter or add activity to the current pattern.
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
                          className={`group relative ${laneHeaderWidthClass} shrink-0 border-r border-[var(--border-soft)] ${laneHeaderPaddingClass} text-left cursor-pointer`}
                          onClick={() => setSelectedTrackId(track.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedTrackId(track.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {selected && <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full" style={{ backgroundColor: track.color }} />}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                                <span className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</span>
                              </div>
                              <div className="mt-2 flex items-center gap-3">
                                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</span>
                                {pinned && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">Pinned</span>}
                                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.source.engine}</span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{sourceLabel}</span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.volume.toFixed(0)} dB</span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                                  {patternSteps.reduce((sum, step) => sum + step.length, 0)} notes
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
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
                              <RowActionBtn label="Move track up" onClick={(event) => {
                                event.stopPropagation();
                                moveTrack(track.id, 'up');
                              }}>
                                <ArrowUp className="h-3.5 w-3.5" />
                              </RowActionBtn>
                              <RowActionBtn label="Move track down" onClick={(event) => {
                                event.stopPropagation();
                                moveTrack(track.id, 'down');
                              }}>
                                <ArrowDown className="h-3.5 w-3.5" />
                              </RowActionBtn>
                              <RowActionBtn label="Duplicate track" onClick={(event) => {
                                event.stopPropagation();
                                duplicateTrack(track.id);
                              }}>
                                <Copy className="h-3.5 w-3.5" />
                              </RowActionBtn>
                              <RowActionBtn label="Clear pattern" onClick={(event) => {
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
                          </div>
                        </div>

                        <div className={`flex gap-[2px] ${laneGridPaddingClass}`} style={{ width: `${stepGridWidth}px` }}>
                          {patternSteps.map((value, stepIndex) => {
                            const isActive = value.length > 0;
                            const isCurrent = currentStep === stepIndex;
                            const isSelectedStep = selectedStepIndex === stepIndex;
                            const leadEvent = value[0];
                            const extraNotes = Math.max(0, value.length - 1);
                            const maxGate = value.reduce((gate, event) => Math.max(gate, event.gate), 0);

                            return (
                              <button
                                className={`relative shrink-0 border transition-colors ${compactLanes ? 'min-h-[38px]' : 'min-h-[48px]'} ${isActive ? 'border-transparent' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]'} ${isCurrent ? 'ring-1 ring-inset ring-[rgba(255,255,255,0.08)]' : ''} ${isSelectedStep ? 'outline outline-1 outline-offset-0 outline-[rgba(125,211,252,0.26)]' : ''}`}
                                key={`${track.id}-${stepIndex}`}
                                onClick={() => {
                                  setSelectedTrackId(track.id);
                                  setSelectedStepIndex(stepIndex);
                                  toggleStep(track.id, stepIndex);
                                }}
                                style={isActive
                                  ? {
                                      background: isCurrent ? track.color : `${track.color}cc`,
                                      boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.12)',
                                      width: `${stepCellWidth - 2}px`,
                                    }
                                  : {
                                      width: `${stepCellWidth - 2}px`,
                                    }}
                              >
                                {isActive && !['kick', 'snare', 'hihat'].includes(track.type) && leadEvent && (
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
                                {extraNotes > 0 && (
                                  <span className="absolute left-1 top-1 rounded-sm bg-black/20 px-1 font-mono text-[8px] text-white/80">
                                    {value.length}
                                  </span>
                                )}
                                {isCurrent && <span className="absolute inset-y-1 left-1 w-[2px] rounded-full bg-white/50" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              </div>
            </div>
            <div className="mt-3 rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Use the strip, trackpad, or mouse wheel to move across the pattern when step counts grow.
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
                    {Math.floor(gridScrollLeft / stepCellWidth) + 1}
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
                    {Math.min(stepsPerPattern, Math.ceil((gridScrollLeft + gridViewportWidth) / stepCellWidth))}
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
            </div>
          </div>
        </div>

        <aside className="surface-panel-strong sonic-sidebar w-[320px] shrink-0 overflow-auto p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <span className="section-label">Compose inspector</span>
          </div>

          {selectedTrack ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
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
                    onClick={() => setActiveView(isSelectedTrackDrum ? 'ARRANGER' : 'PIANO_ROLL')}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {isSelectedTrackDrum ? 'Song tools' : 'Deep edit'}
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
              </div>

              <div className="rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="section-label">Pattern actions</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => shiftPattern(selectedTrack.id, 'left')}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
                    Shift left
                  </button>
                  <button
                    className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    onClick={() => shiftPattern(selectedTrack.id, 'right')}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Shift right
                  </button>
                  {!isSelectedTrackDrum && (
                    <>
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        onClick={() => transposePattern(selectedTrack.id, -1)}
                      >
                        Note down
                      </button>
                      <button
                        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        onClick={() => transposePattern(selectedTrack.id, 1)}
                      >
                        Note up
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="section-label">Selected step</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[var(--text-primary)]">Step {selectedStepIndex + 1}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    {selectedStep.length} note{selectedStep.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  {selectedLeadEvent
                    ? `${selectedLeadEvent.note} · velocity ${Math.round(selectedLeadEvent.velocity * 100)} · gate ${selectedLeadEvent.gate.toFixed(2)}`
                    : 'This step is empty. Click the grid to place a note or trigger.'}
                </div>
                {!isSelectedTrackDrum && selectedLeadEvent && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="section-label">Velocity</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{Math.round(selectedLeadEvent.velocity * 100)}</span>
                      </div>
                      <input
                        className="mt-3"
                        max="1"
                        min="0.1"
                        onChange={(event) => updateStepEvent(selectedTrack.id, selectedStepIndex, 0, { velocity: Number(event.target.value) })}
                        step="0.01"
                        type="range"
                        value={selectedLeadEvent.velocity}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="section-label">Gate</span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{selectedLeadEvent.gate.toFixed(2)}</span>
                      </div>
                      <input
                        className="mt-3"
                        max={NOTE_GATE_MAX}
                        min={NOTE_GATE_MIN}
                        onChange={(event) => updateStepEvent(selectedTrack.id, selectedStepIndex, 0, { gate: clampNoteGate(Number(event.target.value)) })}
                        step={NOTE_GATE_FINE_STEP}
                        type="range"
                        value={selectedLeadEvent.gate}
                      />
                    </div>
                  </div>
                )}

                {selectedStep.length > 1 && (
                  <div className="mt-4 grid gap-2">
                    {selectedStep.map((event, noteIndex) => (
                      <div
                        className="rounded-[10px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                        key={`${event.note}-${noteIndex}`}
                      >
                        <div className="font-mono text-[12px] text-[var(--text-primary)]">{event.note}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                          Vel {Math.round(event.velocity * 100)} · Gate {event.gate.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Select a lane to inspect the current pattern without leaving the grid.</p>
          )}
        </aside>
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
    className={`control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${active ? 'text-[var(--accent-strong)]' : ''}`}
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
    className={`ghost-icon-button flex h-8 w-8 items-center justify-center ${active ? 'border-[rgba(124,211,252,0.3)] bg-[rgba(124,211,252,0.1)] text-[var(--accent-strong)]' : ''}`}
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
    className={`control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${active ? 'text-[var(--accent-strong)]' : ''}`}
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
