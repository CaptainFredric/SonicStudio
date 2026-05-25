import { describe, expect, it } from 'vitest';

import { createBlankProject, createTwilightFrameProject } from '../project/schema';
import { buildTrainingCorpus } from './aiTrainingCorpus';

describe('aiTrainingCorpus', () => {
  it('emits the V2 envelope and copies session-level metadata from the project', () => {
    const project = createTwilightFrameProject();
    const corpus = buildTrainingCorpus(project);

    expect(corpus.version).toBe(2);
    expect(corpus.source).toBe('sonicstudio');
    expect(corpus.session_name).toBe(project.metadata.name);
    expect(corpus.tempo_bpm).toBe(project.transport.bpm);
    expect(corpus.steps_per_pattern).toBe(project.transport.stepsPerPattern);
    expect(corpus.pattern_count).toBe(project.transport.patternCount);
    expect(corpus.tracks).toHaveLength(project.tracks.length);
  });

  it('attaches per-track stats — note count, mean velocity, octave range, density', () => {
    const project = createTwilightFrameProject();
    const corpus = buildTrainingCorpus(project);

    corpus.tracks.forEach((trainingTrack) => {
      const noteCount = corpus.notes.filter((note) => note.track_id === trainingTrack.id).length;
      expect(trainingTrack.stats.note_count).toBe(noteCount);
      if (noteCount === 0) {
        expect(trainingTrack.stats.mean_velocity).toBe(0);
        expect(trainingTrack.stats.octave_low).toBeNull();
        expect(trainingTrack.stats.octave_high).toBeNull();
      } else {
        expect(trainingTrack.stats.mean_velocity).toBeGreaterThanOrEqual(0);
        expect(trainingTrack.stats.mean_velocity).toBeLessThanOrEqual(1);
        expect(trainingTrack.stats.octave_low).not.toBeNull();
        expect(trainingTrack.stats.octave_high).not.toBeNull();
        expect(trainingTrack.stats.octave_high as number).toBeGreaterThanOrEqual(trainingTrack.stats.octave_low as number);
      }
    });
  });

  it('emits a pattern_stats row for every authored pattern, with active track ids matching the notes', () => {
    const project = createTwilightFrameProject();
    const corpus = buildTrainingCorpus(project);

    expect(corpus.pattern_stats.length).toBeGreaterThanOrEqual(project.transport.patternCount);
    corpus.pattern_stats.forEach((row) => {
      const matchingNotes = corpus.notes.filter((note) => note.pattern_index === row.pattern_index);
      expect(row.note_count).toBe(matchingNotes.length);
      const expectedTracks = new Set(matchingNotes.map((note) => note.track_id));
      expect(new Set(row.active_track_ids)).toEqual(expectedTracks);
    });
  });

  it('keeps every stat finite — no NaN or Infinity, density bounded between 0 and 1', () => {
    const project = createBlankProject('Sanity Session');
    const corpus = buildTrainingCorpus(project);

    expect(corpus.version).toBe(2);
    corpus.tracks.forEach((trainingTrack) => {
      expect(Number.isFinite(trainingTrack.stats.mean_velocity)).toBe(true);
      expect(Number.isFinite(trainingTrack.stats.density_per_step)).toBe(true);
      expect(trainingTrack.stats.density_per_step).toBeGreaterThanOrEqual(0);
      expect(trainingTrack.stats.density_per_step).toBeLessThanOrEqual(1);
    });
  });
});
