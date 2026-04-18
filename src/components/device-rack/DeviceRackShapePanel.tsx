import React from 'react';
import { Activity, Sparkles } from 'lucide-react';

import type { SynthParams, Track } from '../../project/schema';
import { Knob } from '../Knob';
import { FILTER_OPTIONS, RackSection, filterLabel } from './rackPrimitives';

interface DeviceRackShapePanelProps {
  onSetTrackParams: (params: Partial<SynthParams>) => void;
  track: Track;
}

export const DeviceRackShapePanel = ({
  onSetTrackParams,
  track,
}: DeviceRackShapePanelProps) => (
  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <RackSection icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />} title="Envelope">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Knob label="Attack" max={1} min={0.001} onChange={(value) => onSetTrackParams({ attack: value })} unit="s" value={track.params.attack} />
        <Knob label="Decay" max={2} min={0.01} onChange={(value) => onSetTrackParams({ decay: value })} unit="s" value={track.params.decay} />
        <Knob label="Sustain" max={1} min={0} onChange={(value) => onSetTrackParams({ sustain: value })} value={track.params.sustain} />
        <Knob label="Release" max={4} min={0.01} onChange={(value) => onSetTrackParams({ release: value })} unit="s" value={track.params.release} />
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
        </div>
      </div>
    </RackSection>
  </div>
);
