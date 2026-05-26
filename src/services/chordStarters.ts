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

export interface ChordStarter {
  id: string;
  label: string;
  description: string;
  tokens: CapturedNoteToken[];
}

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
    tokens: [holdNote('C4'), holdNote('G4'), holdNote('A4'), holdNote('F4')],
  },
  {
    id: 'doo-wop-i-vi-iv-v-c',
    label: 'I vi IV V in C',
    description: 'Doo-wop / 50s ballad. C, Am, F, G across four bars.',
    tokens: [holdNote('C4'), holdNote('A4'), holdNote('F4'), holdNote('G4')],
  },
  {
    id: 'cinematic-i-vi-iii-vii-am',
    label: 'i VI III VII in A minor',
    description: 'Cinematic minor cycle. Am, F, C, G across four bars.',
    tokens: [holdNote('A3'), holdNote('F3'), holdNote('C4'), holdNote('G3')],
  },
  {
    id: 'aeolian-descent-am',
    label: 'i VII VI V in A minor',
    description: 'Sad descent. Am, G, F, E across four bars.',
    tokens: [holdNote('A3'), holdNote('G3'), holdNote('F3'), holdNote('E3')],
  },
  {
    id: 'jazz-ii-v-i-c',
    label: 'ii V I in C',
    description: 'Jazz cadence. Dm, G, C across three bars.',
    tokens: [holdNote('D4'), holdNote('G4'), holdNote('C4')],
  },
  {
    id: 'blues-i-iv-v-i-c',
    label: 'I IV V I in C',
    description: 'Folk / blues four-chord turn. C, F, G, C across four bars.',
    tokens: [holdNote('C4'), holdNote('F4'), holdNote('G4'), holdNote('C4')],
  },
  {
    id: 'lydian-i-ii-c',
    label: 'I II in C lydian',
    description: 'Bright modal lift. C, D across two bars.',
    tokens: [holdNote('C4'), holdNote('D4')],
  },
  {
    id: 'andalusian-am',
    label: 'i VII VI V in Phrygian',
    description: 'Andalusian cadence. Am, G, F, E with shorter holds for movement.',
    tokens: [
      { note: 'A3', gate: 2, velocity: 0.62 },
      { note: 'G3', gate: 2, velocity: 0.58 },
      { note: 'F3', gate: 2, velocity: 0.58 },
      { note: 'E3', gate: 2, velocity: 0.64 },
    ],
  },
];
