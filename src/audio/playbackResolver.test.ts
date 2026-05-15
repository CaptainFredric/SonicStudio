import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate } from '../project/schema';
import {
  findFirstPlayableStepInLoop,
  hasPlayableStepAt,
  resolvePatternStepForPlayback,
} from './playbackResolver';

const clearPatternNotes = (project: ReturnType<typeof createProjectFromTemplate>, patternIndex = 0) => {
  const stepsPerPattern = project.transport.stepsPerPattern;
  project.tracks.forEach((track) => {
    track.patterns[patternIndex] = Array.from({ length: stepsPerPattern }, () => []);
  });
};

const makeArrangerClipsByTrack = (project: ReturnType<typeof createProjectFromTemplate>) => {
  return project.arrangerClips.reduce<Record<string, typeof project.arrangerClips>>((lookup, clip) => {
    if (!lookup[clip.trackId]) {
      lookup[clip.trackId] = [];
    }
    lookup[clip.trackId].push(clip);
    return lookup;
  }, {});
};

describe('playbackResolver', () => {
  it('falls back to current pattern in song mode when a track has no clips', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    const track = project.tracks[0];
    if (!track) {
      throw new Error('Expected at least one track');
    }

    track.patterns[0][3] = [{ gate: 1, note: 'C3', velocity: 0.9 }];

    const resolved = resolvePatternStepForPlayback({
      arrangerClipsByTrack: {},
      currentPattern: 0,
      songStep: 3,
      stepsPerPattern: project.transport.stepsPerPattern,
      track,
      transportMode: 'SONG',
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.patternIndex).toBe(0);
    expect(resolved?.stepIndex).toBe(3);
    expect(resolved?.note).toHaveLength(1);
    expect(resolved?.note[0]?.note).toBe('C3');
  });

  it('returns null in song mode when clips exist but none are active at the current step', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    const track = project.tracks[0];
    if (!track) {
      throw new Error('Expected at least one track');
    }

    project.arrangerClips = [
      {
        beatLength: project.transport.stepsPerPattern,
        id: 'clip-1',
        patternIndex: 0,
        startBeat: project.transport.stepsPerPattern,
        trackId: track.id,
      },
    ];

    const resolved = resolvePatternStepForPlayback({
      arrangerClipsByTrack: makeArrangerClipsByTrack(project),
      currentPattern: 0,
      songStep: 0,
      stepsPerPattern: project.transport.stepsPerPattern,
      track,
      transportMode: 'SONG',
    });

    expect(resolved).toBeNull();
  });

  it('locates the first playable step in loop bounds', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    const track = project.tracks[0];
    if (!track) {
      throw new Error('Expected at least one track');
    }

    track.patterns[0][5] = [{ gate: 0.7, note: 'E3', velocity: 0.8 }];

    const firstPlayable = findFirstPlayableStepInLoop({
      arrangerClipsByTrack: {},
      currentPattern: 0,
      loopBounds: { endBeat: 16, startBeat: 0 },
      stepsPerPattern: project.transport.stepsPerPattern,
      tracks: project.tracks,
      transportMode: 'SONG',
    });

    expect(firstPlayable).toBe(5);
  });

  it('searches from loop start and ignores playable notes before the loop window', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    const track = project.tracks[0];
    if (!track) {
      throw new Error('Expected at least one track');
    }

    track.patterns[0][2] = [{ gate: 1, note: 'C3', velocity: 0.9 }];
    track.patterns[0][9] = [{ gate: 1, note: 'G3', velocity: 0.9 }];

    const firstPlayable = findFirstPlayableStepInLoop({
      arrangerClipsByTrack: {},
      currentPattern: 0,
      loopBounds: { endBeat: 16, startBeat: 8 },
      stepsPerPattern: project.transport.stepsPerPattern,
      tracks: project.tracks,
      transportMode: 'SONG',
    });

    expect(firstPlayable).toBe(9);
  });

  it('resolves from current pattern in PATTERN mode even when song clips are present', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    const track = project.tracks[0];
    if (!track) {
      throw new Error('Expected at least one track');
    }

    track.patterns[0][1] = [{ gate: 1, note: 'C3', velocity: 0.8 }];
    track.patterns[1][1] = [{ gate: 1, note: 'E3', velocity: 0.8 }];
    project.arrangerClips = [
      {
        beatLength: project.transport.stepsPerPattern,
        id: 'clip-song-uses-pattern-0',
        patternIndex: 0,
        startBeat: 0,
        trackId: track.id,
      },
    ];

    const resolvedPatternMode = resolvePatternStepForPlayback({
      arrangerClipsByTrack: makeArrangerClipsByTrack(project),
      currentPattern: 1,
      songStep: 1,
      stepsPerPattern: project.transport.stepsPerPattern,
      track,
      transportMode: 'PATTERN',
    });

    expect(resolvedPatternMode?.patternIndex).toBe(1);
    expect(resolvedPatternMode?.note[0]?.note).toBe('E3');
  });

  it('ignores muted tracks when checking if a step is playable', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    const track = project.tracks[0];
    if (!track) {
      throw new Error('Expected at least one track');
    }

    track.patterns[0][2] = [{ gate: 1, note: 'A2', velocity: 0.8 }];
    track.muted = true;

    const playable = hasPlayableStepAt({
      arrangerClipsByTrack: {},
      currentPattern: 0,
      songStep: 2,
      stepsPerPattern: project.transport.stepsPerPattern,
      tracks: project.tracks,
      transportMode: 'SONG',
    });

    expect(playable).toBe(false);
  });
});
