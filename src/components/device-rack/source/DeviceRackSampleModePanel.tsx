import type { Track, TrackSource } from '../../../project/schema';
import { SAMPLE_TRIGGER_MODE_OPTIONS } from '../rackPrimitives';

interface DeviceRackSampleModePanelProps {
  activeSampleMeta: {
    description: string;
    label: string;
  } | null;
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  sampleOptions: Array<{ label: string; preset: TrackSource['samplePreset'] }>;
  track: Track;
}

export const DeviceRackSampleModePanel = ({
  activeSampleMeta,
  onSetTrackSource,
  sampleOptions,
  track,
}: DeviceRackSampleModePanelProps) => (
  <>
    <label className="text-xs text-[var(--text-secondary)]">
      <span className="section-label mb-2 block">Sample preset</span>
      <select
        className="control-field h-11 w-full px-3 text-sm"
        onChange={(event) => onSetTrackSource({
          customSampleDataUrl: undefined,
          customSampleName: undefined,
          samplePreset: event.target.value as TrackSource['samplePreset'],
        })}
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

    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-xs text-[var(--text-secondary)]">
        <span className="section-label mb-2 block">Playback mode</span>
        <select
          className="control-field h-11 w-full px-3 text-sm"
          onChange={(event) => onSetTrackSource({
            samplePlayback: event.target.value as TrackSource['samplePlayback'],
          })}
          value={track.source.samplePlayback}
        >
          <option value="pitched">Pitched</option>
          <option value="oneshot">One-shot</option>
        </select>
      </label>
      <label className="text-xs text-[var(--text-secondary)]">
        <span className="section-label mb-2 block">Trigger mode</span>
        <select
          className="control-field h-11 w-full px-3 text-sm"
          onChange={(event) => onSetTrackSource({
            sampleTriggerMode: event.target.value as TrackSource['sampleTriggerMode'],
          })}
          value={track.source.sampleTriggerMode}
        >
          {SAMPLE_TRIGGER_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>

    <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
      {SAMPLE_TRIGGER_MODE_OPTIONS.find((option) => option.value === track.source.sampleTriggerMode)?.description}
    </div>
  </>
);
