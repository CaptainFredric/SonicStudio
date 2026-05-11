import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Hand, Power } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';

const STORAGE_KEY = 'sonicstudio:tapToPlay:open';

const readInitialOpen = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const BLACK_KEYS_BY_WHITE: Record<string, string | null> = {
  C: 'C#',
  D: 'D#',
  E: null,
  F: 'F#',
  G: 'G#',
  A: 'A#',
  B: null,
};

const QWERTY_WHITE = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"] as const;
const QWERTY_BLACK_BY_WHITE: Record<string, string | undefined> = {
  a: 'w',
  s: 'e',
  d: '',
  f: 't',
  g: 'y',
  h: 'u',
  j: '',
  k: 'o',
  l: 'p',
  ';': '',
  "'": '',
};

interface Octave {
  startOctave: number;
  totalOctaves: number;
}

const getOctaveRangeForType = (type: string): Octave => {
  if (type === 'bass') return { startOctave: 2, totalOctaves: 2 };
  if (type === 'pad') return { startOctave: 3, totalOctaves: 2 };
  if (type === 'pluck' || type === 'fx') return { startOctave: 4, totalOctaves: 2 };
  return { startOctave: 3, totalOctaves: 2 };
};

const buildWhiteKeys = (range: Octave) => {
  const result: Array<{ note: string; octave: number; whiteIndex: number; qwerty?: string }> = [];
  let idx = 0;
  for (let o = 0; o < range.totalOctaves; o += 1) {
    const octave = range.startOctave + o;
    for (const w of WHITE_KEYS) {
      result.push({
        note: `${w}${octave}`,
        octave,
        whiteIndex: idx,
        qwerty: QWERTY_WHITE[idx],
      });
      idx += 1;
    }
  }
  return result;
};

const DRUM_PADS = [
  { label: 'Soft', velocity: 0.55, qwerty: 'a' },
  { label: 'Mid', velocity: 0.75, qwerty: 's' },
  { label: 'Hard', velocity: 0.92, qwerty: 'd' },
  { label: 'Accent', velocity: 1, qwerty: 'f' },
];

export const TapToPlay = () => {
  const {
    initAudio,
    isInitialized,
    previewTrack,
    selectedTrackId,
    tracks,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;
  const [open, setOpen] = useState<boolean>(readInitialOpen);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const lastFlashRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

  const isDrum = !!track && (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat');
  const octaveRange = useMemo(() => (track ? getOctaveRangeForType(track.type) : { startOctave: 3, totalOctaves: 2 }), [track]);
  const whiteKeys = useMemo(() => buildWhiteKeys(octaveRange), [octaveRange]);

  const playKey = useCallback(
    (note: string) => {
      if (!track) return;
      if (!isInitialized) {
        void initAudio();
      }
      void previewTrack(track.id, note);
      setActiveKey(note);
      const id = window.setTimeout(() => setActiveKey((current) => (current === note ? null : current)), 170);
      lastFlashRef.current = id;
    },
    [initAudio, isInitialized, previewTrack, track],
  );

  const playDrum = useCallback(
    (velocity: number) => {
      if (!track) return;
      if (!isInitialized) {
        void initAudio();
      }
      void previewTrack(track.id);
      setActiveKey(`pad-${velocity}`);
      const id = window.setTimeout(() => setActiveKey(null), 170);
      lastFlashRef.current = id;
    },
    [initAudio, isInitialized, previewTrack, track],
  );

  useEffect(() => {
    if (!open || !track) return undefined;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (
          target.tagName === 'INPUT'
          || target.tagName === 'SELECT'
          || target.tagName === 'TEXTAREA'
          || target.isContentEditable
        )
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (isDrum) {
        const padIndex = ['a', 's', 'd', 'f'].indexOf(key);
        if (padIndex >= 0) {
          event.preventDefault();
          playDrum(DRUM_PADS[padIndex].velocity);
        }
        return;
      }
      const whiteIndex = QWERTY_WHITE.indexOf(key as (typeof QWERTY_WHITE)[number]);
      if (whiteIndex >= 0 && whiteKeys[whiteIndex]) {
        event.preventDefault();
        playKey(whiteKeys[whiteIndex].note);
        return;
      }
      const matchEntry = Object.entries(QWERTY_BLACK_BY_WHITE).find(([, q]) => q === key);
      if (matchEntry) {
        const whiteIdxForBlack = QWERTY_WHITE.indexOf(matchEntry[0] as (typeof QWERTY_WHITE)[number]);
        const white = whiteKeys[whiteIdxForBlack];
        if (white) {
          const blackNoteName = BLACK_KEYS_BY_WHITE[white.note.charAt(0)];
          if (blackNoteName) {
            event.preventDefault();
            playKey(`${blackNoteName}${white.octave}`);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDrum, open, playDrum, playKey, track, whiteKeys]);

  if (!track) {
    return null;
  }

  if (!open) {
    return (
      <section className="surface-panel md:h-[40px] md:shrink-0 flex items-center gap-2 px-3 py-1.5">
        <button
          aria-expanded="false"
          aria-label="Open tap-to-play keyboard"
          className="ghost-icon-button flex h-8 w-8 items-center justify-center"
          onClick={() => setOpen(true)}
          title="Tap to play"
          type="button"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <Hand className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="section-label">Tap to play</span>
        <span className="hidden sm:inline text-[11px] text-[var(--text-secondary)]">Click a key or press A–L to play the selected track.</span>
      </section>
    );
  }

  return (
    <section className="surface-panel md:shrink-0 flex flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-expanded="true"
          aria-label="Hide tap-to-play keyboard"
          className="ghost-icon-button flex h-8 w-8 items-center justify-center"
          onClick={() => setOpen(false)}
          title="Hide"
          type="button"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <Hand className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="section-label">Tap to play</span>
        <div
          className="flex h-6 w-6 items-center justify-center"
          style={{ borderRadius: '2px', border: `1px solid ${track.color}55`, background: `${track.color}1a`, color: track.color }}
        >
          <TrackIcon type={track.type} className="h-3 w-3" />
        </div>
        <span className="truncate text-sm font-medium text-[var(--text-primary)]">{track.name}</span>
        <span className="hidden md:inline text-[11px] text-[var(--text-secondary)]">{getTrackPersonality(track.type).blurb}</span>
        {!isInitialized && (
          <button
            className="control-chip ml-auto flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            data-needs-attention="true"
            onClick={() => void initAudio()}
            type="button"
            title="Arm audio engine"
          >
            <Power className="h-3 w-3" />
            Arm audio
          </button>
        )}
      </div>

      {isDrum ? (
        <DrumPadStrip
          accent={track.color}
          active={activeKey}
          onPad={playDrum}
        />
      ) : (
        <KeyboardStrip
          accent={track.color}
          active={activeKey}
          onKey={playKey}
          whiteKeys={whiteKeys}
        />
      )}
    </section>
  );
};

const KeyboardStrip = ({
  accent,
  active,
  onKey,
  whiteKeys,
}: {
  accent: string;
  active: string | null;
  onKey: (note: string) => void;
  whiteKeys: Array<{ note: string; octave: number; whiteIndex: number; qwerty?: string }>;
}) => {
  return (
    <div
      className="relative w-full select-none"
      role="group"
      aria-label="On-screen keyboard"
      style={{ height: 64 }}
    >
      <div className="absolute inset-0 flex">
        {whiteKeys.map((wk) => {
          const isActive = active === wk.note;
          const isC = wk.note.startsWith('C');
          return (
            <button
              key={wk.note}
              className="relative flex-1 border-l first:border-l-0 border-[var(--border-soft)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              onMouseDown={(event) => {
                event.preventDefault();
                onKey(wk.note);
              }}
              onTouchStart={(event) => {
                event.preventDefault();
                onKey(wk.note);
              }}
              style={{
                background: isActive ? accent : undefined,
              }}
              type="button"
              title={`${wk.note}${wk.qwerty ? ` (${wk.qwerty.toUpperCase()})` : ''}`}
            >
              <span
                className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]"
                style={{ color: isActive ? '#0a0f15' : isC ? 'var(--text-secondary)' : undefined }}
              >
                {isC ? wk.note : wk.qwerty?.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-0">
        {whiteKeys.map((wk, i) => {
          const black = BLACK_KEYS_BY_WHITE[wk.note.charAt(0)];
          if (!black) return null;
          if (i === whiteKeys.length - 1) return null;
          const left = `${((i + 1) / whiteKeys.length) * 100}%`;
          const blackNote = `${black}${wk.octave}`;
          const isActive = active === blackNote;
          return (
            <button
              key={blackNote}
              className="pointer-events-auto absolute top-0 z-10 -translate-x-1/2 border border-[var(--border-strong)] bg-[#0a0f15] hover:bg-[#0f1620] transition-colors"
              onMouseDown={(event) => {
                event.preventDefault();
                onKey(blackNote);
              }}
              onTouchStart={(event) => {
                event.preventDefault();
                onKey(blackNote);
              }}
              style={{
                left,
                width: `${(1 / whiteKeys.length) * 60}%`,
                height: '60%',
                background: isActive ? accent : undefined,
              }}
              type="button"
              title={blackNote}
            />
          );
        })}
      </div>
    </div>
  );
};

const DrumPadStrip = ({
  accent,
  active,
  onPad,
}: {
  accent: string;
  active: string | null;
  onPad: (velocity: number) => void;
}) => {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Drum pads">
      {DRUM_PADS.map((pad) => {
        const id = `pad-${pad.velocity}`;
        const isActive = active === id;
        return (
          <button
            key={pad.label}
            className="border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] transition-colors flex h-14 items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.16em]"
            onMouseDown={(event) => {
              event.preventDefault();
              onPad(pad.velocity);
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              onPad(pad.velocity);
            }}
            style={{
              background: isActive ? accent : undefined,
              color: isActive ? '#0a0f15' : 'var(--text-secondary)',
            }}
            type="button"
            title={`${pad.label} (${pad.qwerty.toUpperCase()})`}
          >
            {pad.label}
            <span className="font-mono text-[10px] opacity-70">{pad.qwerty.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
};
