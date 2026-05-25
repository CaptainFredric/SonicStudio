import { useEffect, useState } from 'react';
import * as Tone from 'tone';

// Tiny mono "bar:beat" indicator next to the transport. Only shows when
// the Tone Transport is actually running, so it disappears at rest and
// the stopped transport stays uncluttered.
export const TransportPositionTag = ({ className = '' }: { className?: string }) => {
  const [position, setPosition] = useState<string | null>(null);

  useEffect(() => {
    let attached = true;
    const tick = () => {
      if (!attached) return;
      try {
        const transport = Tone.getTransport();
        if (transport.state !== 'started') {
          setPosition(null);
          return;
        }
        const raw = transport.position.toString();
        // "bar:beat:sixteenth.subdivision" — trim to "bar:beat".
        const [bar = '0', beat = '0'] = raw.split(':');
        setPosition(`${bar}:${beat}`);
      } catch {
        setPosition(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 130);
    return () => {
      attached = false;
      window.clearInterval(id);
    };
  }, []);

  if (position === null) {
    return null;
  }

  return (
    <span
      aria-label={`Transport position ${position}`}
      className={`font-mono text-[10px] tracking-[0.1em] text-[var(--text-secondary)] ${className}`}
    >
      {position}
    </span>
  );
};
