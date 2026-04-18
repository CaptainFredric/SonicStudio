import React from 'react';
import { ArrowDown, ArrowUp, Focus, MoreHorizontal, Pin, VolumeX } from 'lucide-react';

import type { ArrangementClip, Track } from '../../project/schema';
import type { DragMode, LaneSection, LaneSectionKey, SnapSize, ZoomPreset } from './types';

const DRAG_HANDLE_WIDTH = 8;

interface ArrangerTimelineProps {
  clipHeightClass: string;
  collapsedGroups: Record<LaneSectionKey, boolean>;
  currentStep: number;
  getRenderedClipFrame: (clip: ArrangementClip) => { beatLength: number; startBeat: number };
  handleTimelineWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  inspectorOpen: boolean;
  laneDataCount: number;
  laneHeightClass: string;
  laneLabelWidth: number;
  laneSections: LaneSection[];
  maxTimelineScrollLeft: number;
  onBeginClipDrag: (clip: ArrangementClip, event: React.PointerEvent<HTMLDivElement>, mode: DragMode) => void;
  onMoveTrack: (trackId: string, direction: 'up' | 'down') => void;
  onScrollTimelineByViewport: (direction: -1 | 1) => void;
  onSelectClip: (clipId: string) => void;
  onSetInspectorOpen: (value: boolean) => void;
  onSetOpenLaneMenuTrackId: (trackId: string | null) => void;
  onSetSelectedTrackId: (trackId: string) => void;
  onToggleCollapsedGroup: (key: LaneSectionKey) => void;
  onToggleMute: (trackId: string) => void;
  onTogglePinnedTrack: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  openLaneMenuTrackId: string | null;
  phraseSummary: string;
  pinnedTrackIds: string[];
  pixelsPerStep: number;
  scrollLeft: number;
  selectedArrangerClipId: string | null;
  selectedClip: ArrangementClip | null;
  selectedTrackId: string | null;
  setScrollStripPosition: (value: number) => void;
  snapSize: SnapSize;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  timelineSteps: number;
  timelineWidth: number;
  totalBars: number;
  visibleEndStep: number;
  visibleStartStep: number;
  zoomPreset: ZoomPreset;
}

export const ArrangerTimeline = ({
  clipHeightClass,
  collapsedGroups,
  currentStep,
  getRenderedClipFrame,
  handleTimelineWheel,
  inspectorOpen,
  laneDataCount,
  laneHeightClass,
  laneLabelWidth,
  laneSections,
  maxTimelineScrollLeft,
  onBeginClipDrag,
  onMoveTrack,
  onScrollTimelineByViewport,
  onSelectClip,
  onSetInspectorOpen,
  onSetOpenLaneMenuTrackId,
  onSetSelectedTrackId,
  onToggleCollapsedGroup,
  onToggleMute,
  onTogglePinnedTrack,
  onToggleSolo,
  openLaneMenuTrackId,
  phraseSummary,
  pinnedTrackIds,
  pixelsPerStep,
  scrollLeft,
  selectedArrangerClipId,
  selectedClip,
  selectedTrackId,
  setScrollStripPosition,
  snapSize,
  timelineRef,
  timelineSteps,
  timelineWidth,
  totalBars,
  visibleEndStep,
  visibleStartStep,
  zoomPreset,
}: ArrangerTimelineProps) => (
  <div className="flex min-w-0 flex-1 flex-col">
    <div className="mb-3 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="section-label">Timeline</div>
        {!inspectorOpen && selectedClip && (
          <div className="truncate text-[11px] text-[var(--text-secondary)]">{phraseSummary}</div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!inspectorOpen && (
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => onSetInspectorOpen(true)}
          >
            Show desk
          </button>
        )}
        <button
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          onClick={() => onScrollTimelineByViewport(-1)}
        >
          Scroll left
        </button>
        <button
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          onClick={() => onScrollTimelineByViewport(1)}
        >
          Scroll right
        </button>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {totalBars} bars · snap {snapSize} steps · {zoomPreset.toLowerCase()} zoom
        </div>
      </div>
    </div>

    <div
      className="timeline-shell min-h-0 flex-1 overflow-auto border border-[var(--border-soft)] bg-[rgba(0,0,0,0.24)]"
      onWheel={handleTimelineWheel}
      ref={timelineRef}
    >
      <div className="min-h-full p-4" style={{ minWidth: `${timelineWidth}px` }}>
        <div className="grid" style={{ gridTemplateColumns: `${laneLabelWidth}px minmax(0, 1fr)` }}>
          <div className="sticky left-0 z-10 border-b border-r border-[var(--border-soft)] bg-[rgba(8,12,17,0.96)] px-4 py-3 backdrop-blur" style={{ width: `${laneLabelWidth}px` }}>
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

          {laneDataCount === 0 ? (
            <div className="col-span-2 flex items-center justify-center px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
              No arranger lanes match the current scope. Change the lane filter or add clips to the song view.
            </div>
          ) : laneSections.map(({ key, label, lanes }) => (
            <React.Fragment key={key}>
              <div className="sticky left-0 z-10 border-b border-r border-[var(--border-soft)] bg-[rgba(12,16,22,0.98)] px-4 py-3" style={{ width: `${laneLabelWidth}px` }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="section-label">{label}</span>
                  <button
                    className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]"
                    onClick={() => onToggleCollapsedGroup(key)}
                  >
                    {collapsedGroups[key] ? 'Show' : 'Hide'}
                  </button>
                </div>
              </div>
              <div className="border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  {lanes.length} lane{lanes.length === 1 ? '' : 's'}
                </div>
              </div>
              {!collapsedGroups[key] && lanes.map(({ clips, track }) => {
                const isSelectedTrack = selectedTrackId === track.id;
                const pinned = pinnedTrackIds.includes(track.id);

                return (
                  <React.Fragment key={track.id}>
                    <div
                      className={`group/lane sticky left-0 z-10 flex items-center gap-3 border-b border-r border-[var(--border-soft)] px-4 py-4 text-left transition-colors ${isSelectedTrack ? 'bg-[rgba(124,211,252,0.09)]' : 'bg-[rgba(8,12,17,0.96)] hover:bg-[rgba(255,255,255,0.03)]'}`}
                      onClick={() => onSetSelectedTrackId(track.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSetSelectedTrackId(track.id);
                        }
                      }}
                      role="button"
                      style={{ width: `${laneLabelWidth}px` }}
                      tabIndex={0}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: track.color }} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{track.name}</div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                          {track.type} · {clips.length} clip{clips.length === 1 ? '' : 's'}{pinned ? ' · pinned' : ''}
                        </div>
                      </div>
                      <div
                        className="relative ml-auto opacity-0 transition-opacity group-hover/lane:opacity-100 group-focus-within/lane:opacity-100"
                        data-lane-menu-root="true"
                      >
                        <LaneStateButton
                          active={openLaneMenuTrackId === track.id}
                          label="Lane actions"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSetOpenLaneMenuTrackId(openLaneMenuTrackId === track.id ? null : track.id);
                          }}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </LaneStateButton>
                        {openLaneMenuTrackId === track.id && (
                          <div className="absolute right-0 top-[calc(100%+0.4rem)] z-30 min-w-[176px] rounded-[10px] border border-[var(--border-soft)] bg-[rgba(9,12,17,0.98)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                            <LaneMenuAction
                              icon={<VolumeX className="h-3.5 w-3.5" />}
                              label={track.muted ? 'Unmute lane' : 'Mute lane'}
                              onClick={() => {
                                onToggleMute(track.id);
                                onSetOpenLaneMenuTrackId(null);
                              }}
                            />
                            <LaneMenuAction
                              icon={<Focus className="h-3.5 w-3.5" />}
                              label={track.solo ? 'Release solo' : 'Solo lane'}
                              onClick={() => {
                                onToggleSolo(track.id);
                                onSetOpenLaneMenuTrackId(null);
                              }}
                            />
                            <LaneMenuAction
                              icon={<Pin className="h-3.5 w-3.5" />}
                              label={pinned ? 'Unpin lane' : 'Pin lane'}
                              onClick={() => {
                                onTogglePinnedTrack(track.id);
                                onSetOpenLaneMenuTrackId(null);
                              }}
                            />
                            <div className="my-2 h-px bg-[var(--border-soft)]" />
                            <LaneMenuAction
                              icon={<ArrowUp className="h-3.5 w-3.5" />}
                              label="Move up"
                              onClick={() => {
                                onMoveTrack(track.id, 'up');
                                onSetOpenLaneMenuTrackId(null);
                              }}
                            />
                            <LaneMenuAction
                              icon={<ArrowDown className="h-3.5 w-3.5" />}
                              label="Move down"
                              onClick={() => {
                                onMoveTrack(track.id, 'down');
                                onSetOpenLaneMenuTrackId(null);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
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
                      <div className={`relative z-[2] flex ${laneHeightClass} items-center`}>
                        {clips.map((clip) => {
                          const isSelectedClip = selectedArrangerClipId === clip.id;
                          const frame = getRenderedClipFrame(clip);

                          return (
                            <div
                              className={`group absolute top-1/2 flex ${clipHeightClass} -translate-y-1/2 overflow-hidden border px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.24)] transition-all ${isSelectedClip ? 'ring-1 ring-[rgba(255,255,255,0.28)]' : ''}`}
                              key={clip.id}
                              onClick={() => onSelectClip(clip.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  onSelectClip(clip.id);
                                }
                              }}
                              onPointerDown={(event) => onBeginClipDrag(clip, event, 'move')}
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
                                onPointerDown={(event) => onBeginClipDrag(clip, event, 'trim-start')}
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
                              <div
                                className="absolute inset-y-0 right-0 z-[3] cursor-ew-resize bg-[rgba(255,255,255,0.08)] opacity-0 transition-opacity group-hover:opacity-100"
                                onPointerDown={(event) => onBeginClipDrag(clip, event, 'trim-end')}
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
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
    <div className="mt-3 rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          Drag the strip or use the trackpad and mouse wheel to move across the song span.
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {visibleStartStep + 1}
          </span>
          <input
            className="sonic-scroll-strip"
            max={maxTimelineScrollLeft}
            min={0}
            onChange={(event) => setScrollStripPosition(Number(event.target.value))}
            step={Math.max(1, snapSize * pixelsPerStep)}
            type="range"
            value={Math.min(scrollLeft, maxTimelineScrollLeft)}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {Math.max(visibleStartStep + 1, visibleEndStep)}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const LaneStateButton = ({
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

const LaneMenuAction = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
    onClick={onClick}
    type="button"
  >
    <span className="text-[var(--text-tertiary)]">{icon}</span>
    <span>{label}</span>
  </button>
);
