import { defaultNoteForTrack, type ArrangementClip, type Track } from '../../project/schema';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const noteToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
};

export const midiToNote = (midi: number): string => {
  const clampedMidi = Math.max(24, Math.min(96, Math.round(midi)));
  const pitchClass = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${pitchClass}${octave}`;
};

export const shiftNote = (note: string, semitones: number) => {
  const midi = noteToMidi(note);
  if (midi === null) {
    return note;
  }

  return midiToNote(midi + semitones);
};

export const buildComposerRows = (track: Track, focusNote: string | null) => {
  const rootMidi = noteToMidi(focusNote ?? defaultNoteForTrack(track)) ?? noteToMidi(defaultNoteForTrack(track)) ?? 60;
  return Array.from({ length: 12 }, (_, index) => midiToNote(rootMidi + 7 - index));
};

export const getComposerStepCount = (clip: ArrangementClip | null, stepsPerPattern: number) => {
  if (!clip) {
    return Math.min(stepsPerPattern, 16);
  }

  if (clip.beatLength > 16 || stepsPerPattern > 16) {
    return Math.min(stepsPerPattern, 32);
  }

  return Math.min(stepsPerPattern, 16);
};

export const phraseRowsForNote = (currentNote: string) => {
  const rootMidi = noteToMidi(currentNote) ?? 60;
  return Array.from({ length: 13 }, (_, index) => midiToNote(rootMidi - 6 + index));
};
