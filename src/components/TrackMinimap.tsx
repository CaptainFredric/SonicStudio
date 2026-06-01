import { useEffect, useRef, useState } from 'react';

import { engine } from '../audio/ToneEngine';
import { useAudio } from '../context/AudioContext';

const SECTION_COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f59e0b',
];

// A compact overview of the whole arrangement with a draggable playhead. It
// shows the song's sections end to end and lets the user grab the handle (or
// click anywhere) to jump the transport to that spot. Only shown for SONG-mode
// scenes that are longer than a single bar, where navigating matters.
export const TrackMinimap = () => {
  const { songLengthInBeats, songMarkers, transportMode, stepsPerPattern } = useAudio();
  const [playBeat, setPlayBeat] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Follow the engine's absolute song position (the React step state is only
  // the within-bar step, so we read the engine directly).
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

  const total = Math.max(1, songLengthInBeats);
  if (transportMode !== 'SONG' || total <= stepsPerPattern) {
    return null;
  }

  const beatFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * total);
  };
  const seek = (clientX: number) => {
    const beat = beatFromClientX(clientX);
    engine.seekToBeat(beat);
    setPlayBeat(beat);
  };

  const sorted = [...songMarkers].sort((a, b) => a.beat - b.beat);
  const sections = sorted.map((marker, index) => ({
    name: marker.name,
    start: marker.beat,
    end: index < sorted.length - 1 ? sorted[index + 1].beat : total,
    color: SECTION_COLORS[index % SECTION_COLORS.length],
  }));
  const playPct = Math.max(0, Math.min(100, (playBeat / total) * 100));
  const currentBar = Math.floor(playBeat / stepsPerPattern) + 1;
  const totalBars = Math.max(1, Math.round(total / stepsPerPattern));

  return (
    <div className="mb-2 grid shrink-0 gap-1">
      <div className="flex items-center justify-between">
        <span className="section-label">Track timeline</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          Bar {currentBar} / {totalBars}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative h-7 w-full cursor-pointer select-none overflow-hidden rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] touch-none"
        role="slider"
        aria-label="Track position. Drag to jump to a spot in the song."
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={playBeat}
        tabIndex={0}
        onPointerDown={(event) => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seek(event.clientX);
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) seek(event.clientX);
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { engine.seekToBeat(playBeat - stepsPerPattern); setPlayBeat((b) => Math.max(0, b - stepsPerPattern)); }
          if (event.key === 'ArrowRight') { engine.seekToBeat(playBeat + stepsPerPattern); setPlayBeat((b) => Math.min(total, b + stepsPerPattern)); }
        }}
      >
        {sections.map((section) => (
          <div
            key={`${section.start}-${section.name}`}
            className="absolute top-0 flex h-full items-center justify-center overflow-hidden border-l border-[var(--chrome-line)] first:border-l-0"
            style={{
              left: `${(section.start / total) * 100}%`,
              width: `${((section.end - section.start) / total) * 100}%`,
              background: `${section.color}1f`,
            }}
          >
            <span className="truncate px-1 text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ color: section.color }}>
              {section.name}
            </span>
          </div>
        ))}
        <div
          className="pointer-events-none absolute top-0 h-full w-[2px] bg-[var(--accent-strong)]"
          style={{ left: `${playPct}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--bg-panel-strong)] bg-[var(--accent-strong)] shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
          style={{ left: `${playPct}%` }}
        />
      </div>
    </div>
  );
};
