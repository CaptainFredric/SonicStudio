import { useEffect, useState, type ReactNode } from 'react';

import { engine } from '../audio/ToneEngine';

// The colored icon box shown for each lane when the lane column is
// collapsed. Polls the lane's per-track meter and adds a soft glow
// scaled to the current level, so activity stays visible even with the
// labels and controls hidden.
export const CollapsedLaneIcon = ({
  children,
  color,
  title,
  trackId,
}: {
  children: ReactNode;
  color: string;
  title: string;
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
    const id = window.setInterval(tick, 130);
    return () => {
      attached = false;
      window.clearInterval(id);
    };
  }, [trackId]);

  const glowAlpha = Math.round(level * 0.7 * 255).toString(16).padStart(2, '0');

  return (
    <div
      className="flex h-7 w-7 items-center justify-center transition-shadow"
      style={{
        borderRadius: '2px',
        border: `1px solid ${color}55`,
        background: `${color}1a`,
        color,
        boxShadow: level > 0.04 ? `0 0 ${Math.round(4 + level * 10)}px ${color}${glowAlpha}` : 'none',
      }}
      title={title}
    >
      {children}
    </div>
  );
};
