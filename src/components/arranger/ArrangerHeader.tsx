import React from 'react';
import { Plus } from 'lucide-react';

import type { ArrangementClip, SongMarker, Track } from '../../project/schema';
import type { LaneScope, SnapSize, ZoomPreset } from './types';

interface SnapOption {
  label: string;
  value: SnapSize;
}

interface ArrangerHeaderProps {
  addClip: () => void;
  arrangerClips: ArrangementClip[];
  compactLaneView: boolean;
  currentStep: number;
  followPlayhead: boolean;
  inspectorOpen: boolean;
  laneDataCount: number;
  laneScope: LaneScope;
  markerCount: number;
  onJumpToBoundary: (step: number) => void;
  onJumpToPlayhead: () => void;
  onRevealSelectedClip: () => void;
  onSelectClip: (clipId: string) => void;
  onSetCompactLaneView: (value: boolean) => void;
  onSetFollowPlayhead: (value: boolean) => void;
  onSetInspectorOpen: (value: boolean) => void;
  onSetInspectorTab: () => void;
  onSetLaneScope: (value: LaneScope) => void;
  onSetSnapSize: (value: SnapSize) => void;
  onSetZoomPreset: (value: ZoomPreset) => void;
  phraseSummary: string;
  sectionCount: number;
  selectedArrangerClipId: string | null;
  selectedClip: ArrangementClip | null;
  snapOptions: SnapOption[];
  snapSize: SnapSize;
  songMarkers: SongMarker[];
  timelineSteps: number;
  totalBars: number;
  totalDurationSeconds: number;
  tracks: Track[];
  visibleEndStep: number;
  visibleRangeLabel: string;
  visibleStartStep: number;
  zoomPreset: ZoomPreset;
}

export const ArrangerHeader = ({
  addClip,
  arrangerClips,
  compactLaneView,
  currentStep,
  followPlayhead,
  inspectorOpen,
  laneDataCount,
  laneScope,
  markerCount,
  onJumpToBoundary,
  onJumpToPlayhead,
  onRevealSelectedClip,
  onSelectClip,
  onSetCompactLaneView,
  onSetFollowPlayhead,
  onSetInspectorOpen,
  onSetInspectorTab,
  onSetLaneScope,
  onSetSnapSize,
  onSetZoomPreset,
  phraseSummary,
  sectionCount,
  selectedArrangerClipId,
  selectedClip,
  snapOptions,
  snapSize,
  songMarkers,
  timelineSteps,
  totalBars,
  totalDurationSeconds,
  tracks,
  visibleEndStep,
  visibleRangeLabel,
  visibleStartStep,
  zoomPreset,
}: ArrangerHeaderProps) => (
  <div className="border-b border-[var(--border-soft)] px-5 py-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="section-label">Arranger</div>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Song composer</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
          Build the song directly on the timeline.
        </p>
      </div>
      <button
        className="control-field flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
        onClick={addClip}
      >
        <Plus className="h-4 w-4" />
        Add clip
      </button>
    </div>

    <div className="mt-4 grid gap-4 border-t border-[var(--border-soft)] pt-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
      <div className="min-w-0 xl:border-r xl:border-[var(--border-soft)] xl:pr-5">
        <div className="section-label">Song overview</div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--text-primary)]">
          <span>{timelineSteps} steps</span>
          <span>{totalBars} bars</span>
          <span>{totalDurationSeconds.toFixed(1)}s</span>
          <span className="text-[var(--text-secondary)]">Visible {visibleRangeLabel}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#7dd3fc,#67e8f9)]"
            style={{
              marginLeft: `${(visibleStartStep / timelineSteps) * 100}%`,
              width: `${Math.min(100, (Math.max(1, visibleEndStep - visibleStartStep) / timelineSteps) * 100)}%`,
            }}
          />
        </div>
        <div className="relative mt-3 h-10 overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
          <button
            className="absolute inset-0"
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const ratio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
              onJumpToBoundary(Math.max(0, Math.round(ratio * timelineSteps)));
            }}
          />
          {arrangerClips.map((clip) => {
            const track = tracks.find((candidate) => candidate.id === clip.trackId);
            if (!track) {
              return null;
            }

            const isSelected = clip.id === selectedArrangerClipId;

            return (
              <button
                className={`absolute inset-y-2 rounded-sm border ${isSelected ? 'ring-1 ring-white/60' : ''}`}
                key={`overview-${clip.id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectClip(clip.id);
                  onJumpToBoundary(clip.startBeat);
                }}
                style={{
                  backgroundColor: `${track.color}44`,
                  borderColor: `${track.color}${isSelected ? 'ee' : '99'}`,
                  left: `${(clip.startBeat / timelineSteps) * 100}%`,
                  width: `${Math.max(0.8, (clip.beatLength / timelineSteps) * 100)}%`,
                }}
              />
            );
          })}
          {songMarkers.map((marker) => (
            <button
              className="absolute inset-y-0 z-[2] w-0.5 bg-[rgba(255,255,255,0.9)]"
              key={marker.id}
              onClick={(event) => {
                event.stopPropagation();
                onJumpToBoundary(marker.beat);
              }}
              style={{ left: `${(marker.beat / timelineSteps) * 100}%` }}
              title={marker.name}
            />
          ))}
          <div
            className="pointer-events-none absolute inset-y-0 w-[2px] bg-[rgba(255,255,255,0.85)]"
            style={{ left: `${(currentStep / timelineSteps) * 100}%` }}
          />
        </div>
        <div className="mt-4 grid gap-3 border-t border-[var(--border-soft)] pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="section-label">Current focus</div>
            <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{phraseSummary}</div>
            {selectedClip && (
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                Start {selectedClip.startBeat + 1} · Length {selectedClip.beatLength} · Snap {snapSize}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {markerCount} marker{markerCount === 1 ? '' : 's'}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {sectionCount} section{sectionCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 xl:pl-5">
        <div className="section-label">View controls</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-xs text-[var(--text-secondary)]">
            <span className="section-label">Zoom</span>
            <select
              className="control-field h-10 px-3 text-xs font-semibold uppercase tracking-[0.14em]"
              onChange={(event) => onSetZoomPreset(event.target.value as ZoomPreset)}
              value={zoomPreset}
            >
              <option value="SONG">Song</option>
              <option value="SECTION">Section</option>
              <option value="PHRASE">Phrase</option>
            </select>
          </label>

          <label className="grid gap-2 text-xs text-[var(--text-secondary)]">
            <span className="section-label">Snap</span>
            <select
              className="control-field h-10 px-3 text-xs font-semibold uppercase tracking-[0.14em]"
              onChange={(event) => onSetSnapSize(Number(event.target.value) as SnapSize)}
              value={snapSize}
            >
              {snapOptions.map((option) => (
                <option key={`snap-${option.value}`} value={option.value}>
                  {option.label} step{option.value === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-xs text-[var(--text-secondary)]">
            <span className="section-label">Lane scope</span>
            <select
              className="control-field h-10 px-3 text-xs font-semibold uppercase tracking-[0.14em]"
              onChange={(event) => onSetLaneScope(event.target.value as LaneScope)}
              value={laneScope}
            >
              <option value="ALL">All lanes</option>
              <option value="ACTIVE">Active clips</option>
              <option value="FOCUSED">Focused track</option>
              <option value="PINNED">Pinned lanes</option>
              <option value="DRUMS">Drums</option>
              <option value="MUSICAL">Musical</option>
            </select>
          </label>

          <div className="grid gap-2 text-xs text-[var(--text-secondary)]">
            <span className="section-label">Session view</span>
            <div className="flex gap-2">
              <ControlToggle
                active={followPlayhead}
                label="Follow"
                onClick={() => onSetFollowPlayhead(!followPlayhead)}
              />
              <ControlToggle
                active={compactLaneView}
                label={compactLaneView ? 'Compact on' : 'Compact off'}
                onClick={() => onSetCompactLaneView(!compactLaneView)}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-3">
          <ControlToggle active={false} label="Reveal clip" onClick={onRevealSelectedClip} />
          <ControlToggle active={false} label="Playhead" onClick={onJumpToPlayhead} />
          <ControlToggle active={false} label="Start" onClick={() => onJumpToBoundary(0)} />
          <ControlToggle active={false} label="End" onClick={() => onJumpToBoundary(timelineSteps)} />
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            onClick={onSetInspectorTab}
          >
            Song tools
          </button>
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            data-active={inspectorOpen ? 'true' : 'false'}
            onClick={() => onSetInspectorOpen(!inspectorOpen)}
          >
            {inspectorOpen ? 'Hide desk' : 'Show desk'}
          </button>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {laneDataCount} visible lanes
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ControlToggle = ({
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
