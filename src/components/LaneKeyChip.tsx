import { useMemo } from 'react';

import { useAudio } from '../context/AudioContext';
import { detectKey, getEffectiveKey, laneFitness } from '../services/keyDetector';
import type { Track } from '../project/schema';

interface LaneKeyChipProps {
  track: Track;
  className?: string;
}

// Tiny "in key" / "off key" hint for a single lane. Reads against the
// session's detected key so the chip only appears once the session has
// enough notes to grade a lane. Drum lanes do not carry harmony so
// they get no chip.
//
export const LaneKeyChip = ({ track, className = '' }: LaneKeyChipProps) => {
  const { tracks } = useAudio();
  const key = useMemo(() => getEffectiveKey(tracks), [tracks]);
  const fitness = useMemo(() => laneFitness(track, key), [track, key]);
  // When this lane drifts from the session key, show its own
  // most-likely key as a secondary hint — useful when a lane is
  // intentionally in a different key, or when the user has pinned
  // the session and a sketch lane wants to explore elsewhere.
  const ownKey = useMemo(() => detectKey([track]), [track]);

  const isFitting = fitness.ratio !== null && fitness.ratio >= 0.8;
  const label = fitness.ratio === null
    ? null
    : isFitting
      ? `In ${key.label}`
      : !ownKey.uncertain && (ownKey.rootName !== key.rootName || ownKey.mode !== key.mode)
        ? `Out of ${key.label} · reads as ${ownKey.label}`
        : `Out of ${key.label}`;

  if (label === null) return null;

  const ratio = fitness.ratio ?? 0;
  const colorClass = isFitting
    ? 'text-[var(--accent-strong)]'
    : 'text-[var(--accent-warn,#ff9466)]';
  const inKeyPercent = Math.round(ratio * 100);

  return (
    <span
      aria-label={`Lane ${isFitting ? 'fits' : 'drifts from'} ${key.label}. ${inKeyPercent} percent of notes in key.`}
      className={`font-mono text-[9px] uppercase tracking-[0.16em] ${colorClass} ${className}`}
      title={`${inKeyPercent}% of notes fit ${key.label}.`}
    >
      {label}
    </span>
  );
};
