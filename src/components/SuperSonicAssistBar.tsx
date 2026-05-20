import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, Eraser, Play, Sparkles, Wand2 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { TrackIcon } from '../utils/trackPersonality';

// SuperSonic assist bar.
//
// Only renders while SuperSonic mode is on. It surfaces the highest-value
// one-tap edits for the focused lane — moves that otherwise live buried in
// panels — plus a live insight line that reads the pattern and suggests a
// next move. SuperSonic = "tools and guidance within reach"; Normal mode
// stays calm and the same edits remain available the long way round.
// Toggling between the two is a choice of pace, not a feature gate.

const FLASH_MS = 1100;

export const SuperSonicAssistBar = () => {
  const {
    superSonicMode,
    selectedTrackId,
    tracks,
    currentPattern,
    humanizePattern,
    shiftPattern,
    transposePattern,
    clearTrack,
    previewTrack,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;
  // Start collapsed on phones so the assist bar does not dominate the
  // lower half of the workspace; it expands to its full tool row on tap.
  const [open, setOpen] = useState(() => (
    typeof window === 'undefined' ? true : !window.matchMedia('(max-width: 767px)').matches
  ));
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return undefined;
    const id = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(id);
  }, [flash]);

  // Live read of the focused lane — drives the SuperSonic-only insight line.
  const insight = useMemo(() => {
    if (!track) {
      return null;
    }
    const pattern = track.patterns[currentPattern] ?? [];
    const stepCount = Math.max(1, pattern.length);
    const activeSteps = pattern.filter((step) => step.length > 0).length;
    const noteCount = pattern.reduce((sum, step) => sum + step.length, 0);
    const emptyLanes = tracks.filter((candidate) => {
      const candidatePattern = candidate.patterns[currentPattern];
      return !candidatePattern || candidatePattern.every((step) => step.length === 0);
    }).length;

    let tip: string;
    if (activeSteps === 0) {
      tip = 'This lane is empty — paint a few steps, or capture a part to fill it.';
    } else if (activeSteps / stepCount > 0.7) {
      tip = 'Dense lane — Vary volume keeps a busy pattern from sounding mechanical.';
    } else if (emptyLanes > 0) {
      tip = `${emptyLanes} lane${emptyLanes === 1 ? '' : 's'} still empty — more layers fill the song out.`;
    } else {
      tip = 'Good spread — nudge it with Shift, or try an octave move.';
    }

    return { activeSteps, noteCount, stepCount, tip };
  }, [track, tracks, currentPattern]);

  if (!superSonicMode || !track) {
    return null;
  }

  const isDrum = track.type === 'kick' || track.type === 'snare' || track.type === 'hihat';

  const run = (label: string, action: () => void) => {
    action();
    setFlash(label);
  };

  if (!open) {
    return (
      <button
        aria-label="Show SuperSonic assist tools"
        className="surface-panel md:shrink-0 flex w-full items-center gap-2 px-3 py-2 text-left"
        data-supersonic-assist
        data-ui-sound="tab"
        onClick={() => setOpen(true)}
        style={{ borderTop: '2px solid var(--accent)' }}
        title="Show assist tools"
        type="button"
      >
        <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
        <span className="section-label shrink-0">SuperSonic assist</span>
        {track && (
          <span className="min-w-0 truncate text-[11px] text-[var(--text-secondary)]">
            {track.name}
          </span>
        )}
      </button>
    );
  }

  return (
    <section
      className="surface-panel md:shrink-0 grid gap-2 px-3 py-2"
      data-supersonic-assist
      style={{ borderTop: '2px solid var(--accent)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-label="Hide SuperSonic assist tools"
          className="ghost-icon-button flex h-9 w-9 items-center justify-center md:h-7 md:w-7"
          data-ui-sound="tab"
          onClick={() => setOpen(false)}
          title="Hide assist tools"
          type="button"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="section-label">Assist</span>
        <div
          className="flex h-6 items-center gap-1.5 px-1.5"
          style={{ borderRadius: '2px', border: `1px solid ${track.color}55`, background: `${track.color}1a`, color: track.color }}
        >
          <TrackIcon type={track.type} className="h-3 w-3" />
          <span className="text-[11px] font-medium text-[var(--text-primary)]">{track.name}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <AssistButton
            icon={<Play className="h-3.5 w-3.5 fill-current" />}
            label="Audition"
            title="Play this lane's pattern once so you can hear the latest edit"
            onClick={() => run('Auditioning', () => { void previewTrack(track.id); })}
          />
          <AssistButton
            icon={<Wand2 className="h-3.5 w-3.5" />}
            label="Vary volume"
            title="Add a touch of random loudness to each note so the pattern feels less mechanical"
            onClick={() => run('Volume varied', () => humanizePattern(track.id))}
          />
          <AssistButton
            icon={<ArrowLeftRight className="h-3.5 w-3.5 -scale-x-100" />}
            label="Shift ◀"
            title="Shift the pattern one step earlier"
            onClick={() => run('Shifted left', () => shiftPattern(track.id, 'left'))}
          />
          <AssistButton
            icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
            label="Shift ▶"
            title="Shift the pattern one step later"
            onClick={() => run('Shifted right', () => shiftPattern(track.id, 'right'))}
          />
          {!isDrum && (
            <>
              <AssistButton
                label="Note −"
                title="Transpose the pattern down one semitone"
                onClick={() => run('Down a semitone', () => transposePattern(track.id, -1))}
              />
              <AssistButton
                label="Note +"
                title="Transpose the pattern up one semitone"
                onClick={() => run('Up a semitone', () => transposePattern(track.id, 1))}
              />
              <AssistButton
                label="Oct −"
                title="Transpose the pattern down one octave"
                onClick={() => run('Octave down', () => transposePattern(track.id, -12))}
              />
              <AssistButton
                label="Oct +"
                title="Transpose the pattern up one octave"
                onClick={() => run('Octave up', () => transposePattern(track.id, 12))}
              />
            </>
          )}
          <AssistButton
            icon={<Eraser className="h-3.5 w-3.5" />}
            label="Clear"
            title="Clear every note on this lane's current pattern"
            tone="danger"
            onClick={() => run('Cleared', () => clearTrack(track.id))}
          />
        </div>

        {flash && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {flash}
          </span>
        )}
      </div>

      {insight && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-soft)] pt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            {insight.noteCount} {insight.noteCount === 1 ? 'note' : 'notes'} · {insight.activeSteps}/{insight.stepCount} steps
          </span>
          <span className="min-w-0 flex-1">{insight.tip}</span>
        </div>
      )}
    </section>
  );
};

const AssistButton = ({
  icon,
  label,
  title,
  tone = 'normal',
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  tone?: 'normal' | 'danger';
  onClick: () => void;
}) => (
  <button
    className="control-chip flex min-h-[42px] items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] md:min-h-0 md:px-2.5"
    data-ui-sound="tab"
    onClick={onClick}
    style={tone === 'danger' ? { color: 'var(--danger)' } : undefined}
    title={title}
    type="button"
  >
    {icon}
    {label}
  </button>
);
