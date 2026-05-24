import { useEffect, useState } from 'react';

import { engine } from '../audio/ToneEngine';

// Tiny indicator that lights when audio is actually reaching the
// destination. Engine running is not the same as audio audible — a
// stuck context, a system-muted device, or an all-silent pattern can
// each leave the transport advancing while the speakers are quiet. This
// dot disambiguates them at a glance.
export const AudioHealthDot = ({ className = '' }: { className?: string }) => {
  const [live, setLive] = useState(false);

  useEffect(() => {
    let attached = true;
    const tick = () => {
      if (!attached) return;
      const value = engine.getMasterMeterValue();
      const hasSignal = typeof value === 'number' && Number.isFinite(value) && value > -80;
      setLive(hasSignal);
    };
    tick();
    const id = window.setInterval(tick, 220);
    return () => {
      attached = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full transition-colors ${
        live
          ? 'bg-[var(--accent)] shadow-[0_0_8px_color-mix(in_srgb,var(--accent)_60%,transparent)] animate-pulse'
          : 'bg-[var(--border-strong)]'
      } ${className}`}
      title={live ? 'Audio is reaching the speakers' : 'No audio signal detected'}
    />
  );
};
