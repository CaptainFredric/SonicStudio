import { describe, expect, it } from 'vitest';

import {
  createEmptyPattern,
  createProjectFromTemplate,
  createStepEvent,
} from '../project/schema';
import {
  encodeProjectToMidiBytes,
  importMidiBytes,
} from './export';

describe('export MIDI round trips', () => {
  it('preserves note gate and velocity through MIDI bytes', () => {
    const project = createProjectFromTemplate('blank-grid');
    const clearedTracks = project.tracks.map((track) => ({
      ...track,
      patterns: Object.fromEntries(
        Array.from({ length: project.transport.patternCount }, (_, patternIndex) => [
          patternIndex,
          createEmptyPattern(project.transport.stepsPerPattern),
        ]),
      ),
    }));
    const leadTrackIndex = clearedTracks.findIndex((track) => track.type === 'lead');
    if (leadTrackIndex === -1) {
      throw new Error('Expected lead track');
    }

    const leadTrack = clearedTracks[leadTrackIndex];
    const leadPattern = leadTrack.patterns[0].map((step) => [...step]);
    leadPattern[2] = [createStepEvent('C4', { gate: 2.75, velocity: 0.64 })];
    clearedTracks[leadTrackIndex] = {
      ...leadTrack,
      patterns: {
        ...leadTrack.patterns,
        0: leadPattern,
      },
    };

    const bytes = encodeProjectToMidiBytes({
      ...project,
      tracks: clearedTracks,
      transport: {
        ...project.transport,
        currentPattern: 0,
        mode: 'PATTERN',
      },
    });
    const imported = importMidiBytes(bytes, 'roundtrip.mid');
    const importedEvent = imported.project.tracks[0]?.patterns[0]?.[2]?.[0];

    expect(imported.project.metadata.name).toBe('roundtrip');
    expect(imported.project.transport.mode).toBe('PATTERN');
    expect(importedEvent).toMatchObject({
      gate: 2.75,
      note: 'C4',
      velocity: 0.64,
    });
  });
});
