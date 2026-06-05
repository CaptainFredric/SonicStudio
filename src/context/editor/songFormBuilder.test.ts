import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate } from '../../project/schema';
import { buildSongFormProject } from './songFormBuilder';
import { SONG_FORM_DEFINITIONS } from './songFormDefinitions';

const sectionStarts = (sections: Array<{ length: number }>) => {
  let cursor = 0;

  return sections.map((section) => {
    const start = cursor;
    cursor += section.length;
    return start;
  });
};

describe('songFormBuilder', () => {
  it('builds a complete marked arrangement from the current project lanes', () => {
    const project = createProjectFromTemplate('night-transit');
    const definition = SONG_FORM_DEFINITIONS.find((candidate) => candidate.id === 'full-arc');
    const result = buildSongFormProject(project, 'full-arc');

    if (!definition || !result) {
      throw new Error('Expected full arc song form');
    }

    const totalLength = definition.sections.reduce((sum, section) => sum + section.length, 0);

    expect(result.project.transport.mode).toBe('SONG');
    expect(result.project.markers.map((marker) => marker.name)).toEqual(
      definition.sections.map((section) => section.label),
    );
    expect(result.project.markers.map((marker) => marker.beat)).toEqual(sectionStarts(definition.sections));
    // A complete arrangement places at least one clip in every section it marks.
    expect(result.project.arrangerClips.length).toBeGreaterThanOrEqual(definition.sections.length);
    expect(result.project.arrangerClips.every((clip) => (
      clip.patternIndex >= 0 && clip.patternIndex < project.transport.patternCount
    ))).toBe(true);
    expect(result.project.arrangerClips.every((clip) => (
      result.project.tracks.some((track) => track.id === clip.trackId)
    ))).toBe(true);
    expect(Math.max(...result.project.arrangerClips.map((clip) => clip.startBeat + clip.beatLength))).toBe(totalLength);
    expect(result.selectedArrangerClipId).toBe(result.project.arrangerClips[0]?.id ?? null);
    expect(result.selectedTrackId).toBe(result.project.arrangerClips[0]?.trackId ?? null);
  });

  it('uses lighter intro roles and fuller lift roles', () => {
    const project = createProjectFromTemplate('night-transit');
    const result = buildSongFormProject(project, 'short-arc');

    if (!result) {
      throw new Error('Expected short arc song form');
    }

    const introClipCount = result.project.arrangerClips.filter((clip) => clip.startBeat === 0).length;
    const liftClipCount = result.project.arrangerClips.filter((clip) => clip.startBeat === 32).length;

    expect(introClipCount).toBeGreaterThan(0);
    expect(liftClipCount).toBeGreaterThan(introClipCount);
  });
});
