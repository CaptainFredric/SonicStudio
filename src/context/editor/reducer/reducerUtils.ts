import {
  cloneProject,
  createEmptyPattern,
  createStepEvent,
  defaultNoteForTrack,
  getTrackVoicePresetDefinitions,
  MAX_PATTERN_COUNT,
  MAX_STEPS_PER_PATTERN,
  MIN_PATTERN_COUNT,
  MIN_STEPS_PER_PATTERN,
  resizeTrackPatterns,
  type NoteEvent,
  type Project,
  type SampleSliceMemory,
  type SongMarker,
  type Track,
  type TrackSource,
  type TrackVoicePresetDefinition,
} from '../../../project/schema';
import { applyStudioRouteToSession, type StudioRouteState } from '../../../app/routeController';
import { createDefaultSession, loadPersistedSession } from '../../../project/storage';
import {
  syncArrangerClips,
  updateTrack,
} from '../projectMutations';
import type { EditorState } from '../editorTypes';

export const HISTORY_LIMIT = 100;
export const ARRANGER_SNAP = 4;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const cloneStepEvents = (step: NoteEvent[]) => step.map((event) => ({ ...event }));

export const compareNotesDescending = (left: string, right: string) => (
  (noteToMidi(right) ?? 0) - (noteToMidi(left) ?? 0)
);

export const noteToMidi = (note: string): number | null => {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const pitchClass = NOTE_NAMES.indexOf(match[1]);
  if (pitchClass === -1) {
    return null;
  }

  return (Number(match[2]) + 1) * 12 + pitchClass;
};

export const midiToNote = (midi: number): string => {
  const clampedMidi = clamp(Math.round(midi), 24, 96);
  const pitchClass = NOTE_NAMES[clampedMidi % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${pitchClass}${octave}`;
};

export const transposeNote = (note: string, semitones: number): string => {
  const midi = noteToMidi(note);
  if (midi === null) {
    return note;
  }

  return midiToNote(midi + semitones);
};

export const syncSongMarkers = (markers: SongMarker[], maxBeat: number): SongMarker[] => (
  markers
    .map((marker, index) => ({
      ...marker,
      beat: clamp(Math.round(marker.beat || 0), 0, Math.max(maxBeat, 0)),
      name: marker.name.trim() ? marker.name.trim().slice(0, 24) : `Marker ${index + 1}`,
    }))
    .sort((left, right) => left.beat - right.beat)
);

export const createInitialEditorState = (routeState?: StudioRouteState): EditorState => {
  const session = applyStudioRouteToSession(
    loadPersistedSession() ?? createDefaultSession('blank-grid'),
    routeState,
  );

  return {
    history: {
      future: [],
      past: [],
      present: session.project,
    },
    ui: session.ui,
  };
};

export const ensureSelectedTrackId = (project: Project, selectedTrackId: string | null) => {
  if (selectedTrackId && project.tracks.some((track) => track.id === selectedTrackId)) {
    return selectedTrackId;
  }

  return project.tracks[0]?.id ?? null;
};

export const ensureSelectedArrangerClipId = (project: Project, selectedArrangerClipId: string | null) => {
  if (selectedArrangerClipId && project.arrangerClips.some((clip) => clip.id === selectedArrangerClipId)) {
    return selectedArrangerClipId;
  }

  return project.arrangerClips[0]?.id ?? null;
};

export const ensurePinnedTrackIds = (project: Project, pinnedTrackIds: string[]) => (
  pinnedTrackIds.filter((trackId, index) => (
    project.tracks.some((track) => track.id === trackId)
    && pinnedTrackIds.indexOf(trackId) === index
  ))
);

export const songLengthFromProject = (project: Project) => (
  project.arrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    project.transport.stepsPerPattern,
  )
);

export const buildSongRangeDuplicate = (
  project: Project,
  startBeat: number,
  endBeat: number,
  label?: string,
): Project => {
  const normalizedStartBeat = clamp(Math.round(startBeat), 0, songLengthFromProject(project));
  const normalizedEndBeat = clamp(Math.round(endBeat), normalizedStartBeat + 1, songLengthFromProject(project));
  const rangeLength = normalizedEndBeat - normalizedStartBeat;

  if (rangeLength <= 0) {
    return project;
  }

  const duplicateClips = project.arrangerClips.flatMap((clip) => {
    const clipStart = clip.startBeat;
    const clipEnd = clip.startBeat + clip.beatLength;
    const overlapStart = Math.max(clipStart, normalizedStartBeat);
    const overlapEnd = Math.min(clipEnd, normalizedEndBeat);

    if (overlapEnd <= overlapStart) {
      return [];
    }

    return [{
      ...clip,
      beatLength: overlapEnd - overlapStart,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      startBeat: normalizedEndBeat + (overlapStart - normalizedStartBeat),
    }];
  });

  if (duplicateClips.length === 0) {
    return project;
  }

  const duplicatedMarkers = project.markers
    .filter((marker) => marker.beat >= normalizedStartBeat && marker.beat < normalizedEndBeat)
    .map((marker) => ({
      ...marker,
      beat: normalizedEndBeat + (marker.beat - normalizedStartBeat),
      id: `marker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: label ? `${label} Copy` : `${marker.name} Copy`,
    }));

  return {
    ...project,
    arrangerClips: syncArrangerClips(
      [...project.arrangerClips, ...duplicateClips],
      project.tracks,
      project.transport.patternCount,
    ),
    markers: syncSongMarkers(
      [...project.markers, ...duplicatedMarkers],
      Math.max(songLengthFromProject(project), normalizedEndBeat + rangeLength),
    ),
  };
};

const stampProjectUpdate = (project: Project): Project => ({
  ...project,
  metadata: {
    ...project.metadata,
    updatedAt: new Date().toISOString(),
  },
});

export const commitProject = (
  state: EditorState,
  nextProject: Project,
  selectedTrackId: string | null = state.ui.selectedTrackId,
  selectedArrangerClipId: string | null = state.ui.selectedArrangerClipId,
): EditorState => {
  if (nextProject === state.history.present) {
    return state;
  }

  const nextPast = [...state.history.past, cloneProject(state.history.present)].slice(-HISTORY_LIMIT);

  return {
    history: {
      future: [],
      past: nextPast,
      present: stampProjectUpdate(nextProject),
    },
    ui: {
      ...state.ui,
      pinnedTrackIds: ensurePinnedTrackIds(nextProject, state.ui.pinnedTrackIds),
      selectedArrangerClipId: ensureSelectedArrangerClipId(nextProject, selectedArrangerClipId),
      selectedTrackId: ensureSelectedTrackId(nextProject, selectedTrackId),
    },
  };
};

export const buildMasterSnapshotName = (project: Project) => `Snapshot ${project.masterSnapshots.length + 1}`;

export const buildTrackSnapshotName = (project: Project, track: Track) => {
  const matchingCount = project.trackSnapshots.filter((snapshot) => snapshot.trackType === track.type).length;
  return `${track.name.slice(0, 18)} ${matchingCount + 1}`.trim();
};

export const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= items.length
    || toIndex >= items.length
    || fromIndex === toIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
};

const clampSliceValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeSliceMemory = (
  slice: Partial<SampleSliceMemory> | undefined,
  fallbackLabel: string,
): SampleSliceMemory => {
  const start = clampSliceValue(slice?.start ?? 0, 0, 0.95);
  const requestedEnd = clampSliceValue(slice?.end ?? 1, 0.05, 1);

  return {
    end: Math.max(start + 0.05, requestedEnd),
    gain: clampSliceValue(slice?.gain ?? 1, 0.25, 2),
    label: typeof slice?.label === 'string' && slice.label.trim()
      ? slice.label.trim().slice(0, 16)
      : fallbackLabel,
    reverse: Boolean(slice?.reverse),
    start,
  };
};

export const sanitizeActiveSampleSlice = (track: Track, slices: SampleSliceMemory[]) => {
  const { activeSampleSlice } = track.source;

  if (typeof activeSampleSlice !== 'number') {
    return null;
  }

  return activeSampleSlice >= 0 && activeSampleSlice < slices.length ? activeSampleSlice : null;
};

export const remapTrackSampleSlices = (
  track: Track,
  remapIndex: (index: number) => number | null,
): Track => ({
  ...track,
  patterns: Object.fromEntries(
    Object.entries(track.patterns).map(([patternIndex, patternSteps]) => ([
      patternIndex,
      patternSteps.map((step) => (
        step.map((event) => {
          if (typeof event.sampleSliceIndex !== 'number') {
            return event;
          }

          const nextSliceIndex = remapIndex(event.sampleSliceIndex);
          if (nextSliceIndex === null) {
            const { sampleSliceIndex: _removed, ...rest } = event;
            return rest;
          }

          return {
            ...event,
            sampleSliceIndex: nextSliceIndex,
          };
        })
      )),
    ])),
  ) as Track['patterns'],
});

export const clearOutOfRangeTrackSliceReferences = (
  track: Track,
  sliceCount: number,
): Track => remapTrackSampleSlices(track, (index) => (index >= 0 && index < sliceCount ? index : null));

export const mergeTrackSource = (track: Track, source: Partial<TrackSource>): Track => {
  const nextSource = {
    ...track.source,
    ...source,
  };
  const sampleSlices = Array.isArray(nextSource.sampleSlices)
    ? nextSource.sampleSlices
        .slice(0, 8)
        .map((slice, index) => normalizeSliceMemory(slice, `Slice ${index + 1}`))
    : track.source.sampleSlices;
  const activeSampleSlice = nextSource.activeSampleSlice === null
    ? null
    : typeof nextSource.activeSampleSlice === 'number'
      ? (nextSource.activeSampleSlice >= 0 && nextSource.activeSampleSlice < sampleSlices.length
          ? nextSource.activeSampleSlice
          : null)
      : sanitizeActiveSampleSlice({ ...track, source: nextSource }, sampleSlices);

  return {
    ...track,
    source: {
      ...nextSource,
      activeSampleSlice,
      sampleSlices,
    },
  };
};

export const applyTrackVoicePresetDefinition = (
  track: Track,
  preset: TrackVoicePresetDefinition,
): Track => {
  const nextTrack = mergeTrackSource(track, preset.source ?? {});
  return {
    ...nextTrack,
    params: {
      ...nextTrack.params,
      ...(preset.params ?? {}),
    },
  };
};

export const resolveTrackVoicePreset = (track: Track, presetId: string) => (
  getTrackVoicePresetDefinitions(track.type).find((candidate) => candidate.id === presetId)
);

export const resizeProjectTransport = (
  project: Project,
  patternCount: number,
  stepsPerPattern: number,
): Project => {
  const nextPatternCount = clamp(patternCount, MIN_PATTERN_COUNT, MAX_PATTERN_COUNT);
  const nextStepsPerPattern = clamp(stepsPerPattern, MIN_STEPS_PER_PATTERN, MAX_STEPS_PER_PATTERN);

  if (
    nextPatternCount === project.transport.patternCount
    && nextStepsPerPattern === project.transport.stepsPerPattern
  ) {
    return project;
  }

  const tracks = project.tracks.map((track) => (
    resizeTrackPatterns(track, nextPatternCount, nextStepsPerPattern)
  ));

  return {
    ...project,
    arrangerClips: syncArrangerClips(project.arrangerClips, tracks, nextPatternCount),
    tracks,
    transport: {
      ...project.transport,
      currentPattern: clamp(project.transport.currentPattern, 0, nextPatternCount - 1),
      patternCount: nextPatternCount,
      stepsPerPattern: nextStepsPerPattern,
    },
  };
};

export const updatePatternSteps = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  updater: (pattern: NoteEvent[][]) => NoteEvent[][],
): Track => {
  const currentPattern = track.patterns[patternIndex] ?? createEmptyPattern(stepsPerPattern);
  const nextPattern = updater(currentPattern.map(cloneStepEvents));

  return {
    ...track,
    patterns: {
      ...track.patterns,
      [patternIndex]: nextPattern,
    },
  };
};

export const updateTrackAutomationPattern = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  updater: (pattern: { level: number[]; tone: number[] }) => { level: number[]; tone: number[] },
): Track => {
  const currentPattern = track.automation?.[patternIndex] ?? {
    level: Array.from({ length: stepsPerPattern }, () => 0.5),
    tone: Array.from({ length: stepsPerPattern }, () => 0.5),
  };
  const nextPattern = updater({
    level: [...currentPattern.level],
    tone: [...currentPattern.tone],
  });

  return {
    ...track,
    automation: {
      ...track.automation,
      [patternIndex]: nextPattern,
    },
  };
};

export const updateStepPattern = (
  track: Track,
  patternIndex: number,
  stepsPerPattern: number,
  stepIndex: number,
  note?: string,
): Track => (
  updatePatternSteps(track, patternIndex, stepsPerPattern, (nextSteps) => {
    const existingStep = cloneStepEvents(nextSteps[stepIndex] ?? []);

    if (!note) {
      nextSteps[stepIndex] = existingStep.length > 0
        ? []
        : [createStepEvent(defaultNoteForTrack(track))];
      return nextSteps;
    }

    const existingNoteIndex = existingStep.findIndex((step) => step.note === note);

    if (existingNoteIndex >= 0) {
      nextSteps[stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
      return nextSteps;
    }

    const templateEvent = existingStep.at(-1);
    nextSteps[stepIndex] = [
      ...existingStep,
      createStepEvent(note, templateEvent ?? {}),
    ].sort((left, right) => compareNotesDescending(left.note, right.note));

    return nextSteps;
  })
);
