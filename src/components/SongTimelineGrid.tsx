import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsLeft, ChevronsRight, GripVertical, Music2, X } from 'lucide-react';
import type React from 'react';

import { engine } from '../audio/ToneEngine';
import { resolvePatternStepForPlayback } from '../audio/playbackResolver';
import { NOTE_NAMES, SUPERSONIC_NOTE_OFFSETS, getTrackAnchorNote, shiftPitch } from '../utils/notePlacement';
import { TrackIcon } from '../utils/trackPersonality';
import type { ArrangementClip, SongMarker, Track } from '../project/schema';

const SECTION_COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f59e0b',
];

const RULER_HEIGHT = 30;
const GUTTER_WIDTH = 156;

// A sortable pitch value (octave * 12 + pitch class) so a step's notes can be
// stacked highest-to-lowest when shown as subnotes.
const pitchRank = (note: string): number => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 0;
  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  return Number(match[2]) * 12 + (pitchClass < 0 ? 0 : pitchClass);
};
const OVERSCAN = 8;

interface SongTimelineGridProps {
  tracks: Track[];
  arrangerClips: ArrangementClip[];
  stepsPerPattern: number;
  songLengthInBeats: number;
  songMarkers: SongMarker[];
  selectedTrackId: string | null;
  superSonicMode?: boolean;
  onSelectTrack: (trackId: string) => void;
  onToggleStep: (trackId: string, patternIndex: number, localStep: number) => void;
  onPlaceNote?: (trackId: string, patternIndex: number, localStep: number, note: string) => void;
  onSeek?: (beat: number) => void;
  onRenameSection?: (markerId: string, name: string) => void;
  onRemoveSection?: (markerId: string) => void;
  onReorderTrack?: (trackId: string, toIndex: number) => void;
}

// A flattened, scrollable view of the whole arrangement: one lane per track with
// a cell for every step of the song, so every note that plays is visible (not
// just the current 16-step pattern). Editing lands on the pattern the
// arrangement loops there. The section ruler is editable and lanes can be
// dragged to reorder. In SuperSonic mode the cells grow and an empty cell shows
// the pitch ladder on hover, so you can drop a specific pitch straight from the
// whole-song view (the same placement the per-pattern grid offers). Cells are
// virtualized to a window so a long song stays smooth.
export const SongTimelineGrid = ({
  tracks,
  arrangerClips,
  stepsPerPattern,
  songLengthInBeats,
  songMarkers,
  selectedTrackId,
  superSonicMode = false,
  onSelectTrack,
  onToggleStep,
  onPlaceNote,
  onSeek,
  onRenameSection,
  onRemoveSection,
  onReorderTrack,
}: SongTimelineGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [playBeat, setPlayBeat] = useState(0);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // The track gutter slides shut to a thin icon strip so a long song gets the
  // full width, then back open on toggle.
  const [gutterCollapsed, setGutterCollapsed] = useState(false);
  // The floating pitch ladder for SuperSonic placement. It lives in a portal so
  // its tall, tappable rungs are not crushed into a 46px lane or clipped by the
  // grid's overflow, the way an inline ladder was in the whole-song view.
  const [ladder, setLadder] = useState<{
    trackId: string;
    trackName: string;
    color: string;
    patternIndex: number;
    stepIndex: number;
    bar: number;
    anchorNote: string;
    left: number;
    right: number;
    top: number;
    height: number;
  } | null>(null);
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  // A small grace period so moving the pointer from the cell into the popover
  // (across the gap between them) does not dismiss it.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setLadder(null), 140);
  };

  // SuperSonic mode is for precise placement, so the cells grow to fit the
  // pitch ladder; otherwise stay dense for the song overview.
  const cellW = superSonicMode ? 30 : 20;
  const laneH = superSonicMode ? 48 : 34;
  const placementEnabled = superSonicMode && Boolean(onPlaceNote);

  const totalSteps = Math.max(stepsPerPattern, Math.round(songLengthInBeats));
  const totalWidth = totalSteps * cellW;

  useEffect(() => {
    let raf = 0;
    let lastBeat = -1;
    const tick = () => {
      const beat = engine.currentStep;
      if (beat !== lastBeat) {
        lastBeat = beat;
        setPlayBeat(beat);
        // Follow the playhead only when it actually moves (during playback or a
        // seek). Doing it here, instead of in an effect keyed on scrollLeft,
        // means a manual scroll while stopped is never yanked back.
        const el = scrollRef.current;
        if (el) {
          const playX = beat * cellW;
          if (playX < el.scrollLeft + 40 || playX > el.scrollLeft + el.clientWidth - 40) {
            el.scrollLeft = Math.max(0, playX - el.clientWidth / 2);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cellW]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Plain mouse wheel scrolls the timeline sideways (this grid has no vertical
  // scroll of its own), so a mouse with no horizontal wheel can still move
  // across the song. At either end the event bubbles so the page can scroll.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.altKey) return;
      if (node.scrollWidth <= node.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      const atStart = node.scrollLeft <= 0;
      const atEnd = node.scrollLeft >= node.scrollWidth - node.clientWidth - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
      event.preventDefault();
      node.scrollLeft += delta;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // Drop the ladder when placement turns off, and never leave a timer running.
  useEffect(() => {
    if (!placementEnabled) setLadder(null);
  }, [placementEnabled]);
  useEffect(() => () => cancelClose(), []);

  // While the ladder is open, dismiss it on Escape or any scroll/resize, since
  // it is pinned to a cell position those would shift out from under it.
  useEffect(() => {
    if (!ladder) return undefined;
    const dismiss = () => setLadder(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [ladder]);

  const arrangerClipsByTrack = useMemo(() => {
    const map: Record<string, ArrangementClip[]> = {};
    for (const clip of arrangerClips) {
      (map[clip.trackId] ??= []).push(clip);
    }
    return map;
  }, [arrangerClips]);

  const sections = useMemo(() => {
    const sorted = [...songMarkers].sort((a, b) => a.beat - b.beat);
    return sorted.map((marker, index) => ({
      id: marker.id,
      name: marker.name,
      start: marker.beat,
      end: index < sorted.length - 1 ? sorted[index + 1].beat : totalSteps,
      color: SECTION_COLORS[index % SECTION_COLORS.length],
    }));
  }, [songMarkers, totalSteps]);

  const windowStart = Math.max(0, Math.floor(scrollLeft / cellW) - OVERSCAN);
  const windowEnd = Math.min(totalSteps, Math.ceil((scrollLeft + viewportWidth) / cellW) + OVERSCAN);
  const windowSteps: number[] = [];
  for (let step = windowStart; step < windowEnd; step += 1) {
    windowSteps.push(step);
  }

  const resolveAt = (track: Track, songStep: number) => resolvePatternStepForPlayback({
    arrangerClipsByTrack,
    currentPattern: 0,
    songStep,
    stepsPerPattern,
    track,
    transportMode: 'SONG',
  });


  const commitRename = () => {
    if (editingMarkerId && onRenameSection) {
      onRenameSection(editingMarkerId, draftName.trim() || 'Section');
    }
    setEditingMarkerId(null);
  };

  const playheadLeft = playBeat * cellW;
  const barLineEvery = stepsPerPattern;

  // The pitch ladder, floated next to the hovered cell so its rungs are large
  // enough to read and tap. Each rung is labelled with the pitch it places.
  const renderLadderPopover = () => {
    if (!ladder) return null;
    const rungH = 24;
    const popoverW = 68;
    const popoverH = SUPERSONIC_NOTE_OFFSETS.length * rungH + 26;
    const fitsRight = ladder.right + 6 + popoverW <= window.innerWidth - 8;
    const left = fitsRight ? ladder.right + 6 : Math.max(8, ladder.left - popoverW - 6);
    const top = Math.max(8, Math.min(ladder.top + ladder.height / 2 - popoverH / 2, window.innerHeight - popoverH - 8));
    return createPortal(
      <div
        className="fixed z-[60] rounded-[7px] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[0_14px_36px_rgba(0,0,0,0.6)]"
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        style={{ left, top, width: popoverW }}
      >
        <div className="pb-1 text-center font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {ladder.trackName} · Bar {ladder.bar}
        </div>
        <div className="grid gap-px" style={{ gridTemplateRows: `repeat(${SUPERSONIC_NOTE_OFFSETS.length}, ${rungH}px)` }}>
          {SUPERSONIC_NOTE_OFFSETS.map((offset) => {
            const note = shiftPitch(ladder.anchorNote, offset);
            const isCenter = offset === 0;
            return (
              <button
                className="flex items-center justify-center rounded-[3px] font-mono text-[10px] font-semibold transition-[filter] hover:brightness-125 disabled:cursor-default disabled:hover:brightness-100"
                disabled={!note}
                key={offset}
                onClick={() => {
                  if (note) {
                    onPlaceNote?.(ladder.trackId, ladder.patternIndex, ladder.stepIndex, note);
                    setLadder(null);
                  }
                }}
                style={{
                  color: isCenter ? '#06131b' : 'var(--text-primary)',
                  background: note ? (isCenter ? ladder.color : `${ladder.color}24`) : 'transparent',
                  border: `1px solid ${isCenter ? ladder.color : 'var(--border-soft)'}`,
                  opacity: note ? 1 : 0.32,
                }}
                title={note ? `Place ${note}` : 'Out of range'}
                type="button"
              >
                {note ?? '—'}
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <>
    <div className="flex overflow-hidden rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
      {/* Track-name gutter, aligned row-for-row with the lanes. Slides shut to a
          thin icon strip; drag a lane to reorder. */}
      <div className="shrink-0 border-r border-[var(--border-soft)] bg-[var(--bg-panel-strong)] transition-[width] duration-200" style={{ width: gutterCollapsed ? 36 : GUTTER_WIDTH }}>
        <div
          className={`flex items-center border-b border-[var(--border-soft)] ${gutterCollapsed ? 'justify-center' : 'justify-between px-3'}`}
          style={{ height: RULER_HEIGHT }}
        >
          {!gutterCollapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <Music2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              <span className="section-label truncate">Tracks</span>
            </div>
          )}
          <button
            aria-label={gutterCollapsed ? 'Show track names' : 'Hide track names'}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] text-[var(--text-tertiary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
            onClick={() => setGutterCollapsed((value) => !value)}
            title={gutterCollapsed ? 'Slide the track list open' : 'Slide the track list shut for more timeline width'}
            type="button"
          >
            {gutterCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        {tracks.map((track, index) => {
          const isSelected = track.id === selectedTrackId;
          return (
            <div
              key={track.id}
              className={`group relative flex w-full items-center border-b border-[var(--border-soft)] transition-colors last:border-b-0 hover:bg-[rgba(255,255,255,0.02)] ${gutterCollapsed ? 'justify-center' : 'gap-2 px-2.5'}`}
              data-drop-target={dropIndex === index ? 'true' : undefined}
              draggable
              onClick={() => onSelectTrack(track.id)}
              onDragStart={(event) => { setDragTrackId(track.id); event.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(event) => { if (dragTrackId && dragTrackId !== track.id) { event.preventDefault(); setDropIndex(index); } }}
              onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragTrackId && onReorderTrack) onReorderTrack(dragTrackId, index);
                setDragTrackId(null);
                setDropIndex(null);
              }}
              onDragEnd={() => { setDragTrackId(null); setDropIndex(null); }}
              style={{
                height: laneH,
                cursor: 'grab',
                background: isSelected ? 'rgba(125,211,252,0.06)' : undefined,
                boxShadow: dropIndex === index ? 'inset 0 2px 0 var(--accent-strong)' : undefined,
                opacity: dragTrackId === track.id ? 0.45 : 1,
              }}
              title={gutterCollapsed ? track.name : 'Drag to reorder'}
            >
              {isSelected && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: track.color }} />}
              {!gutterCollapsed && <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100" />}
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px]"
                style={{ border: `1px solid ${track.color}55`, background: `${track.color}1a`, color: track.color }}
              >
                <TrackIcon type={track.type} className="h-3.5 w-3.5" />
              </span>
              {!gutterCollapsed && <span className="min-w-0 truncate text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</span>}
            </div>
          );
        })}
      </div>

      {/* Scrollable, virtualized timeline. */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-x-auto"
        onScroll={(event) => { setScrollLeft(event.currentTarget.scrollLeft); setLadder(null); }}
      >
        <div className="relative" style={{ width: totalWidth }}>
          {/* Editable section ruler. */}
          <div className="relative border-b border-[var(--border-soft)] bg-[var(--bg-panel-strong)]" style={{ height: RULER_HEIGHT, width: totalWidth }}>
            {sections.length === 0 && (
              <div className="flex h-full items-center px-2 text-[10px] text-[var(--text-tertiary)]">
                No sections yet. Use Mark section to name parts of the song.
              </div>
            )}
            {sections.map((section) => (
              <div
                key={section.id}
                className="group absolute top-0 flex h-full items-center overflow-hidden border-l border-[var(--chrome-line)]"
                style={{ left: section.start * cellW, width: (section.end - section.start) * cellW, background: `${section.color}14` }}
              >
                {editingMarkerId === section.id ? (
                  <input
                    autoFocus
                    className="mx-1 h-[18px] w-full min-w-0 rounded-[2px] border border-[var(--accent-strong)] bg-[var(--bg-panel-strong)] px-1 text-[10px] text-[var(--text-primary)]"
                    onBlur={commitRename}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename();
                      if (event.key === 'Escape') setEditingMarkerId(null);
                    }}
                    value={draftName}
                  />
                ) : (
                  <>
                    <button
                      className="flex-1 truncate px-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.12em]"
                      onClick={() => onSeek?.(section.start)}
                      onDoubleClick={() => { setEditingMarkerId(section.id); setDraftName(section.name); }}
                      style={{ color: section.color }}
                      title={`Jump to ${section.name}. Double-click to rename.`}
                      type="button"
                    >
                      {section.name}
                    </button>
                    {onRemoveSection && (
                      <button
                        className="mr-0.5 hidden shrink-0 rounded-[2px] p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)] group-hover:block"
                        onClick={() => onRemoveSection(section.id)}
                        title={`Remove ${section.name}`}
                        type="button"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Lanes. */}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="relative border-b border-[var(--border-soft)] last:border-b-0"
              style={{ height: laneH, width: totalWidth }}
              onPointerLeave={scheduleClose}
            >
              {windowSteps.map((songStep) => {
                const resolved = resolveAt(track, songStep);
                const active = Boolean(resolved && resolved.note.length > 0);
                const isBar = songStep % barLineEvery === 0;
                const isBeat = songStep % 4 === 0;
                // Placeable = an empty step that the arrangement actually loops
                // here (so the note has somewhere to live). Hovering one floats
                // the pitch ladder anchored to the cell.
                const placeable = placementEnabled && !active && Boolean(resolved);
                const bar = Math.floor(songStep / barLineEvery) + 1;
                return (
                  <button
                    key={songStep}
                    className="group absolute top-0 h-full transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                    onClick={() => {
                      const target = resolved ?? resolveAt(track, songStep);
                      if (target) onToggleStep(track.id, target.patternIndex, target.stepIndex);
                    }}
                    onPointerEnter={(event) => {
                      if (!placementEnabled) return;
                      if (!placeable || !resolved) { scheduleClose(); return; }
                      const rect = event.currentTarget.getBoundingClientRect();
                      cancelClose();
                      setLadder({
                        trackId: track.id,
                        trackName: track.name,
                        color: track.color,
                        patternIndex: resolved.patternIndex,
                        stepIndex: resolved.stepIndex,
                        bar,
                        anchorNote: getTrackAnchorNote(track, track.patterns[resolved.patternIndex] ?? [], resolved.stepIndex),
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        height: rect.height,
                      });
                    }}
                    style={{
                      left: songStep * cellW,
                      width: cellW,
                      borderLeft: isBar
                        ? '1px solid rgba(255,255,255,0.16)'
                        : isBeat
                          ? '1px solid rgba(255,255,255,0.06)'
                          : '1px solid rgba(255,255,255,0.02)',
                      background: isBeat && !isBar ? 'rgba(255,255,255,0.025)' : undefined,
                    }}
                    title={placeable ? `Bar ${bar} · hover to place a pitch` : `Bar ${bar}`}
                    type="button"
                  >
                    {active && (() => {
                      const events = (resolved && track.patterns[resolved.patternIndex]?.[resolved.stepIndex]) || [];
                      // In SuperSonic mode a step's chord shows each note as its
                      // own stacked sub-bar (highest pitch on top), so the parts
                      // are visible instead of one flat block.
                      if (superSonicMode && events.length > 1) {
                        const sorted = [...events].sort((left, right) => pitchRank(right.note) - pitchRank(left.note));
                        return (
                          <span className="absolute inset-x-[1.5px] inset-y-[3px] flex flex-col gap-px overflow-hidden rounded-[2px]">
                            {sorted.map((event, noteIndex) => (
                              <span
                                className="min-h-0 flex-1 rounded-[1px]"
                                key={`${event.note}-${noteIndex}`}
                                style={{ background: track.color, opacity: 0.95 - noteIndex * 0.12 }}
                                title={event.note}
                              />
                            ))}
                          </span>
                        );
                      }
                      return (
                        <span
                          className="absolute inset-x-[1.5px] inset-y-[3px] overflow-hidden rounded-[2px]"
                          style={{ background: track.color, opacity: 0.92 }}
                          title={events[0]?.note}
                        >
                          <span className="absolute inset-x-0 top-0 h-[2px] bg-white/55" />
                        </span>
                      );
                    })()}
                    {placeable && (
                      <span
                        className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform group-hover:scale-[1.7]"
                        style={{ background: track.color, opacity: 0.2 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Playhead across the ruler and every lane. */}
          <div
            className="pointer-events-none absolute top-0 w-[2px] bg-[var(--accent-strong)]"
            style={{ left: playheadLeft, height: RULER_HEIGHT + tracks.length * laneH }}
          />
        </div>
      </div>
    </div>
    {renderLadderPopover()}
    </>
  );
};
