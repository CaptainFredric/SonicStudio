import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate } from '../project/schema';
import {
  findFirstPlayableStepInLoop,
  hasPlayableStepAt,
  isTrackAudible,
  lastActivePatternStep,
  resolvePatternStepForPlayback,
} from './playbackResolver';

describe('isTrackAudible', () => {
  it('plays an unmuted track when nothing is soloed', () => {
    expect(isTrackAudible({ muted: false, solo: false }, false)).toBe(true);
  });

  it('silences a muted track regardless of solo state', () => {
    expect(isTrackAudible({ muted: true, solo: false }, false)).toBe(false);
    expect(isTrackAudible({ muted: true, solo: true }, true)).toBe(false);
  });

  it('keeps only the soloed tracks audible while a solo is held', () => {
    expect(isTrackAudible({ muted: false, solo: true }, true)).toBe(true);
    expect(isTrackAudible({ muted: false, solo: false }, true)).toBe(false);
  });
});

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
  it('stays silent in song mode when a track has no arranged clips', () => {
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

    expect(resolved).toBeNull();
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

  it('continues from a clip pattern offset after a structural edit', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    const track = project.tracks[0];
    if (!track) {
      throw new Error('Expected at least one track');
    }
    track.patterns[0][6] = [{ gate: 1, note: 'F3', velocity: 0.8 }];
    project.arrangerClips = [{
      beatLength: 8,
      id: 'offset-clip',
      patternIndex: 0,
      patternOffset: 6,
      startBeat: 12,
      trackId: track.id,
    }];

    const resolved = resolvePatternStepForPlayback({
      arrangerClipsByTrack: makeArrangerClipsByTrack(project),
      currentPattern: 0,
      songStep: 12,
      stepsPerPattern: project.transport.stepsPerPattern,
      track,
      transportMode: 'SONG',
    });

    expect(resolved?.stepIndex).toBe(6);
    expect(resolved?.note[0]?.note).toBe('F3');
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
      arrangerClipsByTrack: makeArrangerClipsByTrack(project),
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
      arrangerClipsByTrack: makeArrangerClipsByTrack(project),
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

describe('lastActivePatternStep', () => {
  it('returns -1 for an empty pattern', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    expect(lastActivePatternStep(project.tracks, 0, project.transport.stepsPerPattern)).toBe(-1);
  });

  it('finds the last placed note across tracks and ignores the empty tail', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    // A note early on track 0 and a later one on track 1, inside a 32-step span.
    project.tracks[0].patterns[0][2] = [{ gate: 1, note: 'C3', velocity: 0.9 }];
    project.tracks[1].patterns[0][24] = [{ gate: 1, note: 'E3', velocity: 0.8 }];
    // Trailing steps 25..31 stay empty.
    expect(lastActivePatternStep(project.tracks, 0, 32)).toBe(24);
  });

  it('never reports a step at or beyond the allocated length', () => {
    const project = createProjectFromTemplate('blank-grid');
    clearPatternNotes(project);
    project.tracks[0].patterns[0][20] = [{ gate: 1, note: 'C3', velocity: 0.9 }];
    // Even if a stray note sits past the length, the loop stays within bounds.
    project.tracks[0].patterns[0][40] = [{ gate: 1, note: 'C3', velocity: 0.9 }];
    expect(lastActivePatternStep(project.tracks, 0, 32)).toBe(20);
  });
});
