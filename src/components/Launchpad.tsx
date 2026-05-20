import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  AudioWaveform,
  BookOpen,
  Coffee,
  Disc3,
  FileInput,
  FolderOpen,
  HardDrive,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  X,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import type { SessionTemplateId } from '../project/schema';
import { loadRecordedNotePresets, subscribeRecordedNotePresets, type RecordedNotePreset } from '../services/recordedNoteLibrary';

const SUPPORT_URL = 'https://buymeacoffee.com/captainarm1';
type LibraryFilterId = 'featured' | 'all' | 'club' | 'hooks' | 'drift' | 'acoustic' | 'clean';

interface LaunchpadProps {
  isInitialized: boolean;
  isOpen: boolean;
  onClose: () => void;
  onImportMidi: () => void;
  onSelectTemplate: (templateId: SessionTemplateId) => void;
  onStartGuide: () => void;
  onTranscribeSong: () => void;
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
  {
    body: 'A chamber sketch — held bass, piano triads, a soft pad bed, and a singing violin line over I-vi-IV-V.',
    focus: 'Strings and piano',
    genre: 'Chamber',
    bpm: 86,
    id: 'velvet-suite',
    label: 'Velvet Suite',
    swatch: ['#e0a86b', '#83c995', '#67e8f9'],
    mark: 'VS',
  },
  {
    body: 'A bright I-IV-V loop — soft kick anchor, piano stabs, wide pad, and a bell sparkling on the offbeats.',
    focus: 'Bell-led sparkle',
    genre: 'Sparkle',
    bpm: 92,
    id: 'crystal-garden',
    label: 'Crystal Garden',
    swatch: ['#b9c2da', '#83c995', '#67e8f9'],
    mark: 'CG',
  },
];

const FEATURED_IDS: SessionTemplateId[] = ['night-transit', 'club-horizon', 'starlight-parade', 'velvet-suite', 'lofi-sunday'];

const LIBRARY_FILTERS: Array<{ id: LibraryFilterId; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'all', label: 'All scenes' },
  { id: 'club', label: 'Club' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'drift', label: 'Drift' },
  { id: 'acoustic', label: 'Acoustic' },
  { id: 'clean', label: 'Clean start' },
];

const matchesLibraryFilter = (option: StartOption, filterId: LibraryFilterId) => {
  switch (filterId) {
    case 'featured':
      return FEATURED_IDS.includes(option.id);
    case 'club':
      return option.id === 'club-horizon' || option.id === 'beat-lab';
    case 'hooks':
      return option.id === 'night-transit' || option.id === 'starlight-parade' || option.id === 'synthwave-drive' || option.id === 'crystal-garden';
    case 'drift':
      return option.id === 'lofi-sunday' || option.id === 'ambient-drift' || option.id === 'velvet-suite';
    case 'acoustic':
      return option.id === 'velvet-suite' || option.id === 'crystal-garden';
    case 'clean':
      return option.id === 'blank-grid';
    case 'all':
    default:
      return true;
  }
};

const matchesLibraryQuery = (option: StartOption, query: string) => {
  if (!query) {
    return true;
  }

  const haystack = `${option.label} ${option.genre} ${option.focus} ${option.body} ${option.bpm}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
};

const formatStoredRelative = (iso: string) => {
  try {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) {
      return iso;
    }
    const diff = Date.now() - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) {
      return 'just now';
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 30) {
      return `${days}d ago`;
    }
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

export const Launchpad = ({
  isInitialized,
  isOpen,
  onClose,
  onImportMidi,
  onSelectTemplate,
  onStartGuide,
  onTranscribeSong,
  onWakeAudio,
}: LaunchpadProps) => {
  const {
    loadScoresheet,
    projectName,
    saveScoresheet,
    saveStatus,
    scoresheets,
  } = useAudio();
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilterId>('featured');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [recordedNotes, setRecordedNotes] = useState<RecordedNotePreset[]>([]);
  const [scoresheetDraft, setScoresheetDraft] = useState(projectName);
  const [storageFlash, setStorageFlash] = useState<'saved' | null>(null);
  const recommended = useMemo(
    () => START_OPTIONS.find((option) => option.id === 'night-transit') ?? START_OPTIONS[0],
    [],
  );
  const blankGrid = useMemo(
    () => START_OPTIONS.find((option) => option.id === 'blank-grid') ?? START_OPTIONS.at(-1) ?? START_OPTIONS[0],
    [],
  );
  const visibleOptions = useMemo(
    () => START_OPTIONS.filter((option) => matchesLibraryFilter(option, libraryFilter) && matchesLibraryQuery(option, libraryQuery)),
    [libraryFilter, libraryQuery],
  );
  const recentScoresheets = useMemo(() => scoresheets.slice(0, 4), [scoresheets]);
  const recentRecordedNotes = useMemo(() => recordedNotes.slice(0, 4), [recordedNotes]);
  const autosaveLabel = saveStatus === 'saving'
    ? 'Autosaving now'
    : saveStatus === 'error'
      ? 'Save attention'
      : 'Autosave ready';

  useEffect(() => {
    setScoresheetDraft(projectName);
  }, [projectName]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    setRecordedNotes(loadRecordedNotePresets());
    return subscribeRecordedNotePresets(setRecordedNotes);
  }, [isOpen]);

  useEffect(() => {
    if (!storageFlash) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setStorageFlash(null), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [storageFlash]);

  const surpriseMe = () => {
    const eligible = START_OPTIONS.filter((option) => option.id !== 'blank-grid');
    const choice = eligible[Math.floor(Math.random() * eligible.length)];
    onSelectTemplate(choice.id);
  };

  const saveCurrentSnapshot = () => {
    const nextName = scoresheetDraft.trim();
    if (!nextName) {
      return;
    }

    saveScoresheet(nextName);
    setStorageFlash('saved');
  };

  const openScoresheetFromLibrary = (id: string) => {
    loadScoresheet(id);
    onClose();
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
              Pick a starting point and get moving.
            </h1>
            <p className="mt-5 max-w-[60ch] text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
              Open a full scene to hear ideas right away, or choose Blank Grid and build it up one lane at a time.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <PrimaryStartCard
              badge="Featured scene"
              body="Loads a complete scene with clips, lane parts, and a ready-to-go mix."
              eyebrow={`${recommended.genre} · ${recommended.bpm} BPM`}
              mark={recommended.mark}
              onClick={() => onSelectTemplate(recommended.id)}
              swatch={recommended.swatch}
              title={recommended.label}
            />

            <div className="grid gap-3">
              <SecondaryStartCard
                actionLabel="Start blank"
                body="Starts clean with the core lanes set up and no extra material." 
                mark={blankGrid.mark}
                onClick={() => onSelectTemplate(blankGrid.id)}
                swatch={blankGrid.swatch}
                title={blankGrid.label}
              />
              <SecondaryStartCard
                actionLabel="Choose MIDI"
                body="Import a MIDI file and begin editing right away."
                icon={<FileInput className="h-4 w-4" />}
                onClick={onImportMidi}
                title="Import MIDI"
              />
              <SecondaryStartCard
                actionLabel="Transcribe audio"
                body="Hum, sing, or upload a song. The studio writes the melody onto the grid."
                icon={<AudioWaveform className="h-4 w-4" />}
                onClick={onTranscribeSong}
                title="Transcribe a song"
              />
              <SecondaryStartCard
                actionLabel="Start tour"
                body="Open Song view and walk through the main controls first."
                icon={<Sparkles className="h-4 w-4" />}
                onClick={onStartGuide}
                title="Take the tour"
              />
            </div>
          </div>

          <section className="surface-panel-strong launch-session-stack px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="section-label">Scene browser</div>
                <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                  Search by mood, name, or BPM to quickly find a scene that fits.
                </div>
              </div>
              <button
                className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                data-ui-sound="tab"
                onClick={surpriseMe}
                title="Pick a random starter scene"
                type="button"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Surprise me
              </button>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <label className="grid gap-2">
                <span className="section-label">Search scenes</span>
                <div className="launchpad-search-row">
                  <Search className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <input
                    className="control-field h-10 w-full border-0 bg-transparent px-0 text-[13px] text-[var(--text-primary)] focus:outline-none"
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder="Search name, feel, or BPM"
                    value={libraryQuery}
                  />
                </div>
              </label>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                {LIBRARY_FILTERS.map((filter) => (
                  <button
                    className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-active={libraryFilter === filter.id}
                    data-ui-sound="tab"
                    key={filter.id}
                    onClick={() => setLibraryFilter(filter.id)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-3 text-[11px] leading-5 text-[var(--text-secondary)]">
              <span>
                {visibleOptions.length} {visibleOptions.length === 1 ? 'scene' : 'scenes'} match the current browser.
              </span>
              {libraryQuery ? (
                <button
                  className="control-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  data-ui-sound="tab"
                  onClick={() => setLibraryQuery('')}
                  type="button"
                >
                  Clear search
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2">
              {visibleOptions.length > 0 ? visibleOptions.map((option) => (
                <TemplateCard key={option.id} option={option} onSelect={onSelectTemplate} highlight={option.id === recommended.id} />
              )) : (
                <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[12px] leading-6 text-[var(--text-secondary)]">
                  No scenes match that search yet. Try a broader term like house, ambient, pop, or a BPM like 110.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="surface-panel-strong px-4 py-4">
          <div className="section-label">Quick start</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <LaunchStat label="Scenes" value={String(START_OPTIONS.length)} />
            <LaunchStat label="Scoresheets" value={String(scoresheets.length)} />
            <LaunchStat label="Captured" value={String(recordedNotes.length)} />
            <LaunchStat label="Export" value="WAV MIDI" />
          </div>

          <div className="mt-5 grid gap-3 border-t border-[var(--border-soft)] pt-4">
            <LaunchPathStep
              body="Open a scene to hear a complete arrangement right away."
              step="01"
              title="Open a scene"
            />
            <LaunchPathStep
              body="Press Play or Space. Audio wakes on first input, so you can start immediately."
              step="02"
              title="Hit play"
            />
            <LaunchPathStep
              body="Switch between Song, Notes, Mix, and Compose based on what you want to adjust next."
              step="03"
              title="Change one part"
            />
          </div>

          <section className="mt-5 grid gap-3 border-t border-[var(--border-soft)] pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                  <span className="section-label">Library storage</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Scenes, saved scoresheets, and captured notes are all kept here, so it is easy to pick up where you left off.
                </p>
              </div>
              <span className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                {autosaveLabel}
              </span>
            </div>

            <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <HardDrive className="h-4 w-4 text-[var(--accent)]" />
                <span className="section-label">Store current session</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                Save a local snapshot of the current session, arrangement, mix, and sounds before switching scenes.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-1">
                <input
                  aria-label="Scoresheet name"
                  className="control-field h-10 px-3 text-sm"
                  onChange={(event) => setScoresheetDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      saveCurrentSnapshot();
                    }
                  }}
                  placeholder="Name this saved session"
                  value={scoresheetDraft}
                />
                <button
                  className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  data-active={storageFlash === 'saved' ? 'true' : 'false'}
                  data-ui-sound="action"
                  disabled={!scoresheetDraft.trim()}
                  onClick={saveCurrentSnapshot}
                  type="button"
                >
                  {storageFlash === 'saved' ? <BookOpen className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {storageFlash === 'saved' ? 'Stored' : 'Store current'}
                </button>
              </div>
            </div>

            <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="section-label">Saved scoresheets</div>
                  <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                    Full browser-local snapshots you can reopen directly from the Library.
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  {scoresheets.length} stored
                </span>
              </div>

              {recentScoresheets.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {recentScoresheets.map((sheet) => (
                    <button
                      className="flex items-center justify-between gap-3 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                      data-ui-sound="nav"
                      key={sheet.id}
                      onClick={() => openScoresheetFromLibrary(sheet.id)}
                      type="button"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{sheet.name}</div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          Saved {formatStoredRelative(sheet.savedAt)}
                        </div>
                      </div>
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                  No scoresheets yet. Save the current session once and it will be ready in Library for quick recall.
                </div>
              )}
            </div>

            <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
              <div className="section-label">Captured note library</div>
              <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                Capture saves are local too. Your newest saved notes appear here, not just starter scenes.
              </div>
              {recentRecordedNotes.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recentRecordedNotes.map((note) => (
                    <div
                      className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2.5 py-2"
                      key={note.id}
                    >
                      <div className="text-[11px] font-semibold text-[var(--text-primary)]">{note.name}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        {note.note} · {note.trackType}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                  No saved capture notes yet. Record a few notes in Capture and they will show up here next time.
                </div>
              )}
            </div>
          </section>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border-soft)] pt-4">
            {isInitialized ? (
              <span
                className="status-chip inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
                data-tone="ready"
              >
                Audio ready
              </span>
            ) : (
              <button
                className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
                data-ui-sound="transport"
                onClick={onWakeAudio}
                type="button"
              >
                Turn on audio
              </button>
            )}
            <button
              className="control-chip px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              data-ui-sound="nav"
              onClick={onClose}
              type="button"
            >
              Back to studio
            </button>
            <a
              className="control-chip inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              data-ui-sound="action"
              href={SUPPORT_URL}
              rel="noreferrer noopener"
              target="_blank"
            >
              <Coffee className="h-4 w-4" />
              Buy me a coffee
            </a>
          </div>
          <div className="mt-4 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-[12px] leading-5 text-[var(--text-secondary)]">
            SonicStudio is staying free for most people. If it helps your workflow, the support button above goes to Buy Me a Coffee.
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
    className="launchpad-template-card session-card group relative grid gap-2 overflow-hidden px-4 py-3 text-left transition-colors"
    data-highlight={highlight ? 'true' : 'false'}
    data-ui-sound="nav"
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
