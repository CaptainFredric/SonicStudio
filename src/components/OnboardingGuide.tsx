import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface OnboardingGuideProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface GuideStep {
  body: string;
  eyebrow: string;
  target: string;
  title: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    body: 'Use the Library button to reopen starter scenes whenever you want a full song to poke at or a clean place to restart.',
    eyebrow: 'Library',
    target: 'sessions',
    title: 'Starter sessions are always close by.',
  },
  {
    body: 'The left rail is your fast route between Compose, Sequencer, Roll, Mix, and Arrange. If you get lost, come back here first.',
    eyebrow: 'Views',
    target: 'views',
    title: 'Move around the studio from the left rail.',
  },
  {
    body: 'Press Space or click Play. The first gesture wakes audio, so starting playback is the easiest first move.',
    eyebrow: 'Transport',
    target: 'play',
    title: 'Listen before you start editing.',
  },
  {
    body: 'Click the lower strip or use A through L on the keyboard to audition the selected track without leaving the current view.',
    eyebrow: 'Audition',
    target: 'tap-to-play',
    title: 'Try notes from the lower strip.',
  },
  {
    body: 'Record listens for live pitch, suggests matching lanes, and now lets you save captured notes into a small reusable shelf. Those saved notes can be recalled later from the Roll menu.',
    eyebrow: 'Capture',
    target: 'record',
    title: 'Capture sounds and turn them into reusable note presets.',
  },
  {
    body: 'SuperSonic flips the studio into the advanced workflow. In Sequencer and Roll you get precision hover ladders, macro lane navigation, and faster note targeting without leaving the grid.',
    eyebrow: 'SuperSonic',
    target: 'supersonic',
    title: 'SuperSonic unlocks the more precise editing layer.',
  },
  {
    body: 'Share the exact session with a link, copied JSON, or a session file when you want feedback or need to pick it back up somewhere else.',
    eyebrow: 'Share',
    target: 'share',
    title: 'Share the session without bouncing stems.',
  },
  {
    body: 'Options is where you will find MIDI import, exports, checkpoints, workspace defaults, and the SuperSonic preference if you want that mode available by default.',
    eyebrow: 'Options',
    target: 'options',
    title: 'Settings is where the practical stuff lives.',
  },
];

const GUIDE_HIGHLIGHT_PAD = 10;

export const OnboardingGuide = ({ open, onComplete, onSkip }: OnboardingGuideProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) {
      setTargetRect(null);
      return;
    }

    setStepIndex(0);
  }, [open]);

  const step = GUIDE_STEPS[stepIndex] ?? GUIDE_STEPS[0];
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const element = document.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`);
    if (!element) {
      setTargetRect(null);
      return undefined;
    }

    element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });

    const updateRect = () => {
      setTargetRect(element.getBoundingClientRect());
    };

    updateRect();
    const frameId = window.requestAnimationFrame(updateRect);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateRect())
      : null;

    resizeObserver?.observe(element);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, reducedMotion, step.target]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
          onSkip();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStepIndex((current) => Math.min(current + 1, GUIDE_STEPS.length - 1));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStepIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip, open]);

  if (!open) {
    return null;
  }

  const isLastStep = stepIndex === GUIDE_STEPS.length - 1;
  const highlightStyle = targetRect
    ? {
        height: Math.max(0, targetRect.height + GUIDE_HIGHLIGHT_PAD * 2),
        left: Math.max(8, targetRect.left - GUIDE_HIGHLIGHT_PAD),
        top: Math.max(8, targetRect.top - GUIDE_HIGHLIGHT_PAD),
        width: Math.max(0, targetRect.width + GUIDE_HIGHLIGHT_PAD * 2),
      }
    : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[65]">
      {highlightStyle ? (
        <div className="tour-highlight" style={highlightStyle} />
      ) : null}

      <section className="tour-panel pointer-events-auto fixed bottom-4 right-4 w-[min(360px,calc(100vw-1.5rem))] max-w-full p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Sparkles className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Guide</span>
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {step.eyebrow} · {stepIndex + 1} of {GUIDE_STEPS.length}
            </div>
          </div>
          <button
            aria-label="Close guide"
            className="ghost-icon-button flex h-8 w-8 items-center justify-center"
            onClick={onSkip}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-3 text-[18px] font-semibold tracking-tight text-[var(--text-primary)]">{step.title}</h2>
        <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{step.body}</p>

        <div className="mt-4 border-t border-[var(--border-soft)] pt-4 text-[11px] leading-5 text-[var(--text-tertiary)]">
          Use the arrow keys to move between steps. Press Esc to skip.
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              type="button"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <button
              className="control-chip px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              onClick={onSkip}
              type="button"
            >
              Skip
            </button>
          </div>

          <button
            className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            data-active="true"
            onClick={() => {
              if (isLastStep) {
                onComplete();
                return;
              }

              setStepIndex((current) => Math.min(current + 1, GUIDE_STEPS.length - 1));
            }}
            type="button"
          >
            {isLastStep ? 'Done' : 'Next'}
            {!isLastStep ? <ArrowRight className="h-3.5 w-3.5" /> : null}
          </button>
        </div>
      </section>
    </div>
  );
};