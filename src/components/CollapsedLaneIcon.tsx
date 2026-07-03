import { useEffect, useRef, type ReactNode } from 'react';

import { engine } from '../audio/ToneEngine';

// The colored icon box shown for each lane when the lane column is
// collapsed. Polls the lane's per-track meter and adds a soft glow
// scaled to the current level, so activity stays visible even with the
// labels and controls hidden.
export const CollapsedLaneIcon = ({
  active = true,
  children,
  color,
  intervalMs = 130,
  title,
  trackId,
}: {
  active?: boolean;
  children: ReactNode;
  color: string;
  intervalMs?: number;
  title: string;
  trackId: string;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Drive the glow imperatively instead of via state: a per-lane meter that
    // re-renders ~8x a second multiplies across every collapsed lane during
    // playback, and that main-thread churn is what starves the audio scheduler.
    const applyGlow = (level: number) => {
      const box = boxRef.current;
      if (!box) return;
      const glowAlpha = Math.round(level * 0.7 * 255).toString(16).padStart(2, '0');
      box.style.boxShadow = level > 0.04 ? `0 0 ${Math.round(4 + level * 10)}px ${color}${glowAlpha}` : 'none';
    };
    // Skip the timer entirely while the transport is idle: a collapsed lane
    // can't be producing sound, so there is nothing to glow for.
    if (!active) {
      applyGlow(0);
      return undefined;
    }
    let attached = true;
    const tick = () => {
      if (!attached) return;
      const dB = engine.getMeterValue(trackId);
      const normalised = typeof dB === 'number' && Number.isFinite(dB)
        ? Math.max(0, Math.min(1, (dB + 60) / 60))
        : 0;
      applyGlow(normalised);
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      attached = false;
      window.clearInterval(id);
    };
  }, [active, color, intervalMs, trackId]);

  return (
    <div
      className="flex h-7 w-7 items-center justify-center transition-shadow"
      ref={boxRef}
      style={{
        borderRadius: '2px',
        border: `1px solid ${color}55`,
        background: `${color}1a`,
        color,
      }}
      title={title}
    >
      {children}
    </div>
  );
};
