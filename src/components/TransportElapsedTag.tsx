import { useEffect, useState } from 'react';
import * as Tone from 'tone';

// Reads Tone Transport's elapsed seconds while the engine is playing
// and shows a "m:ss" tag next to the bar-beat readout. Hides itself
// when the transport is not running so the stopped state stays
// uncluttered (mirrors TransportPositionTag's behaviour).
export const TransportElapsedTag = ({ className = '' }: { className?: string }) => {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let attached = true;
    const tick = () => {
      if (!attached) return;
      try {
        const transport = Tone.getTransport();
        if (transport.state !== 'started') {
          setLabel(null);
          return;
        }
        const seconds = Math.max(0, Math.floor(transport.seconds));
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        setLabel(`${minutes}:${remainder.toString().padStart(2, '0')}`);
      } catch {
        setLabel(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => {
      attached = false;
      window.clearInterval(id);
    };
  }, []);

  if (label === null) return null;

  return (
    <span
      aria-label={`Elapsed ${label}`}
      className={`font-mono text-[10px] tracking-[0.1em] text-[var(--text-tertiary)] ${className}`}
    >
      {label}
    </span>
  );
};
