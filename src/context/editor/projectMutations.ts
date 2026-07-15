import {
  createArrangerClip as buildArrangerClip,
  createEmptyPattern,
  MAX_ARRANGER_BEAT_POSITION,
  MAX_PATTERN_COUNT,
  MAX_STEPS_PER_PATTERN,
  resizeTrackPatterns,
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
  const stepCount = Math.max(1, tracks[0]?.patterns[0]?.length ?? MAX_STEPS_PER_PATTERN);

  return arrangerClips
    .filter((clip) => trackOrder.has(clip.trackId))
    .map((clip) => ({
      ...clip,
      beatLength: clamp(Math.round(clip.beatLength || 16), 4, MAX_STEPS_PER_PATTERN),
      patternIndex: clamp(Math.round(clip.patternIndex || 0), 0, Math.max(patternCount - 1, 0)),
      patternOffset: clamp(Math.round(clip.patternOffset || 0), 0, stepCount - 1),
      startBeat: clamp(Math.round(clip.startBeat || 0), 0, MAX_ARRANGER_BEAT_POSITION),
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

export const moveArrangerClipProject = (
  project: Project,
  clipId: string,
  targetTrackId: string,
  startBeat: number,
): ({ project: Project } & ProjectMutationSelection) | null => {
  const sourceClip = project.arrangerClips.find((clip) => clip.id === clipId);
  const sourceTrack = sourceClip
    ? project.tracks.find((track) => track.id === sourceClip.trackId)
    : null;
  const targetTrack = project.tracks.find((track) => track.id === targetTrackId);
  if (!sourceClip || !sourceTrack || !targetTrack) return null;

  const nextStartBeat = clamp(
    Math.round(startBeat / 4) * 4,
    0,
    MAX_ARRANGER_BEAT_POSITION - sourceClip.beatLength,
  );
  if (sourceClip.trackId === targetTrackId) {
    if (sourceClip.startBeat === nextStartBeat) return null;
    return {
      project: {
        ...project,
        arrangementLength: Math.max(project.arrangementLength, nextStartBeat + sourceClip.beatLength),
        arrangerClips: syncArrangerClips(
          project.arrangerClips.map((clip) => (
            clip.id === clipId ? { ...clip, startBeat: nextStartBeat } : clip
          )),
          project.tracks,
          project.transport.patternCount,
        ),
      },
      selectedArrangerClipId: clipId,
      selectedTrackId: targetTrackId,
    };
  }

  if (project.transport.patternCount >= MAX_PATTERN_COUNT) return null;

  const nextPatternIndex = project.transport.patternCount;
  const nextPatternCount = nextPatternIndex + 1;
  const resizedTracks = project.tracks.map((track) => (
    resizeTrackPatterns(track, nextPatternCount, project.transport.stepsPerPattern)
  ));
  const sourcePattern = sourceTrack.patterns[sourceClip.patternIndex]
    ?? createEmptyPattern(project.transport.stepsPerPattern);
  const sourceAutomation = sourceTrack.automation?.[sourceClip.patternIndex] ?? {
    level: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
    tone: Array.from({ length: project.transport.stepsPerPattern }, () => 0.5),
  };
  const nextTracks = resizedTracks.map((track) => (
    track.id === targetTrackId
      ? {
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
        }
      : track
  ));

  return {
    project: {
      ...project,
      arrangementLength: Math.max(project.arrangementLength, nextStartBeat + sourceClip.beatLength),
      arrangerClips: syncArrangerClips(
        project.arrangerClips.map((clip) => (
          clip.id === clipId
            ? { ...clip, patternIndex: nextPatternIndex, startBeat: nextStartBeat, trackId: targetTrackId }
            : clip
        )),
        nextTracks,
        nextPatternCount,
      ),
      tracks: nextTracks,
      transport: { ...project.transport, patternCount: nextPatternCount },
    },
    selectedArrangerClipId: clipId,
    selectedTrackId: targetTrackId,
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
    patternOffset: ((sourceClip.patternOffset ?? 0) + firstLength) % project.transport.stepsPerPattern,
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
