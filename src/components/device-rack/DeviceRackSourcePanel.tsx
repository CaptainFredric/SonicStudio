import React, { startTransition } from 'react';
import { FolderUp, Play, SlidersHorizontal, Sparkles, Trash2, Waves, X } from 'lucide-react';

import {
  MAX_CUSTOM_SAMPLE_BYTES,
  getDefaultSamplePreset,
  getSamplePresetMeta,
  getSamplePresetOptions,
} from '../../audio/sampleLibrary';
import {
  defaultNoteForTrack,
  type SampleSliceMemory,
  type Track,
  type TrackSource,
  type TrackVoicePresetDefinition,
} from '../../project/schema';
import { Knob } from '../Knob';
import {
  type SourceSubView,
  InlineSlider,
  RackSection,
  RackTab,
  SAMPLE_TRIGGER_MODE_OPTIONS,
  SAMPLE_WINDOW_PRESETS,
  WAVEFORM_OPTIONS,
  waveformLabel,
} from './rackPrimitives';

interface DeviceRackSourcePanelProps {
  activeSampleMeta: ReturnType<typeof getSamplePresetMeta> | null;
  activeSourceSubView: SourceSubView;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isSampleTrack: boolean;
  onApplyCurrentWindowAsSlice: () => void;
  onApplyEvenSplit: (parts: number) => void;
  onApplyRegionTemplate: () => void;
  onApplyTrackVoicePreset: (presetId: string) => void;
  onCreateSampleSlice: (slice?: Partial<SampleSliceMemory>) => void;
  onDeleteSampleSlice: (sliceIndex: number) => void;
  onPreviewTrack: (note?: string, sampleSliceIndex?: number) => Promise<void>;
  onSelectSampleSlice: (sliceIndex: number | null) => void;
  onSetActiveSourceSubView: (view: SourceSubView) => void;
  onSetSampleStatus: (status: string | null) => void;
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  onUpdateSampleSlice: (sliceIndex: number, updates: Partial<SampleSliceMemory>) => void;
  sampleOptions: ReturnType<typeof getSamplePresetOptions>;
  sampleStatus: string | null;
  sampleWindowWidth: number;
  selectedSampleSlice: SampleSliceMemory | null;
  track: Track;
  trackVoicePresets: TrackVoicePresetDefinition[];
}

export const DeviceRackSourcePanel = ({
  activeSampleMeta,
  activeSourceSubView,
  fileInputRef,
  isSampleTrack,
  onApplyCurrentWindowAsSlice,
  onApplyEvenSplit,
  onApplyRegionTemplate,
  onApplyTrackVoicePreset,
  onCreateSampleSlice,
  onDeleteSampleSlice,
  onPreviewTrack,
  onSelectSampleSlice,
  onSetActiveSourceSubView,
  onSetSampleStatus,
  onSetTrackSource,
  onUpdateSampleSlice,
  sampleOptions,
  sampleStatus,
  sampleWindowWidth,
  selectedSampleSlice,
  track,
  trackVoicePresets,
}: DeviceRackSourcePanelProps) => (
  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
    <RackSection icon={<Waves className="h-4 w-4 text-[var(--accent)]" />} title="Source routing">
      <div className="grid gap-4">
        {isSampleTrack && (
          <div className="flex flex-wrap gap-2">
            <RackTab
              active={activeSourceSubView === 'CORE'}
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              label="Core"
              onClick={() => onSetActiveSourceSubView('CORE')}
            />
            <RackTab
              active={activeSourceSubView === 'SLICES'}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Slices"
              onClick={() => onSetActiveSourceSubView('SLICES')}
            />
          </div>
        )}

        <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
          <div className="section-label">Voice starts</div>
          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
            Apply a full sound starting point for this lane, then fine tune from there.
          </div>
          <div className="mt-3 grid gap-2">
            {trackVoicePresets.map((preset) => (
              <button
                key={preset.id}
                className="rounded-[12px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.26)] hover:bg-[rgba(114,217,255,0.05)]"
                onClick={() => onApplyTrackVoicePreset(preset.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{preset.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                    {preset.focus}
                  </span>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        <label className="text-xs text-[var(--text-secondary)]">
          <span className="section-label mb-2 block">Engine</span>
          <select
            className="control-field h-11 w-full px-3 text-sm"
            onChange={(event) => {
              const engine = event.target.value as typeof track.source.engine;
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

        {track.source.engine === 'sample' && activeSourceSubView === 'CORE' ? (
          <div className="grid gap-3">
            <label className="text-xs text-[var(--text-secondary)]">
              <span className="section-label mb-2 block">Sample preset</span>
              <select
                className="control-field h-11 w-full px-3 text-sm"
                onChange={(event) => onSetTrackSource({
                  customSampleDataUrl: undefined,
                  customSampleName: undefined,
                  samplePreset: event.target.value as typeof track.source.samplePreset,
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
                    samplePlayback: event.target.value as typeof track.source.samplePlayback,
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
                    sampleTriggerMode: event.target.value as typeof track.source.sampleTriggerMode,
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

            <div className="rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
              <div className="section-label">Custom sample</div>
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                {track.source.customSampleName
                  ? `Loaded: ${track.source.customSampleName}`
                  : `Import a short audio file up to ${(MAX_CUSTOM_SAMPLE_BYTES / 1_000_000).toFixed(1)} MB. It will save inside the project.`}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] hover:text-[var(--text-primary)]"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <FolderUp className="h-3.5 w-3.5" />
                  {track.source.customSampleName ? 'Replace' : 'Import'}
                </button>
                {track.source.customSampleName && (
                  <button
                    className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                    onClick={() => {
                      onSetTrackSource({ customSampleDataUrl: undefined, customSampleName: undefined });
                      onSetSampleStatus('Reverted to built-in preset');
                    }}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear custom
                  </button>
                )}
              </div>
              {sampleStatus && (
                <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">{sampleStatus}</div>
              )}
              <input
                accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';

                  if (!file) {
                    return;
                  }

                  if (file.size > MAX_CUSTOM_SAMPLE_BYTES) {
                    onSetSampleStatus(`Sample is too large. Keep it under ${(MAX_CUSTOM_SAMPLE_BYTES / 1_000_000).toFixed(1)} MB.`);
                    return;
                  }

                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = typeof reader.result === 'string' ? reader.result : null;
                    if (!result || !result.startsWith('data:audio/')) {
                      onSetSampleStatus('Could not read that file as audio.');
                      return;
                    }

                    startTransition(() => {
                      onSetTrackSource({
                        customSampleDataUrl: result,
                        customSampleName: file.name,
                      });
                      onSetSampleStatus(`Loaded ${file.name}`);
                    });
                  };
                  reader.onerror = () => {
                    onSetSampleStatus('Could not import that file.');
                  };
                  reader.readAsDataURL(file);
                }}
                ref={fileInputRef}
                type="file"
              />
            </div>

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
                  onClick={() => onSetTrackSource({ sampleReverse: !track.source.sampleReverse })}
                  type="button"
                >
                  {track.source.sampleReverse ? 'Reverse on' : 'Reverse off'}
                </button>
                <button
                  className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
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
          </div>
        ) : null}

        {track.source.engine === 'sample' && activeSourceSubView === 'SLICES' ? (
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
                disabled={track.source.sampleSlices.length >= 8}
                onClick={onApplyCurrentWindowAsSlice}
                type="button"
              >
                {selectedSampleSlice ? 'Replace from window' : 'Save current'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => onApplyEvenSplit(2)} type="button">Split 2</button>
              <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => onApplyEvenSplit(4)} type="button">Split 4</button>
              <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={() => onApplyEvenSplit(8)} type="button">Split 8</button>
              <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={onApplyRegionTemplate} type="button">Attack Body Tail</button>
              <button
                className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
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
                        onClick={() => void onPreviewTrack(defaultNoteForTrack(track), index)}
                        type="button"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="ghost-icon-button flex h-8 w-8 items-center justify-center text-[var(--danger)]"
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

            {selectedSampleSlice && typeof track.source.activeSampleSlice === 'number' && (
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
                      onClick={() => onUpdateSampleSlice(track.source.activeSampleSlice!, { reverse: !selectedSampleSlice.reverse })}
                      type="button"
                    >
                      {selectedSampleSlice.reverse ? 'Slice reverse on' : 'Slice reverse off'}
                    </button>
                    <button
                      className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      onClick={onApplyCurrentWindowAsSlice}
                      type="button"
                    >
                      Replace from current window
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {track.source.engine !== 'sample' ? (
          <label className="text-xs text-[var(--text-secondary)]">
            <span className="section-label mb-2 block">Waveform</span>
            <select
              className="control-field h-11 w-full px-3 text-sm"
              onChange={(event) => onSetTrackSource({ waveform: event.target.value as typeof track.source.waveform })}
              value={track.source.waveform}
            >
              {WAVEFORM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {waveformLabel(option)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </RackSection>

    <RackSection icon={<SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />} title="Pitch and response">
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
      {track.source.engine === 'sample' && (
        <div className="mt-4 rounded-[14px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
          Sample mode keeps octave transpose active for musical playback. Fine detune and glide stay synth-only so playback stays reliable.
        </div>
      )}
    </RackSection>
  </div>
);
