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

import {
  getProjectSongLength,
  type ArrangementClip,
  type InstrumentType,
  type Project,
  type SongMarker,
  type Track,
} from '../project/schema';

import { detectKey, type KeyMode } from './keyDetector';
import { getManualKeyOverride } from './manualKeyOverride';

const COR_VERSION = 3;

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

export interface TrainingDetectedKey {
  root: number;
  root_name: string;
  mode: KeyMode;
  label: string;
  confidence: number;
  uncertain: boolean;
  /** When the user pinned a manual key at export time, the override is preserved here. */
  manual_override?: { root_name: string; mode: KeyMode } | null;
}

export interface TrainingCorpusV3 {
  version: typeof COR_VERSION;
  source: 'sonicstudio';
  exported_at: string;
  session_name: string;
  tempo_bpm: number;
  steps_per_pattern: number;
  pattern_count: number;
  transport_mode: 'PATTERN' | 'SONG';
  detected_key: TrainingDetectedKey;
  tracks: TrainingTrack[];
  notes: TrainingNote[];
  pattern_stats: TrainingPatternStats[];
  song: TrainingClip[];
  markers: TrainingMarker[];
}

/** @deprecated use TrainingCorpusV3 (V2 lacked `detected_key`). */
export type TrainingCorpusV2 = TrainingCorpusV3;

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
export const buildTrainingCorpus = (project: Project): TrainingCorpusV3 => {
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
  const key = detectKey(project.tracks);
  const manualOverride = getManualKeyOverride();

  return {
    version: COR_VERSION,
    source: 'sonicstudio',
    exported_at: new Date().toISOString(),
    session_name: project.metadata.name,
    tempo_bpm: project.transport.bpm,
    steps_per_pattern: stepsPerPattern,
    pattern_count: patternCount,
    transport_mode: project.transport.mode,
    detected_key: {
      root: key.root,
      root_name: key.rootName,
      mode: key.mode,
      label: key.label,
      confidence: round3(key.confidence),
      uncertain: key.uncertain,
      manual_override: manualOverride
        ? { root_name: manualOverride.rootName, mode: manualOverride.mode }
        : null,
    },
    tracks,
    notes,
    pattern_stats,
    song,
    markers,
  };
};

/** Pretty-printed JSON of a corpus, ready to write to disk. */
export const serializeTrainingCorpus = (corpus: TrainingCorpusV3): string => (
  JSON.stringify(corpus, null, 2)
);

export interface TrainingCorpusSummary {
  trackCount: number;
  noteCount: number;
  patternCount: number;
  bars: number;
  markerCount: number;
  clipCount: number;
}

/**
 * Compact "what would I export" preview. Cheap enough to call from a
 * settings panel render without dragging in the full corpus payload.
 */
export const summarizeTrainingCorpus = (project: Project): TrainingCorpusSummary => {
  const { patternCount, stepsPerPattern } = project.transport;
  let noteCount = 0;
  project.tracks.forEach((track) => {
    Object.values(track.patterns).forEach((pattern) => {
      pattern.forEach((step) => {
        noteCount += step.length;
      });
    });
  });

  const songLengthInSteps = getProjectSongLength(project);

  return {
    trackCount: project.tracks.length,
    noteCount,
    patternCount,
    bars: Math.max(1, Math.round(songLengthInSteps / Math.max(1, stepsPerPattern))),
    markerCount: project.markers.length,
    clipCount: project.arrangerClips.length,
  };
};

const slugify = (input: string): string => (
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'sonicstudio-session'
);

/**
 * Build a README.md companion file that documents the corpus schema
 * so a downstream pipeline maintainer can read the JSON without
 * digging through this source file. Kept inline so the export
 * always matches the V the data was emitted with.
 */
export const buildTrainingCorpusReadme = (corpus: TrainingCorpusV3): string => {
  const generatedAt = new Date(corpus.exported_at).toISOString();
  const overrideLine = corpus.detected_key.manual_override
    ? `Manual key pin at export time: \`${corpus.detected_key.manual_override.root_name} ${corpus.detected_key.manual_override.mode}\``
    : 'No manual key pin at export time. The detected_key field is the Krumhansl-Schmuckler reading.';
  return [
    `# SonicStudio training corpus`,
    ``,
    `Generated ${generatedAt} from session **${corpus.session_name}**.`,
    ``,
    `Schema version: \`${corpus.version}\``,
    ``,
    `## Top-level fields`,
    ``,
    `- \`version\`: integer schema version. Increment when the shape changes.`,
    `- \`source\`: always \`"sonicstudio"\`. Use to gate ingestion to this format.`,
    `- \`exported_at\`: ISO timestamp of the export.`,
    `- \`session_name\`: human-readable name from the studio session.`,
    `- \`tempo_bpm\`: integer BPM of the transport at export time.`,
    `- \`steps_per_pattern\`: how many 16th steps make up one pattern bar.`,
    `- \`pattern_count\`: number of pattern banks the session uses.`,
    `- \`transport_mode\`: \`"PATTERN"\` or \`"SONG"\`. Pattern mode loops the current bank; song mode follows the arrangement.`,
    `- \`detected_key\`: the live Krumhansl-Schmuckler key reading. \`manual_override\` is populated when the user pinned a key by hand.`,
    `- \`tracks\`: per-lane metadata, including color, voice, and pre-rolled stats (note count, mean velocity, octave range, density per step).`,
    `- \`notes\`: flat list of every note across every lane, with \`track_id\`, \`pattern_index\`, \`step\`, \`note\`, \`velocity\`, \`gate\`.`,
    `- \`pattern_stats\`: per-pattern note count and active track ids.`,
    `- \`song\`: arrangement clips, one per (lane × pattern) placement.`,
    `- \`markers\`: timeline markers placed on song view.`,
    ``,
    `## Notes on the detected_key field`,
    ``,
    overrideLine,
    ``,
    `\`confidence\` is normalized to 0..1; values near 1 are strong matches, near 0 are weak. \`uncertain\` is true when the session had too few notes for a confident call.`,
    ``,
    `## Conventions`,
    ``,
    `- Pitch class indices count from C (\`0\`) to B (\`11\`).`,
    `- Velocities run 0..1, never 0..127.`,
    `- Gates are step-lengths held (so a \`gate\` of 2 spans two 16th steps).`,
    `- Empty steps are not omitted from the grid — they appear as empty arrays inside each track's pattern.`,
    ``,
  ].join('\n');
};

/**
 * Build the corpus for the current project and trigger a browser
 * download as JSON. Filename derives from the session name. Also
 * triggers a companion README.md so a downstream pipeline reader
 * can see the schema without opening this file.
 */
export const downloadTrainingCorpus = (project: Project): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const corpus = buildTrainingCorpus(project);
  const slug = slugify(corpus.session_name);
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 250);
  };
  const json = serializeTrainingCorpus(corpus);
  downloadBlob(new Blob([json], { type: 'application/json' }), `${slug}-training-corpus.json`);
  // Defer the README a tick so Chrome / Safari don't merge the two
  // sequential downloads into a "block multiple downloads?" prompt.
  window.setTimeout(() => {
    const readme = buildTrainingCorpusReadme(corpus);
    downloadBlob(new Blob([readme], { type: 'text/markdown' }), `${slug}-training-corpus.README.md`);
  }, 400);
};
