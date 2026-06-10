import { defaultNoteForTrack, type NoteEvent, type Track } from '../project/schema';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// The SuperSonic "note ladder": pitch offsets (in semitones) around the anchor
// note, top (highest) to bottom (lowest), with the anchor in the center. Tapping
// a ladder rung drops a note at that pitch straight from the grid.
export const SUPERSONIC_NOTE_OFFSETS = [4, 3, 2, 1, 0, -1, -2, -3, -4] as const;

// A sortable pitch value (octave * 12 + pitch class) so a step's notes can be
// stacked highest-to-lowest when shown as subnotes.
export const pitchRank = (note: string): number => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 0;
  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  return Number(match[2]) * 12 + (pitchClass < 0 ? 0 : pitchClass);
};

// Transpose a note name by a number of semitones, preserving the "C#4" form.
// Returns null for anything that is not a parseable pitch.
export const shiftPitch = (note: string, semitones: number): string | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  const [, name, octaveStr] = match;
  const semitoneIndex = NOTE_NAMES.indexOf(name);
  if (semitoneIndex < 0) return null;
  const totalSemitones = Number(octaveStr) * 12 + semitoneIndex + semitones;
  const newOctave = Math.floor(totalSemitones / 12);
  const newSemitone = ((totalSemitones % 12) + 12) % 12;
  return `${NOTE_NAMES[newSemitone]}${newOctave}`;
};

// The pitch a ladder should center on for a given step: the note already there,
// else the nearest earlier note, else the pattern's first note, else the track
// default. This keeps placement musical instead of always starting from C.
export const getTrackAnchorNote = (track: Track, patternSteps: NoteEvent[][], stepIndex: number): string => {
  const currentNote = patternSteps[stepIndex]?.[0]?.note;
  if (currentNote) {
    return currentNote;
  }

  for (let candidateIndex = stepIndex - 1; candidateIndex >= 0; candidateIndex -= 1) {
    const candidateNote = patternSteps[candidateIndex]?.[0]?.note;
    if (candidateNote) {
      return candidateNote;
    }
  }

  const firstPatternNote = patternSteps.find((step) => step.length > 0)?.[0]?.note;
  return firstPatternNote ?? defaultNoteForTrack(track);
};
