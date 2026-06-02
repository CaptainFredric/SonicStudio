import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Gauge, Mic2, Sparkles } from 'lucide-react';

import type { SynthParams, Track, TrackSource } from '../../project/schema';
import { buildPerformanceMacroParams, getInputChannelStripDefinitions } from '../../services/performanceStrips';
import { Knob } from '../Knob';
import { FILTER_OPTIONS, RackSection, StatusCell, filterLabel } from './rackPrimitives';

interface DeviceRackShapePanelProps {
  onSetTrackParams: (params: Partial<SynthParams>) => void;
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  track: Track;
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const deriveMacroPointFromTrack = (track: Track) => ({
  x: clampUnit((track.params.cutoff - 420) / 11800),
  y: clampUnit((track.params.reverbSend + (track.params.release / 3.2)) / 1.6),
});

export const DeviceRackShapePanel = ({
  onSetTrackParams,
  onSetTrackSource,
  track,
}: DeviceRackShapePanelProps) => {
  const [macroPoint, setMacroPoint] = useState(() => deriveMacroPointFromTrack(track));
  const inputStrips = useMemo(() => getInputChannelStripDefinitions(track.type), [track.type]);
  const macroPreview = useMemo(() => buildPerformanceMacroParams(macroPoint.x, macroPoint.y), [macroPoint.x, macroPoint.y]);

  useEffect(() => {
    setMacroPoint(deriveMacroPointFromTrack(track));
  }, [track.id]);

  const applyMacroPoint = (x: number, y: number) => {
    const nextPoint = {
      x: clampUnit(x),
      y: clampUnit(y),
    };
    setMacroPoint(nextPoint);
    onSetTrackParams(buildPerformanceMacroParams(nextPoint.x, nextPoint.y));
  };

  const updateMacroFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = (event.clientX - rect.left) / rect.width;
    const y = 1 - ((event.clientY - rect.top) / rect.height);
    applyMacroPoint(x, y);
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <RackSection icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />} title="Envelope">
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <Knob label="Attack" max={1} min={0.001} onChange={(value) => onSetTrackParams({ attack: value })} unit="s" value={track.params.attack} />
          <Knob label="Decay" max={2} min={0.01} onChange={(value) => onSetTrackParams({ decay: value })} unit="s" value={track.params.decay} />
          <Knob label="Sustain" max={1} min={0} onChange={(value) => onSetTrackParams({ sustain: value })} value={track.params.sustain} />
          <Knob label="Release" max={4} min={0.01} onChange={(value) => onSetTrackParams({ release: value })} unit="s" value={track.params.release} />
          <Knob color="#7fd1b9" label="Unison" max={1} min={0} onChange={(value) => onSetTrackParams({ unison: value })} value={track.params.unison} />
        </div>
      </RackSection>

      <RackSection icon={<Activity className="h-4 w-4 text-[var(--accent)]" />} title="Filter">
        <div className="grid gap-4">
          <label className="text-xs text-[var(--text-secondary)]">
            <span className="section-label mb-2 block">Mode</span>
            <select
              className="control-field h-11 w-full px-3 text-sm"
              onChange={(event) => onSetTrackParams({ filterMode: event.target.value as typeof track.params.filterMode })}
              value={track.params.filterMode}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {filterLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Knob color="#e7a65f" label="Cutoff" max={15000} min={20} onChange={(value) => onSetTrackParams({ cutoff: value })} unit="Hz" value={track.params.cutoff} />
            <Knob color="#e7a65f" label="Res" max={20} min={0.1} onChange={(value) => onSetTrackParams({ resonance: value })} value={track.params.resonance} />
            <Knob color="#d9a441" label="Env amt" max={1} min={0} onChange={(value) => onSetTrackParams({ filterEnvAmount: value })} value={track.params.filterEnvAmount} />
            <Knob color="#d9a441" label="Env fall" max={2} min={0.01} onChange={(value) => onSetTrackParams({ filterEnvDecay: value })} unit="s" value={track.params.filterEnvDecay} />
          </div>
        </div>
      </RackSection>

      <RackSection icon={<Mic2 className="h-4 w-4 text-[var(--accent)]" />} title="Input strips">
        <div className="grid gap-3">
          <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
            Guitar and vocal quick-load chains for guide takes, hooks, and input-first writing. They reshape the current lane with a more amp-or-channel-strip style contour.
          </div>
          {inputStrips.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {inputStrips.map((strip) => (
                <div
                  className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3"
                  key={strip.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{strip.label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{strip.description}</div>
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {strip.focus}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={() => {
                        onSetTrackSource(strip.source);
                        onSetTrackParams(strip.params);
                      }}
                      type="button"
                    >
                      Load strip
                    </button>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Best on {strip.trackTypes.join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
              This lane family is already more percussive than input-first. Switch to a lead, pad, pluck, or FX lane to use the guitar and vocal strips.
            </div>
          )}
        </div>
      </RackSection>

      <RackSection icon={<Gauge className="h-4 w-4 text-[var(--accent)]" />} title="Performance pad">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <div
              className="relative h-56 touch-none overflow-hidden rounded-[4px] border border-[rgba(114,217,255,0.18)] bg-[radial-gradient(circle_at_top_left,rgba(114,217,255,0.26),transparent_55%),linear-gradient(135deg,rgba(18,25,36,0.96),rgba(10,16,24,0.98))]"
              onPointerCancel={(event) => {
                try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                updateMacroFromPointer(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons !== 1) {
                  return;
                }
                updateMacroFromPointer(event);
              }}
              onPointerUp={(event) => {
                try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
              }}
              role="application"
            >
              <div className="pointer-events-none absolute inset-4 grid grid-cols-4 grid-rows-4 rounded-[3px] border border-white/8">
                {Array.from({ length: 16 }, (_, index) => (
                  <div className="border border-white/6" key={index} />
                ))}
              </div>
              <div className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Tight / dark
              </div>
              <div className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Open / bright
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Dry / focused
              </div>
              <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Lift / wide
              </div>
              <div
                className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-[3px] border border-[rgba(114,217,255,0.72)] bg-[linear-gradient(180deg,rgba(114,217,255,0.95),rgba(66,153,225,0.72))] shadow-[0_8px_18px_rgba(21,34,48,0.42)]"
                style={{
                  bottom: `${macroPoint.y * 100}%`,
                  left: `${macroPoint.x * 100}%`,
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => applyMacroPoint(0.24, 0.22)}
                type="button"
              >
                Verse lock
              </button>
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => applyMacroPoint(0.62, 0.44)}
                type="button"
              >
                Edge lift
              </button>
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                onClick={() => applyMacroPoint(0.82, 0.88)}
                type="button"
              >
                Open chorus
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <StatusCell label="Cutoff" value={`${macroPreview.cutoff ?? 0} Hz`} />
            <StatusCell label="Drive" value={`${Math.round((macroPreview.distortion ?? 0) * 100)}%`} />
            <StatusCell label="Space" value={`${Math.round(((macroPreview.reverbSend ?? 0) + (macroPreview.delaySend ?? 0)) * 50)}%`} />
            <StatusCell label="Motion" value={`${Math.round(((macroPreview.vibratoDepth ?? 0) * 100))}% depth`} />
          </div>
        </div>
      </RackSection>
    </div>
  );
};
