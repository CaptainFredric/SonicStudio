import React, { useMemo } from 'react';
import {
  ArrowRight,
  Coffee,
  Disc3,
  FileInput,
  Shuffle,
  Sparkles,
  X,
} from 'lucide-react';

import type { SessionTemplateId } from '../project/schema';

const SUPPORT_URL = 'https://buymeacoffee.com/captainarm1';

interface LaunchpadProps {
  isInitialized: boolean;
  isOpen: boolean;
  onClose: () => void;
  onImportMidi: () => void;
  onSelectTemplate: (templateId: SessionTemplateId) => void;
  onStartGuide: () => void;
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
  mark: string;
}

const START_OPTIONS: StartOption[] = [
  {
    body: 'A full song with drums, bass, lead, pads, and mix moves already in place.',
    focus: 'Full arrangement',
    genre: 'Synth pop',
    bpm: 112,
    id: 'night-transit',
    label: 'Night Transit',
    swatch: ['#7dd3fc', '#67e8f9', '#c084fc'],
    mark: 'NT',
  },
  {
    body: 'Driving pulse, sidechained bass, glassy lead, and wide late-night pads.',
    focus: '80s synthwave',
    genre: '80s synthwave',
    bpm: 108,
    id: 'synthwave-drive',
    label: 'Synthwave Drive',
    swatch: ['#fb7185', '#c084fc', '#7dd3fc'],
    mark: 'SD',
  },
  {
    body: 'Club kick, pluck stabs, a pumping bass lane, and a lift FX track already in motion.',
    focus: 'Club lift and stabs',
    genre: 'House pulse',
    bpm: 122,
    id: 'club-horizon',
    label: 'Club Horizon',
    swatch: ['#fb7185', '#ef4444', '#f59e0b'],
    mark: 'CH',
  },
  {
    body: 'Bright pop drums, glossy lead hooks, and a counter-pluck for fast topline writing.',
    focus: 'Bright pop motion',
    genre: 'Pop shimmer',
    bpm: 110,
    id: 'starlight-parade',
    label: 'Starlight Parade',
    swatch: ['#7dd3fc', '#f472b6', '#fbbf24'],
    mark: 'SP',
  },
  {
    body: 'Loose drums, soft chords, and plenty of room for melody at 78 BPM.',
    focus: 'Lo-fi hip hop',
    genre: 'Lo-fi',
    bpm: 78,
    id: 'lofi-sunday',
    label: 'Lo-Fi Sunday',
    swatch: ['#fbbf24', '#fb923c', '#67e8f9'],
    mark: 'LS',
  },
  {
    body: 'Sample drums, walking bass, and a few risers for loop-first writing.',
    focus: 'Beat-first',
    genre: 'Hip-hop beat',
    bpm: 136,
    id: 'beat-lab',
    label: 'Beat Lab',
    swatch: ['#f87171', '#fb923c', '#fbbf24'],
    mark: 'BL',
  },
  {
    body: 'Wide pads, slow phrases, and lots of space for sketching.',
    focus: 'Atmosphere',
    genre: 'Ambient',
    bpm: 94,
    id: 'ambient-drift',
    label: 'Ambient Drift',
    swatch: ['#67e8f9', '#60a5fa', '#c084fc'],
    mark: 'AD',
  },
  {
    body: 'A cleaner grid with drums, bass, lead, and pad lanes ready to sketch on immediately.',
    focus: 'Start blank',
    genre: 'Blank canvas',
    bpm: 120,
    id: 'blank-grid',
    label: 'Blank Grid',
    swatch: ['#9eb3c8', '#74899e', '#9eb3c8'],
    mark: 'BG',
  },
];

const FEATURED_IDS: SessionTemplateId[] = ['night-transit', 'club-horizon', 'starlight-parade', 'lofi-sunday'];

export const Launchpad = ({
  isInitialized,
  isOpen,
  onClose,
  onImportMidi,
  onSelectTemplate,
  onStartGuide,
  onWakeAudio,
}: LaunchpadProps) => {
  const recommended = useMemo(
    () => START_OPTIONS.find((option) => option.id === 'night-transit') ?? START_OPTIONS[0],
    [],
  );
  const blankGrid = useMemo(
    () => START_OPTIONS.find((option) => option.id === 'blank-grid') ?? START_OPTIONS.at(-1) ?? START_OPTIONS[0],
    [],
  );
  const more = useMemo(
    () => START_OPTIONS.filter((option) => option.id !== recommended.id && option.id !== blankGrid.id),
    [blankGrid.id, recommended.id],
  );
  const featured = useMemo(
    () => START_OPTIONS.filter((option) => FEATURED_IDS.includes(option.id)),
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
    <section className="launchpad-panel mx-auto grid max-w-[1240px] gap-7 border border-[var(--border-strong)] px-5 py-6 md:min-h-[calc(100vh-1.5rem)] md:px-8 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--accent-strong)]">
          <Disc3 className="h-4 w-4" />
          <span className="section-label text-[var(--accent-strong)]">Get started</span>
        </div>
        <button
          aria-label="Close launchpad"
          className="ghost-icon-button flex h-9 w-9 items-center justify-center"
          onClick={onClose}
          title="Close"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.08fr)_360px] xl:items-start">
        <div className="min-w-0 grid gap-6">
          <div className="border-b border-[var(--border-soft)] pb-5">
            <div className="section-label text-[var(--accent-strong)]">Start here</div>
            <h1 className="mt-3 max-w-[11ch] text-[clamp(2.35rem,5vw,4.7rem)] font-semibold leading-[0.92] tracking-[-0.06em]">
              Start with something you can hear right away.
            </h1>
            <p className="mt-5 max-w-[60ch] text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
              Night Transit opens with a full song, so you can hear how everything fits together. Blank Grid is there if you'd rather start from scratch.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <PrimaryStartCard
              badge="Good place to start"
              body="Open a full demo with clips, lanes, and mix moves already set up."
              eyebrow={`${recommended.genre} · ${recommended.bpm} BPM`}
              mark={recommended.mark}
              onClick={() => onSelectTemplate(recommended.id)}
              swatch={recommended.swatch}
              title={recommended.label}
            />

            <div className="grid gap-3">
              <SecondaryStartCard
                actionLabel="Start blank"
                body="Start clean with the core lanes in place and nothing in the way."
                mark={blankGrid.mark}
                onClick={() => onSelectTemplate(blankGrid.id)}
                swatch={blankGrid.swatch}
                title={blankGrid.label}
              />
              <SecondaryStartCard
                actionLabel="Choose MIDI"
                body="Bring in a MIDI file and start editing right away."
                icon={<FileInput className="h-4 w-4" />}
                onClick={onImportMidi}
                title="Import MIDI"
              />
              <SecondaryStartCard
                actionLabel="Start tour"
                body="Open Night Transit in Song view and walk through the basics first."
                icon={<Sparkles className="h-4 w-4" />}
                onClick={onStartGuide}
                title="Take the tour"
              />
            </div>
          </div>

          <section className="surface-panel-strong launch-session-stack px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="section-label">More starting points</div>
                <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                  Jump to a different starting point any time.
                </div>
              </div>
              <button
                className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                onClick={surpriseMe}
                title="Pick a random starter scene"
                type="button"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Surprise me
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {featured.map((option) => (
                <TemplateCard key={option.id} option={option} onSelect={onSelectTemplate} highlight={option.id === recommended.id} />
              ))}
              {more.filter((option) => !FEATURED_IDS.includes(option.id)).map((option) => (
                <TemplateCard key={option.id} option={option} onSelect={onSelectTemplate} />
              ))}
            </div>
          </section>
        </div>

        <aside className="surface-panel-strong px-4 py-4">
          <div className="section-label">Quick start</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <LaunchStat label="Scenes" value={String(START_OPTIONS.length)} />
            <LaunchStat label="Saved" value="Local" />
            <LaunchStat label="Export" value="WAV MIDI" />
          </div>

          <div className="mt-5 grid gap-3 border-t border-[var(--border-soft)] pt-4">
            <LaunchPathStep
              body="Start with Night Transit if you want to hear a full arrangement right away."
              step="01"
              title="Open a scene"
            />
            <LaunchPathStep
              body="Press Play or Space. Audio wakes up on the first input, so there isn't a separate unlock step."
              step="02"
              title="Hit play"
            />
            <LaunchPathStep
              body="Switch between Song, Notes, Mix, and Compose depending on what you want to change next."
              step="03"
              title="Change one part"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border-soft)] pt-4">
            {isInitialized ? (
              <span
                className="status-chip inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
                data-tone="ready"
              >
                Audio on
              </span>
            ) : (
              <button
                className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
                onClick={onWakeAudio}
                type="button"
              >
                Turn on audio
              </button>
            )}
            <button
              className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              onClick={onClose}
              type="button"
            >
              Back to studio
            </button>
            <a
              className="control-chip inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              href={SUPPORT_URL}
              rel="noreferrer noopener"
              target="_blank"
            >
              <Coffee className="h-4 w-4" />
              Buy me a coffee
            </a>
          </div>
          <div className="mt-4 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-[12px] leading-5 text-[var(--text-secondary)]">
            SonicStudio is staying broadly free. If it earns a place in your workflow, the support button above goes straight to Buy Me a Coffee.
          </div>
        </aside>
      </div>
    </section>
  );
};

const PrimaryStartCard = ({
  badge,
  body,
  eyebrow,
  mark,
  onClick,
  swatch,
  title,
}: {
  badge: string;
  body: string;
  eyebrow: string;
  mark: string;
  onClick: () => void;
  swatch: [string, string, string];
  title: string;
}) => (
  <button
    className="launchpad-primary-card group text-left"
    onClick={onClick}
    type="button"
  >
    <span className="launchpad-primary-line" style={{ background: `linear-gradient(90deg, ${swatch[0]}, ${swatch[1]}, ${swatch[2]})` }} />
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="section-label text-[var(--accent-strong)]">{badge}</div>
        <h2 className="mt-3 text-[28px] leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]">{title}</h2>
        <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--accent)]">{eyebrow}</div>
      </div>
      <span
        className="launchpad-mark-box"
        style={{
          background: `${swatch[0]}14`,
          borderColor: `${swatch[0]}55`,
        }}
      >
        {mark}
      </span>
    </div>
    <p className="mt-4 max-w-[46ch] text-[13px] leading-6 text-[var(--text-secondary)]">{body}</p>
    <div className="mt-5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
      <span>Open now</span>
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </div>
  </button>
);

const SecondaryStartCard = ({
  actionLabel,
  body,
  icon,
  mark,
  onClick,
  swatch,
  title,
}: {
  actionLabel: string;
  body: string;
  icon?: React.ReactNode;
  mark?: string;
  onClick: () => void;
  swatch?: [string, string, string];
  title: string;
}) => (
  <button
    className="launchpad-secondary-card group text-left"
    onClick={onClick}
    type="button"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="launchpad-mark-box mt-0.5"
          style={swatch ? {
            background: `${swatch[0]}14`,
            borderColor: `${swatch[0]}55`,
          } : undefined}
        >
          {icon ?? mark}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
          <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{body}</div>
        </div>
      </div>
      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)]" />
    </div>
    <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">{actionLabel}</div>
  </button>
);

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
    className="session-card group relative grid gap-2 overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.018)] px-4 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.3)] hover:bg-[rgba(114,217,255,0.05)]"
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
          className="launchpad-mark-box"
          style={{
            background: `${option.swatch[0]}14`,
            borderColor: `${option.swatch[0]}55`,
          }}
        >
          <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-[var(--text-primary)]">{option.mark}</span>
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
        Open
      </span>
    </div>
    <div className="text-[12px] leading-5 text-[var(--text-secondary)]">{option.body}</div>
  </button>
);

const LaunchPathStep = ({
  body,
  step,
  title,
}: {
  body: string;
  step: string;
  title: string;
}) => (
  <div className="launchpad-step-row">
    <span className="launchpad-step-index">{step}</span>
    <div>
      <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{body}</div>
    </div>
  </div>
);

const LaunchStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="launch-stat border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
    <div className="section-label">{label}</div>
    <div className="mt-2 font-mono text-sm font-semibold tracking-[0.08em] text-[var(--text-primary)]">{value}</div>
  </div>
);
