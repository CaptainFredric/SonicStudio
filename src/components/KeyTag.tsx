import { useMemo, useState } from 'react';
import { Pin } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { detectKey, getEffectiveKey } from '../services/keyDetector';
import { useManualKeyOverride, type ManualKeyOverride } from '../services/manualKeyOverride';

const ROOT_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const MODE_OPTIONS = ['major', 'minor'] as const;

// Compact "A minor" / "C major" tag for the transport area. Reads
// straight off the project's tracks each render so the label tracks
// edits live. We hide it entirely until the session has enough notes
// to be confident, so a fresh blank session does not show a phantom
// key. Clicking the tag opens an inline picker that pins a manual
// key override.
export const KeyTag = ({ className = '' }: { className?: string }) => {
  const { tracks } = useAudio();
  const [override, setOverride] = useManualKeyOverride();
  const effective = useMemo(() => getEffectiveKey(tracks), [tracks, override]);
  // Separate analytical reading so the picker can offer a one-tap
  // "Pin to detected" even when the user has already pinned a
  // different key.
  const analytical = useMemo(() => detectKey(tracks), [tracks]);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (effective.uncertain && !override) {
    return null;
  }

  const isManual = override !== null;
  const tooltip = isManual
    ? `Manually pinned to ${effective.label}. Click to change or release.`
    : `Live key read from your notes. Confidence ${Math.round(effective.confidence * 100)}%. Click to pin manually.`;

  return (
    <span className={`relative inline-flex items-center gap-1 ${className}`}>
      <button
        aria-label={isManual ? `Key pinned to ${effective.label}` : `Detected key ${effective.label}. Click to pin manually.`}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]"
        onClick={() => setPickerOpen((current) => !current)}
        title={tooltip}
        type="button"
      >
        {effective.label}
        {isManual && <Pin className="h-2.5 w-2.5" />}
      </button>
      {pickerOpen && (
        <div
          className="surface-panel-strong absolute left-0 top-full z-[60] mt-1 grid w-[220px] gap-2 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
          role="dialog"
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Pin key
          </div>
          <div className="grid grid-cols-6 gap-1">
            {ROOT_OPTIONS.map((root) => (
              <button
                aria-label={`Pick root ${root}`}
                className="control-chip h-7 min-h-[1.75rem] px-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                data-active={override?.rootName === root ? 'true' : 'false'}
                key={root}
                onClick={() => {
                  const mode = override?.mode ?? 'major';
                  setOverride({ rootName: root, mode } as ManualKeyOverride);
                }}
                type="button"
              >
                {root}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {MODE_OPTIONS.map((mode) => (
              <button
                aria-label={`Pick mode ${mode}`}
                className="control-chip h-7 min-h-[1.75rem] px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-active={override?.mode === mode ? 'true' : 'false'}
                key={mode}
                onClick={() => {
                  const rootName = override?.rootName ?? effective.rootName;
                  setOverride({ rootName, mode } as ManualKeyOverride);
                }}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
          {!analytical.uncertain && (
            <button
              aria-label={`Pin to the detected key ${analytical.label}`}
              className="control-chip h-7 min-h-[1.75rem] px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              disabled={override?.rootName === analytical.rootName && override?.mode === analytical.mode}
              onClick={() => setOverride({ rootName: analytical.rootName, mode: analytical.mode } as ManualKeyOverride)}
              type="button"
            >
              Pin to {analytical.label}
            </button>
          )}
          <button
            aria-label="Release the manual pin and resume auto detection"
            className="control-chip h-7 min-h-[1.75rem] px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            disabled={!isManual}
            onClick={() => setOverride(null)}
            type="button"
          >
            Auto
          </button>
          <button
            aria-label="Close picker"
            className="control-chip h-7 min-h-[1.75rem] px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => setPickerOpen(false)}
            type="button"
          >
            Done
          </button>
        </div>
      )}
    </span>
  );
};
