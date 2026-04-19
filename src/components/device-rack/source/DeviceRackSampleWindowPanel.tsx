import type { Track, TrackSource } from '../../../project/schema';
import { InlineSlider, SAMPLE_WINDOW_PRESETS } from '../rackPrimitives';

interface DeviceRackSampleWindowPanelProps {
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  sampleWindowWidth: number;
  track: Track;
}

export const DeviceRackSampleWindowPanel = ({
  onSetTrackSource,
  sampleWindowWidth,
  track,
}: DeviceRackSampleWindowPanelProps) => (
  <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
    <div className="section-label">Source window</div>
    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
      Full-source playback uses this window. Slices can override gain and reverse when selected.
    </div>
    <div className="mt-4 rounded-[12px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="section-label">Region strip</span>
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
          {Math.round(track.source.sampleStart * 100)}% to {Math.round(track.source.sampleEnd * 100)}%
        </span>
      </div>
      <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <div
          className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,#7dd3fc,#67e8f9)]"
          style={{
            left: `${track.source.sampleStart * 100}%`,
            width: `${sampleWindowWidth * 100}%`,
          }}
        />
        <div className="relative h-full">
          {track.source.sampleSlices.map((slice, index) => (
            <div
              className={`absolute inset-y-0 border ${track.source.activeSampleSlice === index ? 'bg-[rgba(125,211,252,0.28)] border-[rgba(125,211,252,0.7)]' : 'bg-[rgba(255,255,255,0.14)] border-[rgba(255,255,255,0.28)]'}`}
              key={`${slice.label}-${index}`}
              style={{
                left: `${slice.start * 100}%`,
                width: `${Math.max(4, (slice.end - slice.start) * 100)}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>

    <div className="mt-4 space-y-3">
      <InlineSlider
        label="Start"
        max={0.95}
        min={0}
        onChange={(value) => onSetTrackSource({
          sampleEnd: Math.max(value + 0.05, track.source.sampleEnd),
          sampleStart: value,
        })}
        step={0.01}
        unit="%"
        value={track.source.sampleStart}
      />
      <InlineSlider
        label="End"
        max={1}
        min={0.05}
        onChange={(value) => onSetTrackSource({
          sampleEnd: value,
          sampleStart: Math.min(track.source.sampleStart, value - 0.05),
        })}
        step={0.01}
        unit="%"
        value={track.source.sampleEnd}
      />
      <InlineSlider
        label="Source gain"
        max={2}
        min={0.25}
        onChange={(value) => onSetTrackSource({ sampleGain: value })}
        step={0.01}
        value={track.source.sampleGain}
      />
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {SAMPLE_WINDOW_PRESETS.map((preset) => (
        <button
          key={preset.key}
          className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          data-ui-sound="tab"
          onClick={() => onSetTrackSource({
            sampleEnd: preset.end,
            sampleStart: preset.start,
          })}
          type="button"
        >
          {preset.label}
        </button>
      ))}
      <button
        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        data-ui-sound="action"
        onClick={() => onSetTrackSource({ sampleReverse: !track.source.sampleReverse })}
        type="button"
      >
        {track.source.sampleReverse ? 'Reverse on' : 'Reverse off'}
      </button>
      <button
        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        data-ui-sound="action"
        onClick={() => onSetTrackSource({
          sampleEnd: 1,
          sampleGain: 1,
          sampleReverse: false,
          sampleStart: 0,
        })}
        type="button"
      >
        Reset window
      </button>
    </div>
  </div>
);
