import { getDefaultSamplePreset } from '../../../audio/sampleLibrary';
import type { Track, TrackSource } from '../../../project/schema';

interface DeviceRackEnginePanelProps {
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  track: Track;
}

export const DeviceRackEnginePanel = ({
  onSetTrackSource,
  track,
}: DeviceRackEnginePanelProps) => (
  <label className="text-xs text-[var(--text-secondary)]">
    <span className="section-label mb-2 block">Engine</span>
    <select
      className="control-field h-11 w-full px-3 text-sm"
      onChange={(event) => {
        const engine = event.target.value as TrackSource['engine'];
        onSetTrackSource({
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
);
