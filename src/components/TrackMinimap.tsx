import { useEffect, useMemo, useRef, useState } from 'react';

import { engine } from '../audio/ToneEngine';
import { useAudio } from '../context/AudioContext';

const SECTION_COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f59e0b',
];

const RULER_HEIGHT = 16;
const LANE_HEIGHT = 12;
const GUTTER_WIDTH = 64;

// A compact arrangement overview, GarageBand style: a section ruler on top and
// one thin lane per track showing where that instrument's clips actually play
// across the song, with a playhead you can drag (or click) to jump the
// transport. Only shown for SONG-mode scenes longer than a single bar, where
// there is an arrangement worth navigating.
export const TrackMinimap = () => {
  const { songLengthInBeats, songMarkers, transportMode, stepsPerPattern, arrangerClips, tracks } = useAudio();
  const [playBeat, setPlayBeat] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);
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

  const sections = useMemo(() => {
    const sorted = [...songMarkers].sort((a, b) => a.beat - b.beat);
    return sorted.map((marker, index) => ({
      name: marker.name,
      start: marker.beat,
      end: index < sorted.length - 1 ? sorted[index + 1].beat : total,
      color: SECTION_COLORS[index % SECTION_COLORS.length],
    }));
  }, [songMarkers, total]);

  // One lane per track, carrying the clips that place it in the song.
  const lanes = useMemo(() => tracks.map((track) => ({
    id: track.id,
    name: track.name,
    color: track.color,
    clips: arrangerClips
      .filter((clip) => clip.trackId === track.id)
      .map((clip) => ({ id: clip.id, start: clip.startBeat, length: clip.beatLength })),
  })), [tracks, arrangerClips]);

  if (transportMode !== 'SONG' || total <= stepsPerPattern) {
    return null;
  }

  const beatFromClientX = (clientX: number): number => {
    const el = areaRef.current;
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
  const pct = (beats: number) => `${(beats / total) * 100}%`;

  const playPct = Math.max(0, Math.min(100, (playBeat / total) * 100));
  const currentBar = Math.floor(playBeat / stepsPerPattern) + 1;
  const totalBars = Math.max(1, Math.round(total / stepsPerPattern));
  const activeSection = sections.find((section) => playBeat >= section.start && playBeat < section.end);

  return (
    <div className="mb-2 grid shrink-0 gap-1">
      <div className="flex items-center justify-between">
        <span className="section-label">Track timeline</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {activeSection ? `${activeSection.name} · ` : ''}Bar {currentBar} / {totalBars}
        </span>
      </div>
      <div className="flex overflow-hidden rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
        {/* Track-name gutter, aligned row-for-row with the lanes on the right. */}
        <div className="shrink-0 border-r border-[var(--border-soft)]" style={{ width: GUTTER_WIDTH }}>
          <div className="border-b border-[var(--border-soft)]" style={{ height: RULER_HEIGHT }} />
          {lanes.map((lane) => (
            <div
              key={lane.id}
              className="flex items-center gap-1.5 border-b border-[var(--border-soft)] px-2 last:border-b-0"
              style={{ height: LANE_HEIGHT }}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-[1px]" style={{ background: lane.color }} />
              <span className="truncate text-[8px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                {lane.name}
              </span>
            </div>
          ))}
        </div>

        {/* Scrubbable timeline: section ruler + per-track region lanes. */}
        <div
          ref={areaRef}
          className="relative flex-1 cursor-pointer select-none touch-none"
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
          {/* Section ruler. */}
          <div className="relative border-b border-[var(--border-soft)]" style={{ height: RULER_HEIGHT }}>
            {sections.map((section) => (
              <div
                key={`${section.start}-${section.name}`}
                className="absolute top-0 flex h-full items-center overflow-hidden border-l border-[var(--chrome-line)] first:border-l-0"
                style={{ left: pct(section.start), width: pct(section.end - section.start), background: `${section.color}1f` }}
              >
                <span className="truncate px-1 text-[8px] font-semibold uppercase tracking-[0.1em]" style={{ color: section.color }}>
                  {section.name}
                </span>
              </div>
            ))}
          </div>

          {/* Per-track region lanes. */}
          {lanes.map((lane) => (
            <div
              key={lane.id}
              className="relative border-b border-[var(--border-soft)] last:border-b-0"
              style={{ height: LANE_HEIGHT }}
            >
              {sections.map((section) => (
                <div
                  key={`grid-${section.start}`}
                  className="absolute top-0 h-full border-l border-[var(--chrome-line)] first:border-l-0"
                  style={{ left: pct(section.start) }}
                />
              ))}
              {lane.clips.map((clip) => (
                <div
                  key={clip.id}
                  className="absolute rounded-[1px]"
                  style={{ left: pct(clip.start), width: pct(clip.length), top: 2, bottom: 2, background: lane.color, opacity: 0.78 }}
                />
              ))}
            </div>
          ))}

          {/* Playhead line across the ruler and every lane, plus a grab handle. */}
          <div
            className="pointer-events-none absolute inset-y-0 w-[1.5px] bg-[var(--accent-strong)]"
            style={{ left: `${playPct}%` }}
          />
          <div
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[var(--bg-panel-strong)] bg-[var(--accent-strong)] shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
            style={{ left: `${playPct}%`, top: RULER_HEIGHT / 2 }}
          />
        </div>
      </div>
    </div>
  );
};
