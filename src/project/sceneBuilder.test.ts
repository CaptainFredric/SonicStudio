import { describe, expect, it } from 'vitest';

import { arrangeSections, arrangementBars, type SceneSection } from './sceneBuilder';
import { createTrack, type TransportSettings } from './schema';

const transport: TransportSettings = {
  bpm: 125,
  countInBars: 0,
  currentPattern: 0,
  metronomeEnabled: false,
  mode: 'SONG',
  patternCount: 8,
  stepsPerPattern: 16,
};

const pad = createTrack('pad', { name: 'Pad' });
const bass = createTrack('bass', { name: 'Bass' });
const lead = createTrack('lead', { name: 'Lead' });

describe('arrangeSections', () => {
  it('lays sections end to end with cumulative start beats', () => {
    const sections: SceneSection[] = [
      { name: 'Intro', bars: 8, pattern: 2, lanes: [pad, bass] },
      { name: 'Drop', bars: 8, pattern: 0, lanes: [pad, bass, lead] },
      { name: 'Outro', bars: 4, pattern: 2, lanes: [pad] },
    ];
    const { clips, markers } = arrangeSections(transport, sections);

    // One clip per active lane.
    expect(clips).toHaveLength(2 + 3 + 1);
    // One marker per section, beats cumulative (8 bars * 16 steps = 128).
    expect(markers.map((m) => m.name)).toEqual(['Intro', 'Drop', 'Outro']);
    expect(markers.map((m) => m.beat)).toEqual([0, 128, 256]);
    // Marker ids are unique.
    expect(new Set(markers.map((m) => m.id)).size).toBe(3);
  });

  it('places each section clip at the right beat with the right length and pattern', () => {
    const sections: SceneSection[] = [
      { name: 'A', bars: 8, pattern: 0, lanes: [pad] },
      { name: 'B', bars: 8, pattern: 5, lanes: [pad] },
    ];
    const { clips } = arrangeSections(transport, sections);
    expect(clips[0]).toMatchObject({ startBeat: 0, beatLength: 128, patternIndex: 0 });
    expect(clips[1]).toMatchObject({ startBeat: 128, beatLength: 128, patternIndex: 5 });
  });

  it('sums total bars', () => {
    expect(arrangementBars([
      { name: 'A', bars: 8, pattern: 0, lanes: [] },
      { name: 'B', bars: 12, pattern: 0, lanes: [] },
    ])).toBe(20);
  });
});
