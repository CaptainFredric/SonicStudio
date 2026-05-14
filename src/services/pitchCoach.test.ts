import { describe, expect, it } from 'vitest';

import { getPitchCoachFeedback, midiToPitchHz, noteToMidi } from './pitchCoach';

describe('pitchCoach', () => {
  it('parses note names into midi numbers', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('bad-note')).toBeNull();
  });

  it('marks a matched pitch as in tune', () => {
    const feedback = getPitchCoachFeedback({
      detectedNote: 'C4',
      detectedPitchHz: midiToPitchHz(60),
      targetNote: 'C4',
    });

    expect(feedback.tone).toBe('locked');
    expect(feedback.direction).toBe('centered');
  });

  it('shows flat and sharp guidance away from the target', () => {
    const flatFeedback = getPitchCoachFeedback({
      detectedNote: 'G#3',
      detectedPitchHz: 430,
      targetNote: 'A4',
    });
    const sharpFeedback = getPitchCoachFeedback({
      detectedNote: 'A#4',
      detectedPitchHz: 470,
      targetNote: 'A4',
    });

    expect(flatFeedback.direction).toBe('flat');
    expect(flatFeedback.indicator).toBeLessThan(0.5);
    expect(sharpFeedback.direction).toBe('sharp');
    expect(sharpFeedback.indicator).toBeGreaterThan(0.5);
  });
});