import type { TrackVoicePresetDefinition } from '../../../project/schema';

interface DeviceRackVoiceStartsPanelProps {
  onApplyTrackVoicePreset: (presetId: string) => void;
  trackVoicePresets: TrackVoicePresetDefinition[];
}

export const DeviceRackVoiceStartsPanel = ({
  onApplyTrackVoicePreset,
  trackVoicePresets,
}: DeviceRackVoiceStartsPanelProps) => (
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
          data-ui-sound="action"
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
);
