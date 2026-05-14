import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate, createTrack } from './schema';

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
});