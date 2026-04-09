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

        <input
          className="mixer-fader h-6 w-[220px] -rotate-90 origin-center bg-transparent appearance-none cursor-pointer"
          max="6"
          min="-60"
          onChange={(event) => updateTrackVolume(track.id, Number(event.target.value))}
          step="1"
          style={{ WebkitAppearance: 'none' }}
          type="range"
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
  const { tracks } = useAudio();

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