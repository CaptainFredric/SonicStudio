import { startTransition, type RefObject } from 'react';
import { FolderUp, X } from 'lucide-react';

import { MAX_CUSTOM_SAMPLE_BYTES } from '../../../audio/sampleLibrary';
import type { Track, TrackSource } from '../../../project/schema';

interface DeviceRackCustomSamplePanelProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSetSampleStatus: (status: string | null) => void;
  onSetTrackSource: (source: Partial<TrackSource>) => void;
  sampleStatus: string | null;
  track: Track;
}

export const DeviceRackCustomSamplePanel = ({
  fileInputRef,
  onSetSampleStatus,
  onSetTrackSource,
  sampleStatus,
  track,
}: DeviceRackCustomSamplePanelProps) => (
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
);
