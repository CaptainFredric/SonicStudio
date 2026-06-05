// Shared pitch-class and scale helpers.
//
// The same note-name -> pitch-class map and the major / natural-minor
// scale-degree sets were duplicated across the key detector, chord
// starters, next-chord suggester, note-string library, manual key
// override, and a few components. Centralizing them here keeps one
// source of truth so the key-aware features can never silently
// disagree about what "in key" means.

export type ScaleMode = 'major' | 'minor';

// Pitch class indices count from C (0) to B (11). Both sharps and flats
// resolve to the same class so any reasonable note spelling parses.
export const PITCH_CLASS_BY_NAME: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4,
  'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};

// Sharp spellings, indexed by pitch class. The studio writes notes with
// sharps, so this is the canonical way back from a pitch class to a name.
// Typed as readonly string[] (not a literal tuple) so callers can run
// .indexOf(someString) against it without a type error.
export const NOTE_NAMES_SHARP: readonly string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Scale degrees relative to the tonic (semitone offsets).
export const MAJOR_SCALE_DEGREES = [0, 2, 4, 5, 7, 9, 11] as const;
export const MINOR_SCALE_DEGREES = [0, 2, 3, 5, 7, 8, 10] as const;

export const scaleDegreesFor = (mode: ScaleMode): readonly number[] => (
  mode === 'major' ? MAJOR_SCALE_DEGREES : MINOR_SCALE_DEGREES
);

/**
 * Parse the pitch class out of a note name, ignoring the octave.
 * Accepts an optional sharp or flat (e.g. "C4", "F#3", "Bb2", "B-1").
 * Returns null for anything that isn't a recognizable note.
 */
export const pitchClassFromNote = (note: string): number | null => {
  const match = note.match(/^([A-Ga-g])([#b]?)/);
  if (!match) return null;
  const key = `${match[1].toUpperCase()}${match[2]}`;
  const pc = PITCH_CLASS_BY_NAME[key];
  return pc === undefined ? null : pc;
};

/**
 * The set of pitch classes that belong to a key, given a tonic pitch
 * class and a mode. Used everywhere a lane / row / note needs an
 * "is this in key?" check.
 */
export const inKeyPitchClasses = (root: number, mode: ScaleMode): Set<number> => (
  new Set(scaleDegreesFor(mode).map((degree) => (root + degree) % 12))
);

/** True when a note name falls inside the given key. */
export const noteFitsKey = (note: string, root: number, mode: ScaleMode): boolean => {
  const pc = pitchClassFromNote(note);
  if (pc === null) return false;
  return inKeyPitchClasses(root, mode).has(pc);
};

/**
 * The semitone shift (within -5..+6) that lands the most of these pitch classes
 * on the key's scale. Used to transpose a captured phrase into the session key
 * while preserving its internal intervals (a transpose, not a per-note snap).
 * Ties break toward the smallest move, so an already-in-key phrase stays put.
 */
export const bestKeyTranspose = (pitchClasses: number[], root: number, mode: ScaleMode): number => {
  if (pitchClasses.length === 0) return 0;
  const inKey = inKeyPitchClasses(root, mode);
  let best = 0;
  let bestScore = -1;
  for (let shift = -5; shift <= 6; shift += 1) {
    let score = 0;
    for (const pc of pitchClasses) {
      if (inKey.has((((pc + shift) % 12) + 12) % 12)) score += 1;
    }
    if (score > bestScore || (score === bestScore && Math.abs(shift) < Math.abs(best))) {
      best = shift;
      bestScore = score;
    }
  }
  return best;
};
