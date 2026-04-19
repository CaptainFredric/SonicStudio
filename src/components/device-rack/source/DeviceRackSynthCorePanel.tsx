import type { Track, TrackSource } from '../../../project/schema';
import { WAVEFORM_OPTIONS, waveformLabel } from '../rackPrimitives';

interface DeviceRackSynthCorePanelProps {
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  track: Track;
}

export const DeviceRackSynthCorePanel = ({
  onSetTrackSource,
  track,
}: DeviceRackSynthCorePanelProps) => (
  <label className="text-xs text-[var(--text-secondary)]">
    <span className="section-label mb-2 block">Waveform</span>
    <select
      className="control-field h-11 w-full px-3 text-sm"
      onChange={(event) => onSetTrackSource({ waveform: event.target.value as TrackSource['waveform'] })}
      value={track.source.waveform}
    >
      {WAVEFORM_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {waveformLabel(option)}
        </option>
      ))}
    </select>
  </label>
);
