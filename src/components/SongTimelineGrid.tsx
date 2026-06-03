import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';

import { engine } from '../audio/ToneEngine';
import { resolvePatternStepForPlayback } from '../audio/playbackResolver';
import type { ArrangementClip, SongMarker, Track } from '../project/schema';

const SECTION_COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f59e0b',
];

const CELL_WIDTH = 20;
const LANE_HEIGHT = 30;
const RULER_HEIGHT = 26;
const GUTTER_WIDTH = 140;
const OVERSCAN = 8;

interface SongTimelineGridProps {
  tracks: Track[];
  arrangerClips: ArrangementClip[];
  stepsPerPattern: number;
  songLengthInBeats: number;
  songMarkers: SongMarker[];
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  onToggleStep: (trackId: string, patternIndex: number, localStep: number) => void;
  onSeek?: (beat: number) => void;
  onRenameSection?: (markerId: string, name: string) => void;
  onRemoveSection?: (markerId: string) => void;
  onReorderTrack?: (trackId: string, toIndex: number) => void;
}

// A flattened, scrollable view of the whole arrangement: one lane per track with
// a cell for every step of the song, so every note that plays is visible (not
// just the current 16-step pattern). Clicking a cell toggles the note in the
// pattern that the arrangement loops there. The section ruler is editable
// (rename, remove, click to jump) and lanes can be dragged to reorder, so the
// view works for any song the user builds, not just templates with preset
// section names. Cells are virtualized to a window so a long song stays smooth.
export const SongTimelineGrid = ({
  tracks,
  arrangerClips,
  stepsPerPattern,
  songLengthInBeats,
  songMarkers,
  selectedTrackId,
  onSelectTrack,
  onToggleStep,
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

  const totalSteps = Math.max(stepsPerPattern, Math.round(songLengthInBeats));
  const totalWidth = totalSteps * CELL_WIDTH;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const beat = engine.currentStep;
      setPlayBeat((prev) => (prev === beat ? prev : beat));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const windowStart = Math.max(0, Math.floor(scrollLeft / CELL_WIDTH) - OVERSCAN);
  const windowEnd = Math.min(totalSteps, Math.ceil((scrollLeft + viewportWidth) / CELL_WIDTH) + OVERSCAN);
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const playX = playBeat * CELL_WIDTH;
    if (playX < scrollLeft + 40 || playX > scrollLeft + el.clientWidth - 40) {
      el.scrollLeft = Math.max(0, playX - el.clientWidth / 2);
    }
  }, [playBeat, scrollLeft]);

  const commitRename = () => {
    if (editingMarkerId && onRenameSection) {
      onRenameSection(editingMarkerId, draftName.trim() || 'Section');
    }
    setEditingMarkerId(null);
  };

  const playheadLeft = playBeat * CELL_WIDTH;
  const barLineEvery = stepsPerPattern;

  return (
    <div className="flex overflow-hidden rounded-[4px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)]">
      {/* Track-name gutter, aligned row-for-row with the lanes. Drag a lane to reorder. */}
      <div className="shrink-0 border-r border-[var(--border-soft)] bg-[var(--bg-panel-strong)]" style={{ width: GUTTER_WIDTH }}>
        <div className="flex items-center border-b border-[var(--border-soft)] px-2.5" style={{ height: RULER_HEIGHT }}>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Drag to reorder</span>
        </div>
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className="flex w-full items-center gap-1.5 border-b border-[var(--border-soft)] px-2 last:border-b-0"
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
              height: LANE_HEIGHT,
              cursor: 'grab',
              background: track.id === selectedTrackId ? 'rgba(125,211,252,0.08)' : undefined,
              boxShadow: dropIndex === index ? 'inset 0 2px 0 var(--accent-strong)' : undefined,
              opacity: dragTrackId === track.id ? 0.45 : 1,
            }}
          >
            <GripVertical className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: track.color }} />
            <span className="truncate text-[11px] font-medium text-[var(--text-secondary)]">{track.name}</span>
          </div>
        ))}
      </div>

      {/* Scrollable, virtualized timeline. */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-x-auto"
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
      >
        <div className="relative" style={{ width: totalWidth }}>
          {/* Editable section ruler. */}
          <div className="relative border-b border-[var(--border-soft)]" style={{ height: RULER_HEIGHT, width: totalWidth }}>
            {sections.length === 0 && (
              <div className="flex h-full items-center px-2 text-[10px] text-[var(--text-tertiary)]">
                No sections yet. Use Mark section to name parts of the song.
              </div>
            )}
            {sections.map((section) => (
              <div
                key={section.id}
                className="group absolute top-0 flex h-full items-center overflow-hidden border-l border-[var(--chrome-line)]"
                style={{ left: section.start * CELL_WIDTH, width: (section.end - section.start) * CELL_WIDTH, background: `${section.color}14` }}
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
            <div key={track.id} className="relative border-b border-[var(--border-soft)] last:border-b-0" style={{ height: LANE_HEIGHT, width: totalWidth }}>
              {windowSteps.map((songStep) => {
                const resolved = resolveAt(track, songStep);
                const active = Boolean(resolved && resolved.note.length > 0);
                const isBar = songStep % barLineEvery === 0;
                return (
                  <button
                    key={songStep}
                    className="absolute top-0 h-full"
                    onClick={() => {
                      const target = resolved ?? resolveAt(track, songStep);
                      if (target) onToggleStep(track.id, target.patternIndex, target.stepIndex);
                    }}
                    style={{
                      left: songStep * CELL_WIDTH,
                      width: CELL_WIDTH,
                      borderLeft: isBar ? '1px solid var(--border-soft)' : '1px solid rgba(255,255,255,0.025)',
                    }}
                    title={`Bar ${Math.floor(songStep / barLineEvery) + 1}`}
                    type="button"
                  >
                    {active && (
                      <span className="absolute inset-x-[2px] inset-y-[5px] rounded-[2px]" style={{ background: track.color, opacity: 0.85 }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Playhead across the ruler and every lane. */}
          <div
            className="pointer-events-none absolute top-0 w-[2px] bg-[var(--accent-strong)]"
            style={{ left: playheadLeft, height: RULER_HEIGHT + tracks.length * LANE_HEIGHT }}
          />
        </div>
      </div>
    </div>
  );
};
