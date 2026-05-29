// Live key detector.
//
// Walks the notes a user has authored across every track and returns
// the most likely musical key. Uses the Krumhansl-Schmuckler key
// profiles (the standard textbook approach for symbolic key-finding):
// each profile encodes how prominent each of the 12 pitch classes
// tends to be in a given mode (major / minor), and the detector picks
// the (root, mode) that best correlates with the user's pitch-class
// distribution.
//
// Read-only on the audio engine and the project. No ML, no remote
// call. The detection runs in microseconds on a normal session.

import type { Track } from '../project/schema';
import {
  inKeyPitchClasses,
  NOTE_NAMES_SHARP,
  pitchClassFromNote,
  type ScaleMode,
} from '../utils/pitch';
import { getManualKeyOverride } from './manualKeyOverride';

// Krumhansl & Kessler / Schmuckler weighting vectors. Index 0 = the
// tonic, index 1 = the second pitch class, and so on. We rotate them
// per candidate root to score every (root, mode) hypothesis.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export type KeyMode = ScaleMode;

export interface DetectedKey {
  /** Tonic pitch class index (0 = C). */
  root: number;
  /** Pretty pitch name, e.g. "A". Always spelled with sharps. */
  rootName: string;
  mode: KeyMode;
  /** Friendly label suitable for display, e.g. "A minor". */
  label: string;
  /** Normalized confidence in 0..1. */
  confidence: number;
  /** True when the session has too few notes to call. */
  uncertain: boolean;
  /** Total counted notes that fed the detection. */
  noteCount: number;
}

export const EMPTY_KEY: DetectedKey = {
  root: 0,
  rootName: 'C',
  mode: 'major',
  label: 'No key yet',
  confidence: 0,
  uncertain: true,
  noteCount: 0,
};

const MIN_NOTES_FOR_CONFIDENCE = 4;

// Drums are explicitly noisy in pitch terms — kicks tend to sit on a
// constant C/D, hats are unpitched samples. Excluding them keeps the
// detector honest for melodic / harmonic content.
const PITCHED_TYPES: Track['type'][] = ['bass', 'lead', 'pad', 'pluck', 'fx', 'violin', 'piano', 'bell'];

// Downbeats and low bass notes get extra weight because they anchor a
// human listener's sense of tonality. Without these, a relative-major /
// minor pair (A minor vs C major) would correlate identically and the
// detector would coinflip between them.
const DOWNBEAT_BONUS = 1.8;
const BASS_LANE_BONUS = 1.4;
const STEPS_PER_BAR = 16;

const buildHistogram = (tracks: Track[]): { histogram: number[]; noteCount: number } => {
  const histogram = new Array(12).fill(0) as number[];
  let noteCount = 0;
  for (const track of tracks) {
    if (!PITCHED_TYPES.includes(track.type)) continue;
    if (track.muted) continue;
    const laneBonus = track.type === 'bass' ? BASS_LANE_BONUS : 1;
    for (const stepGrid of Object.values(track.patterns)) {
      stepGrid.forEach((step, stepIndex) => {
        const positionBonus = stepIndex % STEPS_PER_BAR === 0 ? DOWNBEAT_BONUS : 1;
        for (const event of step) {
          const pc = pitchClassFromNote(event.note);
          if (pc === null) continue;
          // Weight by velocity so a fortissimo accent counts more
          // than a soft passing tone, by lane (bass anchors the
          // tonal center), and by position (downbeats matter most).
          const weight = Math.max(0.1, event.velocity) * laneBonus * positionBonus;
          histogram[pc] += weight;
          noteCount += 1;
        }
      });
    }
  }
  return { histogram, noteCount };
};

const rotate = (profile: number[], by: number): number[] => (
  profile.map((_, index) => profile[(index - by + 12) % 12])
);

// Pearson-style correlation between two equal-length numeric vectors.
// We use this so the score is robust to overall histogram magnitude.
const correlation = (a: number[], b: number[]): number => {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let sumSqA = 0;
  let sumSqB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    sumSqA += da * da;
    sumSqB += db * db;
  }
  const denominator = Math.sqrt(sumSqA * sumSqB);
  if (denominator === 0) return 0;
  return numerator / denominator;
};

// True when an absolute pitch class belongs to the key's diatonic set.
// Used by laneFitness + detectPatternKeyDrift.
const noteFitsKey = (notePc: number, key: DetectedKey): boolean => (
  inKeyPitchClasses(key.root, key.mode).has(notePc)
);

/**
 * Source of truth for "what key is this session in?" for UI surfaces.
 * Honors a manual override when one is set, falling back to the
 * Krumhansl-Schmuckler reading otherwise. Use this instead of
 * detectKey from any component that should respect the user's pin.
 */
export const getEffectiveKey = (tracks: Track[]): DetectedKey => {
  const override = getManualKeyOverride();
  if (override) {
    const root = pitchClassFromNote(override.rootName) ?? 0;
    return {
      root,
      rootName: override.rootName,
      mode: override.mode,
      label: `${override.rootName} ${override.mode}`,
      confidence: 1,
      uncertain: false,
      noteCount: tracks.reduce((sum, track) => sum + Object.values(track.patterns).reduce(
        (innerSum, stepGrid) => innerSum + stepGrid.reduce((s, step) => s + step.length, 0),
        0,
      ), 0),
    };
  }
  return detectKey(tracks);
};

export interface LaneFitness {
  inside: number;
  outside: number;
  /** Fraction inside the detected key, 0..1. Returns null if no notes. */
  ratio: number | null;
}

/**
 * Read how well a single lane sits inside the detected key. Drum
 * lanes always return null — their pitches are constant and shouldn't
 * be graded musically.
 */
export const laneFitness = (track: Track, key: DetectedKey): LaneFitness => {
  if (key.uncertain) return { inside: 0, outside: 0, ratio: null };
  if (!PITCHED_TYPES.includes(track.type)) return { inside: 0, outside: 0, ratio: null };
  let inside = 0;
  let outside = 0;
  for (const stepGrid of Object.values(track.patterns)) {
    for (const step of stepGrid) {
      for (const event of step) {
        const pc = pitchClassFromNote(event.note);
        if (pc === null) continue;
        if (noteFitsKey(pc, key)) inside += 1;
        else outside += 1;
      }
    }
  }
  const total = inside + outside;
  return {
    inside,
    outside,
    ratio: total === 0 ? null : inside / total,
  };
};

export interface PatternKeyDrift {
  patternIndex: number;
  inside: number;
  outside: number;
  /** Same fraction-inside semantics as LaneFitness.ratio. */
  ratio: number | null;
  /** True when this pattern is mostly off-key compared to the session. */
  drifts: boolean;
}

const DRIFT_RATIO_THRESHOLD = 0.7;
const DRIFT_MIN_NOTES = 4;

/**
 * Scan each pattern bank and flag the ones whose notes mostly fall
 * outside the session's detected key. Drum lanes are excluded so a
 * percussion-heavy pattern doesn't look "off-key" just because its
 * kicks are constant.
 */
export const detectPatternKeyDrift = (tracks: Track[], key: DetectedKey): PatternKeyDrift[] => {
  if (key.uncertain) return [];
  const buckets = new Map<number, { inside: number; outside: number }>();
  for (const track of tracks) {
    if (!PITCHED_TYPES.includes(track.type)) continue;
    if (track.muted) continue;
    for (const [patternKey, stepGrid] of Object.entries(track.patterns)) {
      const patternIndex = Number(patternKey);
      if (!Number.isFinite(patternIndex)) continue;
      let bucket = buckets.get(patternIndex);
      if (!bucket) {
        bucket = { inside: 0, outside: 0 };
        buckets.set(patternIndex, bucket);
      }
      for (const step of stepGrid) {
        for (const event of step) {
          const pc = pitchClassFromNote(event.note);
          if (pc === null) continue;
          if (noteFitsKey(pc, key)) bucket.inside += 1;
          else bucket.outside += 1;
        }
      }
    }
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([patternIndex, { inside, outside }]) => {
      const total = inside + outside;
      const ratio = total === 0 ? null : inside / total;
      return {
        patternIndex,
        inside,
        outside,
        ratio,
        drifts: total >= DRIFT_MIN_NOTES && ratio !== null && ratio < DRIFT_RATIO_THRESHOLD,
      };
    });
};

export const detectKey = (tracks: Track[]): DetectedKey => {
  const { histogram, noteCount } = buildHistogram(tracks);
  if (noteCount === 0) return EMPTY_KEY;

  let best: { root: number; mode: KeyMode; score: number } = { root: 0, mode: 'major', score: -Infinity };
  for (let root = 0; root < 12; root += 1) {
    const majorScore = correlation(histogram, rotate(MAJOR_PROFILE, root));
    if (majorScore > best.score) best = { root, mode: 'major', score: majorScore };
    const minorScore = correlation(histogram, rotate(MINOR_PROFILE, root));
    if (minorScore > best.score) best = { root, mode: 'minor', score: minorScore };
  }

  // Normalize confidence into a friendly 0..1 range. A correlation
  // around 0.8+ is a strong match, 0.4 is a weak one.
  const rawConfidence = Math.max(0, Math.min(1, (best.score + 0.2) / 1.2));
  const uncertain = noteCount < MIN_NOTES_FOR_CONFIDENCE || best.score < 0.3;
  const rootName = NOTE_NAMES_SHARP[best.root];
  const label = uncertain
    ? 'Key forming…'
    : `${rootName} ${best.mode}`;

  return {
    root: best.root,
    rootName,
    mode: best.mode,
    label,
    confidence: rawConfidence,
    uncertain,
    noteCount,
  };
};
