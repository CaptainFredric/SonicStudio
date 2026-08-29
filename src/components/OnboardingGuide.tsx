import { ArrowLeft, ArrowRight, Pause, Play, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type GuideMode = 'showcase' | 'tour';

interface OnboardingGuideProps {
  isPlaying: boolean;
  mode: GuideMode;
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onTogglePlayback: () => void | Promise<void>;
}

interface GuideStep {
  action: string;
  body: string;
  eyebrow: string;
  payoff: string;
  target: string;
  title: string;
}

const SHOWCASE_STEPS: GuideStep[] = [
  {
    action: 'Play Night Transit. The complete six section arrangement is ready now.',
    body: 'Start with the finished idea instead of an empty grid. The browser wakes the audio engine on your first tap.',
    eyebrow: 'Listen',
    payoff: 'You can judge the musical result before learning a single control.',
    target: 'play',
    title: 'Hear a complete song first.',
  },
  {
    action: 'Open one workspace and change only the part that interests you.',
    body: 'The same project moves from step sequencing to pitch editing, arrangement, sound design, and mixing.',
    eyebrow: 'Shape',
    payoff: 'This is one connected writing workflow, not a collection of disconnected demos.',
    target: 'views',
    title: 'Shape the idea from one studio.',
  },
  {
    action: 'Share the session, export MIDI, or bounce a WAV when the idea is ready.',
    body: 'Your arrangement stays editable, saves locally, and can leave the browser in practical formats.',
    eyebrow: 'Finish',
    payoff: 'The result is portable music and a recoverable project, not a visual mockup.',
    target: 'share',
    title: 'Leave with something real.',
  },
];

const TOUR_STEPS: GuideStep[] = [
  {
    action: 'Tap Play to hear the whole scene, then keep what works.',
    body: 'Press Play, or hit Space, and the scene you loaded starts right up. Audio wakes on that first tap, so there is nothing to set up first.',
    eyebrow: 'Start here',
    payoff: 'You hear the idea in seconds, then change only what you want.',
    target: 'play',
    title: 'Start by hearing it.',
  },
  {
    action: 'Build timing in Pattern, arrange clips in Song, open Piano roll for pitch, then use Mix for balance.',
    body: 'Library, Capture, and Transcribe bring material in. Pattern writes loops, Song arranges them, Piano roll shapes notes, and Mix finishes the balance.',
    eyebrow: 'Workflow',
    payoff: 'Each surface owns one clear stage of the same song instead of duplicating the others.',
    target: 'views',
    title: 'Move from idea to song without losing context.',
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
    body: 'Capture listens for pitch and suggests lane matches. You can tune behavior in Settings (commit timing, match count, auto-preview).',
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
    action: 'Use Settings for defaults and behavior tuning. Keep creative material in Library.',
    body: 'Settings includes MIDI import, exports, checkpoints, workspace defaults, SuperSonic behavior, and capture controls.',
    eyebrow: 'Settings',
    payoff: 'Settings stay organized, and your creative material stays easy to find.',
    target: 'options',
    title: 'Settings handles setup and workflow tuning.',
  },
];

export const OnboardingGuide = ({
  isPlaying,
  mode,
  open,
  onComplete,
  onSkip,
  onTogglePlayback,
}: OnboardingGuideProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const steps = mode === 'showcase' ? SHOWCASE_STEPS : TOUR_STEPS;
  const isShowcase = mode === 'showcase';
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
  }, [mode, open]);

  const step = steps[stepIndex] ?? steps[0];
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
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStepIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip, open, steps.length]);

  if (!open) {
    return null;
  }

  const isLastStep = stepIndex === steps.length - 1;
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

      <section
        aria-label={isShowcase ? 'SonicStudio quick preview' : 'SonicStudio guide'}
        className="tour-panel pointer-events-auto fixed bottom-4 right-4 w-[min(360px,calc(100vw-1.5rem))] max-w-full p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Sparkles className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">{isShowcase ? 'Quick preview' : 'Guide'}</span>
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {step.eyebrow} · {stepIndex + 1} of {steps.length}
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

        <div aria-atomic="true" aria-live="polite">
          <h2 className="mt-3 text-[18px] font-semibold tracking-tight text-[var(--text-primary)]">{step.title}</h2>
          <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{step.body}</p>
        </div>

        {isShowcase && step.target === 'play' ? (
          <button
            aria-label={isPlaying ? 'Pause Night Transit' : 'Play Night Transit'}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[3px] border border-[var(--accent)] bg-[rgba(72,228,255,0.13)] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)] transition-colors hover:bg-[rgba(72,228,255,0.21)]"
            data-active={isPlaying ? 'true' : 'false'}
            data-ui-sound="transport"
            onClick={() => void onTogglePlayback()}
            type="button"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            {isPlaying ? 'Pause demo' : 'Play Night Transit'}
          </button>
        ) : null}

        <div className="mt-4 h-[2px] overflow-hidden rounded-[2px] bg-[rgba(255,255,255,0.08)]">
          <div
            className="h-full rounded-[2px] bg-[linear-gradient(90deg,var(--accent),rgba(114,217,255,0.36))]"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        {isShowcase ? (
          <div className="mt-4 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
            <div className="section-label">What to notice</div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{step.payoff}</p>
          </div>
        ) : (
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
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {steps.map((guideStep, index) => (
            <button
              aria-current={index === stepIndex ? 'step' : undefined}
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

        {!isShowcase ? (
          <div className="mt-4 border-t border-[var(--border-soft)] pt-4 text-[11px] leading-5 text-[var(--text-tertiary)]">
            Use left and right arrows to move through steps. Press Esc to skip. On mobile, Show control recenters the target before you continue.
          </div>
        ) : null}

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
              {isShowcase ? 'Explore studio' : 'Skip'}
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

              setStepIndex((current) => Math.min(current + 1, steps.length - 1));
            }}
            type="button"
          >
            {isLastStep ? (isShowcase ? 'Enter studio' : 'Done') : 'Next'}
            {!isLastStep ? <ArrowRight className="h-3.5 w-3.5" /> : null}
          </button>
        </div>
      </section>
    </div>
  );
};
