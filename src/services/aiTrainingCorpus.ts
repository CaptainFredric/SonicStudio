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
//
// V2 adds pre-rolled stats:
//   - tracks[].stats: per-track aggregates (note_count, mean_velocity,
//     octave_low/high, density_per_step) so trainers can filter or
//     weight tracks without re-scanning the flat notes array.
//   - pattern_stats[]: per-pattern aggregates (note_count, active
//     track count, which track IDs are live) for pattern-level
//     conditioning.

import type {
  ArrangementClip,
  InstrumentType,
  Project,
  SongMarker,
  Track,
} from '../project/schema';

const COR_VERSION = 2;

export interface TrainingTrackStats {
  note_count: number;
  mean_velocity: number; // 0..1, rounded to 3dp
  octave_low: number | null; // null if the track has no notes
  octave_high: number | null;
  density_per_step: number; // notes / (pattern_count * steps_per_pattern), rounded
}

export interface TrainingTrack {
  id: string;
  instrument: InstrumentType;
  display_name: string;
  color: string;
  volume_db: number;
  muted: boolean;
  source_engine: 'synth' | 'sample';
  waveform: string;
  stats: TrainingTrackStats;
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

export interface TrainingPatternStats {
  pattern_index: number;
  note_count: number;
  active_track_ids: string[];
}

export interface TrainingCorpusV2 {
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
  pattern_stats: TrainingPatternStats[];
  song: TrainingClip[];
  markers: TrainingMarker[];
}

// Notes look like 'C4', 'D#5', 'Eb3', 'A-1'. The octave is just the
// trailing signed integer.
const parseOctave = (note: string): number | null => {
  const match = note.match(/-?\d+$/);
  if (!match) return null;
  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) ? value : null;
};

const round3 = (value: number) => Number(value.toFixed(3));

const collectTrackNotes = (track: Track): TrainingNote[] => {
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
          velocity: round3(event.velocity),
          gate: round3(event.gate),
        });
      });
    });
  });
  return notes;
};

const computeTrackStats = (
  trackNotes: TrainingNote[],
  patternCount: number,
  stepsPerPattern: number,
): TrainingTrackStats => {
  if (trackNotes.length === 0) {
    return {
      note_count: 0,
      mean_velocity: 0,
      octave_low: null,
      octave_high: null,
      density_per_step: 0,
    };
  }

  let velocitySum = 0;
  let octaveLow = Number.POSITIVE_INFINITY;
  let octaveHigh = Number.NEGATIVE_INFINITY;
  trackNotes.forEach((note) => {
    velocitySum += note.velocity;
    const octave = parseOctave(note.note);
    if (octave !== null) {
      if (octave < octaveLow) octaveLow = octave;
      if (octave > octaveHigh) octaveHigh = octave;
    }
  });

  const steps = Math.max(1, patternCount * stepsPerPattern);
  return {
    note_count: trackNotes.length,
    mean_velocity: round3(velocitySum / trackNotes.length),
    octave_low: Number.isFinite(octaveLow) ? octaveLow : null,
    octave_high: Number.isFinite(octaveHigh) ? octaveHigh : null,
    density_per_step: round3(trackNotes.length / steps),
  };
};

const describeTrack = (
  track: Track,
  trackNotes: TrainingNote[],
  patternCount: number,
  stepsPerPattern: number,
): TrainingTrack => ({
  id: track.id,
  instrument: track.type,
  display_name: track.name,
  color: track.color,
  volume_db: track.volume,
  muted: track.muted,
  source_engine: track.source.engine,
  waveform: track.source.waveform,
  stats: computeTrackStats(trackNotes, patternCount, stepsPerPattern),
});

const computePatternStats = (
  notes: TrainingNote[],
  patternCount: number,
): TrainingPatternStats[] => {
  const buckets = new Map<number, { count: number; tracks: Set<string> }>();
  for (let index = 0; index < patternCount; index += 1) {
    buckets.set(index, { count: 0, tracks: new Set() });
  }
  notes.forEach((note) => {
    const bucket = buckets.get(note.pattern_index);
    if (!bucket) {
      // Patterns beyond patternCount are unusual but still summarized.
      buckets.set(note.pattern_index, {
        count: 1,
        tracks: new Set([note.track_id]),
      });
      return;
    }
    bucket.count += 1;
    bucket.tracks.add(note.track_id);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([patternIndex, bucket]) => ({
      pattern_index: patternIndex,
      note_count: bucket.count,
      active_track_ids: Array.from(bucket.tracks),
    }));
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
export const buildTrainingCorpus = (project: Project): TrainingCorpusV2 => {
  const { patternCount, stepsPerPattern } = project.transport;
  const trackNotesByTrack = project.tracks.map((track) => ({
    track,
    notes: collectTrackNotes(track),
  }));
  const tracks = trackNotesByTrack.map(({ track, notes }) => (
    describeTrack(track, notes, patternCount, stepsPerPattern)
  ));
  const notes = trackNotesByTrack.flatMap((entry) => entry.notes);
  const pattern_stats = computePatternStats(notes, patternCount);
  const song = project.arrangerClips.map(describeClip);
  const markers = project.markers.map(describeMarker);

  return {
    version: COR_VERSION,
    source: 'sonicstudio',
    exported_at: new Date().toISOString(),
    session_name: project.metadata.name,
    tempo_bpm: project.transport.bpm,
    steps_per_pattern: stepsPerPattern,
    pattern_count: patternCount,
    transport_mode: project.transport.mode,
    tracks,
    notes,
    pattern_stats,
    song,
    markers,
  };
};

/** Pretty-printed JSON of a corpus, ready to write to disk. */
export const serializeTrainingCorpus = (corpus: TrainingCorpusV2): string => (
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
