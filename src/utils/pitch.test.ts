import { describe, expect, it } from 'vitest';

import {
  bestKeyTranspose,
  inKeyPitchClasses,
  noteFitsKey,
  NOTE_NAMES_SHARP,
  PITCH_CLASS_BY_NAME,
  pitchClassFromNote,
  scaleDegreesFor,
} from './pitch';

describe('pitchClassFromNote', () => {
  it('reads naturals, sharps, and flats, ignoring the octave', () => {
    expect(pitchClassFromNote('C4')).toBe(0);
    expect(pitchClassFromNote('F#3')).toBe(6);
    expect(pitchClassFromNote('Bb2')).toBe(10);
    expect(pitchClassFromNote('A')).toBe(9);
    expect(pitchClassFromNote('B-1')).toBe(11);
  });

  it('accepts lower-case letters', () => {
    expect(pitchClassFromNote('g4')).toBe(7);
  });

  it('returns null when there is no leading note letter', () => {
    // The parser is intentionally permissive about a leading A-G letter
    // (it matches the behaviour of the per-file parsers it replaced), so
    // these reject only because they do not start with a note letter.
    expect(pitchClassFromNote('xyz')).toBeNull();
    expect(pitchClassFromNote('123')).toBeNull();
    expect(pitchClassFromNote('')).toBeNull();
  });

  it('round-trips through NOTE_NAMES_SHARP', () => {
    for (let pc = 0; pc < 12; pc += 1) {
      expect(pitchClassFromNote(`${NOTE_NAMES_SHARP[pc]}4`)).toBe(pc);
    }
  });
});

describe('scaleDegreesFor / inKeyPitchClasses', () => {
  it('returns the seven major degrees and seven minor degrees', () => {
    expect([...scaleDegreesFor('major')]).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect([...scaleDegreesFor('minor')]).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it('builds the A minor diatonic set (A B C D E F G)', () => {
    // A = 9. A minor pitch classes: A(9) B(11) C(0) D(2) E(4) F(5) G(7).
    const set = inKeyPitchClasses(9, 'minor');
    expect([...set].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('builds the C major diatonic set (C D E F G A B)', () => {
    const set = inKeyPitchClasses(0, 'major');
    expect([...set].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
});

describe('noteFitsKey', () => {
  it('accepts diatonic notes and rejects chromatic ones in G minor', () => {
    const root = PITCH_CLASS_BY_NAME.G; // 7
    expect(noteFitsKey('G4', root, 'minor')).toBe(true);
    expect(noteFitsKey('A#3', root, 'minor')).toBe(true); // Bb in key
    expect(noteFitsKey('B3', root, 'minor')).toBe(false); // B natural not in G minor
    expect(noteFitsKey('F#4', root, 'minor')).toBe(false);
  });
});

describe('bestKeyTranspose', () => {
  it('leaves an already in-key phrase untouched', () => {
    expect(bestKeyTranspose([0, 2, 4, 7], 0, 'major')).toBe(0); // C D E G in C major
  });

  it('shifts an out-of-key phrase onto the scale', () => {
    // B, C#, D#, F#: a semitone up lands on C, D, E, G (all in C major).
    expect(bestKeyTranspose([11, 1, 3, 6], 0, 'major')).toBe(1);
  });

  it('returns 0 for an empty phrase', () => {
    expect(bestKeyTranspose([], 9, 'minor')).toBe(0);
  });
});
