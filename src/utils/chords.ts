const SEMITONES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const CHORD_QUALITIES: Record<string, { intervals: number[]; label: string }> = {
  maj: { intervals: [0, 4, 7], label: 'major' },
  min: { intervals: [0, 3, 7], label: 'minor' },
  dim: { intervals: [0, 3, 6], label: 'diminished' },
  sus4: { intervals: [0, 5, 7], label: 'sus4' },
  maj7: { intervals: [0, 4, 7, 11], label: 'major 7' },
  min7: { intervals: [0, 3, 7, 10], label: 'minor 7' },
  dom7: { intervals: [0, 4, 7, 10], label: 'dominant 7' },
};

export type ChordQuality = keyof typeof CHORD_QUALITIES;

// Roman-numeral roles in a major key (degree, quality)
export const MAJOR_KEY_TRIADS: Array<{ numeral: string; degree: number; quality: ChordQuality; label: string }> = [
  { numeral: 'I', degree: 0, quality: 'maj', label: 'tonic' },
  { numeral: 'ii', degree: 2, quality: 'min', label: 'supertonic' },
  { numeral: 'iii', degree: 4, quality: 'min', label: 'mediant' },
  { numeral: 'IV', degree: 5, quality: 'maj', label: 'subdominant' },
  { numeral: 'V', degree: 7, quality: 'maj', label: 'dominant' },
  { numeral: 'vi', degree: 9, quality: 'min', label: 'submediant' },
  { numeral: 'vii°', degree: 11, quality: 'dim', label: 'leading tone' },
];

export const MINOR_KEY_TRIADS: Array<{ numeral: string; degree: number; quality: ChordQuality; label: string }> = [
  { numeral: 'i', degree: 0, quality: 'min', label: 'tonic' },
  { numeral: 'ii°', degree: 2, quality: 'dim', label: 'supertonic' },
  { numeral: 'III', degree: 3, quality: 'maj', label: 'mediant' },
  { numeral: 'iv', degree: 5, quality: 'min', label: 'subdominant' },
  { numeral: 'V', degree: 7, quality: 'maj', label: 'dominant' },
  { numeral: 'VI', degree: 8, quality: 'maj', label: 'submediant' },
  { numeral: 'VII', degree: 10, quality: 'maj', label: 'subtonic' },
];

export const KEY_OPTIONS = SEMITONES;
export type KeyName = typeof SEMITONES[number];

const noteToParts = (note: string): { name: string; octave: number } | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  return { name: match[1], octave: Number(match[2]) };
};

const partsToNote = (semitoneIndex: number, octave: number): string => {
  const normalized = ((semitoneIndex % 12) + 12) % 12;
  const octaveShift = Math.floor(semitoneIndex / 12);
  return `${SEMITONES[normalized]}${octave + octaveShift}`;
};

export const buildChordNotes = (
  rootKey: KeyName,
  intervalFromRoot: number,
  quality: ChordQuality,
  octave: number,
): string[] => {
  const rootIndex = SEMITONES.indexOf(rootKey);
  if (rootIndex < 0) return [];
  const chordRootSemitones = rootIndex + intervalFromRoot;
  return CHORD_QUALITIES[quality].intervals.map((interval) => (
    partsToNote(chordRootSemitones + interval, octave)
  ));
};

export const guessKeyAndOctaveFromTrack = (
  type: string,
  octaveShift: number,
): { key: KeyName; octave: number; mode: 'major' | 'minor' } => {
  const baseOctave = type === 'bass' ? 2 : type === 'pad' ? 3 : 4;
  return { key: 'C', octave: baseOctave + octaveShift, mode: 'major' };
};

export const parseNoteOctave = (note: string): number => {
  const parts = noteToParts(note);
  return parts?.octave ?? 4;
};
