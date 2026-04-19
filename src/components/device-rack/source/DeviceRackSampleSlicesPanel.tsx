import { Play, Trash2 } from 'lucide-react';

import { defaultNoteForTrack, type SampleSliceMemory, type Track } from '../../../project/schema';
import { InlineSlider } from '../rackPrimitives';

interface DeviceRackSampleSlicesPanelProps {
  onApplyCurrentWindowAsSlice: () => void;
  onApplyEvenSplit: (parts: number) => void;
  onApplyRegionTemplate: () => void;
  onCreateSampleSlice: (slice?: Partial<SampleSliceMemory>) => void;
  onDeleteSampleSlice: (sliceIndex: number) => void;
  onPreviewTrack: (note?: string, sampleSliceIndex?: number) => Promise<void>;
  onSelectSampleSlice: (sliceIndex: number | null) => void;
  onUpdateSampleSlice: (sliceIndex: number, updates: Partial<SampleSliceMemory>) => void;
  selectedSampleSlice: SampleSliceMemory | null;
  track: Track;
}

export const DeviceRackSampleSlicesPanel = ({
  onApplyCurrentWindowAsSlice,
  onApplyEvenSplit,
  onApplyRegionTemplate,
  onCreateSampleSlice,
  onDeleteSampleSlice,
  onPreviewTrack,
  onSelectSampleSlice,
  onUpdateSampleSlice,
  selectedSampleSlice,
  track,
}: DeviceRackSampleSlicesPanelProps) => (
  <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="section-label">Slices</div>
        <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
          Author real slice regions here, then use step mapping in the arranger for beat work.
        </div>
      </div>
      <button
        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        data-ui-sound="action"
        disabled={track.source.sampleSlices.length >= 8}
        onClick={onApplyCurrentWindowAsSlice}
        type="button"
      >
        {selectedSampleSlice ? 'Replace from window' : 'Save current'}
      </button>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" data-ui-sound="tab" onClick={() => onApplyEvenSplit(2)} type="button">Split 2</button>
      <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" data-ui-sound="tab" onClick={() => onApplyEvenSplit(4)} type="button">Split 4</button>
      <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" data-ui-sound="tab" onClick={() => onApplyEvenSplit(8)} type="button">Split 8</button>
      <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" data-ui-sound="tab" onClick={onApplyRegionTemplate} type="button">Attack Body Tail</button>
      <button
        className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        data-ui-sound="action"
        disabled={track.source.sampleSlices.length >= 8}
        onClick={() => onCreateSampleSlice({
          end: track.source.sampleEnd,
          gain: track.source.sampleGain,
          reverse: track.source.sampleReverse,
          start: track.source.sampleStart,
        })}
        type="button"
      >
        New slice
      </button>
    </div>

    <div className="mt-4 grid gap-2">
      {track.source.sampleSlices.length > 0 ? track.source.sampleSlices.map((slice, index) => (
        <div
          className={`rounded-[12px] border p-3 ${track.source.activeSampleSlice === index ? 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.12)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]'}`}
          key={`slice-${index}`}
        >
          <div className="flex items-start justify-between gap-3">
            <button
              className="min-w-0 text-left"
              data-ui-sound="action"
              onClick={() => onSelectSampleSlice(index)}
              type="button"
            >
              <div className="truncate text-sm font-medium text-[var(--text-primary)]">{slice.label}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {Math.round(slice.start * 100)}% to {Math.round(slice.end * 100)}%
              </div>
            </button>
            <div className="flex gap-2">
              <button
                className="ghost-icon-button flex h-8 w-8 items-center justify-center"
                data-ui-sound="transport"
                onClick={() => void onPreviewTrack(defaultNoteForTrack(track), index)}
                type="button"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
              <button
                className="ghost-icon-button flex h-8 w-8 items-center justify-center text-[var(--danger)]"
                data-ui-sound="danger"
                onClick={() => onDeleteSampleSlice(index)}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )) : (
        <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
          No slices yet. Save the current window or use one of the split actions above.
        </div>
      )}
    </div>

    {selectedSampleSlice && typeof track.source.activeSampleSlice === 'number' ? (
      <div className="mt-4 rounded-[12px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] p-3">
        <div className="section-label">Selected slice</div>
        <div className="mt-3 grid gap-3">
          <label className="text-xs text-[var(--text-secondary)]">
            <span className="section-label mb-2 block">Label</span>
            <input
              className="control-field h-11 w-full px-3 text-sm"
              maxLength={16}
              onChange={(event) => onUpdateSampleSlice(track.source.activeSampleSlice!, { label: event.target.value })}
              value={selectedSampleSlice.label}
            />
          </label>
          <InlineSlider
            label="Slice gain"
            max={2}
            min={0.25}
            onChange={(value) => onUpdateSampleSlice(track.source.activeSampleSlice!, { gain: value })}
            step={0.01}
            value={selectedSampleSlice.gain}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-active={selectedSampleSlice.reverse}
              data-ui-sound="action"
              onClick={() => onUpdateSampleSlice(track.source.activeSampleSlice!, { reverse: !selectedSampleSlice.reverse })}
              type="button"
            >
              {selectedSampleSlice.reverse ? 'Slice reverse on' : 'Slice reverse off'}
            </button>
            <button
              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-ui-sound="action"
              onClick={onApplyCurrentWindowAsSlice}
              type="button"
            >
              Replace from current window
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </div>
);
