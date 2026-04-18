import React from 'react';
import { SlidersHorizontal, Zap } from 'lucide-react';

import type { SynthParams, Track } from '../../project/schema';
import { Knob } from '../Knob';
import { RackSection } from './rackPrimitives';

interface DeviceRackSpacePanelProps {
  onSetTrackParams: (params: Partial<SynthParams>) => void;
  track: Track;
}

export const DeviceRackSpacePanel = ({
  onSetTrackParams,
  track,
}: DeviceRackSpacePanelProps) => (
  <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
    <RackSection icon={<SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />} title="Motion">
      <div className="grid gap-4 sm:grid-cols-2">
        <Knob color="#8ab4ff" label="Vib rate" max={12} min={0.1} onChange={(value) => onSetTrackParams({ vibratoRate: value })} unit="Hz" value={track.params.vibratoRate} />
        <Knob color="#8ab4ff" label="Vib depth" max={1} min={0} onChange={(value) => onSetTrackParams({ vibratoDepth: value })} value={track.params.vibratoDepth} />
      </div>
    </RackSection>

    <RackSection icon={<Zap className="h-4 w-4 text-[var(--accent)]" />} title="Drive and space">
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
        <Knob color="#96b9f3" label="Chorus" max={1} min={0} onChange={(value) => onSetTrackParams({ chorusSend: value })} value={track.params.chorusSend} />
        <Knob color="#d79cff" label="Crush" max={1} min={0} onChange={(value) => onSetTrackParams({ bitCrush: value })} value={track.params.bitCrush} />
        <Knob color="#f08f86" label="Drive" max={1} min={0} onChange={(value) => onSetTrackParams({ distortion: value })} value={track.params.distortion} />
        <Knob color="#96b9f3" label="Delay" max={1} min={0} onChange={(value) => onSetTrackParams({ delaySend: value })} value={track.params.delaySend} />
        <Knob color="#96b9f3" label="Reverb" max={1} min={0} onChange={(value) => onSetTrackParams({ reverbSend: value })} value={track.params.reverbSend} />
      </div>
    </RackSection>
  </div>
);
