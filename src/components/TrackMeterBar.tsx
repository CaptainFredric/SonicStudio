import { useEffect, useState } from 'react';

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
  className = '',
  color,
  offKey = false,
  trackId,
}: {
  className?: string;
  color: string;
  offKey?: boolean;
  trackId: string;
}) => {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let attached = true;
    const tick = () => {
      if (!attached) return;
      const dB = engine.getMeterValue(trackId);
      const normalised = typeof dB === 'number' && Number.isFinite(dB)
        ? Math.max(0, Math.min(1, (dB + 60) / 60))
        : 0;
      setLevel(normalised);
    };
    tick();
    const id = window.setInterval(tick, 110);
    return () => {
      attached = false;
      window.clearInterval(id);
    };
  }, [trackId]);

  return (
    <span
      aria-hidden="true"
      className={`block h-[3px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)] ${className}`}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-100"
        style={{
          width: `${level * 100}%`,
          backgroundColor: offKey ? 'var(--accent-warn, #ff9466)' : color,
        }}
      />
    </span>
  );
};
