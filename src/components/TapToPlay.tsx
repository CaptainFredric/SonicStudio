import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripHorizontal, Hand, Minus, Plus, Power } from 'lucide-react';

import { engine } from '../audio/ToneEngine';
import { useAudio, usePlaybackStep } from '../context/AudioContext';
import {
  captureSuggestionControlsToTrackParams,
  captureSuggestionControlsToTrackSource,
} from '../services/audioRecording';
import { loadRecordedNotePresets, subscribeRecordedNotePresets, type RecordedNotePreset } from '../services/recordedNoteLibrary';
import { createTrack as createPreviewTrackModel, defaultNoteForTrack, getTrackVoicePresetDefinitions } from '../project/schema';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';

const STORAGE_KEY = 'sonicstudio:tapToPlay:open';
const HEIGHT_STORAGE_KEY = 'sonicstudio:tapToPlay:height';
const OCTAVE_STORAGE_KEY = 'sonicstudio:tapToPlay:octaveShift';
const WRITE_MODE_STORAGE_KEY = 'sonicstudio:tapToPlay:writeMode';
const MIN_HEIGHT = 56;
const MAX_HEIGHT = 240;
const DEFAULT_HEIGHT = 88;

const readInitialOpen = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const readInitialHeight = () => {
  if (typeof window === 'undefined') return DEFAULT_HEIGHT;
  try {
    const raw = window.localStorage.getItem(HEIGHT_STORAGE_KEY);
    if (!raw) return DEFAULT_HEIGHT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_HEIGHT;
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(parsed)));
  } catch {
    return DEFAULT_HEIGHT;
  }
};

const readInitialOctaveShift = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(OCTAVE_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(-3, Math.min(3, Math.round(parsed)));
  } catch {
    return 0;
  }
};

const readInitialWriteMode = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WRITE_MODE_STORAGE_KEY) === '1';
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

const DRUM_PAD_TONES: Record<string, { backgroundAlpha: string; borderAlpha: string; glowAlpha: string }> = {
  Soft: { backgroundAlpha: '12', borderAlpha: '42', glowAlpha: '16' },
  Mid: { backgroundAlpha: '1f', borderAlpha: '58', glowAlpha: '22' },
  Hard: { backgroundAlpha: '33', borderAlpha: '72', glowAlpha: '2e' },
  Accent: { backgroundAlpha: '4d', borderAlpha: '9c', glowAlpha: '44' },
};

const buildRecordedPresetPreviewTrack = (preset: RecordedNotePreset) => {
  const voicePreset = preset.presetId
    ? getTrackVoicePresetDefinitions(preset.trackType).find((candidate) => candidate.id === preset.presetId) ?? null
    : null;

  return createPreviewTrackModel(preset.trackType, {
    id: `tap-preview-${preset.id}`,
    name: preset.name,
    params: {
      ...(voicePreset?.params ?? {}),
      ...captureSuggestionControlsToTrackParams(preset.controls),
    },
    source: {
      ...(voicePreset?.source ?? {}),
      ...captureSuggestionControlsToTrackSource(preset.controls),
    },
  });
};

export const TapToPlay = () => {
  const {
    applyTrackVoicePreset,
    initAudio,
    isInitialized,
    isPlaying,
    previewTrack,
    selectedTrackId,
    setTrackParams,
    setSelectedTrackId,
    setTrackSource,
    stampChord,
    stepsPerPattern,
    tracks,
  } = useAudio();
  const playbackStep = usePlaybackStep();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;
  const [open, setOpen] = useState<boolean>(readInitialOpen);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [height, setHeight] = useState<number>(readInitialHeight);
  const [octaveShift, setOctaveShift] = useState<number>(readInitialOctaveShift);
  const [writeMode, setWriteMode] = useState<boolean>(readInitialWriteMode);
  const [writeStep, setWriteStep] = useState(0);
  const [recordedNoteLibrary, setRecordedNoteLibrary] = useState<RecordedNotePreset[]>([]);
  const [selectedRecordedPresetId, setSelectedRecordedPresetId] = useState<string | null>(null);
  const lastFlashRef = useRef<number | null>(null);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const appliedPresetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setRecordedNoteLibrary(loadRecordedNotePresets());
    return subscribeRecordedNotePresets(setRecordedNoteLibrary);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(height));
    } catch { /* ignore */ }
  }, [height]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(OCTAVE_STORAGE_KEY, String(octaveShift));
    } catch { /* ignore */ }
  }, [octaveShift]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(WRITE_MODE_STORAGE_KEY, writeMode ? '1' : '0');
    } catch { /* ignore */ }
  }, [writeMode]);

  const isDrum = !!track && (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat');
  const normalizedPlaybackStep = stepsPerPattern > 0 ? playbackStep % stepsPerPattern : 0;
  const octaveRange = useMemo(() => {
    if (!track) return { startOctave: 3, totalOctaves: 2 };
    const base = getOctaveRangeForType(track.type);
    return { ...base, startOctave: Math.max(0, Math.min(8, base.startOctave + octaveShift)) };
  }, [track, octaveShift]);
  const whiteKeys = useMemo(() => buildWhiteKeys(octaveRange), [octaveRange]);
  const selectedRecordedPreset = useMemo(() => (
    selectedRecordedPresetId
      ? recordedNoteLibrary.find((preset) => preset.id === selectedRecordedPresetId) ?? null
      : null
  ), [recordedNoteLibrary, selectedRecordedPresetId]);
  const visibleRecordedPresets = useMemo(() => {
    if (!track) {
      return [] as RecordedNotePreset[];
    }

    const matchingType = recordedNoteLibrary.filter((preset) => preset.trackType === track.type);
    const remaining = recordedNoteLibrary.filter((preset) => preset.trackType !== track.type);
    return [...matchingType, ...remaining].slice(0, 6);
  }, [recordedNoteLibrary, track]);

  useEffect(() => {
    if (!selectedRecordedPresetId) {
      return;
    }

    if (!recordedNoteLibrary.some((preset) => preset.id === selectedRecordedPresetId)) {
      setSelectedRecordedPresetId(null);
    }
  }, [recordedNoteLibrary, selectedRecordedPresetId]);

  useEffect(() => {
    setWriteStep(normalizedPlaybackStep);
    appliedPresetKeyRef.current = null;
  }, [normalizedPlaybackStep, track?.id]);

  const applyRecordedPresetToTrack = useCallback((preset: RecordedNotePreset) => {
    if (!track) {
      return;
    }

    if (preset.presetId) {
      applyTrackVoicePreset(track.id, preset.presetId);
    }

    setTrackSource(track.id, captureSuggestionControlsToTrackSource(preset.controls));
    setTrackParams(track.id, captureSuggestionControlsToTrackParams(preset.controls));
    appliedPresetKeyRef.current = `${track.id}:${preset.id}`;
  }, [applyTrackVoicePreset, setTrackParams, setTrackSource, track]);

  const stampPlayedNote = useCallback((note: string, velocity: number) => {
    if (!track || !stepsPerPattern) {
      return;
    }

    if (selectedRecordedPreset && appliedPresetKeyRef.current !== `${track.id}:${selectedRecordedPreset.id}`) {
      applyRecordedPresetToTrack(selectedRecordedPreset);
    }

    const targetStep = isPlaying ? normalizedPlaybackStep : writeStep;
    stampChord(track.id, targetStep, [note], {
      gate: track.source.engine === 'sample' ? 2 : track.type === 'pad' ? 2 : 1.25,
      velocity,
    });

    if (!isPlaying) {
      setWriteStep((current) => (current + 1) % stepsPerPattern);
    }
  }, [applyRecordedPresetToTrack, isPlaying, normalizedPlaybackStep, selectedRecordedPreset, stampChord, stepsPerPattern, track, writeStep]);

  const previewPlayable = useCallback(async (note: string, velocity: number = 0.88) => {
    if (!track) {
      return;
    }

    await initAudio();

    if (selectedRecordedPreset) {
      const previewTrackModel = buildRecordedPresetPreviewTrack(selectedRecordedPreset);
      const previewNote = note || selectedRecordedPreset.note || defaultNoteForTrack(previewTrackModel);
      engine.previewTrack(previewTrackModel, previewNote, undefined, velocity);
      return;
    }

    await previewTrack(track.id, note || defaultNoteForTrack(track), undefined, velocity);
  }, [initAudio, previewTrack, selectedRecordedPreset, track]);

  const playKey = useCallback(
    (note: string) => {
      if (!track) return;
      void previewPlayable(note, 0.88);
      if (writeMode) {
        stampPlayedNote(note, 0.88);
      }
      setActiveKey(note);
      const id = window.setTimeout(() => setActiveKey((current) => (current === note ? null : current)), 170);
      lastFlashRef.current = id;
    },
    [previewPlayable, stampPlayedNote, track, writeMode],
  );

  const playDrum = useCallback(
    (velocity: number) => {
      if (!track) return;
      const note = selectedRecordedPreset?.note ?? defaultNoteForTrack(track);
      void previewPlayable(note, velocity);
      if (writeMode) {
        stampPlayedNote(note, velocity);
      }
      setActiveKey(`pad-${velocity}`);
      const id = window.setTimeout(() => setActiveKey(null), 170);
      lastFlashRef.current = id;
    },
    [previewPlayable, selectedRecordedPreset?.note, stampPlayedNote, track, writeMode],
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
      // Octave shift hotkeys
      if (event.key === ',' || event.key === 'z') {
        event.preventDefault();
        setOctaveShift((current) => Math.max(-3, current - 1));
        return;
      }
      if (event.key === '.' || event.key === 'x') {
        event.preventDefault();
        setOctaveShift((current) => Math.min(3, current + 1));
        return;
      }
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

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    resizeStateRef.current = { startY: event.clientY, startHeight: height };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    event.preventDefault();
  }, [height]);

  const handleResizeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state) return;
    const delta = state.startY - event.clientY;
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, state.startHeight + delta)));
  }, []);

  const handleResizeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    resizeStateRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  if (!track) {
    return null;
  }

  if (!open) {
    return (
      <section data-tour-target="tap-to-play" className="surface-panel flex flex-wrap items-center gap-2 px-3 py-2 md:h-[40px] md:shrink-0 md:py-1.5">
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
        <span className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">{track.name}</span>
        <span className="hidden sm:inline text-[11px] text-[var(--text-secondary)]">Click a key or press A–L to play the selected track.</span>
      </section>
    );
  }

  return (
    <section data-tour-target="tap-to-play" className="surface-panel md:shrink-0 flex flex-col gap-2 px-3 py-2 relative">
      <div
        aria-label="Resize tap-to-play"
        aria-orientation="horizontal"
        className="group hidden md:flex absolute inset-x-0 top-0 h-2 cursor-ns-resize items-center justify-center"
        onPointerCancel={handleResizeEnd}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        role="separator"
        tabIndex={0}
        title="Drag up or down to resize the keyboard"
      >
        <GripHorizontal className="h-3 w-3 text-[var(--text-tertiary)] opacity-40 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
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
        <div className="min-w-0 flex-1">
          <TrackPicker
            activeId={track.id}
            tracks={tracks}
            onPick={(id) => setSelectedTrackId(id)}
          />
        </div>
        {!isDrum && (
          <div className="flex items-center gap-0.5">
            <button
              aria-label="Octave down"
              className="ghost-icon-button flex h-7 w-7 items-center justify-center"
              onClick={() => setOctaveShift((current) => Math.max(-3, current - 1))}
              title="Octave down (,)"
              type="button"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)] min-w-[40px] text-center">
              {octaveShift === 0 ? 'Oct 0' : `Oct ${octaveShift > 0 ? `+${octaveShift}` : octaveShift}`}
            </span>
            <button
              aria-label="Octave up"
              className="ghost-icon-button flex h-7 w-7 items-center justify-center"
              onClick={() => setOctaveShift((current) => Math.min(3, current + 1))}
              title="Octave up (.)"
              type="button"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
        <button
          className="control-chip flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          data-active={writeMode ? 'true' : 'false'}
          onClick={() => {
            setWriteMode((current) => {
              const next = !current;
              if (next) {
                setWriteStep(normalizedPlaybackStep);
              }
              return next;
            });
          }}
          type="button"
          title="Write played notes into the current pattern"
        >
          {writeMode ? 'Write on' : 'Write off'}
        </button>
        {writeMode && (
          <div className="flex items-center gap-0.5">
            <button
              aria-label="Previous write step"
              className="ghost-icon-button flex h-7 w-7 items-center justify-center"
              onClick={() => setWriteStep((current) => Math.max(0, current - 1))}
              title="Previous step"
              type="button"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[62px] text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {isPlaying ? `Play ${normalizedPlaybackStep + 1}` : `Step ${writeStep + 1}`}
            </span>
            <button
              aria-label="Next write step"
              className="ghost-icon-button flex h-7 w-7 items-center justify-center"
              onClick={() => setWriteStep((current) => Math.min(Math.max(0, stepsPerPattern - 1), current + 1))}
              title="Next step"
              type="button"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
        <span className="hidden min-w-0 md:inline text-[11px] text-[var(--text-secondary)]">{getTrackPersonality(track.type).blurb}</span>
        {!isInitialized && (
          <button
            className="control-chip ml-auto flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            data-needs-attention="true"
            onClick={() => void initAudio()}
            type="button"
            title="Enable audio engine"
          >
            <Power className="h-3 w-3" />
            Enable audio
          </button>
        )}
      </div>

      {visibleRecordedPresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] pt-2">
          <span className="section-label">Captured sounds</span>
          <button
            className="control-chip flex h-7 items-center px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            data-active={selectedRecordedPreset ? 'false' : 'true'}
            onClick={() => setSelectedRecordedPresetId(null)}
            type="button"
          >
            Track sound
          </button>
          {visibleRecordedPresets.map((preset) => (
            <button
              key={preset.id}
              className="control-chip flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              data-active={selectedRecordedPresetId === preset.id ? 'true' : 'false'}
              onClick={() => setSelectedRecordedPresetId((current) => current === preset.id ? null : preset.id)}
              title={`${preset.name} · ${preset.note} · ${preset.trackType}`}
              type="button"
            >
              <span className="truncate">{preset.name}</span>
              <span className="font-mono text-[9px] text-[var(--text-tertiary)]">{preset.note}</span>
            </button>
          ))}
          {selectedRecordedPreset && (
            <button
              className="control-chip ml-auto flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              onClick={() => applyRecordedPresetToTrack(selectedRecordedPreset)}
              type="button"
            >
              Use on lane
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <span>
          {selectedRecordedPreset
            ? `Previewing ${selectedRecordedPreset.name} on the tap keys.`
            : 'Using the selected lane sound on the tap keys.'}
        </span>
        <span className="hidden md:inline">
          {writeMode
            ? 'Played notes can be stamped into the current pattern while you audition.'
            : 'Turn on Write to drop notes into the pattern from the keyboard.'}
        </span>
      </div>

      {isDrum ? (
        <DrumPadStrip
          accent={track.color}
          active={activeKey}
          onPad={playDrum}
          height={height}
        />
      ) : (
        <KeyboardStrip
          accent={track.color}
          active={activeKey}
          onKey={playKey}
          whiteKeys={whiteKeys}
          height={height}
        />
      )}
    </section>
  );
};

const TrackPicker = ({
  activeId,
  tracks,
  onPick,
}: {
  activeId: string | null;
  tracks: ReturnType<typeof useAudio>['tracks'];
  onPick: (id: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1">
    {tracks.map((t) => (
      <button
        key={t.id}
        aria-label={`Play through ${t.name}`}
        className="flex h-7 w-7 items-center justify-center transition-opacity"
        onClick={() => onPick(t.id)}
        style={{
          background: activeId === t.id ? `${t.color}26` : 'transparent',
          border: `1px solid ${activeId === t.id ? t.color : 'transparent'}`,
          borderRadius: '3px',
          color: t.color,
          opacity: activeId === t.id ? 1 : 0.74,
        }}
        title={`Play ${t.name}`}
        type="button"
      >
        <TrackIcon type={t.type} className="h-3.5 w-3.5" />
      </button>
    ))}
  </div>
);

const KeyboardStrip = ({
  accent,
  active,
  onKey,
  whiteKeys,
  height,
}: {
  accent: string;
  active: string | null;
  onKey: (note: string) => void;
  whiteKeys: Array<{ note: string; octave: number; whiteIndex: number; qwerty?: string }>;
  height: number;
}) => {
  return (
    <div
      className="relative w-full select-none"
      role="group"
      aria-label="On-screen keyboard"
      style={{ height }}
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
  height,
}: {
  accent: string;
  active: string | null;
  onPad: (velocity: number) => void;
  height: number;
}) => {
  const padHeight = Math.max(48, Math.min(height, 160));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Drum pads">
      {DRUM_PADS.map((pad) => {
        const id = `pad-${pad.velocity}`;
        const isActive = active === id;
        const tone = DRUM_PAD_TONES[pad.label];
        return (
          <button
            key={pad.label}
            className="border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] transition-colors flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.16em]"
            onMouseDown={(event) => {
              event.preventDefault();
              onPad(pad.velocity);
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              onPad(pad.velocity);
            }}
            style={{
              background: isActive
                ? `linear-gradient(180deg, ${accent}, ${accent}cc)`
                : `linear-gradient(180deg, ${accent}${tone.backgroundAlpha}, rgba(255,255,255,0.03))`,
              borderColor: isActive ? `${accent}cc` : `${accent}${tone.borderAlpha}`,
              boxShadow: isActive
                ? `inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 1px ${accent}${tone.glowAlpha}, 0 8px 18px rgba(0,0,0,0.14)`
                : `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px ${accent}12`,
              color: isActive ? '#0a0f15' : 'var(--text-primary)',
              height: padHeight,
            }}
            type="button"
            title={`${pad.label} (${pad.qwerty.toUpperCase()})`}
          >
            <span className="flex flex-col items-center gap-1">
              <span>{pad.label}</span>
              <span className="font-mono text-[10px] opacity-75">Vel {Math.round(pad.velocity * 100)}</span>
            </span>
            <span className="font-mono text-[10px] opacity-70">{pad.qwerty.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
};
