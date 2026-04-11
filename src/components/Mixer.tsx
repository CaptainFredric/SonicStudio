import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { engine } from '../audio/ToneEngine';
import type { Track } from '../project/schema';

const VUChannel: React.FC<{ track: Track }> = ({ track }) => {
  const { updateTrackPan, updateTrackVolume, toggleMute, toggleSolo } = useAudio();
  const [level, setLevel] = useState(-100);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLevel(engine.getMeterValue(track.id));
    }, 50);

    return () => {
      window.clearInterval(interval);
    };
  }, [track.id]);

  const levelHeight = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));

  return (
    <div className="surface-panel-strong w-[148px] shrink-0 p-4 flex flex-col">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.color }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{track.name}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{track.type}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <StateBtn active={track.muted} label="Mute" onClick={() => toggleMute(track.id)} />
        <StateBtn active={track.solo} label="Solo" onClick={() => toggleSolo(track.id)} />
      </div>

      <div className="mt-5">
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

      <div className="mt-6 flex-1 flex items-center justify-center gap-5">
        <div className="relative h-[220px] w-3 rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
            style={{
              height: `${levelHeight}%`,
              background: 'linear-gradient(180deg, rgba(212,177,106,0.92) 0%, rgba(130,201,187,0.96) 65%)',
            }}
          />
        </div>

        <VerticalFader
          max={6}
          min={-60}
          onChange={(value) => updateTrackVolume(track.id, value)}
          step={1}
          value={track.volume}
        />
      </div>

      <div className="mt-4 flex items-center justify-between border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
        <span className="section-label">Gain</span>
        <span className="font-mono text-xs text-[var(--text-primary)]">{track.volume.toFixed(1)} dB</span>
      </div>
    </div>
  );
};

export const Mixer = () => {
  const { master, setMasterSettings, tracks } = useAudio();
  const [masterLevel, setMasterLevel] = useState(-100);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMasterLevel(engine.getMasterMeterValue());
    }, 50);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const masterLevelHeight = Math.max(0, Math.min(100, ((masterLevel + 60) / 60) * 100));

  return (
    <section className="surface-panel flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="section-label">Mixer</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Channel strips</h2>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
          <span>{tracks.length} active tracks</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-5 [scroll-behavior:smooth] [-webkit-overflow-scrolling:touch]">
        <div className="flex h-full min-h-[560px] gap-4 scroll-snap-x-mandatory">
          <div className="scroll-snap-align-start">
            <div className="surface-panel-strong flex h-full min-h-[560px] w-[184px] shrink-0 flex-col p-4">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">Master</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Output chain</div>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="section-label">Glue</span>
                    <span className="font-mono text-[10px] text-[var(--text-secondary)]">{Math.round(master.glueCompression * 100)}</span>
                  </div>
                  <input
                    className="mt-3"
                    max="1"
                    min="0"
                    onChange={(event) => setMasterSettings({ glueCompression: Number(event.target.value) })}
                    step="0.01"
                    type="range"
                    value={master.glueCompression}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="section-label">Tone</span>
                    <span className="font-mono text-[10px] text-[var(--text-secondary)]">{Math.round(master.tone * 100)}</span>
                  </div>
                  <input
                    className="mt-3"
                    max="1"
                    min="0"
                    onChange={(event) => setMasterSettings({ tone: Number(event.target.value) })}
                    step="0.01"
                    type="range"
                    value={master.tone}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-1 items-center justify-center gap-5">
                <div className="relative h-[220px] w-3 overflow-hidden rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)]">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
                    style={{
                      height: `${masterLevelHeight}%`,
                      background: 'linear-gradient(180deg, rgba(125,211,252,0.92) 0%, rgba(130,201,187,0.96) 65%)',
                    }}
                  />
                </div>

                <VerticalFader
                  max={12}
                  min={-12}
                  onChange={(value) => setMasterSettings({ outputGain: value })}
                  step={0.5}
                  value={master.outputGain}
                />
              </div>

              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
                  <span className="section-label">Output</span>
                  <span className="font-mono text-xs text-[var(--text-primary)]">{master.outputGain.toFixed(1)} dB</span>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="section-label">Limiter ceiling</span>
                    <span className="font-mono text-[10px] text-[var(--text-secondary)]">{master.limiterCeiling.toFixed(1)} dB</span>
                  </div>
                  <input
                    className="mt-3"
                    max="0"
                    min="-1.2"
                    onChange={(event) => setMasterSettings({ limiterCeiling: Number(event.target.value) })}
                    step="0.05"
                    type="range"
                    value={master.limiterCeiling}
                  />
                </div>
              </div>
            </div>
          </div>
          {tracks.map((track) => (
            <div key={track.id} className="scroll-snap-align-start">
              <VUChannel track={track} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const StateBtn = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    className="control-chip flex-1 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] transition-colors"
    data-active={active}
    onClick={onClick}
  >
    {label}
  </button>
);

const VerticalFader = ({
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const thumbBottom = `calc(${clampedPercentage}% - 14px)`;

  const updateFromPointer = (element: HTMLDivElement, clientY: number) => {
    const bounds = element.getBoundingClientRect();
    const ratio = 1 - ((clientY - bounds.top) / bounds.height);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const rawValue = min + ((max - min) * clampedRatio);
    const steppedValue = min + (Math.round((rawValue - min) / step) * step);
    onChange(Number(Math.max(min, Math.min(max, steppedValue)).toFixed(step >= 1 ? 0 : 2)));
  };

  return (
    <div className="flex h-[220px] w-9 items-center justify-center">
      <div
        className="group relative flex h-full w-6 cursor-ns-resize items-center justify-center rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)]"
        onPointerDown={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
          updateFromPointer(event.currentTarget as HTMLDivElement, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 0) {
            return;
          }

          updateFromPointer(event.currentTarget as HTMLDivElement, event.clientY);
        }}
        style={{ touchAction: 'none' }}
      >
        <div className="absolute inset-[5px] rounded-full bg-[rgba(255,255,255,0.035)]" />
        <div
          className="absolute bottom-[5px] left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-[var(--accent)] transition-[height] duration-75"
          style={{ height: `calc(${clampedPercentage}% - 5px)` }}
        />
        <div
          className="absolute left-1/2 h-7 w-7 -translate-x-1/2 rounded-[6px] border border-[rgba(255,255,255,0.24)] bg-[linear-gradient(180deg,rgba(241,245,249,0.92),rgba(203,213,225,0.76))] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-colors group-hover:border-[rgba(130,201,187,0.42)]"
          style={{ bottom: thumbBottom }}
        />
      </div>
    </div>
  );
};
