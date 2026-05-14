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
    action: 'Open the Library whenever you want a fresh scene, a saved scoresheet, or a quick reminder of what is stored locally in this browser.',
    body: 'Use the Library button to reopen starter scenes, recent saved sessions, and your captured-note storage from one place.',
    eyebrow: 'Library',
    payoff: 'You always have a safe reset point and a fast way back to saved work without digging through Options.',
    target: 'sessions',
    title: 'Starter sessions are always close by.',
  },
  {
    action: 'Use the left rail first when you need to change editing context quickly instead of hunting for the same lane in several panels.',
    body: 'The left rail is your fast route between Compose, Sequencer, Roll, Mix, and Arrange. If you get lost, come back here first.',
    eyebrow: 'Views',
    payoff: 'The app feels much smaller once you treat the rail as the main navigation spine.',
    target: 'views',
    title: 'Move around the studio from the left rail.',
  },
  {
    action: 'Hit Play before editing so you hear the scene, tempo, and balance first. That usually tells you what needs work fastest.',
    body: 'Press Space or click Play. The first gesture wakes audio, so starting playback is the easiest first move.',
    eyebrow: 'Transport',
    payoff: 'Playback is the quickest sanity check for whether you are changing the right thing.',
    target: 'play',
    title: 'Listen before you start editing.',
  },
  {
    action: 'Use the lower strip or A through L to test notes in context without leaving the current screen.',
    body: 'Click the lower strip or use A through L on the keyboard to audition the selected track without leaving the current view.',
    eyebrow: 'Audition',
    payoff: 'It is the fastest way to check pitch ideas while you stay focused on timing, mix, or arrangement.',
    target: 'tap-to-play',
    title: 'Try notes from the lower strip.',
  },
  {
    action: 'Record one clean sound, watch the live note and lane guesses settle, then save the note shelf or apply a match to a track.',
    body: 'Record listens for live pitch, suggests matching lanes, and lets you save captured notes into a reusable shelf. In Options you can tune how quickly capture commits, how many live matches appear, and whether the top match auto-previews.',
    eyebrow: 'Capture',
    payoff: 'Capture is now good for both quick note detection and building a reusable local note library.',
    target: 'record',
    title: 'Capture sounds and turn them into reusable note presets.',
  },
  {
    action: 'Toggle SuperSonic when you want the denser, more surgical editing layer instead of the calmer default studio skin.',
    body: 'SuperSonic flips the studio into the advanced workflow. In Sequencer and Roll you get precision hover ladders, macro lane navigation, faster note targeting, and the ambient wave veil if you want the full alternate skin.',
    eyebrow: 'SuperSonic',
    payoff: 'It is the same session, but with a more aggressive editing posture for faster detailed work.',
    target: 'supersonic',
    title: 'SuperSonic unlocks the more precise editing layer.',
  },
  {
    action: 'Use Share when you want a portable copy or a link. Use the Library when you only need local recall on this device.',
    body: 'Share the exact session with a link, copied JSON, or a session file when you want feedback or need to pick it back up somewhere else.',
    eyebrow: 'Share',
    payoff: 'This keeps browser-local saves and portable exports clearly separate, which is safer.',
    target: 'share',
    title: 'Share the session without bouncing stems.',
  },
  {
    action: 'Use Options for defaults and workflow tuning; use the Library for quick storage and recall.',
    body: 'Options is where the practical controls live now: MIDI import, exports, checkpoints, workspace defaults, SuperSonic wave and guidance settings, plus the upgraded capture controls.',
    eyebrow: 'Options',
    payoff: 'That split keeps setup controls in one place and actual saved creative material in another.',
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
          Use the arrow keys to move between steps. Press Esc to skip. On smaller screens, Show control recenters the highlighted UI before you continue.
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