import { describe, expect, it } from 'vitest';

import {
  appendTranscriptionToSession,
  buildSessionFromTranscription,
  correctOctaveJumps,
  detectPitchHz,
  frequencyToMidi,
  highPassFilter,
  midiToNoteName,
  segmentNotes,
  transcribeSamples,
  type FrameAnalysis,
  type TranscriptionResult,
} from './songTranscription';
import { createProjectFromTemplate, createStepEvent, MAX_PATTERN_COUNT } from '../project/schema';

const SAMPLE_RATE = 44100;

/** Build a Float32Array holding a sine tone of the given pitch and length. */
const sineTone = (hz: number, seconds: number, amplitude = 0.6): Float32Array => {
  const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE);
  }
  return samples;
};

/** Concatenate several signals into one buffer. */
const concat = (...parts: Float32Array[]): Float32Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

describe('songTranscription note math', () => {
  it('converts MIDI numbers to note names', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(69)).toBe('A4');
    expect(midiToNoteName(61)).toBe('C#4');
  });

  it('converts frequency to MIDI', () => {
    expect(Math.round(frequencyToMidi(440))).toBe(69);
    expect(Math.round(frequencyToMidi(261.63))).toBe(60);
  });
});

describe('detectPitchHz', () => {
  it('locks onto a clean sine tone within a few cents', () => {
    const frame = sineTone(220, 0.2).subarray(0, 1024);
    const detected = detectPitchHz(frame, SAMPLE_RATE);
    expect(detected).toBeGreaterThan(210);
    expect(detected).toBeLessThan(230);
  });

  it('returns -1 for silence', () => {
    const silent = new Float32Array(1024);
    expect(detectPitchHz(silent, SAMPLE_RATE)).toBe(-1);
  });
});

describe('transcribeSamples', () => {
  it('transcribes a steady hummed note into a single grid note', () => {
    const result = transcribeSamples(sineTone(440, 1.2), SAMPLE_RATE, { bpm: 120 });
    expect(result.notes.length).toBeGreaterThan(0);
    // A4 is MIDI 69; allow an octave of tracker slack.
    expect(result.notes[0].note).toMatch(/A[34]/);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.polyphonic).toBe(false);
  });

  it('captures a two-note melody as separate notes', () => {
    const melody = concat(sineTone(261.63, 0.6), sineTone(392, 0.6));
    const result = transcribeSamples(melody, SAMPLE_RATE, { bpm: 120 });
    expect(result.notes.length).toBeGreaterThanOrEqual(2);
    const midis = result.notes.map((note) => note.midi);
    expect(Math.max(...midis)).toBeGreaterThan(Math.min(...midis));
  });

  it('reports an empty result for silence without throwing', () => {
    const result = transcribeSamples(new Float32Array(SAMPLE_RATE), SAMPLE_RATE);
    expect(result.notes).toHaveLength(0);
    expect(result.summary).toContain('No clear');
  });
});

describe('buildSessionFromTranscription', () => {
  it('assembles a loadable session with one melodic track', () => {
    const result: TranscriptionResult = {
      bpm: 120,
      confidence: 0.8,
      durationSeconds: 4,
      polyphonic: false,
      summary: 'test',
      notes: [
        { midi: 60, note: 'C4', startStep: 0, durationSteps: 2, velocity: 0.8 },
        { midi: 64, note: 'E4', startStep: 4, durationSteps: 2, velocity: 0.7 },
      ],
    };
    const session = buildSessionFromTranscription(result, 'My hum');
    expect(session.project.tracks).toHaveLength(1);
    expect(session.project.metadata.name).toBe('My hum');
    expect(session.project.transport.bpm).toBe(120);

    const placedNotes = session.project.tracks[0].patterns[0]
      .flat()
      .map((event) => event.note);
    expect(placedNotes).toContain('C4');
    expect(placedNotes).toContain('E4');
  });

  it('falls back to a default project name when none is given', () => {
    const session = buildSessionFromTranscription(
      { bpm: 110, confidence: 0.5, durationSeconds: 2, polyphonic: false, summary: '', notes: [] },
      '   ',
    );
    expect(session.project.metadata.name).toBe('Transcribed take');
  });

  it('keeps long takes through the full supported pattern range', () => {
    const session = buildSessionFromTranscription(
      {
        bpm: 120,
        confidence: 0.8,
        durationSeconds: 120,
        polyphonic: false,
        summary: 'long take',
        notes: [{ midi: 69, note: 'A4', startStep: 1000, durationSteps: 8, velocity: 0.7 }],
      },
      'Long take',
    );

    expect(session.project.transport.patternCount).toBe(MAX_PATTERN_COUNT);
    expect(session.project.tracks[0].patterns[15][40][0]).toMatchObject({ gate: 8, note: 'A4' });
  });
});

describe('appendTranscriptionToSession', () => {
  it('adds a lane at the selected pattern without replacing the song', () => {
    const project = createProjectFromTemplate('blank-grid');
    project.metadata.name = 'Keep this song';
    project.transport.bpm = 98;
    project.transport.currentPattern = 3;
    project.tracks[0].patterns[0][0] = [createStepEvent('C4')];

    const appended = appendTranscriptionToSession(
      {
        project,
        ui: {
          activeView: 'MIXER',
          isSettingsOpen: false,
          loopRangeEndBeat: null,
          loopRangeStartBeat: null,
          pinnedTrackIds: [],
          selectedArrangerClipId: null,
          selectedTrackId: project.tracks[0].id,
        },
      },
      {
        bpm: 120,
        confidence: 0.8,
        durationSeconds: 4,
        polyphonic: false,
        summary: 'phrase',
        notes: [
          { midi: 60, note: 'C4', startStep: 0, durationSteps: 2, velocity: 0.8 },
          { midi: 64, note: 'E4', startStep: 18, durationSteps: 2, velocity: 0.7 },
        ],
      },
      { laneName: 'Kitchen melody' },
    );

    expect(appended).not.toBeNull();
    expect(appended!.session.project.metadata.name).toBe('Keep this song');
    expect(appended!.session.project.transport.bpm).toBe(98);
    expect(appended!.session.project.tracks).toHaveLength(project.tracks.length + 1);
    expect(appended!.session.project.tracks[0].patterns[0][0][0].note).toBe('C4');
    expect(appended!.session.project.transport.patternCount).toBe(5);
    const lane = appended!.session.project.tracks.at(-1)!;
    expect(lane.name).toBe('Kitchen melody');
    expect(lane.patterns[3][0][0].note).toBe('C4');
    expect(lane.patterns[4][2][0].note).toBe('E4');
    expect(appended!.session.ui.selectedTrackId).toBe(lane.id);
  });

  it('refuses a phrase that cannot fit instead of dropping its ending', () => {
    const project = createProjectFromTemplate('blank-grid');
    project.transport.currentPattern = project.transport.patternCount - 1;
    const appended = appendTranscriptionToSession(
      {
        project,
        ui: {
          activeView: 'SEQUENCER',
          isSettingsOpen: false,
          loopRangeEndBeat: null,
          loopRangeStartBeat: null,
          pinnedTrackIds: [],
          selectedArrangerClipId: null,
          selectedTrackId: project.tracks[0].id,
        },
      },
      {
        bpm: 120,
        confidence: 0.8,
        durationSeconds: 120,
        polyphonic: false,
        summary: 'too long',
        notes: [{ midi: 60, note: 'C4', startStep: 900, durationSteps: 8, velocity: 0.8 }],
      },
    );

    expect(appended).toBeNull();
  });
});

const frame = (midi: number | null, rms = 0.5): FrameAnalysis => ({ midi, rms });

describe('correctOctaveJumps', () => {
  it('folds an isolated octave slip back to the surrounding pitch', () => {
    const frames = [
      ...Array(5).fill(0).map(() => frame(60)),
      frame(72), // a single frame jumps an octave (classic tracker slip)
      ...Array(5).fill(0).map(() => frame(60)),
    ];
    const corrected = correctOctaveJumps(frames);
    corrected.forEach((f) => {
      expect(f.midi).not.toBeNull();
      expect(Math.abs((f.midi as number) - 60)).toBeLessThan(0.5);
    });
  });

  it('leaves a real interval (a fifth) untouched', () => {
    const frames = [
      ...Array(5).fill(0).map(() => frame(60)),
      ...Array(5).fill(0).map(() => frame(67)), // perfect fifth, not an octave
    ];
    const corrected = correctOctaveJumps(frames);
    expect(corrected.slice(5).every((f) => Math.abs((f.midi as number) - 67) < 0.5)).toBe(true);
  });

  it('accepts a sustained octave move instead of fighting it', () => {
    const frames = [
      ...Array(5).fill(0).map(() => frame(60)),
      ...Array(6).fill(0).map(() => frame(72)), // a held octave leap is real
    ];
    const corrected = correctOctaveJumps(frames);
    // The last frame should track the real octave-up move, not be folded down.
    expect(corrected[corrected.length - 1].midi).toBeCloseTo(72, 0);
  });
});

describe('segmentNotes gap bridging', () => {
  const hopSeconds = 0.04; // matches the analysis hop (480 / 12000)

  it('holds one note through a brief unvoiced dropout', () => {
    const frames = [
      ...Array(6).fill(0).map(() => frame(60)),
      frame(null), // ~40 ms gap, under the bridge threshold
      ...Array(6).fill(0).map(() => frame(60)),
    ];
    const notes = segmentNotes(frames, hopSeconds);
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
  });

  it('splits into two notes when the gap is long enough to be a rest', () => {
    const frames = [
      ...Array(6).fill(0).map(() => frame(60)),
      ...Array(5).fill(0).map(() => frame(null)), // ~200 ms rest
      ...Array(6).fill(0).map(() => frame(60)),
    ];
    const notes = segmentNotes(frames, hopSeconds);
    expect(notes).toHaveLength(2);
  });

  it('drops a lone voiced frame as a transient but keeps a sustained note', () => {
    const frames = [
      frame(60), // single voiced frame ~40 ms: a click, below the keep threshold
      ...Array(5).fill(0).map(() => frame(null)),
      ...Array(4).fill(0).map(() => frame(67)), // sustained ~160 ms note: kept
    ];
    const notes = segmentNotes(frames, hopSeconds);
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(67);
  });
});

describe('highPassFilter', () => {
  it('removes a DC offset while preserving a mid tone', () => {
    const tone = sineTone(220, 0.3, 0.5);
    const withDc = tone.map((sample) => sample + 0.4);
    const filtered = highPassFilter(withDc, SAMPLE_RATE, 40);
    // The +0.4 DC offset should collapse toward zero after the high-pass.
    const mean = filtered.reduce((sum, sample) => sum + sample, 0) / filtered.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    // The 220 Hz tone sits well above the 40 Hz cutoff, so its energy survives.
    const rms = Math.sqrt(filtered.reduce((sum, sample) => sum + sample * sample, 0) / filtered.length);
    expect(rms).toBeGreaterThan(0.25);
  });

  it('leaves an empty buffer untouched', () => {
    expect(highPassFilter(new Float32Array(0), SAMPLE_RATE, 40).length).toBe(0);
  });
});
