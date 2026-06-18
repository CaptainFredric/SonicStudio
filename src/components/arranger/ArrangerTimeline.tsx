import React, { useCallback, useEffect, useRef } from 'react';
import { GripVertical } from 'lucide-react';

import type { ArrangementClip } from '../../project/schema';
import { ArrangerLaneMenu } from './ArrangerLaneMenu';
import type { DragMode, LaneSection, LaneSectionKey, SnapSize, ZoomPreset } from './types';

const DRAG_HANDLE_WIDTH = 8;

interface ArrangerTimelineProps {
  clipHeightClass: string;
  collapsedGroups: Record<LaneSectionKey, boolean>;
  currentStep: number;
  onPinchZoom?: (delta: number, anchorRatio: number) => void;
  getRenderedClipFrame: (clip: ArrangementClip) => { beatLength: number; startBeat: number };
  handleTimelineWheel: (event: WheelEvent) => void;
  inspectorOpen: boolean;
  laneDataCount: number;
  laneHeightClass: string;
  laneLabelWidth: number;
  laneSections: LaneSection[];
  maxTimelineScrollLeft: number;
  onBeginClipDrag: (clip: ArrangementClip, event: React.PointerEvent<HTMLDivElement>, mode: DragMode) => void;
  onDropNoteString?: (stringId: string, trackId: string) => boolean;
  onMoveTrack: (trackId: string, direction: 'up' | 'down') => void;
  onScrollTimelineByViewport: (direction: -1 | 1) => void;
  onSelectClip: (clipId: string) => void;
  queuedNoteStringId?: string | null;
  setQueuedNoteStringId?: (id: string | null) => void;
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
  onPinchZoom,
  getRenderedClipFrame,
  handleTimelineWheel,
  inspectorOpen,
  laneDataCount,
  laneHeightClass,
  laneLabelWidth,
  laneSections,
  maxTimelineScrollLeft,
  onBeginClipDrag,
  onDropNoteString,
  onMoveTrack,
  onScrollTimelineByViewport,
  onSelectClip,
  queuedNoteStringId = null,
  setQueuedNoteStringId,
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
}: ArrangerTimelineProps) => {
  const panStateRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const pinchStateRef = useRef<{ distance: number } | null>(null);
  const songTimelineWidth = timelineSteps * pixelsPerStep;
  const runwayWidth = Math.max(0, timelineWidth - songTimelineWidth);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node) {
      return undefined;
    }

    const onWheel = (event: WheelEvent) => {
      handleTimelineWheel(event);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
    };
  }, [handleTimelineWheel, timelineRef]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && onPinchZoom) {
      const [a, b] = [event.touches[0], event.touches[1]];
      pinchStateRef.current = { distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) };
    }
  }, [onPinchZoom]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchStateRef.current || !onPinchZoom) return;
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const delta = distance - pinchStateRef.current.distance;
    if (Math.abs(delta) < 3) return;
    event.preventDefault();
    const node = timelineRef.current;
    const bounds = node?.getBoundingClientRect();
    const midX = (a.clientX + b.clientX) / 2;
    const ratio = bounds && bounds.width > 0 ? (midX - bounds.left) / bounds.width : 0.5;
    onPinchZoom(delta * 0.5, ratio);
    pinchStateRef.current = { distance };
  }, [onPinchZoom, timelineRef]);

  const handleTouchEnd = useCallback(() => {
    pinchStateRef.current = null;
  }, []);

  const laneDragStateRef = useRef<{ trackId: string; lastY: number } | null>(null);

  const handleLaneDragStart = useCallback((trackId: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    laneDragStateRef.current = { trackId, lastY: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleLaneDragMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = laneDragStateRef.current;
    if (!state) return;
    const ROW_THRESHOLD = 44;
    const delta = event.clientY - state.lastY;
    if (Math.abs(delta) < ROW_THRESHOLD) return;
    const direction = delta > 0 ? 'down' : 'up';
    onMoveTrack(state.trackId, direction);
    laneDragStateRef.current = { trackId: state.trackId, lastY: state.lastY + (direction === 'down' ? ROW_THRESHOLD : -ROW_THRESHOLD) };
  }, [onMoveTrack]);

  const handleLaneDragEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    laneDragStateRef.current = null;
    document.body.style.cursor = '';
  }, []);

  const handleRulerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const node = timelineRef.current;
    if (!node) return;
    if (event.button !== 0 && event.button !== 1) return;
    panStateRef.current = { startX: event.clientX, startScroll: node.scrollLeft };
    node.setPointerCapture?.(event.pointerId);
    node.style.cursor = 'grabbing';
  }, [timelineRef]);

  const handleRulerPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    const node = timelineRef.current;
    if (!state || !node) return;
    node.scrollLeft = state.startScroll - (event.clientX - state.startX);
  }, [timelineRef]);

  const handleRulerPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const node = timelineRef.current;
    if (panStateRef.current && node) {
      try {
        node.releasePointerCapture?.(event.pointerId);
      } catch {
        /* ignore */
      }
      node.style.cursor = '';
    }
    panStateRef.current = null;
  }, [timelineRef]);

  return (
  <div className="flex min-w-0 flex-1 flex-col">
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="section-label">Timeline</div>
        {!inspectorOpen && selectedClip && (
          <div className="min-w-0 whitespace-normal break-words text-[11px] leading-5 text-[var(--text-secondary)] sm:truncate">{phraseSummary}</div>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {!inspectorOpen && (
          <button
            className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => onSetInspectorOpen(true)}
          >
            Show desk
          </button>
        )}
        <button
          aria-label="Scroll the timeline left"
          className="control-chip flex h-9 w-9 items-center justify-center text-base"
          disabled={scrollLeft <= 0}
          onClick={() => onScrollTimelineByViewport(-1)}
          title="Scroll left (one viewport)"
        >
          ‹
        </button>
        <button
          aria-label="Scroll the timeline right"
          className="control-chip flex h-9 w-9 items-center justify-center text-base"
          disabled={scrollLeft >= maxTimelineScrollLeft - 1}
          onClick={() => onScrollTimelineByViewport(1)}
          title="Scroll right (one viewport)"
        >
          ›
        </button>
        <div className="w-full font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)] sm:w-auto sm:text-right">
          {totalBars} bars · snap {snapSize} · {zoomPreset.toLowerCase()}
        </div>
      </div>
    </div>

    <div className="relative min-h-0 flex-1">
      {scrollLeft > 4 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6"
          style={{ background: 'linear-gradient(90deg, rgba(4,7,11,0.85), transparent)' }}
        />
      )}
      {scrollLeft < maxTimelineScrollLeft - 4 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6"
          style={{ background: 'linear-gradient(270deg, rgba(4,7,11,0.85), transparent)' }}
        />
      )}
    <div
      className="timeline-shell h-full overflow-auto rounded-[4px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      ref={timelineRef}
    >
      <div className="min-h-full p-4" style={{ minWidth: `${timelineWidth}px` }}>
        <div className="grid" style={{ gridTemplateColumns: `${laneLabelWidth}px minmax(0, 1fr)` }}>
          <div className="sticky left-0 z-10 border-b border-r border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-4 py-3 backdrop-blur" style={{ width: `${laneLabelWidth}px` }}>
            <div className="section-label">Track lanes</div>
          </div>
          <div
            className="relative cursor-grab border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] select-none touch-pan-x"
            onPointerDown={handleRulerPointerDown}
            onPointerMove={handleRulerPointerMove}
            onPointerUp={handleRulerPointerUp}
            onPointerCancel={handleRulerPointerUp}
            title="Drag horizontally to pan the timeline"
          >
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
              {runwayWidth > 0 && (
                <button
                  className="group relative flex h-14 shrink-0 flex-col items-center justify-center border-l border-dashed border-[rgba(151,163,180,0.24)] bg-[linear-gradient(90deg,rgba(255,255,255,0.02),rgba(114,217,255,0.06))] text-center"
                  style={{ width: `${runwayWidth}px` }}
                  title="Drag clips into this runway to keep extending the song"
                  type="button"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">Open end</span>
                  <span className="mt-1 text-[10px] text-[var(--text-tertiary)]">drag clips right to extend</span>
                </button>
              )}
            </div>
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-[rgba(124,211,252,0.8)]"
              style={{ left: `${currentStep * pixelsPerStep}px` }}
            />
            {runwayWidth > 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-[rgba(151,163,180,0.24)]"
                style={{ left: `${songTimelineWidth}px` }}
              />
            )}
          </div>

          {laneDataCount === 0 ? (
            <div className="col-span-2 flex items-center justify-center px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
              No arranger lanes match the current scope. Change the lane filter or add clips to the song view.
            </div>
          ) : laneSections.map(({ key, label, lanes }) => (
            <React.Fragment key={key}>
              <div className="sticky left-0 z-10 border-b border-r border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-4 py-3" style={{ width: `${laneLabelWidth}px` }}>
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
                      className={`group/lane sticky left-0 z-10 flex items-center gap-2 border-b border-r border-[var(--border-soft)] px-3 py-4 text-left transition-colors ${isSelectedTrack ? 'bg-[rgba(124,211,252,0.09)]' : 'bg-[var(--bg-panel-strong)] hover:bg-[rgba(255,255,255,0.03)]'}`}
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
                      <button
                        aria-label={`Drag to reorder ${track.name}`}
                        className="flex h-6 w-5 cursor-grab items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] touch-none"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={handleLaneDragStart(track.id)}
                        onPointerMove={handleLaneDragMove}
                        onPointerUp={handleLaneDragEnd}
                        onPointerCancel={handleLaneDragEnd}
                        title="Drag to reorder"
                        type="button"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: track.color }} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-5 text-[var(--text-primary)]">{track.name}</div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                          {track.type} · {clips.length} clip{clips.length === 1 ? '' : 's'}{pinned ? ' · pinned' : ''}
                        </div>
                      </div>
                      <ArrangerLaneMenu
                        isOpen={openLaneMenuTrackId === track.id}
                        onMoveTrack={onMoveTrack}
                        onSetOpen={onSetOpenLaneMenuTrackId}
                        onToggleMute={onToggleMute}
                        onTogglePinnedTrack={onTogglePinnedTrack}
                        onToggleSolo={onToggleSolo}
                        pinned={pinned}
                        track={track}
                      />
                    </div>
                    <div
                      className="relative border-b border-[var(--border-soft)] py-3"
                      onClick={() => {
                        if (queuedNoteStringId && onDropNoteString) {
                          const applied = onDropNoteString(queuedNoteStringId, track.id);
                          if (applied && setQueuedNoteStringId) {
                            setQueuedNoteStringId(null);
                          }
                        }
                      }}
                      onDragEnter={(event) => {
                        if (!onDropNoteString) return;
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
                        if (!onDropNoteString) return;
                        if (event.dataTransfer.types.includes('application/x-sonicstudio-note-string')) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'copy';
                        }
                      }}
                      onDrop={(event) => {
                        if (!onDropNoteString) return;
                        const stringId = event.dataTransfer.getData('application/x-sonicstudio-note-string');
                        if (!stringId) return;
                        event.preventDefault();
                        delete event.currentTarget.dataset.dropTarget;
                        onDropNoteString(stringId, track.id);
                      }}
                    >
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
                        {runwayWidth > 0 && (
                          <div
                            className="absolute inset-y-0 border-l border-dashed border-[rgba(151,163,180,0.18)] bg-[linear-gradient(90deg,rgba(255,255,255,0.015),rgba(114,217,255,0.04))]"
                            style={{ left: `${songTimelineWidth}px`, width: `${runwayWidth}px` }}
                          />
                        )}
                      </div>
                      <div
                        className="pointer-events-none absolute bottom-0 top-0 z-[1] w-[2px] bg-[rgba(124,211,252,0.8)]"
                        style={{ left: `${currentStep * pixelsPerStep}px` }}
                      />
                      <div className={`relative z-[2] flex ${laneHeightClass} items-center`}>
                        {clips.map((clip) => {
                          const isSelectedClip = selectedArrangerClipId === clip.id;
                          const frame = getRenderedClipFrame(clip);
                          const clipWidth = frame.beatLength * pixelsPerStep;
                          const isTightClip = clipWidth < 132;
                          const isMicroClip = clipWidth < 84;
                          const compactPatternLabel = `P${String.fromCharCode(65 + clip.patternIndex)}`;
                          const shortTrackName = track.name
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 3)
                            .toUpperCase();

                          return (
                            <div
                              className={`group absolute top-1/2 flex ${clipHeightClass} -translate-y-1/2 overflow-hidden border shadow-[0_12px_24px_rgba(0,0,0,0.24)] transition-all ${isTightClip ? 'px-2 py-1.5' : 'px-3 py-2'} ${isSelectedClip ? 'ring-1 ring-[rgba(255,255,255,0.28)]' : ''}`}
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
                              title={`${track.name} · Pattern ${String.fromCharCode(65 + clip.patternIndex)} · ${frame.beatLength} steps`}
                            >
                              <div
                                className="absolute inset-y-0 left-0 z-[3] cursor-ew-resize bg-[rgba(255,255,255,0.08)] opacity-0 transition-opacity group-hover:opacity-100"
                                onPointerDown={(event) => onBeginClipDrag(clip, event, 'trim-start')}
                                style={{ width: `${DRAG_HANDLE_WIDTH}px` }}
                              />
                              <div className={`min-w-0 flex-1 ${isMicroClip ? 'flex items-center justify-center' : ''}`}>
                                {isMicroClip ? (
                                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-primary)]">
                                    {compactPatternLabel}
                                  </div>
                                ) : (
                                  <>
                                    <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                      {isTightClip ? shortTrackName || track.name.slice(0, 3).toUpperCase() : track.name}
                                    </div>
                                    {isTightClip ? (
                                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                                        {compactPatternLabel} · {frame.beatLength} st
                                      </div>
                                    ) : (
                                      <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-[var(--text-secondary)]">
                                        <span>Pattern {String.fromCharCode(65 + clip.patternIndex)}</span>
                                        <span>{frame.beatLength} steps</span>
                                      </div>
                                    )}
                                  </>
                                )}
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
      <div
        aria-hidden="true"
        className="arranger-timeline-fade"
      />
    </div>
    </div>
    <div className="mt-3 rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          Song span navigation
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {visibleStartStep + 1}
          </span>
          <input
            aria-label="Scroll the timeline horizontally"
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
};
