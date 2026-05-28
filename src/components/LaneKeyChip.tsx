import { useEffect, useMemo, useRef, useState } from 'react';

import { useAudio } from '../context/AudioContext';
import { getEffectiveKey, laneFitness } from '../services/keyDetector';
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
// The chip fades in when its label first appears and fades between
// the in-key / out-of-key states as the user edits, so a flip from
// fitting to drifting (or back) reads as a deliberate change instead
// of a hard swap.
export const LaneKeyChip = ({ track, className = '' }: LaneKeyChipProps) => {
  const { tracks } = useAudio();
  const key = useMemo(() => getEffectiveKey(tracks), [tracks]);
  const fitness = useMemo(() => laneFitness(track, key), [track, key]);

  const label = fitness.ratio === null
    ? null
    : fitness.ratio >= 0.8
      ? `In ${key.label}`
      : `Out of ${key.label}`;

  // Track the label that's been on screen long enough to fade between.
  const [renderedLabel, setRenderedLabel] = useState<string | null>(label);
  const [opacity, setOpacity] = useState(label ? 1 : 0);
  const lastLabelRef = useRef(label);

  useEffect(() => {
    if (label === lastLabelRef.current) return;
    if (label === null) {
      // Fading out the chip entirely.
      setOpacity(0);
      const id = window.setTimeout(() => setRenderedLabel(null), 280);
      lastLabelRef.current = label;
      return () => window.clearTimeout(id);
    }
    if (renderedLabel === null) {
      // First mount or returning from null.
      setRenderedLabel(label);
      requestAnimationFrame(() => setOpacity(1));
      lastLabelRef.current = label;
      return;
    }
    // Cross-fade: quick dip to 0, swap, fade back up.
    setOpacity(0);
    const swap = window.setTimeout(() => {
      setRenderedLabel(label);
      setOpacity(1);
    }, 160);
    lastLabelRef.current = label;
    return () => window.clearTimeout(swap);
  }, [label, renderedLabel]);

  if (renderedLabel === null) return null;

  const ratio = fitness.ratio ?? 0;
  const isFitting = ratio >= 0.8;
  const colorClass = isFitting
    ? 'text-[var(--accent-strong)]'
    : 'text-[var(--accent-warn,#ff9466)]';
  const inKeyPercent = Math.round(ratio * 100);

  return (
    <span
      aria-label={`Lane ${isFitting ? 'fits' : 'drifts from'} ${key.label}. ${inKeyPercent} percent of notes in key.`}
      className={`font-mono text-[9px] uppercase tracking-[0.16em] transition-opacity duration-300 ${colorClass} ${className}`}
      style={{ opacity }}
      title={`${inKeyPercent}% of notes fit ${key.label}.`}
    >
      {renderedLabel}
    </span>
  );
};
