const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export interface PitchCoachFeedback {
  accuracy: number;
  centsOff: number | null;
  detail: string;
  direction: 'centered' | 'flat' | 'idle' | 'sharp';
  indicator: number;
  label: string;
  tone: 'close' | 'idle' | 'locked' | 'miss';
}

export const noteToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const [, name, octaveText] = match;
  const noteIndex = NOTE_NAMES.indexOf(name as typeof NOTE_NAMES[number]);
  if (noteIndex < 0) {
    return null;
  }

  return (Number(octaveText) + 1) * 12 + noteIndex;
};

export const midiToPitchHz = (midi: number) => 440 * (2 ** ((midi - 69) / 12));

export const getPitchCoachFeedback = ({
  detectedNote,
  detectedPitchHz,
  targetNote,
}: {
  detectedNote?: string | null;
  detectedPitchHz: number | null;
  targetNote: string | null;
}): PitchCoachFeedback => {
  if (!targetNote) {
    return {
      accuracy: 0,
      centsOff: null,
      detail: 'Pick a target note and hold it for a moment.',
      direction: 'idle',
      indicator: 0.5,
      label: 'Set target',
      tone: 'idle',
    };
  }

  const targetMidi = noteToMidi(targetNote);
  if (targetMidi === null) {
    return {
      accuracy: 0,
      centsOff: null,
      detail: 'That target note could not be parsed.',
      direction: 'idle',
      indicator: 0.5,
      label: 'Bad target',
      tone: 'idle',
    };
  }

  if (!detectedPitchHz || detectedPitchHz <= 0) {
    return {
      accuracy: 0,
      centsOff: null,
      detail: `Listening for ${targetNote}. Hold the note a little longer for feedback.`,
      direction: 'idle',
      indicator: 0.5,
      label: 'Listening',
      tone: 'idle',
    };
  }

  const targetPitchHz = midiToPitchHz(targetMidi);
  const centsOff = 1200 * Math.log2(detectedPitchHz / targetPitchHz);
  const absoluteCents = Math.abs(centsOff);
  const direction = absoluteCents <= 6 ? 'centered' : centsOff < 0 ? 'flat' : 'sharp';
  const tone = absoluteCents <= 8 ? 'locked' : absoluteCents <= 24 ? 'close' : 'miss';
  const label = tone === 'locked'
    ? 'In tune'
    : direction === 'flat'
      ? 'Bring it up'
      : 'Bring it down';
  const detail = tone === 'locked'
    ? `${targetNote} is locked${detectedNote ? ` · hearing ${detectedNote}` : ''}.`
    : `${Math.round(absoluteCents)} cents ${direction === 'flat' ? 'flat' : 'sharp'} against ${targetNote}${detectedNote ? ` · hearing ${detectedNote}` : ''}.`;

  return {
    accuracy: clampUnit(1 - (absoluteCents / 70)),
    centsOff,
    detail,
    direction,
    indicator: clampUnit(0.5 + (centsOff / 100)),
    label,
    tone,
  };
};