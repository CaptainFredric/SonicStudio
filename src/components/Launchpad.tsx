import React, { useMemo } from 'react';
import {
  Disc3,
  FileInput,
  Hand,
  Shuffle,
  Sparkles,
  X,
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

interface StartOption {
  body: string;
  focus: string;
  genre: string;
  bpm: number;
  id: SessionTemplateId;
  label: string;
  swatch: [string, string, string];
  emoji: string;
}

const START_OPTIONS: StartOption[] = [
  {
    body: 'A finished song you can play right away. Drums, bass, lead, and pads already in motion.',
    focus: 'Full arrangement',
    genre: 'Synth pop',
    bpm: 112,
    id: 'night-transit',
    label: 'Night Transit',
    swatch: ['#7dd3fc', '#67e8f9', '#c084fc'],
    emoji: '🌃',
  },
  {
    body: 'Four-on-the-floor kick, syncopated bass, melodic lead, and a wide pad underneath.',
    focus: '80s synthwave',
    genre: '80s synthwave',
    bpm: 108,
    id: 'synthwave-drive',
    label: 'Synthwave Drive',
    swatch: ['#fb7185', '#c084fc', '#7dd3fc'],
    emoji: '🌆',
  },
  {
    body: 'Slow drums, soft chords, a sparse lead line. 78 BPM, easy to start writing over.',
    focus: 'Lo-fi hip hop',
    genre: 'Lo-fi',
    bpm: 78,
    id: 'lofi-sunday',
    label: 'Lo-Fi Sunday',
    swatch: ['#fbbf24', '#fb923c', '#67e8f9'],
    emoji: '☕',
  },
  {
    body: 'Sample-driven drums, walking bass, and an FX riser. Built for loop work.',
    focus: 'Beat-first',
    genre: 'Hip-hop beat',
    bpm: 136,
    id: 'beat-lab',
    label: 'Beat Lab',
    swatch: ['#f87171', '#fb923c', '#fbbf24'],
    emoji: '🥁',
  },
  {
    body: 'Wide pads and slow phrases. Good for ambient writing or scoring sketches.',
    focus: 'Atmosphere',
    genre: 'Ambient',
    bpm: 94,
    id: 'ambient-drift',
    label: 'Ambient Drift',
    swatch: ['#67e8f9', '#60a5fa', '#c084fc'],
    emoji: '🌫️',
  },
  {
    body: 'Just kick, bass, and lead. Start from scratch.',
    focus: 'Start blank',
    genre: 'Blank canvas',
    bpm: 120,
    id: 'blank-grid',
    label: 'Blank Grid',
    swatch: ['#9eb3c8', '#74899e', '#9eb3c8'],
    emoji: '◻️',
  },
];

const FEATURED_IDS: SessionTemplateId[] = ['night-transit', 'synthwave-drive', 'lofi-sunday'];

export const Launchpad = ({
  isInitialized,
  isOpen,
  onClose,
  onImportMidi,
  onSelectTemplate,
  onWakeAudio,
}: LaunchpadProps) => {
  const featured = useMemo(
    () => START_OPTIONS.filter((option) => FEATURED_IDS.includes(option.id)),
    [],
  );
  const more = useMemo(
    () => START_OPTIONS.filter((option) => !FEATURED_IDS.includes(option.id)),
    [],
  );

  const surpriseMe = () => {
    const eligible = START_OPTIONS.filter((option) => option.id !== 'blank-grid');
    const choice = eligible[Math.floor(Math.random() * eligible.length)];
    onSelectTemplate(choice.id);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <section className="launchpad-panel mx-auto grid max-w-[1240px] gap-6 border border-[var(--border-strong)] px-5 py-6 md:min-h-[calc(100vh-1.5rem)] md:px-8 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--accent-strong)]">
          <Disc3 className="h-4 w-4" />
          <span className="section-label text-[var(--accent-strong)]">Launchpad</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Press <kbd className="font-mono text-[10px] text-[var(--text-secondary)]">Esc</kbd> to close
          </span>
          <button
            aria-label="Close launchpad"
            className="ghost-icon-button flex h-9 w-9 items-center justify-center"
            onClick={onClose}
            title="Close (Esc)"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-start">
        <div className="min-w-0">
          <h1 className="max-w-[14ch] text-[clamp(2.1rem,4.4vw,4rem)] font-semibold leading-[0.96] tracking-tight">
            Open a session.
          </h1>
          <p className="mt-5 max-w-[58ch] text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
            Each starter loads a working song with drums, bass, lead, and pad
            already arranged. Press play to hear it, then edit anything. You
            can also import a MIDI file or open a blank session.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              data-active={isInitialized}
              onClick={onWakeAudio}
              type="button"
            >
              {isInitialized ? 'Audio armed' : 'Arm audio'}
            </button>
            <button
              className="control-chip flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              onClick={surpriseMe}
              type="button"
              title="Pick a random starter"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Surprise me
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

          <div className="mt-6 flex items-center gap-2 rounded-sm border border-[var(--border-soft)] bg-[rgba(114,217,255,0.04)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            <Hand className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Tip: once a session is loaded, open the tap-to-play strip and use <span className="font-mono text-[11px] text-[var(--text-primary)]">A</span>–<span className="font-mono text-[11px] text-[var(--text-primary)]">L</span> to play the selected track from your keyboard.</span>
          </div>
        </div>

        <div className="surface-panel-strong px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="section-label">Starter sessions</div>
              <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                Pick one to open the studio with a song already in it.
              </div>
            </div>
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          </div>

          <div className="mt-4 grid gap-2">
            {featured.map((option) => (
              <TemplateCard key={option.id} option={option} onSelect={onSelectTemplate} highlight />
            ))}
          </div>

          <div className="section-label mt-5">More</div>
          <div className="mt-2 grid gap-2">
            {more.map((option) => (
              <TemplateCard key={option.id} option={option} onSelect={onSelectTemplate} />
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
                    Open a MIDI file and continue editing it here.
                  </div>
                </div>
              </div>
              <span className="text-xs text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]">
                Browse
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

interface TemplateCardProps {
  option: StartOption;
  onSelect: (id: SessionTemplateId) => void;
  highlight?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  option,
  onSelect,
  highlight = false,
}) => (
  <button
    className="group relative grid gap-2 overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.018)] px-4 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.3)] hover:bg-[rgba(114,217,255,0.05)]"
    onClick={() => onSelect(option.id)}
    type="button"
  >
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 h-[3px]"
      style={{
        background: `linear-gradient(90deg, ${option.swatch[0]}, ${option.swatch[1]}, ${option.swatch[2]})`,
        opacity: highlight ? 0.92 : 0.6,
      }}
    />
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center border text-base"
          style={{
            background: `${option.swatch[0]}14`,
            borderColor: `${option.swatch[0]}55`,
            borderRadius: '2px',
          }}
        >
          {option.emoji}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{option.label}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--accent)]">
            <span>{option.genre}</span>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{option.bpm} BPM</span>
          </div>
        </div>
      </div>
      <span className="text-xs text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]">
        Open →
      </span>
    </div>
    <div className="text-[12px] leading-5 text-[var(--text-secondary)]">{option.body}</div>
  </button>
);
