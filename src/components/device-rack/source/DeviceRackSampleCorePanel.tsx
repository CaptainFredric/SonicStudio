import { startTransition, type RefObject } from 'react';
import { FolderUp, X } from 'lucide-react';

import {
  MAX_CUSTOM_SAMPLE_BYTES,
  getDefaultSamplePreset,
} from '../../../audio/sampleLibrary';
import { type Track, type TrackSource } from '../../../project/schema';
import {
  SAMPLE_TRIGGER_MODE_OPTIONS,
  WAVEFORM_OPTIONS,
  waveformLabel,
} from '../rackPrimitives';

interface DeviceRackSampleCorePanelProps {
  activeSampleMeta: {
    description: string;
    label: string;
  } | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSetSampleStatus: (status: string | null) => void;
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  sampleOptions: Array<{ label: string; preset: TrackSource['samplePreset'] }>;
  sampleStatus: string | null;
  track: Track;
}

export const DeviceRackSampleCorePanel = ({
  activeSampleMeta,
  fileInputRef,
  onSetSampleStatus,
  onSetTrackSource,
  sampleOptions,
  sampleStatus,
  track,
}: DeviceRackSampleCorePanelProps) => (
  <>
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

    {track.source.engine === 'sample' ? (
      <div className="grid gap-3">
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
              data-ui-sound="action"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <FolderUp className="h-3.5 w-3.5" />
              {track.source.customSampleName ? 'Replace' : 'Import'}
            </button>
            {track.source.customSampleName ? (
              <button
                className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                data-ui-sound="danger"
                onClick={() => {
                  onSetTrackSource({ customSampleDataUrl: undefined, customSampleName: undefined });
                  onSetSampleStatus('Reverted to built-in preset');
                }}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
                Clear custom
              </button>
            ) : null}
          </div>
          {sampleStatus ? (
            <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">{sampleStatus}</div>
          ) : null}
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
      </div>
    ) : (
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
    )}
  </>
);
