import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate, type Project } from '../../project/schema';
import {
  duplicateArrangerClipProject,
  makeClipPatternUniqueProject,
  moveArrangerClipProject,
  splitArrangerClipProject,
  syncArrangerClips,
} from './projectMutations';

const createLinkedClipProject = (patternCount = 4): { clipId: string; project: Project } => {
  const project = createProjectFromTemplate('night-transit');
  const sourceClip = project.arrangerClips[0];

  return {
    clipId: sourceClip.id,
    project: {
      ...project,
      arrangerClips: [
        sourceClip,
        {
          ...sourceClip,
          id: `${sourceClip.id}_linked`,
          startBeat: sourceClip.startBeat + sourceClip.beatLength,
        },
      ],
      transport: {
        ...project.transport,
        patternCount,
      },
    },
  };
};

describe('projectMutations', () => {
  it('duplicates a clip adjacent to the source clip and selects the duplicate', () => {
    const project = createProjectFromTemplate('night-transit');
    const sourceClip = project.arrangerClips[0];

    const mutation = duplicateArrangerClipProject(project, sourceClip.id);

    expect(mutation).not.toBeNull();
    expect(mutation?.selectedTrackId).toBe(sourceClip.trackId);

    const duplicatedClip = mutation?.project.arrangerClips.find((clip) => clip.id === mutation.selectedArrangerClipId);
    expect(duplicatedClip).toMatchObject({
      beatLength: sourceClip.beatLength,
      patternIndex: sourceClip.patternIndex,
      startBeat: sourceClip.startBeat + sourceClip.beatLength,
      trackId: sourceClip.trackId,
    });
  });

  it('moves a clip to another lane without changing its musical content', () => {
    const project = createProjectFromTemplate('night-transit');
    const sourceClip = project.arrangerClips[0];
    const sourceTrack = project.tracks.find((track) => track.id === sourceClip.trackId)!;
    const targetTrack = project.tracks.find((track) => track.id !== sourceClip.trackId)!;
    const sourcePattern = sourceTrack.patterns[sourceClip.patternIndex];
    const oldPatternCount = project.transport.patternCount;

    const mutation = moveArrangerClipProject(project, sourceClip.id, targetTrack.id, 12);

    expect(mutation).not.toBeNull();
    const movedClip = mutation!.project.arrangerClips.find((clip) => clip.id === sourceClip.id);
    expect(movedClip).toMatchObject({
      patternIndex: oldPatternCount,
      startBeat: 12,
      trackId: targetTrack.id,
    });
    expect(mutation!.project.transport.patternCount).toBe(oldPatternCount + 1);
    expect(mutation!.project.tracks.find((track) => track.id === targetTrack.id)?.patterns[oldPatternCount]).toEqual(sourcePattern);
    expect(sourceTrack.patterns[sourceClip.patternIndex]).toEqual(sourcePattern);
  });

  it('moves a clip in its lane on the four-step grid without allocating a pattern', () => {
    const project = createProjectFromTemplate('night-transit');
    const sourceClip = project.arrangerClips[0];

    const mutation = moveArrangerClipProject(project, sourceClip.id, sourceClip.trackId, 9);

    expect(mutation?.project.arrangerClips.find((clip) => clip.id === sourceClip.id)?.startBeat).toBe(8);
    expect(mutation?.project.transport.patternCount).toBe(project.transport.patternCount);
  });

  it('splits a clip on the requested snap and selects the trailing clip', () => {
    const project = createProjectFromTemplate('night-transit');
    const sourceClip = project.arrangerClips[0];

    const mutation = splitArrangerClipProject(project, sourceClip.id, sourceClip.startBeat + 8, 4);

    expect(mutation).not.toBeNull();
    const nextClips = mutation?.project.arrangerClips.filter((clip) => clip.trackId === sourceClip.trackId) ?? [];
    const leadingClip = nextClips.find((clip) => clip.id === sourceClip.id);
    const trailingClip = nextClips.find((clip) => clip.id === mutation?.selectedArrangerClipId);

    expect(leadingClip?.beatLength).toBe(8);
    expect(trailingClip).toMatchObject({
      beatLength: sourceClip.beatLength - 8,
      patternIndex: sourceClip.patternIndex,
      patternOffset: 8,
      startBeat: sourceClip.startBeat + 8,
      trackId: sourceClip.trackId,
    });
  });

  it('keeps clips addressable beyond the old 4096-step timeline ceiling', () => {
    const project = createProjectFromTemplate('night-transit');
    const sourceClip = project.arrangerClips[0];
    const synced = syncArrangerClips(
      [{ ...sourceClip, startBeat: 5000 }],
      project.tracks,
      project.transport.patternCount,
    );

    expect(synced[0].startBeat).toBe(5000);
  });

  it('clamps split requests to keep both halves viable', () => {
    const project = createProjectFromTemplate('night-transit');
    const sourceClip = project.arrangerClips[0];

    const mutation = splitArrangerClipProject(project, sourceClip.id, sourceClip.startBeat + 1, 4);

    expect(mutation).not.toBeNull();
    const leadingClip = mutation?.project.arrangerClips.find((clip) => clip.id === sourceClip.id);
    const trailingClip = mutation?.project.arrangerClips.find((clip) => clip.id === mutation.selectedArrangerClipId);

    expect(leadingClip?.beatLength).toBe(4);
    expect(trailingClip?.beatLength).toBe(sourceClip.beatLength - 4);
  });

  it('makes a linked clip unique by retargeting it to an unused pattern slot', () => {
    const { clipId, project } = createLinkedClipProject();
    const sourceTrack = project.tracks.find((track) => track.id === project.arrangerClips[0].trackId);
    if (!sourceTrack) {
      throw new Error('Expected source track');
    }

    const sourcePattern = sourceTrack.patterns[project.arrangerClips[0].patternIndex];
    const sourceAutomation = sourceTrack.automation[project.arrangerClips[0].patternIndex];
    const mutation = makeClipPatternUniqueProject(project, clipId);

    expect(mutation).not.toBeNull();
    const selectedClip = mutation?.project.arrangerClips.find((clip) => clip.id === clipId);
    const nextTrack = mutation?.project.tracks.find((track) => track.id === sourceTrack.id);

    expect(selectedClip?.patternIndex).not.toBe(project.arrangerClips[0].patternIndex);
    expect(nextTrack?.patterns[selectedClip?.patternIndex ?? -1]).toEqual(sourcePattern);
    expect(nextTrack?.automation[selectedClip?.patternIndex ?? -1]).toEqual(sourceAutomation);
  });

  it('does nothing when a clip is already unique', () => {
    const project = createProjectFromTemplate('night-transit');
    // A clip is already unique when no other clip on the same track shares its
    // pattern, so "make unique" has nothing to retarget.
    const uniqueClip = project.arrangerClips.find((clip) => (
      project.arrangerClips.filter((other) => (
        other.trackId === clip.trackId && other.patternIndex === clip.patternIndex
      )).length === 1
    ));
    if (!uniqueClip) {
      throw new Error('Expected at least one already-unique clip in the fixture');
    }

    expect(makeClipPatternUniqueProject(project, uniqueClip.id)).toBeNull();
  });

  it('does nothing when no free pattern slot exists for uniqueness', () => {
    const { clipId, project } = createLinkedClipProject(1);

    expect(makeClipPatternUniqueProject(project, clipId)).toBeNull();
  });
});
