import React from 'react';
import {
  Activity,
  Disc3,
  Play,
  Sparkles,
  SlidersHorizontal,
  Volume2,
  Waves,
  Zap,
} from 'lucide-react';

import { getDefaultSamplePreset, getSamplePresetMeta, getSamplePresetOptions } from '../audio/sampleLibrary';
import { useAudio } from '../context/AudioContext';
import { Knob } from './Knob';
import { Visualizer } from './Visualizer';

const WAVEFORM_OPTIONS = ['sine', 'triangle', 'sawtooth', 'square'] as const;
const FILTER_OPTIONS = ['lowpass', 'bandpass', 'highpass'] as const;

export const DeviceRack = () => {
  const {
    currentPattern,
    isRecording,
    previewTrack,
    selectedTrackId,
    setTrackParams,
    setTrackSource,
    toggleRecording,
    tracks,
    updateTrackPan,
    updateTrackVolume,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;
  const sampleOptions = track ? getSamplePresetOptions(track.type) : [];
  const activeSampleMeta = track ? getSamplePresetMeta(track.source.samplePreset) : null;

  if (!track) {
    return (
      <section className="surface-panel flex h-[330px] items-center justify-center">
        <div className="text-center">
          <div className="section-label">Device rack</div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Select a track to load its source, tone, and output chain.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-panel h-[360px] overflow-auto p-3">
      <div className="grid h-full min-w-[1720px] grid-cols-[240px_1fr_0.95fr_1.05fr_0.95fr_1.05fr_1.45fr] gap-3">
        <div className="surface-panel-strong flex flex-col justify-between p-4">
          <div>
            <div className="section-label">Selected track</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border" style={{ background: `${track.color}12`, borderColor: `${track.color}44`, borderRadius: '4px', color: track.color }}>
                <Disc3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {track.source.engine}
                  </span>
                  <span className="rounded-sm border border-[var(--border-soft)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {track.source.engine === 'sample' ? activeSampleMeta?.label ?? 'preset' : waveformLabel(track.source.waveform)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
              <div className="section-label">Character</div>
              <div className="mt-2 text-sm text-[var(--text-primary)]">
                {track.source.engine === 'sample'
                  ? `${activeSampleMeta?.label ?? 'Sample'} · ${filterLabel(track.params.filterMode)}`
                  : `${waveformLabel(track.source.waveform)} · ${filterLabel(track.params.filterMode)}`}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {track.source.engine === 'sample'
                  ? 'Built-in sampled source running through the same motion and space chain as the synth engine.'
                  : track.type === 'bass' || track.type === 'lead'
                    ? 'Playable synth voice with oscillator shaping, motion, and widening.'
                    : 'Percussive or texture lane with deeper color and output shaping.'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                className="control-chip flex flex-1 items-center justify-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] hover:text-[var(--text-primary)]"
                onClick={() => void previewTrack(track.id)}
              >
                <Play className="h-3.5 w-3.5" />
                Audition
              </button>
            </div>

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

        <RackSection icon={<Waves className="h-4 w-4 text-[var(--accent)]" />} title="Source">
          <div className="grid gap-4">
            <label className="text-xs text-[var(--text-secondary)]">
              <span className="section-label mb-2 block">Engine</span>
              <select
                className="control-field h-11 w-full px-3 text-sm"
                onChange={(event) => {
                  const engine = event.target.value as typeof track.source.engine;
                  setTrackSource(track.id, {
                    engine,
                    samplePreset: engine === 'sample' ? getDefaultSamplePreset(track.type) : track.source.samplePreset,
                  });
                }}
                value={track.source.engine}
              >
                <option value="synth">Synth</option>
                <option value="sample">Sample</option>
              </select>
            </label>

            {track.source.engine === 'sample' ? (
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="section-label mb-2 block">Sample preset</span>
                <select
                  className="control-field h-11 w-full px-3 text-sm"
                  onChange={(event) => setTrackSource(track.id, { samplePreset: event.target.value as typeof track.source.samplePreset })}
                  value={track.source.samplePreset}
                >
                  {sampleOptions.map((option) => (
                    <option key={option.preset} value={option.preset}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-[11px] leading-5 text-[var(--text-secondary)]">
                  {activeSampleMeta?.description ?? 'Built-in sample source.'}
                </span>
              </label>
            ) : (
              <label className="text-xs text-[var(--text-secondary)]">
              <span className="section-label mb-2 block">Waveform</span>
              <select
                className="control-field h-11 w-full px-3 text-sm"
                onChange={(event) => setTrackSource(track.id, { waveform: event.target.value as typeof track.source.waveform })}
                value={track.source.waveform}
              >
                {WAVEFORM_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {waveformLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            )}
            <div className="grid grid-cols-3 gap-4">
              <Knob
                color="#7dd3fc"
                label="Octave"
                max={3}
                min={-3}
                onChange={(value) => setTrackSource(track.id, { octaveShift: Math.round(value) })}
                step={1}
                value={track.source.octaveShift}
              />
              <Knob
                color="#7dd3fc"
                label="Detune"
                disabled={track.source.engine === 'sample'}
                max={1200}
                min={-1200}
                onChange={(value) => setTrackSource(track.id, { detune: value })}
                unit="ct"
                value={track.source.detune}
              />
              <Knob
                color="#7dd3fc"
                disabled={track.source.engine === 'sample'}
                label="Glide"
                max={0.2}
                min={0}
                onChange={(value) => setTrackSource(track.id, { portamento: value })}
                unit="s"
                value={track.source.portamento}
              />
            </div>
            {track.source.engine === 'sample' && (
              <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                Sample mode keeps octave transpose active for musical playback. Fine detune and glide stay synth-only for now so the first version remains reliable in the browser.
              </div>
            )}
          </div>
        </RackSection>

        <RackSection icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />} title="Envelope">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Knob label="Attack" max={1} min={0.001} onChange={(value) => setTrackParams(track.id, { attack: value })} unit="s" value={track.params.attack} />
            <Knob label="Decay" max={2} min={0.01} onChange={(value) => setTrackParams(track.id, { decay: value })} unit="s" value={track.params.decay} />
            <Knob label="Sustain" max={1} min={0} onChange={(value) => setTrackParams(track.id, { sustain: value })} value={track.params.sustain} />
            <Knob label="Release" max={4} min={0.01} onChange={(value) => setTrackParams(track.id, { release: value })} unit="s" value={track.params.release} />
          </div>
        </RackSection>

        <RackSection icon={<Activity className="h-4 w-4 text-[var(--accent)]" />} title="Filter">
          <div className="grid h-full gap-4">
            <label className="text-xs text-[var(--text-secondary)]">
              <span className="section-label mb-2 block">Mode</span>
              <select
                className="control-field h-11 w-full px-3 text-sm"
                onChange={(event) => setTrackParams(track.id, { filterMode: event.target.value as typeof track.params.filterMode })}
                value={track.params.filterMode}
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {filterLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-around gap-3">
              <Knob color="#e7a65f" label="Cutoff" max={15000} min={20} onChange={(value) => setTrackParams(track.id, { cutoff: value })} unit="Hz" value={track.params.cutoff} />
              <Knob color="#e7a65f" label="Res" max={20} min={0.1} onChange={(value) => setTrackParams(track.id, { resonance: value })} value={track.params.resonance} />
            </div>
          </div>
        </RackSection>

        <RackSection icon={<SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />} title="Motion">
          <div className="grid grid-cols-2 gap-4">
            <Knob color="#8ab4ff" label="Vib rate" max={12} min={0.1} onChange={(value) => setTrackParams(track.id, { vibratoRate: value })} unit="Hz" value={track.params.vibratoRate} />
            <Knob color="#8ab4ff" label="Vib depth" max={1} min={0} onChange={(value) => setTrackParams(track.id, { vibratoDepth: value })} value={track.params.vibratoDepth} />
          </div>
        </RackSection>

        <RackSection icon={<Zap className="h-4 w-4 text-[var(--accent)]" />} title="Drive & space">
          <div className="grid grid-cols-5 gap-4">
            <Knob color="#96b9f3" label="Chorus" max={1} min={0} onChange={(value) => setTrackParams(track.id, { chorusSend: value })} value={track.params.chorusSend} />
            <Knob color="#d79cff" label="Crush" max={1} min={0} onChange={(value) => setTrackParams(track.id, { bitCrush: value })} value={track.params.bitCrush} />
            <Knob color="#f08f86" label="Drive" max={1} min={0} onChange={(value) => setTrackParams(track.id, { distortion: value })} value={track.params.distortion} />
            <Knob color="#96b9f3" label="Delay" max={1} min={0} onChange={(value) => setTrackParams(track.id, { delaySend: value })} value={track.params.delaySend} />
            <Knob color="#96b9f3" label="Reverb" max={1} min={0} onChange={(value) => setTrackParams(track.id, { reverbSend: value })} value={track.params.reverbSend} />
          </div>
        </RackSection>

        <div className="surface-panel-strong flex flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-label">Master output</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Volume2 className="h-4 w-4 text-[var(--accent)]" />
                Spectrum and print monitor
              </div>
            </div>
            <button
              className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${isRecording ? 'border-[rgba(240,143,134,0.28)] bg-[rgba(240,143,134,0.16)] text-[var(--danger)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={toggleRecording}
            >
              {isRecording ? 'Stop print' : 'Print audio'}
            </button>
          </div>
          <div className="mt-4 grid flex-1 gap-4">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
              <div className="section-label">Track status</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                <StatusCell label="Engine" value={track.source.engine === 'sample' ? 'Sample' : 'Synth'} />
                <StatusCell label="Voice" value={track.source.engine === 'sample' ? activeSampleMeta?.label ?? 'Preset' : waveformLabel(track.source.waveform)} />
                <StatusCell label="Pattern notes" value={`${track.patterns[currentPattern]?.reduce((sum, step) => sum + step.length, 0) ?? 0}`} />
                <StatusCell label="Filter" value={filterLabel(track.params.filterMode)} />
              </div>
              <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                {track.source.engine === 'sample'
                  ? 'Audition plays the current sample preset through the same filter and FX chain used during playback.'
                  : 'Audition plays the current synth voice with its motion and space settings, so you can shape tone without starting transport.'}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
              <Visualizer />
            </div>
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

const waveformLabel = (waveform: typeof WAVEFORM_OPTIONS[number]) => {
  switch (waveform) {
    case 'sawtooth':
      return 'Saw';
    case 'triangle':
      return 'Triangle';
    default:
      return waveform.charAt(0).toUpperCase() + waveform.slice(1);
  }
};

const filterLabel = (mode: typeof FILTER_OPTIONS[number]) => {
  switch (mode) {
    case 'highpass':
      return 'High-pass';
    case 'bandpass':
      return 'Band-pass';
    default:
      return 'Low-pass';
  }
};

const StatusCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[10px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
    <div className="section-label">{label}</div>
    <div className="mt-1 text-xs font-medium text-[var(--text-primary)]">{value}</div>
  </div>
);
