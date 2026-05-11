import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, GripHorizontal, Save, SlidersHorizontal, Sparkles, Volume2, Zap } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { getTrackPersonality, TrackIcon } from '../utils/trackPersonality';
import { Knob } from './Knob';
import { Visualizer } from './Visualizer';

const RACK_COLLAPSED_KEY = 'sonicstudio:deviceRack:collapsed';
const RACK_HEIGHT_KEY = 'sonicstudio:deviceRack:height';
const RACK_MIN_HEIGHT = 168;
const RACK_MAX_HEIGHT = 520;
const RACK_DEFAULT_HEIGHT = 232;

const readInitialCollapsed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RACK_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

const readInitialHeight = () => {
  if (typeof window === 'undefined') return RACK_DEFAULT_HEIGHT;
  try {
    const raw = window.localStorage.getItem(RACK_HEIGHT_KEY);
    if (!raw) return RACK_DEFAULT_HEIGHT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return RACK_DEFAULT_HEIGHT;
    return Math.min(RACK_MAX_HEIGHT, Math.max(RACK_MIN_HEIGHT, Math.round(parsed)));
  } catch {
    return RACK_DEFAULT_HEIGHT;
  }
};

export const DeviceRack = () => {
  const {
    isRecording,
    saveTrackSnapshot,
    selectedTrackId,
    setTrackParams,
    toggleRecording,
    tracks,
    updateTrackPan,
    updateTrackVolume,
  } = useAudio();
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return undefined;
    const id = window.setTimeout(() => setJustSaved(false), 1400);
    return () => window.clearTimeout(id);
  }, [justSaved]);
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed);
  const [rackHeight, setRackHeight] = useState<number>(readInitialHeight);
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(RACK_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(RACK_HEIGHT_KEY, String(rackHeight));
    } catch {
      /* ignore */
    }
  }, [rackHeight]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const clientY = 'touches' in event ? event.touches[0]?.clientY ?? 0 : event.clientY;
      dragStateRef.current = { startY: clientY, startHeight: rackHeight };
      event.preventDefault();

      const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        const moveClientY = 'touches' in moveEvent
          ? moveEvent.touches[0]?.clientY ?? state.startY
          : (moveEvent as MouseEvent).clientY;
        const delta = state.startY - moveClientY;
        const next = Math.min(RACK_MAX_HEIGHT, Math.max(RACK_MIN_HEIGHT, state.startHeight + delta));
        setRackHeight(next);
      };
      const onEnd = () => {
        dragStateRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    },
    [rackHeight],
  );

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setRackHeight((current) => Math.min(RACK_MAX_HEIGHT, current + (event.shiftKey ? 24 : 8)));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setRackHeight((current) => Math.max(RACK_MIN_HEIGHT, current - (event.shiftKey ? 24 : 8)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setRackHeight(RACK_DEFAULT_HEIGHT);
    }
  }, []);

  if (!track) {
    return (
      <section className="surface-panel flex items-center justify-center py-6 md:h-[68px] md:shrink-0 md:py-0">
        <div className="text-center">
          <div className="section-label">Device rack</div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">Select a track to load its instrument and effect controls.</p>
        </div>
      </section>
    );
  }

  if (collapsed) {
    return (
      <section className="surface-panel device-rack-panel md:h-[56px] md:shrink-0 flex items-center gap-3 px-4 py-2">
        <button
          aria-expanded="false"
          aria-label="Expand device rack"
          className="ghost-icon-button flex h-9 w-9 items-center justify-center"
          onClick={() => setCollapsed(false)}
          title="Open sound desk"
          type="button"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <div
          className="flex h-7 w-7 items-center justify-center"
          style={{ borderRadius: '2px', border: `1px solid ${track.color}44`, background: `${track.color}14`, color: track.color }}
          title={getTrackPersonality(track.type).blurb}
        >
          <TrackIcon type={track.type} className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="section-label">Sound desk</span>
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">{track.name}</span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          <span>vol <span className="text-[var(--text-secondary)]">{track.volume.toFixed(0)}</span></span>
          <span>cut <span className="text-[var(--text-secondary)]">{(track.params.cutoff / 1000).toFixed(1)}k</span></span>
          <span>rev <span className="text-[var(--text-secondary)]">{track.params.reverbSend.toFixed(2)}</span></span>
        </div>
        <button
          className={`border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${isRecording ? 'border-[rgba(240,143,134,0.28)] bg-[rgba(240,143,134,0.16)] text-[var(--danger)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          onClick={toggleRecording}
          title="Render the current scope to WAV"
          type="button"
        >
          {isRecording ? 'Stop' : 'Export'}
        </button>
      </section>
    );
  }

  return (
    <section
      className="surface-panel device-rack-panel p-3 md:shrink-0 md:overflow-auto relative"
      style={{ height: `${rackHeight}px` }}
    >
      <div
        aria-label="Resize sound desk"
        aria-orientation="horizontal"
        aria-valuemax={RACK_MAX_HEIGHT}
        aria-valuemin={RACK_MIN_HEIGHT}
        aria-valuenow={rackHeight}
        className="group absolute inset-x-0 top-0 z-20 flex h-3 cursor-ns-resize items-center justify-center"
        onKeyDown={handleResizeKeyDown}
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
        role="separator"
        tabIndex={0}
        title="Drag to resize. Use the up and down arrow keys for fine adjustments."
      >
        <GripHorizontal className="h-3 w-3 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100" />
      </div>
      <button
        aria-expanded="true"
        aria-label="Collapse device rack"
        className="ghost-icon-button absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center"
        onClick={() => setCollapsed(true)}
        title="Collapse sound desk"
        type="button"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <div className="grid grid-cols-1 gap-3 lg:h-full lg:min-w-[1380px] lg:grid-cols-[220px_1.1fr_0.95fr_1.3fr_0.95fr_1.45fr]">
        <div className="surface-panel-strong flex flex-col justify-between p-4">
          <div>
            <div className="section-label">Selected track</div>
            <div className="mt-4 flex items-center gap-3">
              <div
                className="h-11 w-11 border flex items-center justify-center"
                style={{ borderColor: `${track.color}44`, background: `${track.color}14`, color: track.color, borderRadius: '2px' }}
                title={getTrackPersonality(track.type).blurb}
              >
                <TrackIcon type={track.type} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</div>
              </div>
              <button
                aria-label="Save current sound as a snapshot"
                className="control-chip flex h-8 items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-active={justSaved ? 'true' : undefined}
                onClick={() => {
                  saveTrackSnapshot(track.id);
                  setJustSaved(true);
                }}
                title="Capture the current synth and source settings as a personal preset"
                type="button"
              >
                <Save className="h-3 w-3" />
                {justSaved ? 'Saved' : 'Save sound'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="section-label">Channel level</span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">{track.volume.toFixed(1)} dB</span>
              </div>
              <input
                className="mt-3"
                max="6"
                min="-60"
                onChange={(event) => updateTrackVolume(track.id, Number(event.target.value))}
                step="1"
                type="range"
                value={track.volume}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="section-label">Pan</span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">{track.pan.toFixed(1)}</span>
              </div>
              <input
                className="mt-3"
                max="1"
                min="-1"
                onChange={(event) => updateTrackPan(track.id, Number(event.target.value))}
                step="0.1"
                type="range"
                value={track.pan}
              />
            </div>
          </div>
        </div>

        <RackSection icon={<SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />} title="Envelope">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Knob label="Attack" max={1} min={0.001} onChange={(value) => setTrackParams(track.id, { attack: value })} unit="s" value={track.params.attack} />
            <Knob label="Decay" max={2} min={0.01} onChange={(value) => setTrackParams(track.id, { decay: value })} unit="s" value={track.params.decay} />
            <Knob label="Sustain" max={1} min={0} onChange={(value) => setTrackParams(track.id, { sustain: value })} value={track.params.sustain} />
            <Knob label="Release" max={4} min={0.01} onChange={(value) => setTrackParams(track.id, { release: value })} unit="s" value={track.params.release} />
          </div>
        </RackSection>

        <RackSection icon={<Activity className="h-4 w-4 text-[var(--accent)]" />} title="Filter">
          <div className="flex h-full items-center justify-around gap-3">
            <Knob color="#e7a65f" label="Cutoff" max={15000} min={20} onChange={(value) => setTrackParams(track.id, { cutoff: value })} unit="Hz" value={track.params.cutoff} />
            <Knob color="#e7a65f" label="Res" max={20} min={0.1} onChange={(value) => setTrackParams(track.id, { resonance: value })} value={track.params.resonance} />
          </div>
        </RackSection>

        <RackSection icon={<Zap className="h-4 w-4 text-[var(--accent)]" />} title="Character">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Knob color="#f08f86" label="Saturate" max={1} min={0} onChange={(value) => setTrackParams(track.id, { distortion: value })} value={track.params.distortion} />
            <Knob color="#f08f86" label="Bitcrush" max={1} min={0} onChange={(value) => setTrackParams(track.id, { bitCrush: value })} value={track.params.bitCrush} />
            <Knob color="#f08f86" label="Vibrato" max={1} min={0} onChange={(value) => setTrackParams(track.id, { vibratoDepth: value })} value={track.params.vibratoDepth} />
            <Knob color="#f08f86" label="Vib rate" max={10} min={0.5} onChange={(value) => setTrackParams(track.id, { vibratoRate: value })} unit="Hz" value={track.params.vibratoRate} />
          </div>
        </RackSection>

        <RackSection icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />} title="Spatial">
          <div className="flex h-full items-center justify-around gap-3">
            <Knob color="#96b9f3" label="Chorus" max={1} min={0} onChange={(value) => setTrackParams(track.id, { chorusSend: value })} value={track.params.chorusSend} />
            <Knob color="#96b9f3" label="Delay" max={1} min={0} onChange={(value) => setTrackParams(track.id, { delaySend: value })} value={track.params.delaySend} />
            <Knob color="#96b9f3" label="Reverb" max={1} min={0} onChange={(value) => setTrackParams(track.id, { reverbSend: value })} value={track.params.reverbSend} />
          </div>
        </RackSection>

        <div className="surface-panel-strong flex flex-col p-4 min-h-[180px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-label">Master output</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Volume2 className="h-4 w-4 text-[var(--accent)]" />
                Spectrum and waveform monitor
              </div>
            </div>
            <button
              className={`border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${isRecording ? 'border-[rgba(240,143,134,0.28)] bg-[rgba(240,143,134,0.16)] text-[var(--danger)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={toggleRecording}
              title="Render the current scope to WAV"
            >
              {isRecording ? 'Stop export' : 'Export audio'}
            </button>
          </div>
          <div className="mt-4 min-h-[80px] flex-1">
            <Visualizer />
          </div>
        </div>
      </div>
    </section>
  );
};

const RackSection = ({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="surface-panel-strong flex flex-col p-4">
    <div className="flex items-center gap-2">
      {icon}
      <span className="section-label">{title}</span>
    </div>
    <div className="mt-5 flex-1">{children}</div>
  </div>
);
