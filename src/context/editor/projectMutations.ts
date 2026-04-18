import {
  createArrangerClip as buildArrangerClip,
  createEmptyPattern,
  type ArrangementClip,
  type NoteEvent,
  type Project,
  type Track,
} from '../../project/schema';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cloneStepEvents = (step: NoteEvent[]) => step.map((event) => ({ ...event }));

export interface ProjectMutationSelection {
  selectedArrangerClipId: string;
  selectedTrackId: string;
}

export const syncArrangerClips = (
  arrangerClips: ArrangementClip[],
  tracks: Track[],
  patternCount: number,
): ArrangementClip[] => {
  if (arrangerClips.length === 0 || tracks.length === 0) {
    return [];
  }

  const trackOrder = new Map(tracks.map((track, index) => [track.id, index]));

  return arrangerClips
    .filter((clip) => trackOrder.has(clip.trackId))
    .map((clip) => ({
      ...clip,
      beatLength: clamp(Math.round(clip.beatLength || 16), 4, 128),
      patternIndex: clamp(Math.round(clip.patternIndex || 0), 0, Math.max(patternCount - 1, 0)),
      startBeat: clamp(Math.round(clip.startBeat || 0), 0, 4096),
    }))
    .sort((left, right) => {
      const leftTrackIndex = trackOrder.get(left.trackId) ?? 0;
      const rightTrackIndex = trackOrder.get(right.trackId) ?? 0;

      if (leftTrackIndex !== rightTrackIndex) {
        return leftTrackIndex - rightTrackIndex;
      }

      return left.startBeat - right.startBeat;
    });
};

export const updateTrack = (
  project: Project,
  trackId: string,
  updater: (track: Track) => Track,
): Project => {
  let didChange = false;
  const tracks = project.tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }

    const nextTrack = updater(track);
    if (nextTrack !== track) {
      didChange = true;
    }

    return nextTrack;
  });

  return didChange ? { ...project, tracks } : project;
};

const getClipContext = (project: Project, clipId: string) => {
  const clip = project.arrangerClips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    return null;
  }

  const track = project.tracks.find((candidate) => candidate.id === clip.trackId);
  if (!track) {
    return null;
  }

  return { clip, track };
};

export const getUniqueClipPatternProject = (
  project: Project,
  clipId: string,
): { clip: ArrangementClip; project: Project; track: Track } | null => {
  const context = getClipContext(project, clipId);
  if (!context) {
    return null;
  }

  const { clip, track } = context;
  const linkedClips = project.arrangerClips.filter((candidate) => (
    candidate.trackId === clip.trackId
    && candidate.patternIndex === clip.patternIndex
  ));

  if (linkedClips.length <= 1) {
    return { clip, project, track };
  }

  const occupiedPatternIndices = new Set(
    project.arrangerClips
      .filter((candidate) => candidate.trackId === track.id && candidate.id !== clip.id)
      .map((candidate) => candidate.patternIndex),
  );
  const nextPatternIndex = Array.from(
    { length: project.transport.patternCount },
    (_, patternIndex) => patternIndex,
  ).find((patternIndex) => !occupiedPatternIndices.has(patternIndex) && patternIndex !== clip.patternIndex);

  if (nextPatternIndex === undefined) {
    return null;
  }

  const nextProject = updateTrack(project, track.id, (candidate) => {
    const sourcePattern = candidate.patterns[clip.patternIndex] ?? createEmptyPattern(project.transport.stepsPerPattern);
    const sourceAutomation = candidate.automation?.[clip.patternIndex] ?? {
      level: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
      tone: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
    };

    return {
      ...candidate,
      automation: {
        ...candidate.automation,
        [nextPatternIndex]: {
          level: [...sourceAutomation.level],
          tone: [...sourceAutomation.tone],
        },
      },
      patterns: {
        ...candidate.patterns,
        [nextPatternIndex]: sourcePattern.map(cloneStepEvents),
      },
    };
  });

  const retargetedProject = {
    ...nextProject,
    arrangerClips: syncArrangerClips(
      nextProject.arrangerClips.map((candidate) => (
        candidate.id === clip.id ? { ...candidate, patternIndex: nextPatternIndex } : candidate
      )),
      nextProject.tracks,
      nextProject.transport.patternCount,
    ),
  };

  const nextContext = getClipContext(retargetedProject, clipId);
  return nextContext ? { ...nextContext, project: retargetedProject } : null;
};

export const duplicateArrangerClipProject = (
  project: Project,
  clipId: string,
): { project: Project } & ProjectMutationSelection | null => {
  const sourceClip = project.arrangerClips.find((clip) => clip.id === clipId);
  if (!sourceClip) {
    return null;
  }

  const duplicatedClip = buildArrangerClip(sourceClip.trackId, project.transport, {
    beatLength: sourceClip.beatLength,
    patternIndex: sourceClip.patternIndex,
    startBeat: sourceClip.startBeat + sourceClip.beatLength,
  });

  return {
    project: {
      ...project,
      arrangerClips: syncArrangerClips(
        [...project.arrangerClips, duplicatedClip],
        project.tracks,
        project.transport.patternCount,
      ),
    },
    selectedArrangerClipId: duplicatedClip.id,
    selectedTrackId: sourceClip.trackId,
  };
};

export const makeClipPatternUniqueProject = (
  project: Project,
  clipId: string,
): { project: Project } & ProjectMutationSelection | null => {
  const sourceClip = project.arrangerClips.find((clip) => clip.id === clipId);
  if (!sourceClip) {
    return null;
  }

  const sourceTrack = project.tracks.find((track) => track.id === sourceClip.trackId);
  if (!sourceTrack) {
    return null;
  }

  const linkedClips = project.arrangerClips.filter((clip) => (
    clip.trackId === sourceTrack.id
    && clip.patternIndex === sourceClip.patternIndex
  ));

  if (linkedClips.length <= 1) {
    return null;
  }

  const occupiedPatternIndices = new Set(
    project.arrangerClips
      .filter((clip) => clip.trackId === sourceTrack.id && clip.id !== sourceClip.id)
      .map((clip) => clip.patternIndex),
  );
  const nextPatternIndex = Array.from(
    { length: project.transport.patternCount },
    (_, patternIndex) => patternIndex,
  ).find((patternIndex) => !occupiedPatternIndices.has(patternIndex) && patternIndex !== sourceClip.patternIndex);

  if (nextPatternIndex === undefined) {
    return null;
  }

  const nextProject = updateTrack(project, sourceTrack.id, (track) => {
    const sourcePattern = track.patterns[sourceClip.patternIndex] ?? createEmptyPattern(project.transport.stepsPerPattern);
    const sourceAutomation = track.automation?.[sourceClip.patternIndex] ?? {
      level: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
      tone: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
    };

    return {
      ...track,
      automation: {
        ...track.automation,
        [nextPatternIndex]: {
          level: [...sourceAutomation.level],
          tone: [...sourceAutomation.tone],
        },
      },
      patterns: {
        ...track.patterns,
        [nextPatternIndex]: sourcePattern.map(cloneStepEvents),
      },
    };
  });

  return {
    project: {
      ...nextProject,
      arrangerClips: syncArrangerClips(
        nextProject.arrangerClips.map((clip) => (
          clip.id === sourceClip.id ? { ...clip, patternIndex: nextPatternIndex } : clip
        )),
        nextProject.tracks,
        nextProject.transport.patternCount,
      ),
    },
    selectedArrangerClipId: sourceClip.id,
    selectedTrackId: sourceTrack.id,
  };
};

export const splitArrangerClipProject = (
  project: Project,
  clipId: string,
  splitAtBeat: number | undefined,
  arrangerSnap: number,
): { project: Project } & ProjectMutationSelection | null => {
  const sourceClip = project.arrangerClips.find((clip) => clip.id === clipId);
  if (!sourceClip || sourceClip.beatLength < 8) {
    return null;
  }

  const requestedSplitBeat = typeof splitAtBeat === 'number'
    ? clamp(
        Math.round(splitAtBeat / arrangerSnap) * arrangerSnap,
        sourceClip.startBeat + 4,
        sourceClip.startBeat + sourceClip.beatLength - 4,
      )
    : sourceClip.startBeat + clamp(
        Math.floor(sourceClip.beatLength / 8) * 4,
        4,
        sourceClip.beatLength - 4,
      );
  const firstLength = requestedSplitBeat - sourceClip.startBeat;
  const secondLength = sourceClip.beatLength - firstLength;
  const splitClip = buildArrangerClip(sourceClip.trackId, project.transport, {
    beatLength: secondLength,
    patternIndex: sourceClip.patternIndex,
    startBeat: sourceClip.startBeat + firstLength,
  });

  return {
    project: {
      ...project,
      arrangerClips: syncArrangerClips(
        [
          ...project.arrangerClips.map((clip) => (
            clip.id === sourceClip.id
              ? { ...clip, beatLength: firstLength }
              : clip
          )),
          splitClip,
        ],
        project.tracks,
        project.transport.patternCount,
      ),
    },
    selectedArrangerClipId: splitClip.id,
    selectedTrackId: sourceClip.trackId,
  };
};
