import { useEffect, useMemo, useRef, useState } from 'react';

import { engine } from '../audio/ToneEngine';
import { resolvePatternStepForPlayback } from '../audio/playbackResolver';
import type { ArrangementClip, SongMarker, Track } from '../project/schema';

const SECTION_COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f59e0b',
];

const CELL_WIDTH = 20;
const LANE_HEIGHT = 30;
const RULER_HEIGHT = 22;
const GUTTER_WIDTH = 132;
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
}

// A flattened, scrollable view of the whole arrangement: one lane per track with
// a cell for every step of the song, so every note that plays is visible (not
// just the current 16-step pattern). Clicking a cell toggles the note in the
// pattern that the arrangement loops there, so an edit lands on the source the
// engine actually plays. Cells are virtualized to a window so a multi-minute
// song stays smooth.
export const SongTimelineGrid = ({
  tracks,
  arrangerClips,
  stepsPerPattern,
  songLengthInBeats,
  songMarkers,
  selectedTrackId,
  onSelectTrack,
  onToggleStep,
}: SongTimelineGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [playBeat, setPlayBeat] = useState(0);

  const totalSteps = Math.max(stepsPerPattern, Math.round(songLengthInBeats));
  const totalWidth = totalSteps * CELL_WIDTH;

  // Follow the engine's absolute song position for the playhead.
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

  // Keep the playhead in view while it advances during playback.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const playX = playBeat * CELL_WIDTH;
    if (playX < scrollLeft + 40 || playX > scrollLeft + el.clientWidth - 40) {
      el.scrollLeft = Math.max(0, playX - el.clientWidth / 2);
    }
  }, [playBeat, scrollLeft]);

  const playheadLeft = playBeat * CELL_WIDTH;
  const barLineEvery = stepsPerPattern; // one pattern == one bar of the timeline

  return (
    <div className="flex overflow-hidden rounded-[4px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)]">
      {/* Track-name gutter, aligned row-for-row with the lanes. */}
      <div className="shrink-0 border-r border-[var(--border-soft)] bg-[var(--bg-panel-strong)]" style={{ width: GUTTER_WIDTH }}>
        <div className="border-b border-[var(--border-soft)]" style={{ height: RULER_HEIGHT }} />
        {tracks.map((track) => (
          <button
            key={track.id}
            className="flex w-full items-center gap-2 border-b border-[var(--border-soft)] px-2.5 text-left last:border-b-0"
            data-active={track.id === selectedTrackId}
            onClick={() => onSelectTrack(track.id)}
            style={{ height: LANE_HEIGHT, background: track.id === selectedTrackId ? 'rgba(125,211,252,0.08)' : undefined }}
            type="button"
          >
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: track.color }} />
            <span className="truncate text-[11px] font-medium text-[var(--text-secondary)]">{track.name}</span>
          </button>
        ))}
      </div>

      {/* Scrollable, virtualized timeline. */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-x-auto"
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
      >
        <div className="relative" style={{ width: totalWidth }}>
          {/* Section ruler. */}
          <div className="relative border-b border-[var(--border-soft)]" style={{ height: RULER_HEIGHT, width: totalWidth }}>
            {sections.map((section) => (
              <div
                key={`${section.start}-${section.name}`}
                className="absolute top-0 flex h-full items-center overflow-hidden border-l border-[var(--chrome-line)]"
                style={{ left: section.start * CELL_WIDTH, width: (section.end - section.start) * CELL_WIDTH, background: `${section.color}14` }}
              >
                <span className="truncate px-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: section.color }}>
                  {section.name}
                </span>
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
                      <span
                        className="absolute inset-x-[2px] inset-y-[5px] rounded-[2px]"
                        style={{ background: track.color, opacity: 0.85 }}
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
            style={{ left: playheadLeft, height: RULER_HEIGHT + tracks.length * LANE_HEIGHT }}
          />
        </div>
      </div>
    </div>
  );
};
