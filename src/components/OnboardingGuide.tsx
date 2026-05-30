import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface OnboardingGuideProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface GuideStep {
  action: string;
  body: string;
  eyebrow: string;
  payoff: string;
  target: string;
  title: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    action: 'Tap Play to hear the whole scene, then keep what works.',
    body: 'Press Play, or hit Space, and the scene you loaded starts right up. Audio wakes on that first tap, so there is nothing to set up first.',
    eyebrow: 'Start here',
    payoff: 'You hear the idea in seconds, then change only what you want.',
    target: 'play',
    title: 'Start by hearing it.',
  },
  {
    action: 'Use the left rail to switch editing context, not just screens.',
    body: 'Compose is idea capture, Sequencer is step timing, Roll is pitch detail, Mix is balance, and Arranger is song structure.',
    eyebrow: 'Views',
    payoff: 'Knowing each view role makes the workflow feel intentional instead of repetitive.',
    target: 'views',
    title: 'Each main view has a distinct job.',
  },
  {
    action: 'Open Library to start fresh, reopen saved work, or pull captured notes.',
    body: 'Library keeps starter scenes, saved sessions, and captured notes together so you can reset or pick up where you left off.',
    eyebrow: 'Library',
    payoff: 'You always have a clean starting point and a quick way back.',
    target: 'sessions',
    title: 'Library holds your scenes and saves.',
  },
  {
    action: 'Use the lower strip (or A through L) to audition notes in place.',
    body: 'You can test note choices on the selected lane without leaving your current screen.',
    eyebrow: 'Audition',
    payoff: 'You stay in flow while testing pitch ideas quickly.',
    target: 'tap-to-play',
    title: 'Audition notes without context switching.',
  },
  {
    action: 'Capture a clean note, review the suggested lane and pitch, then apply or save it.',
    body: 'Capture listens for pitch and suggests lane matches. You can tune behavior in Options (commit timing, match count, auto-preview).',
    eyebrow: 'Capture',
    payoff: 'Great for fast note detection and building your own reusable note shelf.',
    target: 'record',
    title: 'Capture turns sounds into reusable note starts.',
  },
  {
    action: 'Turn on SuperSonic when you want the common edits one tap away.',
    body: 'SuperSonic adds an assist bar above the keyboard with Vary volume, Shift, Octave, and Clear, plus hover guidance. Normal mode keeps the same tools in their panels.',
    eyebrow: 'SuperSonic',
    payoff: 'Pick the pace that fits. Nothing is locked behind either mode.',
    target: 'supersonic',
    title: 'SuperSonic puts quick edits within reach.',
  },
  {
    action: 'Use Share for links or portable files. Use Library for local recall.',
    body: 'Share can export the exact session for feedback or cross-device work.',
    eyebrow: 'Share',
    payoff: 'Keeping local and portable workflows separate is cleaner and safer.',
    target: 'share',
    title: 'Share sessions without bouncing audio first.',
  },
  {
    action: 'Use Options for defaults and behavior tuning. Keep creative material in Library.',
    body: 'Options includes MIDI import, exports, checkpoints, workspace defaults, SuperSonic behavior, and capture controls.',
    eyebrow: 'Options',
    payoff: 'Settings stay organized, and your creative material stays easy to find.',
    target: 'options',
    title: 'Options handles setup and workflow tuning.',
  },
];

export const OnboardingGuide = ({ open, onComplete, onSkip }: OnboardingGuideProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const isCompactViewport = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(max-width: 767px)').matches;
  }, []);

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
      block: isCompactViewport ? 'center' : 'nearest',
      inline: 'nearest',
    });

    const updateRect = () => {
      setTargetRect(element.getBoundingClientRect());
    };

    updateRect();
    const frameId = window.requestAnimationFrame(updateRect);
    const settleId = window.setTimeout(updateRect, reducedMotion ? 0 : 120);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateRect())
      : null;

    resizeObserver?.observe(element);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(settleId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isCompactViewport, open, reducedMotion, step.target]);

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
    ? (() => {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
        const dynamicPad = Math.max(6, Math.min(14, Math.round(Math.min(targetRect.width, targetRect.height) * 0.08)));
        const rawLeft = targetRect.left - dynamicPad;
        const rawTop = targetRect.top - dynamicPad;
        const rawWidth = targetRect.width + (dynamicPad * 2);
        const rawHeight = targetRect.height + (dynamicPad * 2);
        const clampedWidth = Math.max(0, Math.min(rawWidth, Math.max(0, viewportWidth - 16)));
        const clampedHeight = Math.max(0, Math.min(rawHeight, Math.max(0, viewportHeight - 16)));
        const clampedLeft = Math.max(8, Math.min(rawLeft, Math.max(8, viewportWidth - clampedWidth - 8)));
        const clampedTop = Math.max(8, Math.min(rawTop, Math.max(8, viewportHeight - clampedHeight - 8)));

        return {
          height: clampedHeight,
          left: clampedLeft,
          top: clampedTop,
          width: clampedWidth,
        };
      })()
    : undefined;

  const focusTarget = () => {
    const element = document.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`);
    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
    setTargetRect(element.getBoundingClientRect());
  };

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

        <div className="mt-4 h-[2px] overflow-hidden rounded-[2px] bg-[rgba(255,255,255,0.08)]">
          <div
            className="h-full rounded-[2px] bg-[linear-gradient(90deg,var(--accent),rgba(114,217,255,0.36))]"
            style={{ width: `${((stepIndex + 1) / GUIDE_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
            <div className="section-label">Try this</div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{step.action}</p>
          </div>
          <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
            <div className="section-label">Why it matters</div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{step.payoff}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {GUIDE_STEPS.map((guideStep, index) => (
            <button
              aria-label={`Jump to guide step ${index + 1}: ${guideStep.eyebrow}`}
              className="control-chip flex h-8 min-w-8 items-center justify-center px-2 text-[10px] font-mono font-semibold uppercase tracking-[0.14em]"
              data-active={index === stepIndex}
              data-ui-sound="tab"
              key={guideStep.target}
              onClick={() => setStepIndex(index)}
              type="button"
            >
              {index + 1}
            </button>
          ))}
          {targetRect ? (
            <button
              className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-ui-sound="action"
              onClick={focusTarget}
              type="button"
            >
              Show control
            </button>
          ) : null}
        </div>

        <div className="mt-4 border-t border-[var(--border-soft)] pt-4 text-[11px] leading-5 text-[var(--text-tertiary)]">
          Use left and right arrows to move through steps. Press Esc to skip. On mobile, Show control recenters the target before you continue.
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              data-ui-sound="tab"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              type="button"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <button
              className="control-chip px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              data-ui-sound="tab"
              onClick={onSkip}
              type="button"
            >
              Skip
            </button>
          </div>

          <button
            className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            data-active="true"
            data-ui-sound="tab"
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