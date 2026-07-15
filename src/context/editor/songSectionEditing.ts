import {
  MAX_PATTERN_COUNT,
  MAX_ARRANGER_BEAT_POSITION,
  resizeTrackPatterns,
  type ArrangementClip,
  type NoteEvent,
  type PatternAutomation,
  type Project,
  type SavedSongSection,
  type SavedSongSectionClip,
  type SongMarker,
  type Track,
} from '../../project/schema';
import { syncArrangerClips } from './projectMutations';
import { clamp, songLengthFromProject, syncSongMarkers } from './reducer/reducerUtils';

const MIN_CLIP_LENGTH = 4;
const MAX_SAVED_SECTIONS = 24;

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const clonePattern = (pattern: NoteEvent[][]): NoteEvent[][] => (
  pattern.map((step) => step.map((event) => ({ ...event })))
);

const cloneAutomation = (automation: PatternAutomation, stepCount: number): PatternAutomation => ({
  level: Array.from({ length: stepCount }, (_, index) => automation.level[index] ?? 0.5),
  tone: Array.from({ length: stepCount }, (_, index) => automation.tone[index] ?? 0.5),
});

const normalizeRange = (project: Project, startBeat: number, endBeat: number) => {
  const songLength = songLengthFromProject(project);
  const start = clamp(Math.round(startBeat), 0, Math.max(0, songLength - 1));
  const end = clamp(Math.round(endBeat), start + 1, songLength);
  return { end, length: end - start, songLength, start };
};

const distinctMarkers = (markers: SongMarker[], maxBeat: number): SongMarker[] => {
  const beats = new Set<number>();
  return syncSongMarkers(markers, maxBeat).filter((marker) => {
    if (beats.has(marker.beat)) return false;
    beats.add(marker.beat);
    return true;
  });
};

const ensureOpeningMarker = (markers: SongMarker[], maxBeat: number): SongMarker[] => {
  if (markers.some((marker) => marker.beat === 0)) {
    return distinctMarkers(markers, maxBeat);
  }

  return distinctMarkers([
    { beat: 0, id: createId('marker'), name: 'Section 1' },
    ...markers,
  ], maxBeat);
};

const keepClip = (clip: ArrangementClip | null): clip is ArrangementClip => (
  Boolean(clip && clip.beatLength >= MIN_CLIP_LENGTH)
);

const advanceClipOffset = (
  clip: ArrangementClip,
  beatDelta: number,
  stepsPerPattern: number,
) => (
  ((clip.patternOffset ?? 0) + beatDelta) % Math.max(1, stepsPerPattern)
);

const splitAndShiftClipsForInsertion = (
  clips: ArrangementClip[],
  insertionBeat: number,
  insertedLength: number,
  stepsPerPattern: number,
): ArrangementClip[] => clips.flatMap((clip) => {
  const clipEnd = clip.startBeat + clip.beatLength;
  if (clipEnd <= insertionBeat) return [clip];
  if (clip.startBeat >= insertionBeat) {
    return [{ ...clip, startBeat: clip.startBeat + insertedLength }];
  }

  const leftLength = insertionBeat - clip.startBeat;
  const rightLength = clipEnd - insertionBeat;
  return [
    leftLength >= MIN_CLIP_LENGTH ? { ...clip, beatLength: leftLength } : null,
    rightLength >= MIN_CLIP_LENGTH
      ? {
          ...clip,
          beatLength: rightLength,
          id: createId('clip'),
          patternOffset: advanceClipOffset(clip, leftLength, stepsPerPattern),
          startBeat: insertionBeat + insertedLength,
        }
      : null,
  ].filter(keepClip);
});

const shiftMarkersForInsertion = (
  markers: SongMarker[],
  insertionBeat: number,
  insertedLength: number,
) => markers.map((marker) => (
  marker.beat >= insertionBeat
    ? { ...marker, beat: marker.beat + insertedLength }
    : marker
));

const syncSectionProject = (
  project: Project,
  clips: ArrangementClip[],
  markers: SongMarker[],
  arrangementLength: number,
  tracks: Track[] = project.tracks,
  patternCount: number = project.transport.patternCount,
): Project => ({
  ...project,
  arrangementLength,
  arrangerClips: syncArrangerClips(clips, tracks, patternCount),
  markers: ensureOpeningMarker(markers, arrangementLength),
  tracks,
  transport: patternCount === project.transport.patternCount
    ? project.transport
    : { ...project.transport, patternCount },
});

export const insertBlankSongSection = (
  project: Project,
  atBeat: number,
  beatLength: number,
  name: string,
): Project => {
  const songLength = songLengthFromProject(project);
  const insertionBeat = clamp(Math.round(atBeat), 0, songLength);
  const insertedLength = clamp(
    Math.round(beatLength),
    MIN_CLIP_LENGTH,
    MAX_ARRANGER_BEAT_POSITION - songLength,
  );
  if (insertedLength < MIN_CLIP_LENGTH) return project;

  const nextLength = songLength + insertedLength;
  const clips = splitAndShiftClipsForInsertion(
    project.arrangerClips,
    insertionBeat,
    insertedLength,
    project.transport.stepsPerPattern,
  );
  const markers = [
    { beat: insertionBeat, id: createId('marker'), name: name.trim().slice(0, 24) || `Section ${project.markers.length + 1}` },
    ...shiftMarkersForInsertion(project.markers, insertionBeat, insertedLength),
  ];

  return syncSectionProject(project, clips, markers, nextLength);
};

export const resizeSongSectionEnd = (
  project: Project,
  startBeat: number,
  currentEndBeat: number,
  nextEndBeat: number,
): Project => {
  const songLength = songLengthFromProject(project);
  const start = clamp(Math.round(startBeat), 0, Math.max(0, songLength - MIN_CLIP_LENGTH));
  const currentEnd = clamp(
    Math.round(currentEndBeat),
    start + MIN_CLIP_LENGTH,
    songLength,
  );
  const minimumEnd = Math.max(
    start + MIN_CLIP_LENGTH,
    currentEnd - (songLength - project.transport.stepsPerPattern),
  );
  const maximumEnd = currentEnd + (MAX_ARRANGER_BEAT_POSITION - songLength);
  const nextEnd = clamp(Math.round(nextEndBeat), minimumEnd, maximumEnd);
  if (nextEnd === currentEnd) return project;

  if (nextEnd < currentEnd) {
    return deleteSongRange(project, nextEnd, currentEnd);
  }

  const insertedLength = nextEnd - currentEnd;
  return syncSectionProject(
    project,
    splitAndShiftClipsForInsertion(
      project.arrangerClips,
      currentEnd,
      insertedLength,
      project.transport.stepsPerPattern,
    ),
    shiftMarkersForInsertion(project.markers, currentEnd, insertedLength),
    songLength + insertedLength,
  );
};

export const clearSongRange = (
  project: Project,
  startBeat: number,
  endBeat: number,
): Project => {
  const range = normalizeRange(project, startBeat, endBeat);
  const clips = project.arrangerClips.flatMap((clip) => {
    const clipEnd = clip.startBeat + clip.beatLength;
    if (clipEnd <= range.start || clip.startBeat >= range.end) return [clip];

    const leftLength = Math.max(0, range.start - clip.startBeat);
    const rightLength = Math.max(0, clipEnd - range.end);
    return [
      leftLength >= MIN_CLIP_LENGTH ? { ...clip, beatLength: leftLength } : null,
      rightLength >= MIN_CLIP_LENGTH
        ? {
            ...clip,
            beatLength: rightLength,
            id: createId('clip'),
            patternOffset: advanceClipOffset(
              clip,
              range.end - clip.startBeat,
              project.transport.stepsPerPattern,
            ),
            startBeat: range.end,
          }
        : null,
    ].filter(keepClip);
  });

  return syncSectionProject(project, clips, project.markers, range.songLength);
};

export const deleteSongRange = (
  project: Project,
  startBeat: number,
  endBeat: number,
): Project => {
  const range = normalizeRange(project, startBeat, endBeat);
  const nextLength = Math.max(project.transport.stepsPerPattern, range.songLength - range.length);
  const clips = project.arrangerClips.flatMap((clip) => {
    const clipEnd = clip.startBeat + clip.beatLength;
    if (clipEnd <= range.start) return [clip];
    if (clip.startBeat >= range.end) {
      return [{ ...clip, startBeat: clip.startBeat - range.length }];
    }

    const leftLength = Math.max(0, range.start - clip.startBeat);
    const rightLength = Math.max(0, clipEnd - range.end);
    return [
      leftLength >= MIN_CLIP_LENGTH ? { ...clip, beatLength: leftLength } : null,
      rightLength >= MIN_CLIP_LENGTH
        ? {
            ...clip,
            beatLength: rightLength,
            id: leftLength >= MIN_CLIP_LENGTH ? createId('clip') : clip.id,
            patternOffset: advanceClipOffset(
              clip,
              range.end - clip.startBeat,
              project.transport.stepsPerPattern,
            ),
            startBeat: range.start,
          }
        : null,
    ].filter(keepClip);
  });
  const markers = project.markers.flatMap((marker) => {
    if (marker.beat >= range.start && marker.beat < range.end) return [];
    if (marker.beat >= range.end) return [{ ...marker, beat: marker.beat - range.length }];
    return [marker];
  });

  return syncSectionProject(project, clips, markers, nextLength);
};

export const duplicateSongRange = (
  project: Project,
  startBeat: number,
  endBeat: number,
  label?: string,
): Project => {
  const range = normalizeRange(project, startBeat, endBeat);
  if (range.songLength + range.length > MAX_ARRANGER_BEAT_POSITION) return project;

  const sourceClips = project.arrangerClips.flatMap((clip) => {
    const overlapStart = Math.max(clip.startBeat, range.start);
    const overlapEnd = Math.min(clip.startBeat + clip.beatLength, range.end);
    const overlapLength = overlapEnd - overlapStart;
    if (overlapLength < MIN_CLIP_LENGTH) return [];

    return [{
      ...clip,
      beatLength: overlapLength,
      id: createId('clip'),
      patternOffset: advanceClipOffset(
        clip,
        overlapStart - clip.startBeat,
        project.transport.stepsPerPattern,
      ),
      startBeat: range.end + (overlapStart - range.start),
    }];
  });
  const shiftedClips = splitAndShiftClipsForInsertion(
    project.arrangerClips,
    range.end,
    range.length,
    project.transport.stepsPerPattern,
  );
  const copiedMarkers = project.markers
    .filter((marker) => marker.beat >= range.start && marker.beat < range.end)
    .map((marker) => ({
      ...marker,
      beat: range.end + (marker.beat - range.start),
      id: createId('marker'),
      name: marker.beat === range.start && label ? `${label} Copy` : `${marker.name} Copy`,
    }));
  if (!copiedMarkers.some((marker) => marker.beat === range.end)) {
    copiedMarkers.unshift({
      beat: range.end,
      id: createId('marker'),
      name: `${label?.trim() || 'Section'} Copy`.slice(0, 24),
    });
  }
  const markers = [
    ...copiedMarkers,
    ...shiftMarkersForInsertion(project.markers, range.end, range.length),
  ];

  return syncSectionProject(
    project,
    [...shiftedClips, ...sourceClips],
    markers,
    range.songLength + range.length,
  );
};

export const saveSongRange = (
  project: Project,
  startBeat: number,
  endBeat: number,
  name: string,
): Project => {
  const range = normalizeRange(project, startBeat, endBeat);
  const clips = project.arrangerClips.flatMap((clip) => {
    const overlapStart = Math.max(clip.startBeat, range.start);
    const overlapEnd = Math.min(clip.startBeat + clip.beatLength, range.end);
    const overlapLength = overlapEnd - overlapStart;
    if (overlapLength < MIN_CLIP_LENGTH) return [];

    const track = project.tracks.find((candidate) => candidate.id === clip.trackId);
    if (!track) return [];
    const pattern = track.patterns[clip.patternIndex] ?? [];
    const automation = track.automation[clip.patternIndex] ?? { level: [], tone: [] };

    return [{
      automation: cloneAutomation(automation, pattern.length),
      beatLength: overlapLength,
      pattern: clonePattern(pattern),
      patternOffset: advanceClipOffset(
        clip,
        overlapStart - clip.startBeat,
        project.transport.stepsPerPattern,
      ),
      relativeStartBeat: overlapStart - range.start,
      sourcePatternIndex: clip.patternIndex,
      sourceTrackId: track.id,
      sourceTrackName: track.name,
      sourceTrackType: track.type,
    } satisfies SavedSongSectionClip];
  });
  const savedSection = {
    beatLength: range.length,
    clips,
    createdAt: new Date().toISOString(),
    id: createId('saved_section'),
    markers: project.markers
      .filter((marker) => marker.beat > range.start && marker.beat < range.end)
      .map((marker) => ({ beat: marker.beat - range.start, name: marker.name })),
    name: name.trim().slice(0, 24) || `Saved section ${(project.savedSongSections?.length ?? 0) + 1}`,
    stepsPerPattern: project.transport.stepsPerPattern,
  } satisfies SavedSongSection;

  return {
    ...project,
    savedSongSections: [savedSection, ...(project.savedSongSections ?? [])].slice(0, MAX_SAVED_SECTIONS),
  };
};

export const countSavedSectionPatternSlots = (section: SavedSongSection): number => (
  new Set(section.clips.map((clip) => clip.sourcePatternIndex)).size
);

const mapSavedTracks = (project: Project, section: SavedSongSection) => {
  const result = new Map<string, string>();
  const usedTargetIds = new Set<string>();
  const sourceLanes = Array.from(new Map(section.clips.map((clip) => [clip.sourceTrackId, clip])).values());

  sourceLanes.forEach((source) => {
    const exact = project.tracks.find((track) => track.id === source.sourceTrackId);
    const named = project.tracks.find((track) => (
      !usedTargetIds.has(track.id)
      && track.type === source.sourceTrackType
      && track.name === source.sourceTrackName
    ));
    const typed = project.tracks.find((track) => (
      !usedTargetIds.has(track.id) && track.type === source.sourceTrackType
    ));
    const target = exact ?? named ?? typed;
    if (!target) return;
    result.set(source.sourceTrackId, target.id);
    usedTargetIds.add(target.id);
  });

  return result;
};

export const insertSavedSongSection = (
  project: Project,
  savedSectionId: string,
  atBeat: number,
): Project => {
  const section = (project.savedSongSections ?? []).find((candidate) => candidate.id === savedSectionId);
  if (!section) return project;

  const patternSlots = Array.from(new Set(section.clips.map((clip) => clip.sourcePatternIndex))).sort((a, b) => a - b);
  const nextPatternCount = project.transport.patternCount + patternSlots.length;
  const songLength = songLengthFromProject(project);
  if (
    nextPatternCount > MAX_PATTERN_COUNT
    || songLength + section.beatLength > MAX_ARRANGER_BEAT_POSITION
  ) {
    return project;
  }

  const insertionBeat = clamp(Math.round(atBeat), 0, songLength);
  const patternMap = new Map(patternSlots.map((sourceIndex, offset) => (
    [sourceIndex, project.transport.patternCount + offset]
  )));
  const trackMap = mapSavedTracks(project, section);
  const tracks = project.tracks.map((track) => {
    const resized = resizeTrackPatterns(track, nextPatternCount, project.transport.stepsPerPattern);
    const sourceTrackIds = Array.from(trackMap.entries())
      .filter(([, targetTrackId]) => targetTrackId === track.id)
      .map(([sourceTrackId]) => sourceTrackId);

    section.clips.forEach((clip) => {
      if (!sourceTrackIds.includes(clip.sourceTrackId)) return;
      const targetPatternIndex = patternMap.get(clip.sourcePatternIndex);
      if (targetPatternIndex === undefined || resized.patterns[targetPatternIndex]?.some((step) => step.length > 0)) return;

      resized.patterns[targetPatternIndex] = Array.from(
        { length: project.transport.stepsPerPattern },
        (_, index) => (clip.pattern[index] ?? []).map((event) => ({ ...event })),
      );
      resized.automation[targetPatternIndex] = cloneAutomation(
        clip.automation,
        project.transport.stepsPerPattern,
      );
    });

    return resized;
  });
  const shiftedClips = splitAndShiftClipsForInsertion(
    project.arrangerClips,
    insertionBeat,
    section.beatLength,
    project.transport.stepsPerPattern,
  );
  const insertedClips = section.clips.flatMap((clip) => {
    const trackId = trackMap.get(clip.sourceTrackId);
    const patternIndex = patternMap.get(clip.sourcePatternIndex);
    if (!trackId || patternIndex === undefined) return [];

    return [{
      beatLength: clip.beatLength,
      id: createId('clip'),
      patternIndex,
      patternOffset: clip.patternOffset,
      startBeat: insertionBeat + clip.relativeStartBeat,
      trackId,
    } satisfies ArrangementClip];
  });
  const markers = [
    { beat: insertionBeat, id: createId('marker'), name: section.name },
    ...section.markers.map((marker) => ({
      beat: insertionBeat + marker.beat,
      id: createId('marker'),
      name: marker.name,
    })),
    ...shiftMarkersForInsertion(project.markers, insertionBeat, section.beatLength),
  ];

  return syncSectionProject(
    project,
    [...shiftedClips, ...insertedClips],
    markers,
    songLength + section.beatLength,
    tracks,
    nextPatternCount,
  );
};

export const removeSavedSongSection = (project: Project, savedSectionId: string): Project => {
  const sections = project.savedSongSections ?? [];
  if (!sections.some((section) => section.id === savedSectionId)) return project;
  return { ...project, savedSongSections: sections.filter((section) => section.id !== savedSectionId) };
};

export const renameSavedSongSection = (
  project: Project,
  savedSectionId: string,
  name: string,
): Project => {
  const nextName = name.trim().slice(0, 24);
  if (!nextName) return project;
  let changed = false;
  const savedSongSections = (project.savedSongSections ?? []).map((section) => {
    if (section.id !== savedSectionId || section.name === nextName) return section;
    changed = true;
    return { ...section, name: nextName };
  });
  return changed ? { ...project, savedSongSections } : project;
};
