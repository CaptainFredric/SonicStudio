import { describe, expect, it } from 'vitest';

import {
  createArrangerClip,
  createProjectFromTemplate,
  createStepEvent,
  createTrack,
  getTrackVoicePresetDefinitions,
  normalizeProject,
  resizeTrackPatterns,
} from './schema';

const countPatternNotes = (patterns: Record<number, Array<Array<{ note: string }>>>) => (
  Object.values(patterns).reduce((total, steps) => (
    total + steps.reduce((stepTotal, step) => stepTotal + step.length, 0)
  ), 0)
);

describe('track defaults', () => {
  it('boots the hat lane in the sample engine so the named hat source is actually used', () => {
    const track = createTrack('hihat');

    expect(track.source.engine).toBe('sample');
    expect(track.source.samplePreset).toBe('hat-air');
    expect(track.source.sampleTriggerMode).toBe('full-source');
  });

  it('boots the glass pad in the sample engine so the pad source stays available by default', () => {
    const track = createTrack('pad');

    expect(track.source.engine).toBe('sample');
    expect(track.source.samplePreset).toBe('pad-haze');
    expect(track.source.samplePlayback).toBe('pitched');
  });

  it('ships Night Transit as a fuller default song sketch', () => {
    const project = createProjectFromTemplate('night-transit');
    const bassTrack = project.tracks.find((track) => track.type === 'bass');
    const leadTrack = project.tracks.find((track) => track.type === 'lead');
    const padTrack = project.tracks.find((track) => track.type === 'pad');

    expect(bassTrack).toBeTruthy();
    expect(leadTrack).toBeTruthy();
    expect(padTrack).toBeTruthy();
    expect(countPatternNotes(bassTrack!.patterns)).toBeGreaterThanOrEqual(12);
    expect(countPatternNotes(leadTrack!.patterns)).toBeGreaterThanOrEqual(15);
    expect(countPatternNotes(padTrack!.patterns)).toBeGreaterThanOrEqual(36);
  });

  it('boots Blank Grid with a fuller lane set ready to sketch on immediately', () => {
    const project = createProjectFromTemplate('blank-grid');
    const padTrack = project.tracks.find((track) => track.type === 'pad');

    expect(project.tracks.map((track) => track.type)).toEqual(['kick', 'snare', 'hihat', 'bass', 'lead', 'pad']);
    expect(project.arrangerClips).toHaveLength(6);
    expect(padTrack).toBeTruthy();
    expect(countPatternNotes(padTrack!.patterns)).toBeGreaterThanOrEqual(3);
  });

  it('ships Club Horizon and Starlight Parade as additional ready-to-play starter scenes', () => {
    const club = createProjectFromTemplate('club-horizon');
    const starlight = createProjectFromTemplate('starlight-parade');
    const clubPluck = club.tracks.find((track) => track.type === 'pluck');
    const starlightLead = starlight.tracks.find((track) => track.type === 'lead');

    expect(club.tracks).toHaveLength(7);
    expect(starlight.tracks).toHaveLength(7);
    expect(clubPluck).toBeTruthy();
    expect(starlightLead).toBeTruthy();
    expect(countPatternNotes(clubPluck!.patterns)).toBeGreaterThanOrEqual(8);
    expect(countPatternNotes(starlightLead!.patterns)).toBeGreaterThanOrEqual(11);
  });

  it('supports extended pattern and arranger lengths for longer compositions', () => {
    const track = createTrack('lead', { stepsPerPattern: 4096 });
    const clip = createArrangerClip(track.id, {
      bpm: 128,
      countInBars: 0,
      currentPattern: 0,
      metronomeEnabled: false,
      mode: 'PATTERN',
      patternCount: 4,
      stepsPerPattern: 4096,
    }, {
      beatLength: 8192,
      startBeat: 12000,
    });

    expect(track.patterns[0]).toHaveLength(4096);
    expect(clip.beatLength).toBe(8192);
    expect(clip.startBeat).toBe(12000);
  });

  it('keeps overflow notes when shrinking pattern length so they can be restored later', () => {
    const track = createTrack('lead', { patternCount: 4, stepsPerPattern: 64 });
    track.patterns[0][40] = [createStepEvent('A4', { gate: 2, velocity: 0.7 })];

    const resized = resizeTrackPatterns(track, 4, 16);

    expect(resized.patterns[0].length).toBeGreaterThanOrEqual(64);
    expect(resized.patterns[0][40]?.[0]?.note).toBe('A4');
  });

  it('preserves overflow pattern content during normalizeProject when transport length is shorter', () => {
    const project = createProjectFromTemplate('blank-grid');
    const leadTrack = project.tracks.find((track) => track.type === 'lead');

    expect(leadTrack).toBeTruthy();
    leadTrack!.patterns[0][48] = [createStepEvent('G4', { gate: 1, velocity: 0.75 })];
    if (leadTrack!.automation?.[0]) {
      leadTrack!.automation[0].level[48] = 0.66;
      leadTrack!.automation[0].tone[48] = 0.41;
    }
    project.transport.stepsPerPattern = 16;

    const normalized = normalizeProject(project as unknown);

    expect(normalized).toBeTruthy();
    const normalizedLeadTrack = normalized!.tracks.find((track) => track.type === 'lead');
    expect(normalizedLeadTrack).toBeTruthy();
    expect(normalizedLeadTrack!.patterns[0].length).toBeGreaterThanOrEqual(49);
    expect(normalizedLeadTrack!.patterns[0][48]?.[0]?.note).toBe('G4');
    expect(normalizedLeadTrack!.automation?.[0].level[48]).toBeCloseTo(0.66, 2);
    expect(normalizedLeadTrack!.automation?.[0].tone[48]).toBeCloseTo(0.41, 2);
  });

  it('offers foundational primary voice starts on melodic lanes', () => {
    const leadPresets = getTrackVoicePresetDefinitions('lead');
    const foundationIds = leadPresets
      .filter((preset) => preset.id.startsWith('foundation-'))
      .map((preset) => preset.id);

    expect(foundationIds).toEqual(expect.arrayContaining([
      'foundation-sine-core',
      'foundation-triangle-core',
      'foundation-saw-core',
      'foundation-square-core',
    ]));
  });

  it('keeps noise foundation limited to percussive and texture-oriented lanes', () => {
    const leadPresetIds = getTrackVoicePresetDefinitions('lead').map((preset) => preset.id);
    const hihatPresetIds = getTrackVoicePresetDefinitions('hihat').map((preset) => preset.id);

    expect(leadPresetIds.includes('foundation-noise-core')).toBe(false);
    expect(hihatPresetIds.includes('foundation-noise-core')).toBe(true);
  });
});