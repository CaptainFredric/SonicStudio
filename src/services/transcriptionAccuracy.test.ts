import { describe, expect, it } from 'vitest';
import { transcribeSamples } from './songTranscription';

// Deterministic acoustic stress signals, not recordings of performers.
const profiles = [
  { name: 'vocal vibrato', harmonics: [1, .4, .2], vibrato: .35, noise: .01, decay: 0 },
  { name: 'breathy voice', harmonics: [1, .25, .1], vibrato: .12, noise: .08, decay: 0 },
  { name: 'bowed string', harmonics: [1, .7, .5, .3, .2], vibrato: .25, noise: .015, decay: 0 },
  { name: 'plucked string', harmonics: [1, .6, .3, .15], vibrato: 0, noise: 0, decay: 2 },
  { name: 'flute', harmonics: [1, .08, .03], vibrato: .15, noise: .015, decay: 0 },
  { name: 'weak fundamental', harmonics: [.15, 1, .6, .3], vibrato: 0, noise: 0, decay: 0 },
  { name: 'dominant second harmonic', harmonics: [.08, 1, .25], vibrato: 0, noise: 0, decay: 0 },
];

describe('transcription acoustic stress coverage', () => {
  for (const profile of profiles) {
    for (const midi of [28, 36, 40, 48, 60, 69, 81, 93]) {
      for (const rate of [22050, 44100, 48000]) {
      it(`${profile.name}, MIDI ${midi}, ${rate} Hz`, () => {
        const samples = new Float32Array(rate);
        let phase = 0;
        let seed = 42;
        for (let i = 0; i < samples.length; i += 1) {
          const time = i / rate;
          const hz = 440 * 2 ** ((midi - 69 + profile.vibrato * Math.sin(2 * Math.PI * 5 * time)) / 12);
          phase += 2 * Math.PI * hz / rate;
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const tone = profile.harmonics.reduce((sum, amplitude, h) => sum + amplitude * Math.sin(phase * (h + 1)), 0);
          const envelope = Math.min(1, time * 30, (1 - time) * 30) * Math.exp(-profile.decay * time);
          samples[i] = envelope * (.25 * tone + profile.noise * (seed / 2 ** 32 * 2 - 1));
        }
        const result = transcribeSamples(samples, rate, { bpm: 120 });
        const total = result.notes.reduce((sum, note) => sum + note.durationSteps, 0);
        const correct = result.notes.filter(note => note.midi === midi).reduce((sum, note) => sum + note.durationSteps, 0);
        expect(total, 'detect a voiced note').toBeGreaterThan(0);
        expect(correct / total, JSON.stringify(result.notes.map(n => n.note))).toBeGreaterThanOrEqual(.9);
      });
      }
    }
  }
});
