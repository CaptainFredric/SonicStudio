import { describe, expect, it } from 'vitest';

import { parseMidiMessage, shouldRecordMidiNote } from './midiInput';

describe('parseMidiMessage', () => {
  it('reads a note-on with velocity', () => {
    const message = parseMidiMessage([0x90, 60, 100]);
    expect(message.type).toBe('noteon');
    expect(message.note).toBe(60);
    expect(message.velocity).toBeCloseTo(100 / 127, 5);
  });

  it('treats a note-on with zero velocity as a note-off', () => {
    const message = parseMidiMessage([0x90, 64, 0]);
    expect(message.type).toBe('noteoff');
    expect(message.note).toBe(64);
  });

  it('reads an explicit note-off', () => {
    expect(parseMidiMessage([0x80, 64, 40]).type).toBe('noteoff');
  });

  it('reads note-on across channels (low status nibble)', () => {
    // Channel 4 note-on (0x93) should still parse as note-on.
    expect(parseMidiMessage([0x93, 48, 80]).type).toBe('noteon');
  });

  it('ignores control and clock messages', () => {
    expect(parseMidiMessage([0xb0, 7, 100]).type).toBe('other'); // control change
    expect(parseMidiMessage([0xf8]).type).toBe('other'); // timing clock
  });

  it('clamps velocity into 0..1', () => {
    expect(parseMidiMessage([0x90, 60, 127]).velocity).toBeCloseTo(1, 5);
  });

  it('handles empty or missing data', () => {
    expect(parseMidiMessage([]).type).toBe('other');
    expect(parseMidiMessage(null).type).toBe('other');
  });
});

describe('shouldRecordMidiNote', () => {
  const noteOn = parseMidiMessage([0x90, 60, 100]);
  const noteOff = parseMidiMessage([0x80, 60, 0]);

  it('records a note-on only while armed and playing', () => {
    expect(shouldRecordMidiNote({ recordEnabled: true, isPlaying: true, message: noteOn })).toBe(true);
  });

  it('does not record when recording is off', () => {
    expect(shouldRecordMidiNote({ recordEnabled: false, isPlaying: true, message: noteOn })).toBe(false);
  });

  it('does not record while the transport is stopped', () => {
    expect(shouldRecordMidiNote({ recordEnabled: true, isPlaying: false, message: noteOn })).toBe(false);
  });

  it('never records note-offs or notes without a pitch', () => {
    expect(shouldRecordMidiNote({ recordEnabled: true, isPlaying: true, message: noteOff })).toBe(false);
    expect(shouldRecordMidiNote({ recordEnabled: true, isPlaying: true, message: { type: 'noteon' } })).toBe(false);
  });
});
