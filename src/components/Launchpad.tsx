import React from 'react';
import {
  Disc3,
  Drum,
  FileInput,
  Music2,
  Play,
  Sparkles,
  Waves,
} from 'lucide-react';

import type { SessionTemplateId } from '../project/schema';

interface LaunchpadProps {
  isInitialized: boolean;
  isOpen: boolean;
  onClose: () => void;
  onImportMidi: () => void;
  onSelectTemplate: (templateId: SessionTemplateId) => void;
  onWakeAudio: () => void;
}

const START_OPTIONS: Array<{
  body: string;
  focus: string;
  icon: React.ReactNode;
  id: SessionTemplateId;
  label: string;
}> = [
  {
    body: 'Open a shaped arrangement with drums, bass, lead, and pads already moving.',
    focus: 'Hear a finished idea',
    icon: <Play className="h-4 w-4" />,
    id: 'night-transit',
    label: 'Night Transit',
  },
  {
    body: 'Start from a tighter drum and bass scene built for loop writing and quick edits.',
    focus: 'Build a beat',
    icon: <Drum className="h-4 w-4" />,
    id: 'beat-lab',
    label: 'Beat Lab',
  },
  {
    body: 'Enter a minimal desk with only the core lanes most sessions need first.',
    focus: 'Start blank',
    icon: <Music2 className="h-4 w-4" />,
    id: 'blank-grid',
    label: 'Blank Grid',
  },
  {
    body: 'Open a wider harmonic scene for pads, motion, and slower phrase work.',
    focus: 'Write atmosphere',
    icon: <Waves className="h-4 w-4" />,
    id: 'ambient-drift',
    label: 'Ambient Drift',
  },
];

export const Launchpad = ({
  isInitialized,
  isOpen,
  onClose,
  onImportMidi,
  onSelectTemplate,
  onWakeAudio,
}: LaunchpadProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="showcase-gradient-panel grid gap-6 border border-[var(--border-strong)] px-5 py-5 md:grid-cols-[1.2fr_0.8fr] md:px-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[var(--accent-strong)]">
          <Disc3 className="h-4 w-4" />
          <span className="section-label text-[var(--accent-strong)]">Launchpad</span>
        </div>
        <h1 className="mt-4 max-w-[11ch] text-[clamp(2rem,4vw,3.8rem)] leading-[0.94]">
          Start by hearing something real.
        </h1>
        <p className="mt-4 max-w-[58ch] text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
          First time users should see one clear choice surface. Hear a finished sketch, build a beat,
          start from a stripped desk, or bring in MIDI from somewhere else.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            data-active={isInitialized}
            onClick={onWakeAudio}
            type="button"
          >
            {isInitialized ? 'Audio awake' : 'Wake audio'}
          </button>
          <button
            className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            onClick={onImportMidi}
            type="button"
          >
            Import MIDI
          </button>
          <button
            className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            onClick={onClose}
            type="button"
          >
            Skip to studio
          </button>
        </div>
      </div>

      <div className="surface-panel-strong overflow-hidden px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-label">Quick starts</div>
            <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
              Choose one path and land in the right view.
            </div>
          </div>
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        </div>
        <div className="mt-4 grid gap-2">
          {START_OPTIONS.map((option) => (
            <button
              key={option.id}
              className="group grid gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.018)] px-4 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.3)] hover:bg-[rgba(114,217,255,0.05)]"
              onClick={() => onSelectTemplate(option.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] text-[var(--accent-strong)]">
                    {option.icon}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{option.label}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">
                      {option.focus}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]">
                  Open
                </span>
              </div>
              <div className="text-[12px] leading-5 text-[var(--text-secondary)]">{option.body}</div>
            </button>
          ))}
          <button
            className="group flex items-center justify-between gap-3 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.012)] px-4 py-3 text-left transition-colors hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.03)]"
            onClick={onImportMidi}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] text-[var(--warning)]">
                <FileInput className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Import a MIDI file</div>
                <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                  Bring an outside sketch into SonicStudio and keep working here.
                </div>
              </div>
            </div>
            <span className="text-xs text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]">
              Browse
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
