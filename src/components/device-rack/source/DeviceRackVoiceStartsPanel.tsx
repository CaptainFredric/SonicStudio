import { useEffect, useMemo, useState } from 'react';

import type { InstrumentType, TrackVoicePresetDefinition } from '../../../project/schema';
import { type RecordedNotePreset, loadRecordedNotePresets, subscribeRecordedNotePresets } from '../../../services/recordedNoteLibrary';

interface DeviceRackVoiceStartsPanelProps {
  onApplyRecordedNotePreset: (preset: RecordedNotePreset) => void;
  onApplyTrackVoicePreset: (presetId: string) => void;
  trackType: InstrumentType;
  trackVoicePresets: TrackVoicePresetDefinition[];
}

const isFoundationPreset = (presetId: string) => presetId.startsWith('foundation-');

interface PresetCardProps {
  onClick: () => void;
  preset: TrackVoicePresetDefinition;
}

const PresetCard = ({ onClick, preset }: PresetCardProps) => (
  <button
    className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.26)] hover:bg-[rgba(114,217,255,0.05)]"
    data-ui-sound="action"
    onClick={onClick}
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
);

export const DeviceRackVoiceStartsPanel = ({
  onApplyRecordedNotePreset,
  onApplyTrackVoicePreset,
  trackType,
  trackVoicePresets,
}: DeviceRackVoiceStartsPanelProps) => {
  const [recordedNotePresets, setRecordedNotePresets] = useState<RecordedNotePreset[]>([]);

  useEffect(() => {
    setRecordedNotePresets(loadRecordedNotePresets());
    return subscribeRecordedNotePresets(setRecordedNotePresets);
  }, []);

  const matchingRecordedPresets = useMemo(
    () => recordedNotePresets.filter((preset) => preset.trackType === trackType),
    [recordedNotePresets, trackType],
  );

  const foundationalPresets = useMemo(
    () => trackVoicePresets.filter((preset) => isFoundationPreset(preset.id)),
    [trackVoicePresets],
  );

  const characterPresets = useMemo(
    () => trackVoicePresets.filter((preset) => !isFoundationPreset(preset.id)),
    [trackVoicePresets],
  );

  return (
    <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
      <div className="section-label">Voice starts</div>
      <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
        Sound starting points for this lane.
      </div>

      {foundationalPresets.length > 0 ? (
        <div className="mt-3 rounded-[3px] border border-[rgba(114,217,255,0.18)] bg-[rgba(114,217,255,0.04)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="section-label text-[10px]">Primary synth colors</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">
              Fundamental set
            </div>
          </div>
          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
            These are core building blocks: sine, triangle, saw, square, and noise. Dial shape and effects from here to cover wide sound ranges.
          </div>
          <div className="mt-3 grid gap-2">
            {foundationalPresets.map((preset) => (
              <div key={preset.id}>
                <PresetCard
                  onClick={() => onApplyTrackVoicePreset(preset.id)}
                  preset={preset}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {characterPresets.length > 0 ? (
        <div className="mt-3">
          <div className="section-label text-[10px]">Character starts</div>
          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
            Faster stylized starting points tuned for this lane.
          </div>
          <div className="mt-3 grid gap-2">
            {characterPresets.map((preset) => (
              <div key={preset.id}>
                <PresetCard
                  onClick={() => onApplyTrackVoicePreset(preset.id)}
                  preset={preset}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {matchingRecordedPresets.length > 0 ? (
        <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="section-label">Captured instruments</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {matchingRecordedPresets.length} saved
            </div>
          </div>
          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
            Reuse saved captures as full instrument starting points for this lane.
          </div>
          <div className="mt-3 grid gap-2">
            {matchingRecordedPresets.map((preset) => (
              <button
                key={preset.id}
                className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.26)] hover:bg-[rgba(114,217,255,0.05)]"
                data-ui-sound="action"
                onClick={() => onApplyRecordedNotePreset(preset)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{preset.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                    {preset.note}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                  <span>{preset.presetLabel}</span>
                  <span>{Math.round(preset.clarity * 100)}% clarity</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
