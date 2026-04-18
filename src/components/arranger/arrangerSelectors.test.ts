import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate } from '../../project/schema';
import { buildLaneData, buildLaneSections, buildSectionRanges } from './arrangerSelectors';

describe('arrangerSelectors', () => {
  it('builds section ranges from markers and clip overlap', () => {
    const project = createProjectFromTemplate('night-transit');
    project.markers = [
      { beat: 0, id: 'marker-a', name: 'Intro' },
      { beat: 16, id: 'marker-b', name: 'Break' },
    ];

    const sections = buildSectionRanges(project.arrangerClips, project.markers, 48);

    expect(sections).toEqual([
      {
        clipCount: expect.any(Number),
        endBeat: 16,
        id: 'marker-a',
        label: 'Intro',
        startBeat: 0,
      },
      {
        clipCount: expect.any(Number),
        endBeat: 48,
        id: 'marker-b',
        label: 'Break',
        startBeat: 16,
      },
    ]);
    expect(sections[0].clipCount).toBeGreaterThan(0);
  });

  it('creates pinned and grouped lane sections from the canonical lane data', () => {
    const project = createProjectFromTemplate('night-transit');
    const pinnedTrackIds = [project.tracks[0].id, project.tracks[3].id];
    const laneData = buildLaneData({
      arrangerClips: project.arrangerClips,
      laneScope: 'ALL',
      pinnedTrackIds,
      selectedTrackId: null,
      tracks: project.tracks,
    });

    const sections = buildLaneSections({
      laneData,
      laneScope: 'ALL',
      pinnedTrackIds,
    });

    expect(sections[0]?.key).toBe('PINNED');
    expect(sections[0]?.lanes.map(({ track }) => track.id)).toEqual(pinnedTrackIds);
    expect(sections.some((section) => section.key === 'RHYTHM')).toBe(true);
    expect(sections.some((section) => section.key === 'MUSICAL')).toBe(true);
  });

  it('keeps pinned scope grouped by musical family without a duplicate pinned section', () => {
    const project = createProjectFromTemplate('night-transit');
    const pinnedTrackIds = [project.tracks[0].id, project.tracks[1].id];
    const laneData = buildLaneData({
      arrangerClips: project.arrangerClips,
      laneScope: 'PINNED',
      pinnedTrackIds,
      selectedTrackId: null,
      tracks: project.tracks,
    });

    const sections = buildLaneSections({
      laneData,
      laneScope: 'PINNED',
      pinnedTrackIds,
    });

    expect(sections.some((section) => section.key === 'PINNED')).toBe(false);
    expect(sections.every((section) => section.lanes.every(({ track }) => pinnedTrackIds.includes(track.id)))).toBe(true);
  });
});
