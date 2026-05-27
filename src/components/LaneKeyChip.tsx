import { useMemo } from 'react';

import { useAudio } from '../context/AudioContext';
import { detectKey, laneFitness } from '../services/keyDetector';
import type { Track } from '../project/schema';

interface LaneKeyChipProps {
  track: Track;
  className?: string;
}

// Tiny "in key" / "off key" hint for a single lane. Reads against the
// session's detected key so the chip only appears once the session has
// enough notes to grade a lane. Drum lanes do not carry harmony so
// they get no chip.
export const LaneKeyChip = ({ track, className = '' }: LaneKeyChipProps) => {
  const { tracks } = useAudio();
  const key = useMemo(() => detectKey(tracks), [tracks]);
  const fitness = useMemo(() => laneFitness(track, key), [track, key]);

  if (fitness.ratio === null) return null;

  const inKeyPercent = Math.round(fitness.ratio * 100);
  const isFitting = fitness.ratio >= 0.8;
  const colorClass = isFitting
    ? 'text-[var(--accent-strong)]'
    : 'text-[var(--accent-warn,#ff9466)]';

  return (
    <span
      aria-label={`Lane ${isFitting ? 'fits' : 'drifts from'} ${key.label}. ${inKeyPercent} percent of notes in key.`}
      className={`font-mono text-[9px] uppercase tracking-[0.16em] ${colorClass} ${className}`}
      title={`${inKeyPercent}% of notes fit ${key.label}.`}
    >
      {isFitting ? `In ${key.label}` : `Out of ${key.label}`}
    </span>
  );
};
