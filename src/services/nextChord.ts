// Next-chord suggester.
//
// Given the session's detected key and the most recent chord root we
// can pick out of the user's notes, this returns 2-3 plausible next
// chords using common diatonic transitions. The output is a list of
// CapturedNoteToken arrays so the existing capture-shelf machinery
// (save, queue, drop) can consume them without extra plumbing.
//
// The transition tables are deliberately small and human-readable:
// the goal is "good next idea," not "complete music-theory simulator."

import type { Track } from '../project/schema';
import { NOTE_NAMES_SHARP, pitchClassFromNote, scaleDegreesFor } from '../utils/pitch';
import type { DetectedKey, KeyMode } from './keyDetector';
import type { CapturedNoteToken } from './noteStringLibrary';

const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'];

// Index -> array of preferred next-degree indices, in priority order.
const MAJOR_TRANSITIONS: Record<number, number[]> = {
  0: [3, 4, 5], // I  -> IV, V, vi
  1: [4, 6],    // ii -> V, vii°
  2: [5, 3],    // iii-> vi, IV
  3: [4, 0, 1], // IV -> V, I, ii
  4: [0, 5],    // V  -> I, vi
  5: [3, 1, 4], // vi -> IV, ii, V
  6: [0],       // vii°-> I
};
const MINOR_TRANSITIONS: Record<number, number[]> = {
  0: [3, 4, 5], // i  -> iv, V, VI
  1: [4, 6],    // ii°-> V, VII
  2: [5, 6],    // III-> VI, VII
  3: [4, 0, 6], // iv -> V, i, VII
  4: [0, 5],    // V  -> i, VI
  5: [3, 1, 4], // VI -> iv, ii°, V
  6: [2, 0],    // VII-> III, i
};


// Pick the most recent chord-root the user authored. We prefer the
// bass lane (its notes are by convention the chord root). Falling
// back, the lowest-pitched note in the most recently-edited lane
// works as a proxy.
const findLastRootPitch = (tracks: Track[]): number | null => {
  const bass = tracks.find((track) => track.type === 'bass');
  if (bass) {
    for (const stepGrid of Object.values(bass.patterns)) {
      for (let stepIndex = stepGrid.length - 1; stepIndex >= 0; stepIndex -= 1) {
        const step = stepGrid[stepIndex];
        if (!step || step.length === 0) continue;
        const note = step[0]?.note;
        if (!note) continue;
        const pc = pitchClassFromNote(note);
        if (pc !== null) return pc;
      }
    }
  }
  // No bass note authored — try every melodic lane and pick the most
  // recently-occupied step's lowest pitch.
  for (const track of tracks) {
    if (!['lead', 'pad', 'piano', 'violin', 'bell', 'pluck'].includes(track.type)) continue;
    for (const stepGrid of Object.values(track.patterns)) {
      for (let stepIndex = stepGrid.length - 1; stepIndex >= 0; stepIndex -= 1) {
        const step = stepGrid[stepIndex];
        if (!step || step.length === 0) continue;
        const sorted = [...step].sort((a, b) => a.note.localeCompare(b.note));
        const note = sorted[0]?.note;
        if (!note) continue;
        const pc = pitchClassFromNote(note);
        if (pc !== null) return pc;
      }
    }
  }
  return null;
};

const numeralsFor = (mode: KeyMode) => (mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS);
const transitionsFor = (mode: KeyMode) => (mode === 'major' ? MAJOR_TRANSITIONS : MINOR_TRANSITIONS);

const degreeFromPitchClass = (root: number, pc: number, mode: KeyMode): number | null => {
  const relative = ((pc - root) % 12 + 12) % 12;
  const degrees = scaleDegreesFor(mode);
  for (let degreeIndex = 0; degreeIndex < degrees.length; degreeIndex += 1) {
    if (degrees[degreeIndex] === relative) return degreeIndex;
  }
  return null;
};

export interface NextChordSuggestion {
  /** Stable id for use in dismissal / list keys. */
  id: string;
  /** Roman numeral of the suggested chord, e.g. "IV". */
  numeral: string;
  /** Single-token capture (root note held over a bar) ready to save. */
  tokens: CapturedNoteToken[];
  /** Friendly label, e.g. "F major" or "Dm". */
  label: string;
}

const holdRoot = (pc: number, octave = 4): CapturedNoteToken => ({
  note: `${NOTE_NAMES_SHARP[pc]}${octave}`,
  gate: 4,
  velocity: 0.62,
});

/**
 * Compute up to three plausible next-chord suggestions. Returns
 * empty when the key is uncertain or when no recent root could be
 * inferred from the user's notes.
 */
export const suggestNextChords = (
  tracks: Track[],
  key: DetectedKey,
): NextChordSuggestion[] => {
  if (key.uncertain) return [];
  const lastRootPc = findLastRootPitch(tracks);
  if (lastRootPc === null) return [];
  const currentDegree = degreeFromPitchClass(key.root, lastRootPc, key.mode);
  if (currentDegree === null) return [];

  const nextDegreeIndices = transitionsFor(key.mode)[currentDegree] ?? [];
  const degrees = scaleDegreesFor(key.mode);
  const numerals = numeralsFor(key.mode);

  return nextDegreeIndices.slice(0, 3).map((degreeIndex) => {
    const targetPc = (key.root + degrees[degreeIndex]) % 12;
    const numeral = numerals[degreeIndex];
    const isUpper = numeral === numeral.toUpperCase();
    const label = `${NOTE_NAMES_SHARP[targetPc]} ${isUpper ? 'major' : 'minor'}`;
    return {
      id: `next-${numeral}-${NOTE_NAMES_SHARP[targetPc]}`,
      numeral,
      tokens: [holdRoot(targetPc)],
      label,
    };
  });
};
