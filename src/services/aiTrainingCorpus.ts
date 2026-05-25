// SonicStudio → AI training corpus.
//
// A skeleton that turns the current Project into a normalized JSON
// description an external pipeline could feed into a music model
// trainer (sequence models, MIDI-token models, anything that wants
// notes + structure + tempo).
//
// Read-only and additive — building or downloading a corpus never
// touches the audio engine, the session controller, or persisted
// state. Future steps can layer on top of this:
//
//   - more session metadata (mix snapshots, master settings)
//   - tokenization helpers (REMI / MMM style) on top of the flat
//     notes list
//   - upload / inference hooks against a remote service
//
// All fields are versioned. Bump COR_VERSION when the shape changes
// so downstream loaders can branch safely.

import type {
  ArrangementClip,
  InstrumentType,
  Project,
  SongMarker,
  Track,
} from '../project/schema';

const COR_VERSION = 1;

export interface TrainingTrack {
  id: string;
  instrument: InstrumentType;
  display_name: string;
  color: string;
  volume_db: number;
  muted: boolean;
  source_engine: 'synth' | 'sample';
  waveform: string;
}

export interface TrainingNote {
  track_id: string;
  pattern_index: number;
  step: number;
  note: string; // pitch name, e.g. 'C4'
  velocity: number; // 0..1
  gate: number; // step lengths held, >= 1
}

export interface TrainingClip {
  track_id: string;
  pattern_index: number;
  start_beat: number;
  beat_length: number;
}

export interface TrainingMarker {
  name: string;
  beat: number;
}

export interface TrainingCorpusV1 {
  version: typeof COR_VERSION;
  source: 'sonicstudio';
  exported_at: string;
  session_name: string;
  tempo_bpm: number;
  steps_per_pattern: number;
  pattern_count: number;
  transport_mode: 'PATTERN' | 'SONG';
  tracks: TrainingTrack[];
  notes: TrainingNote[];
  song: TrainingClip[];
  markers: TrainingMarker[];
}

const describeTrack = (track: Track): TrainingTrack => ({
  id: track.id,
  instrument: track.type,
  display_name: track.name,
  color: track.color,
  volume_db: track.volume,
  muted: track.muted,
  source_engine: track.source.engine,
  waveform: track.source.waveform,
});

const collectNotes = (track: Track): TrainingNote[] => {
  const notes: TrainingNote[] = [];
  Object.entries(track.patterns).forEach(([patternKey, pattern]) => {
    const patternIndex = Number(patternKey);
    if (!Number.isFinite(patternIndex)) return;
    pattern.forEach((step, stepIndex) => {
      step.forEach((event) => {
        notes.push({
          track_id: track.id,
          pattern_index: patternIndex,
          step: stepIndex,
          note: event.note,
          velocity: Number(event.velocity.toFixed(3)),
          gate: Number(event.gate.toFixed(3)),
        });
      });
    });
  });
  return notes;
};

const describeClip = (clip: ArrangementClip): TrainingClip => ({
  track_id: clip.trackId,
  pattern_index: clip.patternIndex,
  start_beat: clip.startBeat,
  beat_length: clip.beatLength,
});

const describeMarker = (marker: SongMarker): TrainingMarker => ({
  name: marker.name,
  beat: marker.beat,
});

/**
 * Build a normalized training corpus from a Project. Pure function —
 * does not mutate state or touch the audio engine.
 */
export const buildTrainingCorpus = (project: Project): TrainingCorpusV1 => {
  const tracks = project.tracks.map(describeTrack);
  const notes = project.tracks.flatMap(collectNotes);
  const song = project.arrangerClips.map(describeClip);
  const markers = project.markers.map(describeMarker);

  return {
    version: COR_VERSION,
    source: 'sonicstudio',
    exported_at: new Date().toISOString(),
    session_name: project.metadata.name,
    tempo_bpm: project.transport.bpm,
    steps_per_pattern: project.transport.stepsPerPattern,
    pattern_count: project.transport.patternCount,
    transport_mode: project.transport.mode,
    tracks,
    notes,
    song,
    markers,
  };
};

/** Pretty-printed JSON of a corpus, ready to write to disk. */
export const serializeTrainingCorpus = (corpus: TrainingCorpusV1): string => (
  JSON.stringify(corpus, null, 2)
);

const slugify = (input: string): string => (
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'sonicstudio-session'
);

/**
 * Build the corpus for the current project and trigger a browser
 * download as JSON. Filename derives from the session name.
 */
export const downloadTrainingCorpus = (project: Project): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const corpus = buildTrainingCorpus(project);
  const json = serializeTrainingCorpus(corpus);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(corpus.session_name)}-training-corpus.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
};
