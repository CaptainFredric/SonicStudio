import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, Eraser, Sparkles, Wand2 } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { TrackIcon } from '../utils/trackPersonality';

// SuperSonic assist bar.
//
// Only renders while SuperSonic mode is on. It surfaces the highest-value
// one-tap edits for the focused lane — moves that otherwise live buried in
// panels. SuperSonic = "tools within reach"; Normal mode stays calm and the
// same edits remain available the long way round. Toggling between the two
// is a choice of pace, not a feature gate.

const FLASH_MS = 1100;

export const SuperSonicAssistBar = () => {
  const {
    superSonicMode,
    selectedTrackId,
    tracks,
    humanizePattern,
    shiftPattern,
    transposePattern,
    clearTrack,
  } = useAudio();
  const track = tracks.find((candidate) => candidate.id === selectedTrackId) ?? null;
  const [open, setOpen] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return undefined;
    const id = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(id);
  }, [flash]);

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
      <section className="surface-panel md:shrink-0 flex items-center gap-2 px-3 py-1.5" data-supersonic-assist>
        <button
          aria-label="Show SuperSonic assist tools"
          className="ghost-icon-button flex h-7 w-7 items-center justify-center"
          onClick={() => setOpen(true)}
          title="Show assist tools"
          type="button"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="section-label">SuperSonic assist</span>
        <span className="hidden sm:inline text-[11px] text-[var(--text-secondary)]">One-tap edits for the focused lane.</span>
      </section>
    );
  }

  return (
    <section
      className="surface-panel md:shrink-0 flex flex-wrap items-center gap-2 px-3 py-2"
      data-supersonic-assist
    >
      <button
        aria-label="Hide SuperSonic assist tools"
        className="ghost-icon-button flex h-7 w-7 items-center justify-center"
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
    className="control-chip flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
    onClick={onClick}
    style={tone === 'danger' ? { color: 'var(--danger)' } : undefined}
    title={title}
    type="button"
  >
    {icon}
    {label}
  </button>
);
