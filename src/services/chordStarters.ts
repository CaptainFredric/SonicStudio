// Common chord progressions exposed as note-string starters.
//
// Each starter is just a captured note string the user can drop onto
// the shelf with a single click. The notes are root notes of each
// chord held over a full bar (gate 4 at 16-step quantization), so a
// reviewer can apply one to a pad / bass / piano lane and immediately
// hear a recognizable harmonic frame.
//
// The shelf does the heavy lifting once the starter is saved: the
// resulting string drags onto any lane like a typed capture, plays
// back through the lane's voice, and supports the same Apply / Queue
// / Duplicate actions as any other entry.

import type { CapturedNoteToken } from './noteStringLibrary';
import { NOTE_NAMES_SHARP, PITCH_CLASS_BY_NAME, type ScaleMode } from '../utils/pitch';

export interface ChordStarter {
  id: string;
  label: string;
  description: string;
  /** Pitch class of the tonic this starter was authored in. */
  sourceRoot: number;
  sourceMode: ScaleMode;
  tokens: CapturedNoteToken[];
}

const shiftNote = (note: string, semitones: number): string => {
  const match = note.match(/^([A-G])(#?)(-?\d+)$/);
  if (!match) return note;
  const pc = PITCH_CLASS_BY_NAME[`${match[1]}${match[2]}`];
  if (pc === undefined) return note;
  const octave = Number.parseInt(match[3], 10);
  if (!Number.isFinite(octave)) return note;
  const total = (octave + 1) * 12 + pc + semitones;
  const clamped = Math.max(0, Math.min(127, total));
  const newPc = ((clamped % 12) + 12) % 12;
  const newOctave = Math.floor(clamped / 12) - 1;
  return `${NOTE_NAMES_SHARP[newPc]}${newOctave}`;
};

/**
 * Return a new ChordStarter transposed into the target key, but only
 * when the mode matches. A "I V vi IV in C" starter retargeted at G
 * major becomes "I V vi IV in G". Mixed modes (major starter against
 * a minor target) return the starter unchanged.
 */
export const transposeChordStarterToKey = (
  starter: ChordStarter,
  targetRoot: number,
  targetMode: ScaleMode,
): ChordStarter => {
  if (starter.sourceMode !== targetMode) return starter;
  const semitones = ((targetRoot - starter.sourceRoot) % 12 + 12) % 12;
  if (semitones === 0) return starter;
  const targetName = NOTE_NAMES_SHARP[targetRoot];
  const sourceName = NOTE_NAMES_SHARP[starter.sourceRoot];
  return {
    ...starter,
    id: `${starter.id}__to-${targetName}`,
    label: starter.label.replace(sourceName, targetName).replace(`${sourceName} minor`, `${targetName} minor`),
    description: `${starter.description} Transposed to ${targetName} ${targetMode}.`,
    tokens: starter.tokens.map((token) => ({ ...token, note: shiftNote(token.note, semitones) })),
  };
};

const holdNote = (note: string, gate = 4, velocity = 0.6): CapturedNoteToken => ({
  note,
  gate,
  velocity,
});

export const CHORD_STARTERS: ChordStarter[] = [
  {
    id: 'pop-i-v-vi-iv-c',
    label: 'I V vi IV in C',
    description: 'Pop staple. C, G, Am, F across four bars.',
    sourceRoot: 0,
    sourceMode: 'major',
    tokens: [holdNote('C4'), holdNote('G4'), holdNote('A4'), holdNote('F4')],
  },
  {
    id: 'doo-wop-i-vi-iv-v-c',
    label: 'I vi IV V in C',
    description: 'Doo-wop / 50s ballad. C, Am, F, G across four bars.',
    sourceRoot: 0,
    sourceMode: 'major',
    tokens: [holdNote('C4'), holdNote('A4'), holdNote('F4'), holdNote('G4')],
  },
  {
    id: 'cinematic-i-vi-iii-vii-am',
    label: 'i VI III VII in A minor',
    description: 'Cinematic minor cycle. Am, F, C, G across four bars.',
    sourceRoot: 9,
    sourceMode: 'minor',
    tokens: [holdNote('A3'), holdNote('F3'), holdNote('C4'), holdNote('G3')],
  },
  {
    id: 'aeolian-descent-am',
    label: 'i VII VI V in A minor',
    description: 'Sad descent. Am, G, F, E across four bars.',
    sourceRoot: 9,
    sourceMode: 'minor',
    tokens: [holdNote('A3'), holdNote('G3'), holdNote('F3'), holdNote('E3')],
  },
  {
    id: 'jazz-ii-v-i-c',
    label: 'ii V I in C',
    description: 'Jazz cadence. Dm, G, C across three bars.',
    sourceRoot: 0,
    sourceMode: 'major',
    tokens: [holdNote('D4'), holdNote('G4'), holdNote('C4')],
  },
  {
    id: 'blues-i-iv-v-i-c',
    label: 'I IV V I in C',
    description: 'Folk / blues four-chord turn. C, F, G, C across four bars.',
    sourceRoot: 0,
    sourceMode: 'major',
    tokens: [holdNote('C4'), holdNote('F4'), holdNote('G4'), holdNote('C4')],
  },
  {
    id: 'lydian-i-ii-c',
    label: 'I II in C lydian',
    description: 'Bright modal lift. C, D across two bars.',
    sourceRoot: 0,
    sourceMode: 'major',
    tokens: [holdNote('C4'), holdNote('D4')],
  },
  {
    id: 'andalusian-am',
    label: 'i VII VI V in A minor',
    description: 'Andalusian cadence. Am, G, F, E with shorter holds for movement.',
    sourceRoot: 9,
    sourceMode: 'minor',
    tokens: [
      { note: 'A3', gate: 2, velocity: 0.62 },
      { note: 'G3', gate: 2, velocity: 0.58 },
      { note: 'F3', gate: 2, velocity: 0.58 },
      { note: 'E3', gate: 2, velocity: 0.64 },
    ],
  },
];
