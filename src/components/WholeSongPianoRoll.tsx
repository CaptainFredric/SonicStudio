import { useEffect, useMemo, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';

import { engine } from '../audio/ToneEngine';
import { resolvePatternStepForPlayback } from '../audio/playbackResolver';
import { useAudio } from '../context/AudioContext';
import { NOTE_NAMES } from '../utils/notePlacement';
import { TrackIcon } from '../utils/trackPersonality';
import { MIN_ARRANGEMENT_STEPS, type ArrangementClip, type StepValue, type Track } from '../project/schema';

const SECTION_COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f59e0b',
];

const RULER_HEIGHT = 28;
const GUTTER_WIDTH = 58;
const ROW_HEIGHT = 16;
const CELL_WIDTH = 22;
const OVERSCAN = 8;
// Keep the grid at least two octaves tall so it never collapses to a sliver
// when a track only uses a couple of pitches.
const MIN_SPAN = 23;

// A sortable pitch value (octave * 12 + pitch class). NOTE_NAMES is chromatic,
// so this is monotonic across the keyboard.
const pitchRank = (note: string): number => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 0;
  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  return Number(match[2]) * 12 + (pitchClass < 0 ? 0 : pitchClass);
};

const rankToNote = (rank: number): string => {
  const pitchClass = ((rank % 12) + 12) % 12;
  return `${NOTE_NAMES[pitchClass]}${Math.floor(rank / 12)}`;
};

const isBlackKey = (rank: number): boolean => NOTE_NAMES[((rank % 12) + 12) % 12].includes('#');

// A pitch-by-song-step piano roll: every note the arrangement plays for the
// selected track, laid out across the whole song on one scrollable canvas
// instead of one pattern at a time. Each song step resolves to the pattern the
// arrangement loops there, so a click adds or removes that pitch in the source
// pattern and the change shows up everywhere the pattern repeats. The ruler and
// pitch gutter stay pinned while the grid scrolls in both directions; cells are
// virtualized horizontally so a long song stays smooth.
export const WholeSongPianoRoll = () => {
  const {
    tracks,
    selectedTrackId,
    setSelectedTrackId,
    arrangerClips,
    songMarkers,
    songLengthInBeats,
    stepsPerPattern,
    transportMode,
    togglePatternStep,
  } = useAudio();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [playBeat, setPlayBeat] = useState(0);

  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? tracks[0] ?? null;

  const totalSteps = Math.max(MIN_ARRANGEMENT_STEPS, Math.round(songLengthInBeats));
  const totalWidth = totalSteps * CELL_WIDTH;

  // Pitch range = the notes the track actually uses (padded), so the grid frames
  // its melody instead of a generic full keyboard.
  const rows = useMemo(() => {
    const ranks: number[] = [];
    if (track) {
      for (const steps of Object.values(track.patterns) as StepValue[][]) {
        for (const step of steps) {
          for (const event of step) ranks.push(pitchRank(event.note));
        }
      }
    }
    let low = ranks.length > 0 ? Math.min(...ranks) - 1 : 36;
    let high = ranks.length > 0 ? Math.max(...ranks) + 1 : 60;
    while (high - low < MIN_SPAN) {
      high += 1;
      if (high - low < MIN_SPAN) low -= 1;
    }
    const out: Array<{ rank: number; note: string; black: boolean }> = [];
    for (let rank = high; rank >= low; rank -= 1) {
      out.push({ rank, note: rankToNote(rank), black: isBlackKey(rank) });
    }
    return out;
  }, [track]);

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

  // Follow the playhead only when it moves, so a manual scroll is never yanked
  // back (same approach as the whole-song step grid).
  useEffect(() => {
    let raf = 0;
    let lastBeat = -1;
    const tick = () => {
      const beat = engine.currentStep;
      if (beat !== lastBeat) {
        lastBeat = beat;
        setPlayBeat(beat);
        const el = scrollRef.current;
        if (el) {
          const playX = GUTTER_WIDTH + beat * CELL_WIDTH;
          if (playX < el.scrollLeft + GUTTER_WIDTH + 40 || playX > el.scrollLeft + el.clientWidth - 40) {
            el.scrollLeft = Math.max(0, playX - el.clientWidth / 2);
          }
        }
      }
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

  // Plain mouse wheel scrolls sideways so a mouse with no horizontal wheel can
  // still move across the song; at the edges the event bubbles to the page.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.altKey || event.shiftKey) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (node.scrollWidth <= node.clientWidth) return;
      const atStart = node.scrollLeft <= 0;
      const atEnd = node.scrollLeft >= node.scrollWidth - node.clientWidth - 1;
      if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return;
      event.preventDefault();
      node.scrollLeft += event.deltaY;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  if (!track) {
    return (
      <div className="surface-panel flex min-h-0 flex-1 items-center justify-center">
        <div className="text-center">
          <div className="section-label">Piano roll</div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Add a track to edit its notes across the song.</p>
        </div>
      </div>
    );
  }

  const windowStart = Math.max(0, Math.floor((scrollLeft - GUTTER_WIDTH) / CELL_WIDTH) - OVERSCAN);
  const windowEnd = Math.min(totalSteps, Math.ceil((scrollLeft + viewportWidth - GUTTER_WIDTH) / CELL_WIDTH) + OVERSCAN);
  const windowSteps: number[] = [];
  for (let step = windowStart; step < windowEnd; step += 1) windowSteps.push(step);

  const resolveAt = (songStep: number) => resolvePatternStepForPlayback({
    arrangerClipsByTrack,
    currentPattern: 0,
    songStep,
    stepsPerPattern,
    track,
    transportMode: 'SONG',
  });
  // Resolve once per visible step (shared across every pitch row).
  const resolvedByStep = new Map<number, ReturnType<typeof resolveAt>>();
  for (const step of windowSteps) resolvedByStep.set(step, resolveAt(step));

  const playheadLeft = GUTTER_WIDTH + playBeat * CELL_WIDTH;
  const gridHeight = RULER_HEIGHT + rows.length * ROW_HEIGHT;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Track picker + hint. The roll follows the selected track. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          {tracks.map((candidate: Track) => {
            const isSelected = candidate.id === track.id;
            return (
              <button
                key={candidate.id}
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-[3px] border px-2 text-[11px] font-semibold tracking-tight transition-colors"
                onClick={() => setSelectedTrackId(candidate.id)}
                style={{
                  borderColor: isSelected ? `${candidate.color}66` : 'var(--border-soft)',
                  background: isSelected ? `${candidate.color}1f` : 'rgba(255,255,255,0.02)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
                title={`Edit ${candidate.name}`}
                type="button"
              >
                <span className="flex shrink-0 items-center" style={{ color: candidate.color }}>
                  <TrackIcon type={candidate.type} className="h-3.5 w-3.5" />
                </span>
                <span className="max-w-[120px] truncate">{candidate.name}</span>
              </button>
            );
          })}
        </div>
        <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
          {transportMode === 'SONG'
            ? 'Click a cell to add or remove that pitch across the song'
            : 'Switch the transport to Song to arrange across patterns'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]"
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
      >
        <div className="relative" style={{ width: GUTTER_WIDTH + totalWidth, height: gridHeight }}>
          {/* Section ruler: pinned to the top, click a label to jump there. */}
          <div className="sticky top-0 z-20 flex" style={{ height: RULER_HEIGHT }}>
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center gap-1 border-b border-r border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-2"
              style={{ width: GUTTER_WIDTH }}
            >
              <Music2 className="h-3 w-3 text-[var(--accent)]" />
            </div>
            <div className="relative shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-panel-strong)]" style={{ width: totalWidth }}>
              {sections.length === 0 && (
                <div className="flex h-full items-center px-2 text-[10px] text-[var(--text-tertiary)]">
                  No sections yet. Mark sections in the Sequencer to label parts of the song.
                </div>
              )}
              {sections.map((section) => (
                <button
                  key={section.id}
                  className="absolute top-0 flex h-full items-center overflow-hidden border-l border-[var(--chrome-line)] px-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.12em]"
                  onClick={() => engine.seekToBeat(section.start)}
                  style={{
                    left: section.start * CELL_WIDTH,
                    width: (section.end - section.start) * CELL_WIDTH,
                    background: `${section.color}14`,
                    color: section.color,
                  }}
                  title={`Jump to ${section.name}`}
                  type="button"
                >
                  <span className="truncate">{section.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pitch rows, highest at the top. */}
          {rows.map((row) => (
            <div key={row.rank} className="flex" style={{ height: ROW_HEIGHT }}>
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center justify-end border-b border-r border-[var(--border-soft)] pr-1.5 font-mono text-[9px]"
                style={{
                  width: GUTTER_WIDTH,
                  height: ROW_HEIGHT,
                  background: row.black ? 'rgba(0,0,0,0.32)' : 'var(--bg-panel-strong)',
                  color: row.note.startsWith('C') && !row.black ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                }}
              >
                {row.note}
              </div>
              <div
                className="relative shrink-0 border-b border-[var(--border-soft)]"
                style={{
                  width: totalWidth,
                  height: ROW_HEIGHT,
                  background: row.black ? 'rgba(0,0,0,0.16)' : undefined,
                }}
              >
                {windowSteps.map((songStep) => {
                  const resolved = resolvedByStep.get(songStep) ?? null;
                  const arranged = Boolean(resolved);
                  const event = resolved?.note.find((candidate) => candidate.note === row.note) ?? null;
                  const isBar = songStep % stepsPerPattern === 0;
                  const isBeat = songStep % 4 === 0;
                  return (
                    <button
                      key={songStep}
                      className={`absolute top-0 h-full ${arranged ? 'hover:bg-[rgba(255,255,255,0.06)]' : 'cursor-default'}`}
                      disabled={!arranged}
                      onClick={() => {
                        if (resolved) togglePatternStep(track.id, resolved.patternIndex, resolved.stepIndex, row.note);
                      }}
                      style={{
                        left: songStep * CELL_WIDTH,
                        width: CELL_WIDTH,
                        borderLeft: isBar
                          ? '1px solid rgba(255,255,255,0.16)'
                          : isBeat
                            ? '1px solid rgba(255,255,255,0.06)'
                            : '1px solid rgba(255,255,255,0.02)',
                        background: !arranged ? 'rgba(0,0,0,0.18)' : isBeat && !isBar ? 'rgba(255,255,255,0.02)' : undefined,
                      }}
                      title={arranged ? `${row.note} · bar ${Math.floor(songStep / stepsPerPattern) + 1}` : 'No clip here'}
                      type="button"
                    >
                      {event && (
                        <span
                          className="absolute inset-x-[1px] inset-y-[1.5px] rounded-[2px]"
                          style={{ background: track.color, opacity: Math.max(0.45, Math.min(1, event.velocity || 0.9)) }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Playhead across the ruler and every pitch row. */}
          <div
            className="pointer-events-none absolute top-0 z-[5] w-[2px] bg-[var(--accent-strong)]"
            style={{ left: playheadLeft, height: gridHeight }}
          />
        </div>
      </div>
    </div>
  );
};
