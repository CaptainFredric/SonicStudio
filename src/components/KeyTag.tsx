import { useMemo } from 'react';

import { useAudio } from '../context/AudioContext';
import { detectKey } from '../services/keyDetector';

// Compact "A minor" / "C major" tag for the transport area. Reads
// straight off the project's tracks each render so the label tracks
// edits live. We hide it entirely until the session has enough notes
// to be confident, so a fresh blank session does not show a phantom
// key.
export const KeyTag = ({ className = '' }: { className?: string }) => {
  const { tracks } = useAudio();
  const detected = useMemo(() => detectKey(tracks), [tracks]);

  if (detected.uncertain) {
    return null;
  }

  return (
    <span
      aria-label={`Detected key ${detected.label}`}
      className={`font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)] ${className}`}
      title={`Live key read from your notes. Confidence ${Math.round(detected.confidence * 100)}%.`}
    >
      {detected.label}
    </span>
  );
};
