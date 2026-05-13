import { describe, expect, it } from 'vitest';

import { createTrack } from './schema';

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
});