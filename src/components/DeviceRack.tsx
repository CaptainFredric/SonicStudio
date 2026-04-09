import React from 'react';
import { Activity, Disc3, SlidersHorizontal, Sparkles, Volume2, Zap } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { Knob } from './Knob';
import { Visualizer } from './Visualizer';
import { MasterControl, MasterControls } from './MasterControl';

export const DeviceRack = () => {
  const {
    isRecording,
    selectedTrackId,
    setTrackParams,
    toggleRecording,
    tracks,
    updateTrackPan,
    updateTrackVolume,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;

  if (!track) {
    return (
      <section className="surface-panel h-[286px] flex items-center justify-center">
        <div className="text-center">
          <div className="section-label">Device rack</div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Select a track to load its instrument and effect controls.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-panel h-[286px] overflow-auto p-3">
      <div className="grid h-full min-w-[1260px] grid-cols-[220px_1.1fr_0.95fr_0.8fr_0.95fr_1.45fr] gap-3">
        <div className="surface-panel-strong flex flex-col justify-between p-4">
          <div>
            <div className="section-label">Selected track</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-11 w-11 border flex items-center justify-center" style={{ borderColor: `${track.color}44`, background: `${track.color}14`, color: track.color, borderRadius: '2px' }}>
                <Disc3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</div>
              </div>
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

        <RackSection icon={<Zap className="h-4 w-4 text-[var(--accent)]" />} title="Drive">
          <div className="flex h-full items-center justify-center">
            <Knob color="#f08f86" label="Saturate" max={1} min={0} onChange={(value) => setTrackParams(track.id, { distortion: value })} value={track.params.distortion} />
          </div>
        </RackSection>

        <RackSection icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />} title="Spatial">
          <div className="flex h-full items-center justify-around gap-3">
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
                Spectrum and waveform monitor
              </div>
            </div>
            <button
              className={`border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${isRecording ? 'border-[rgba(240,143,134,0.28)] bg-[rgba(240,143,134,0.16)] text-[var(--danger)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={toggleRecording}
            >
              {isRecording ? 'Stop export' : 'Export audio'}
            </button>
          </div>
          <div className="mt-4 min-h-0 flex-1">
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