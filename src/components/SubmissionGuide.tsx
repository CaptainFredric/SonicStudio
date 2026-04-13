import React from 'react';
import {
  AudioLines,
  CheckCircle2,
  Layers3,
  Music4,
  Play,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';

interface SubmissionGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const capabilityCards = [
  {
    body: 'Sequencer, piano roll, arranger, mixer, and sound desk all share the same project state so song work does not fall apart between views.',
    icon: <Music4 className="h-4 w-4 text-[var(--accent)]" />,
    title: 'One studio surface',
  },
  {
    body: 'Synth lanes, sample lanes, slice triggering, voice starts, and per-track shaping make it usable for beats, sketches, and textured ideas.',
    icon: <AudioLines className="h-4 w-4 text-[var(--accent)]" />,
    title: 'Hybrid sound engine',
  },
  {
    body: 'WAV export, MIDI import and export, target-aware print analysis, checkpoints, and recovery points make it safer to use in a real workflow.',
    icon: <Upload className="h-4 w-4 text-[var(--accent)]" />,
    title: 'Real workflow exits',
  },
];

const quickRoute = [
  'Wake audio, then press Play to hear the current scene immediately.',
  'Open Beat Lab for a fast drum-first demo or Night Transit for the fuller song sketch.',
  'Jump to Song view to see clips, markers, loop ranges, and arrangement editing.',
  'Open Notes to inspect pitch, gate, zoom, and finer note shaping.',
];

export const SubmissionGuide = ({ isOpen, onClose }: SubmissionGuideProps) => {
  const {
    arrangerClips,
    currentPattern,
    initAudio,
    isInitialized,
    isPlaying,
    loadSessionTemplate,
    patternCount,
    projectCheckpoints,
    saveCheckpoint,
    selectedTrackId,
    setActiveView,
    togglePlay,
    tracks,
  } = useAudio();

  if (!isOpen) {
    return null;
  }

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;

  return (
    <section className="showcase-gradient-panel mt-3 overflow-hidden rounded-[10px] border border-[var(--border-strong)] px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.3fr)_360px] xl:items-start">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-label">Submission route</div>
              <h2 className="mt-2 text-[28px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]">
                SonicStudio is strongest when a reviewer reaches music fast.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                This build is positioned as a browser-native composition studio with serious workflow exits:
                sample slicing, MIDI import and export, print analysis, checkpoints, and a real song view.
                The main challenge risk is reviewer overload. This panel gives reviewers a fast route into the strongest parts of the product.
              </p>
            </div>
            <button
              aria-label="Close submission guide"
              className="ghost-icon-button flex h-10 w-10 shrink-0 items-center justify-center"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {capabilityCards.map((card) => (
              <div key={card.title} className="surface-panel-muted rounded-[8px] p-4">
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  {card.icon}
                  <h3>{card.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="surface-panel-muted rounded-[8px] p-4">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                <h3>Fastest live demo path</h3>
              </div>
              <div className="mt-3 grid gap-2">
                {quickRoute.map((step) => (
                  <div key={step} className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-panel-muted rounded-[8px] p-4">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Layers3 className="h-4 w-4 text-[var(--accent)]" />
                <h3>Current studio state</h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <MetricCell label="Tracks" value={String(tracks.length)} />
                <MetricCell label="Clips" value={String(arrangerClips.length)} />
                <MetricCell label="Pattern bank" value={String(patternCount)} />
                <MetricCell label="Focus" value={selectedTrack ? selectedTrack.name : `Pattern ${String.fromCharCode(65 + currentPattern)}`} />
              </div>
              <div className="mt-3 rounded-[8px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                Recovery points available: <span className="font-medium text-[var(--text-primary)]">{projectCheckpoints.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-panel-muted rounded-[8px] p-4">
          <div className="section-label">Launch actions</div>
          <div className="mt-3 grid gap-2">
            <button
              className="control-chip flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              data-active={isInitialized ? 'true' : 'false'}
              onClick={() => void initAudio()}
              type="button"
            >
              <span>{isInitialized ? 'Re arm audio' : 'Wake audio engine'}</span>
              <Wand2 className="h-4 w-4 text-[var(--accent)]" />
            </button>
            <button
              className="control-chip flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              data-active={isPlaying ? 'true' : 'false'}
              onClick={() => void togglePlay()}
              type="button"
            >
              <span>{isPlaying ? 'Pause current scene' : 'Play current scene'}</span>
              <Play className="h-4 w-4 text-[var(--accent)]" />
            </button>
            <button
              className="control-chip flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              onClick={() => {
                loadSessionTemplate('beat-lab');
                setActiveView('SEQUENCER');
              }}
              type="button"
            >
              <span>Load Beat Lab demo</span>
              <Music4 className="h-4 w-4 text-[var(--accent)]" />
            </button>
            <button
              className="control-chip flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              onClick={() => {
                loadSessionTemplate('night-transit');
                setActiveView('ARRANGER');
              }}
              type="button"
            >
              <span>Load Night Transit song</span>
              <Layers3 className="h-4 w-4 text-[var(--accent)]" />
            </button>
            <button
              className="control-chip flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              onClick={() => {
                loadSessionTemplate('ambient-drift');
                setActiveView('PIANO_ROLL');
              }}
              type="button"
            >
              <span>Load Ambient Drift notes</span>
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            </button>
            <button
              className="control-chip flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              onClick={() => saveCheckpoint('Submission checkpoint')}
              type="button"
            >
              <span>Save a submission checkpoint</span>
              <Upload className="h-4 w-4 text-[var(--accent)]" />
            </button>
          </div>
          <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
            These actions all touch real session state. Nothing here is presentational filler.
          </div>
        </div>
      </div>
    </section>
  );
};

const MetricCell = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-[8px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
    <div className="section-label">{label}</div>
    <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
);
