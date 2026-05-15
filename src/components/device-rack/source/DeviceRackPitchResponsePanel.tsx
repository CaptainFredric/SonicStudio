import { SlidersHorizontal } from 'lucide-react';

import { Knob } from '../../Knob';
import type { Track, TrackSource } from '../../../project/schema';
import { RackSection } from '../rackPrimitives';

interface DeviceRackPitchResponsePanelProps {
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  track: Track;
}

export const DeviceRackPitchResponsePanel = ({
  onSetTrackSource,
  track,
}: DeviceRackPitchResponsePanelProps) => (
  <RackSection icon={<SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />} title="Pitch and response">
    <div className="mb-3 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
      Octave handles broad transposition. Detune adds fine offsets, and Glide smooths note-to-note movement.
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      <Knob
        color="#7dd3fc"
        label="Octave"
        max={3}
        min={-3}
        onChange={(value) => onSetTrackSource({ octaveShift: Math.round(value) })}
        step={1}
        value={track.source.octaveShift}
      />
      <Knob
        color="#7dd3fc"
        disabled={track.source.engine === 'sample'}
        label="Detune"
        max={1200}
        min={-1200}
        onChange={(value) => onSetTrackSource({ detune: value })}
        unit="ct"
        value={track.source.detune}
      />
      <Knob
        color="#7dd3fc"
        disabled={track.source.engine === 'sample'}
        label="Glide"
        max={0.2}
        min={0}
        onChange={(value) => onSetTrackSource({ portamento: value })}
        unit="s"
        value={track.source.portamento}
      />
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        className="control-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
        data-ui-sound="tab"
        onClick={() => onSetTrackSource({
          detune: 0,
          octaveShift: 0,
          portamento: 0,
        })}
        type="button"
      >
        Reset pitch response
      </button>
      <button
        className="control-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
        data-ui-sound="tab"
        onClick={() => onSetTrackSource({ octaveShift: 0 })}
        type="button"
      >
        Octave 0
      </button>
      {track.source.engine !== 'sample' ? (
        <>
          <button
            className="control-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            data-ui-sound="tab"
            onClick={() => onSetTrackSource({ detune: 0 })}
            type="button"
          >
            Detune 0
          </button>
          <button
            className="control-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            data-ui-sound="tab"
            onClick={() => onSetTrackSource({ portamento: 0 })}
            type="button"
          >
            Glide off
          </button>
        </>
      ) : null}
    </div>
    {track.source.engine === 'sample' ? (
      <div className="mt-4 rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
        Sample mode keeps octave transpose active for musical playback. Fine detune and glide stay synth-only so playback stays reliable.
      </div>
    ) : null}
  </RackSection>
);
