import { useEffect, useRef } from 'react';

import { engine } from '../audio/ToneEngine';

// Thin horizontal level bar for a single lane. Polls the engine's per-
// track meter and fills in the lane's own colour, so it reads at a
// glance which lanes are producing sound (vs. muted / idle / silenced).
// An optional warm tint replaces the colour when the lane is drifting
// out of the session's effective key, giving a continuous warning
// channel for off-key playback that the chip alone can't carry.
//
// -60 dB maps to empty, 0 dB maps to full; in practice tracks bounce
// around the −30 dB to −10 dB band during a busy section.
export const TrackMeterBar = ({
  active = true,
  className = '',
  color,
  intervalMs = 110,
  offKey = false,
  trackId,
}: {
  active?: boolean;
  className?: string;
  color: string;
  intervalMs?: number;
  offKey?: boolean;
  trackId: string;
}) => {
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Update the fill width imperatively rather than through state: a per-lane
    // meter setting state ~9x a second re-renders every lane during playback,
    // and that main-thread churn is exactly what starves the audio scheduler.
    // Writing the width straight to the node keeps the meter live for free.
    const reset = () => { if (fillRef.current) fillRef.current.style.width = '0%'; };
    // Nothing is sounding while the transport is idle, so don't burn a timer.
    if (!active) {
      reset();
      return undefined;
    }
    let attached = true;
    const tick = () => {
      if (!attached) return;
      const dB = engine.getMeterValue(trackId);
      const normalised = typeof dB === 'number' && Number.isFinite(dB)
        ? Math.max(0, Math.min(1, (dB + 60) / 60))
        : 0;
      if (fillRef.current) fillRef.current.style.width = `${normalised * 100}%`;
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      attached = false;
      window.clearInterval(id);
    };
  }, [active, intervalMs, trackId]);

  return (
    <span
      aria-hidden="true"
      className={`block h-[3px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)] ${className}`}
    >
      <span
        className="block h-full w-0 rounded-full transition-[width] duration-100"
        ref={fillRef}
        style={{ backgroundColor: offKey ? 'var(--accent-warn, #ff9466)' : color }}
      />
    </span>
  );
};
