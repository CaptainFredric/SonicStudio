import { useEffect, useRef, useState } from 'react';

import { bpmFromTaps, TAP_TEMPO_RESET_GAP_MS, trimTapRun } from '../../utils/tapTempo';

interface TapTempoButtonProps {
  onBpmChange: (bpm: number) => void;
}

// Tap a steady pulse and the studio reads the tempo from the gaps
// between taps. After a pause longer than the reset window, the next
// tap starts a fresh measurement. The button shows the running tap
// count so the user knows the measurement is building.
export const TapTempoButton = ({ onBpmChange }: TapTempoButtonProps) => {
  const tapsRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  const handleTap = () => {
    const now = Date.now();
    const run = trimTapRun([...tapsRef.current, now]);
    tapsRef.current = run;
    setTapCount(run.length);

    const bpm = bpmFromTaps(run);
    if (bpm !== null) {
      onBpmChange(bpm);
    }

    // Clear the visible count once the user stops tapping so the
    // button returns to its resting label, ready for a fresh count.
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      tapsRef.current = [];
      setTapCount(0);
    }, TAP_TEMPO_RESET_GAP_MS);
  };

  return (
    <button
      aria-label="Tap tempo. Tap a steady pulse to set the BPM."
      className="control-chip h-11 min-h-[2.75rem] inline-flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
      data-active={tapCount > 0 ? 'true' : 'false'}
      onClick={handleTap}
      title="Tap a steady pulse to set the tempo. Pause to start over."
      type="button"
    >
      Tap
      {tapCount > 0 && (
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{tapCount}</span>
      )}
    </button>
  );
};
