import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate } from '../project/schema';
import { buildBounceHistoryEntry, buildRenderProject } from './renderWorkflow';

describe('renderWorkflow', () => {
  it('builds a pattern render payload with transport safety applied', () => {
    const project = createProjectFromTemplate('night-transit');
    const payload = buildRenderProject({
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      project,
      scope: 'pattern',
      selectedArrangerClipId: null,
    });

    expect(payload).not.toBeNull();
    expect(payload?.project.transport.mode).toBe('PATTERN');
    expect(payload?.project.transport.countInBars).toBe(0);
    expect(payload?.project.transport.metronomeEnabled).toBe(false);
  });

  it('clips arranger content for a loop window render', () => {
    const project = createProjectFromTemplate('night-transit');
    project.markers = [
      { beat: 0, id: 'marker-a', name: 'Intro' },
      { beat: 19, id: 'marker-b', name: 'Drop' },
    ];

    const payload = buildRenderProject({
      loopRangeEndBeat: 20,
      loopRangeStartBeat: 8,
      project,
      scope: 'loop-window',
      selectedArrangerClipId: null,
    });

    expect(payload).not.toBeNull();
    expect(payload?.project.arrangerClips.every((clip) => clip.startBeat >= 0)).toBe(true);
    expect(payload?.project.arrangerClips.every((clip) => clip.startBeat + clip.beatLength <= 12)).toBe(true);
    expect(payload?.project.markers).toEqual([{ beat: 11, id: 'marker-b', name: 'Drop' }]);
  });

  it('returns null for clip-window render without a selected clip', () => {
    const project = createProjectFromTemplate('night-transit');
    const payload = buildRenderProject({
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      project,
      scope: 'clip-window',
      selectedArrangerClipId: null,
    });

    expect(payload).toBeNull();
  });

  it('builds bounce history entries with matching snapshot metadata', () => {
    const project = createProjectFromTemplate('night-transit');
    project.masterSnapshots = [
      {
        id: 'snapshot-1',
        name: 'Trusted print',
        settings: { ...project.master },
        updatedAt: '2026-04-17T12:00:00.000Z',
      },
    ];

    const entry = buildBounceHistoryEntry(
      project,
      'mix',
      'song',
      { normalization: 'target', targetProfileId: 'club' },
      'Song mix',
      {
        crestDb: 9.4,
        durationSeconds: 42.1,
        estimatedLufs: -11.2,
        peakDb: -0.8,
        quality: 'clean',
        recommendation: 'Close enough for a club reference.',
        rmsDb: -13.9,
        sampleRate: 44100,
        targetDeltaDb: 0.4,
        targetLabel: 'Club',
        targetLufs: -10.5,
        targetLufsDelta: -0.7,
        targetProfileId: 'club',
        targetVerdict: 'aligned',
      },
    );

    expect(entry.masterSnapshotName).toBe('Trusted print');
    expect(entry.normalization).toBe('target');
    expect(entry.targetProfileId).toBe('club');
    expect(entry.targetVerdict).toBe('aligned');
  });
});
