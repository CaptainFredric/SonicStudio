import { useEffect, useMemo, useRef, useState } from 'react';

import { engine } from '../audio/ToneEngine';
import { resolvePatternStepForPlayback } from '../audio/playbackResolver';
import { useAudio } from '../context/AudioContext';
import type { ArrangementClip } from '../project/schema';

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
  const { songLengthInBeats, songMarkers, transportMode, stepsPerPattern, arrangerClips, tracks, isPlaying, setIsPlaying } = useAudio();
  const [playBeat, setPlayBeat] = useState(0);
  const [areaWidth, setAreaWidth] = useState(320);
  const areaRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // Remember whether the transport was running when a scrub began, so playback
  // can resume from the dropped spot on release.
  const wasPlayingRef = useRef(false);

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

  // Track the timeline width so note ticks can keep a legible minimum size even
  // when a long song packs many steps into a narrow strip.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const measure = () => setAreaWidth(el.clientWidth || 320);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const total = Math.max(1, songLengthInBeats);

  const sections = useMemo(() => {
    const sorted = [...songMarkers].sort((a, b) => a.beat - b.beat);
    return sorted.map((marker, index) => ({
      id: marker.id,
      name: marker.name,
      start: marker.beat,
      end: index < sorted.length - 1 ? sorted[index + 1].beat : total,
      color: SECTION_COLORS[index % SECTION_COLORS.length],
    }));
  }, [songMarkers, total]);

  const arrangerClipsByTrack = useMemo(() => {
    const map: Record<string, ArrangementClip[]> = {};
    for (const clip of arrangerClips) {
      (map[clip.trackId] ??= []).push(clip);
    }
    return map;
  }, [arrangerClips]);

  // One lane per track: the clip regions that place it in the song, plus the
  // individual notes inside those regions. Resolving every step against the
  // arrangement means the lane shows the real rhythm (onsets, sustains, and the
  // gaps between them) instead of one flat block per clip.
  const lanes = useMemo(() => tracks.map((track) => {
    const clips = arrangerClipsByTrack[track.id] ?? [];
    const notes: Array<{ step: number; length: number }> = [];
    for (const clip of clips) {
      const end = clip.startBeat + clip.beatLength;
      for (let step = Math.floor(clip.startBeat); step < end; step += 1) {
        const resolved = resolvePatternStepForPlayback({
          arrangerClipsByTrack,
          currentPattern: 0,
          songStep: step,
          stepsPerPattern,
          track,
          transportMode: 'SONG',
        });
        if (resolved && resolved.note.length > 0) {
          const gate = Math.max(...resolved.note.map((event) => event.gate || 1));
          notes.push({ step, length: Math.max(0.6, Math.min(gate, end - step)) });
        }
      }
    }
    return {
      id: track.id,
      name: track.name,
      color: track.color,
      clips: clips.map((clip) => ({ id: clip.id, start: clip.startBeat, length: clip.beatLength })),
      notes,
    };
  }), [tracks, arrangerClipsByTrack, stepsPerPattern]);

  // Shown for any SONG-mode scene, including single-bar loop templates, so the
  // timeline is always there to scrub.
  if (transportMode !== 'SONG') {
    return null;
  }

  // Pause the transport while scrubbing so the playhead stays exactly where it
  // is dragged and does not keep advancing while held; resume on release.
  const beginScrub = () => {
    wasPlayingRef.current = isPlaying;
    if (isPlaying) {
      engine.togglePlayback();
      setIsPlaying(false);
    }
  };
  const endScrub = () => {
    if (wasPlayingRef.current) {
      engine.togglePlayback();
      setIsPlaying(true);
    }
    wasPlayingRef.current = false;
  };

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
  // Smallest note width, in step units, that still renders ~1.4px wide at the
  // current timeline width, so individual notes never vanish on a long song.
  const minNoteUnits = Math.max(0.5, (1.4 * total) / Math.max(1, areaWidth));

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
            beginScrub();
            seek(event.clientX);
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
          }}
          onPointerMove={(event) => {
            if (draggingRef.current) seek(event.clientX);
          }}
          onPointerUp={(event) => {
            draggingRef.current = false;
            try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
            endScrub();
          }}
          onPointerCancel={(event) => {
            draggingRef.current = false;
            try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
            endScrub();
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
                key={section.id}
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
                  key={`grid-${section.id}`}
                  className="absolute top-0 h-full border-l border-[var(--chrome-line)] first:border-l-0"
                  style={{ left: pct(section.start) }}
                />
              ))}
              {/* Faint clip region for context, then the actual notes on top. */}
              {lane.clips.map((clip) => (
                <div
                  key={clip.id}
                  className="absolute rounded-[1px]"
                  style={{ left: pct(clip.start), width: pct(clip.length), top: 2, bottom: 2, background: lane.color, opacity: 0.14 }}
                />
              ))}
              {lane.notes.length > 0 && (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${total} 1`}
                >
                  {lane.notes.map((note, index) => (
                    <rect
                      key={index}
                      fill={lane.color}
                      height={0.72}
                      width={Math.max(minNoteUnits, note.length * 0.86)}
                      x={note.step}
                      y={0.14}
                    />
                  ))}
                </svg>
              )}
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
