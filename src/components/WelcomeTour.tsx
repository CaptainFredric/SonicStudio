import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'sonicstudio:tour:dismissed:v1';

interface TourStep {
  target: string;
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour-target="play"]',
    title: 'Press play to hear the song.',
    body: 'The starter session is already loaded. Try it now to hear what SonicStudio sounds like, then come back to edit.',
    placement: 'bottom',
  },
  {
    target: '[data-tour-target="sessions"]',
    title: 'Open a different starter anytime.',
    body: 'Click Sessions in the side rail to switch to another mood — Lo-Fi Sunday, Synthwave Drive, Ambient Drift, and more.',
    placement: 'right',
  },
  {
    target: '[data-tour-target="tap-to-play"]',
    title: 'Play the selected track yourself.',
    body: 'Open the tap-to-play strip and use your keyboard (A–L) or click the on-screen keys to play notes through the focused track.',
    placement: 'top',
  },
  {
    target: '[data-tour-target="options"]',
    title: 'Change accent color, density, and more.',
    body: 'Open Options for preferences (theme color, motion, density) and a full keyboard shortcut reference. Press ? anywhere for the same list.',
    placement: 'bottom',
  },
];

interface WelcomeTourProps {
  shouldStart: boolean;
}

const readDismissed = () => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const markDismissed = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
};

export const WelcomeTour = ({ shouldStart }: WelcomeTourProps) => {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!shouldStart) return;
    if (readDismissed()) return;
    const timeout = window.setTimeout(() => setStepIndex(0), 600);
    return () => window.clearTimeout(timeout);
  }, [shouldStart]);

  const current = stepIndex !== null ? STEPS[stepIndex] : null;

  useLayoutEffect(() => {
    if (!current) {
      setTargetRect(null);
      return undefined;
    }
    const measure = () => {
      const el = document.querySelector(current.target) as HTMLElement | null;
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };
    measure();
    const id = window.setInterval(measure, 220);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [current]);

  useEffect(() => {
    if (stepIndex === null) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        markDismissed();
        setStepIndex(null);
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        if (stepIndex < STEPS.length - 1) {
          setStepIndex(stepIndex + 1);
        } else {
          markDismissed();
          setStepIndex(null);
        }
      } else if (event.key === 'ArrowLeft' && stepIndex > 0) {
        setStepIndex(stepIndex - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepIndex]);

  if (!current) {
    return null;
  }

  const skip = () => {
    markDismissed();
    setStepIndex(null);
  };
  const next = () => {
    if (stepIndex !== null && stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      markDismissed();
      setStepIndex(null);
    }
  };
  const back = () => {
    if (stepIndex !== null && stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const padding = 8;
  const cardOffset = 14;
  const isLast = stepIndex === STEPS.length - 1;

  let cardStyle: CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: 'min(360px, 92vw)',
  };
  let highlightStyle: CSSProperties | null = null;

  if (targetRect) {
    highlightStyle = {
      position: 'fixed',
      top: targetRect.top - padding,
      left: targetRect.left - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
      borderRadius: 8,
      boxShadow: '0 0 0 9999px rgba(4, 7, 11, 0.7), 0 0 0 2px var(--accent), 0 0 28px 4px color-mix(in srgb, var(--accent) 35%, transparent)',
      pointerEvents: 'none',
      transition: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
    const placement = current.placement ?? 'bottom';
    const cardWidth = Math.min(360, window.innerWidth - 32);
    const cardLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16,
      placement === 'right' ? targetRect.right + cardOffset
      : placement === 'left' ? targetRect.left - cardWidth - cardOffset
      : targetRect.left + targetRect.width / 2 - cardWidth / 2,
    ));
    const cardTop = placement === 'top'
      ? Math.max(16, targetRect.top - 12 - 180)
      : placement === 'right' || placement === 'left'
        ? Math.max(16, targetRect.top)
        : Math.min(window.innerHeight - 200, targetRect.bottom + cardOffset);
    cardStyle = {
      position: 'fixed',
      top: cardTop,
      left: cardLeft,
      width: cardWidth,
      transform: 'none',
    };
  }

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-[100] bg-[rgba(4,7,11,0.5)] backdrop-blur-[2px] transition-opacity"
        onClick={skip}
        style={highlightStyle ? { background: 'transparent' } : undefined}
      />
      {highlightStyle && <div aria-hidden style={highlightStyle} className="z-[101]" />}
      <div
        aria-modal="true"
        className="surface-panel-strong z-[102] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
        role="dialog"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
            Welcome · {(stepIndex ?? 0) + 1} of {STEPS.length}
          </div>
          <button
            aria-label="Skip tour"
            className="ghost-icon-button flex h-7 w-7 items-center justify-center"
            onClick={skip}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 className="mt-2 text-base font-semibold tracking-tight text-[var(--text-primary)]">
          {current.title}
        </h3>
        <p className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            className="control-chip px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
            onClick={skip}
            type="button"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {stepIndex !== null && stepIndex > 0 && (
              <button
                className="control-chip px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                onClick={back}
                type="button"
              >
                Back
              </button>
            )}
            <button
              className="control-chip px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              data-active="true"
              onClick={next}
              type="button"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
