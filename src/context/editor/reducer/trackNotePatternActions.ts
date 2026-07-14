import {
  createEmptyPattern,
  MAX_STEPS_PER_PATTERN,
  MIN_STEPS_PER_PATTERN,
  type NoteEvent,
} from '../../../project/schema';
import {
  mapBeatAfterPatternColumnDelete,
  mapBeatAfterPatternColumnInsert,
  transformPatternColumn,
  type PatternColumnOperation,
} from '../../../utils/patternColumnEditing';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  cloneStepEvents,
  commitProject,
  resizeProjectTransport,
  songLengthFromProject,
  syncSongMarkers,
  transposeNote,
  updatePatternSteps,
  updateTrackAutomationPattern,
} from './reducerUtils';
import { syncArrangerClips, updateTrack } from '../projectMutations';

const normalizeSegmentSteps = (steps: NoteEvent[][], stepsPerPattern: number) => {
  const next = createEmptyPattern(stepsPerPattern);

  for (let stepIndex = 0; stepIndex < stepsPerPattern; stepIndex += 1) {
    next[stepIndex] = cloneStepEvents(steps[stepIndex] ?? []);
  }

  return next;
};

const normalizeSegmentAutomation = (
  automation: { level: number[]; tone: number[] } | undefined,
  stepsPerPattern: number,
) => ({
  level: Array.from({ length: stepsPerPattern }, (_, index) => automation?.level[index] ?? 0.5),
  tone: Array.from({ length: stepsPerPattern }, (_, index) => automation?.tone[index] ?? 0.5),
});

const shiftPattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  direction: 'left' | 'right',
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
      if (currentPattern.every((step) => step.length === 0)) {
        return currentPattern;
      }

      return direction === 'left'
        ? [...currentPattern.slice(1).map(cloneStepEvents), []]
        : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
    })
  )));
};

const transposePattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  semitones: number,
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => {
    if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
      return track;
    }

    return updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
      currentPattern.map((step) => (
        step.map((event) => ({ ...event, note: transposeNote(event.note, semitones) }))
      ))
    ));
  }));
};

const clearPattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
      currentPattern.some((step) => step.length > 0)
        ? createEmptyPattern(present.transport.stepsPerPattern)
        : currentPattern
    ))
  )));
};

const clearAllTrackNotes = (state: EditorState) => {
  const { present } = state.history;
  let changed = false;

  const nextTracks = present.tracks.map((track) => {
    const hasAnyNotes = Object.values(track.patterns).some((patternSteps) => (
      patternSteps.some((step) => step.length > 0)
    ));

    if (!hasAnyNotes) {
      return track;
    }

    changed = true;
    const nextPatterns = Object.fromEntries(
      Object.keys(track.patterns).map((patternKey) => [patternKey, createEmptyPattern(present.transport.stepsPerPattern)]),
    );

    return {
      ...track,
      patterns: nextPatterns,
    };
  });

  if (!changed) {
    return state;
  }

  return commitProject(state, {
    ...present,
    tracks: nextTracks,
  });
};

const applyPatternSegment = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  steps: NoteEvent[][],
  automation?: { level: number[]; tone: number[] },
) => {
  const { present } = state.history;
  const stepsPerPattern = present.transport.stepsPerPattern;

  return commitProject(state, updateTrack(present, trackId, (track) => {
    const withSteps = updatePatternSteps(track, patternIndex, stepsPerPattern, () => (
      normalizeSegmentSteps(steps, stepsPerPattern)
    ));

    return automation
      ? updateTrackAutomationPattern(withSteps, patternIndex, stepsPerPattern, () => (
          normalizeSegmentAutomation(automation, stepsPerPattern)
        ))
      : withSteps;
  }));
};

const applyPatternStepBatch = (
  state: EditorState,
  patternIndex: number,
  segments: Array<{ steps: NoteEvent[][]; trackId: string }>,
  requestedStepsPerPattern?: number,
) => {
  const { present } = state.history;
  const resizedProject = requestedStepsPerPattern === undefined
    ? present
    : resizeProjectTransport(present, present.transport.patternCount, requestedStepsPerPattern);
  const segmentByTrackId = new Map(segments.map((segment) => [segment.trackId, segment.steps]));
  let appliedSegment = false;
  const tracks = resizedProject.tracks.map((track) => {
    const steps = segmentByTrackId.get(track.id);
    if (!steps) {
      return track;
    }

    appliedSegment = true;
    return updatePatternSteps(
      track,
      patternIndex,
      resizedProject.transport.stepsPerPattern,
      () => normalizeSegmentSteps(steps, resizedProject.transport.stepsPerPattern),
    );
  });

  if (!appliedSegment && resizedProject === present) {
    return state;
  }

  return commitProject(state, appliedSegment ? { ...resizedProject, tracks } : resizedProject);
};

const editPatternColumn = (
  state: EditorState,
  patternIndex: number,
  stepIndex: number,
  operation: PatternColumnOperation,
) => {
  const { present } = state.history;
  const oldStepCount = present.transport.stepsPerPattern;
  if (patternIndex < 0 || patternIndex >= present.transport.patternCount) return state;
  if (stepIndex < 0 || stepIndex >= oldStepCount) return state;
  if (operation === 'move-left' && stepIndex === 0) return state;
  if (operation === 'move-right' && stepIndex === oldStepCount - 1) return state;
  if (operation === 'delete' && oldStepCount <= MIN_STEPS_PER_PATTERN) return state;
  if ((operation === 'duplicate' || operation === 'insert') && oldStepCount >= MAX_STEPS_PER_PATTERN) return state;

  const structuralEdit = operation === 'delete' || operation === 'duplicate' || operation === 'insert';
  const editedPatternIndices = structuralEdit
    ? Array.from({ length: present.transport.patternCount }, (_, index) => index)
    : [patternIndex];
  let changed = structuralEdit;
  const tracks = present.tracks.map((track) => {
    const patterns = { ...track.patterns };
    const automation = { ...track.automation };

    editedPatternIndices.forEach((editedPatternIndex) => {
      const patternOperation = operation === 'duplicate' && editedPatternIndex !== patternIndex
        ? 'insert'
        : operation;
      const result = transformPatternColumn(
        track.patterns[editedPatternIndex] ?? createEmptyPattern(oldStepCount),
        track.automation?.[editedPatternIndex],
        patternOperation,
        stepIndex,
        oldStepCount,
      );
      changed = changed || result.changed;
      patterns[editedPatternIndex] = result.steps;
      automation[editedPatternIndex] = result.automation;
    });

    return { ...track, automation, patterns };
  });

  if (!changed) return state;

  const nextStepCount = operation === 'delete'
    ? oldStepCount - 1
    : operation === 'duplicate' || operation === 'insert'
      ? oldStepCount + 1
      : oldStepCount;
  if (!structuralEdit) {
    return commitProject(state, { ...present, tracks });
  }

  const mapBeat = operation === 'delete'
    ? (beat: number) => mapBeatAfterPatternColumnDelete(beat, stepIndex, oldStepCount)
    : (beat: number) => mapBeatAfterPatternColumnInsert(beat, stepIndex, oldStepCount);
  const arrangerClips = syncArrangerClips(
    present.arrangerClips.map((clip) => {
      const nextStart = mapBeat(clip.startBeat);
      const nextEnd = mapBeat(clip.startBeat + clip.beatLength);
      return {
        ...clip,
        beatLength: Math.max(4, nextEnd - nextStart),
        startBeat: nextStart,
      };
    }),
    tracks,
    present.transport.patternCount,
  );
  const songLength = arrangerClips.reduce(
    (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
    Math.max(nextStepCount, mapBeat(songLengthFromProject(present))),
  );
  const markers = syncSongMarkers(
    present.markers.map((marker) => ({ ...marker, beat: mapBeat(marker.beat) })),
    songLength,
  );

  return commitProject(state, {
    ...present,
    arrangementLength: songLength,
    arrangerClips,
    markers,
    tracks,
    transport: {
      ...present.transport,
      stepsPerPattern: nextStepCount,
    },
  });
};

const humanizePattern = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  amount: number,
) => {
  const { present } = state.history;
  const range = Math.max(0, Math.min(0.5, amount));

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
      let changed = false;
      const next = currentPattern.map((step) => (
        step.map((event) => {
          const jitter = (Math.random() - 0.5) * 2 * range;
          const nextVelocity = Math.max(0.18, Math.min(1, event.velocity + jitter));
          if (Math.abs(nextVelocity - event.velocity) < 0.01) return event;
          changed = true;
          return { ...event, velocity: nextVelocity };
        })
      ));
      return changed ? next : currentPattern;
    })
  )));
};

const stampChord = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  stepIndex: number,
  notes: string[],
  gate: number,
  velocity: number,
) => {
  const { present } = state.history;
  if (stepIndex < 0 || stepIndex >= present.transport.stepsPerPattern) return state;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
      const next = currentPattern.map(cloneStepEvents);
      const targetStep = next[stepIndex] ?? [];
      const existingNotes = new Set(targetStep.map((event) => event.note));
      notes.forEach((note) => {
        if (existingNotes.has(note)) return;
        targetStep.push({ note, velocity, gate });
      });
      next[stepIndex] = targetStep;
      return next;
    })
  )));
};

const moveNoteToStep = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  fromStepIndex: number,
  fromNoteIndex: number,
  toStepIndex: number,
  newGate?: number,
) => {
  const { present } = state.history;
  if (fromStepIndex === toStepIndex && newGate === undefined) return state;
  const stepsPerPattern = present.transport.stepsPerPattern;
  if (toStepIndex < 0 || toStepIndex >= stepsPerPattern) return state;

  return commitProject(state, updateTrack(present, trackId, (track) => (
    updatePatternSteps(track, patternIndex, stepsPerPattern, (currentPattern) => {
      const source = currentPattern[fromStepIndex];
      const event = source?.[fromNoteIndex];
      if (!event) return currentPattern;
      const next = currentPattern.map(cloneStepEvents);
      // Remove from source
      next[fromStepIndex] = next[fromStepIndex].filter((_, i) => i !== fromNoteIndex);
      // Add to destination (or update if a note with same pitch already there — replace to avoid collision)
      const destStep = next[toStepIndex].filter((existing) => existing.note !== event.note);
      destStep.push({ ...event, gate: newGate ?? event.gate });
      next[toStepIndex] = destStep;
      return next;
    })
  )));
};

export const handleTrackNotePatternAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'APPLY_PATTERN_SEGMENT':
      return applyPatternSegment(state, action.trackId, action.patternIndex, action.steps, action.automation);

    case 'APPLY_PATTERN_STEP_BATCH':
      return applyPatternStepBatch(state, action.patternIndex, action.segments, action.stepsPerPattern);

    case 'EDIT_PATTERN_COLUMN':
      return editPatternColumn(state, action.patternIndex, action.stepIndex, action.operation);

    case 'SHIFT_PATTERN':
      return shiftPattern(state, action.trackId, present.transport.currentPattern, action.direction);

    case 'SHIFT_PATTERN_AT':
      return shiftPattern(state, action.trackId, action.patternIndex, action.direction);

    case 'TRANSPOSE_PATTERN':
      return transposePattern(state, action.trackId, present.transport.currentPattern, action.semitones);

    case 'TRANSPOSE_PATTERN_AT':
      return transposePattern(state, action.trackId, action.patternIndex, action.semitones);

    case 'CLEAR_TRACK':
      return clearPattern(state, action.trackId, present.transport.currentPattern);

    case 'CLEAR_ALL_TRACK_NOTES':
      return clearAllTrackNotes(state);

    case 'CLEAR_PATTERN_AT':
      return clearPattern(state, action.trackId, action.patternIndex);

    case 'HUMANIZE_PATTERN':
      return humanizePattern(state, action.trackId, action.patternIndex ?? present.transport.currentPattern, action.amount ?? 0.18);

    case 'MOVE_NOTE_TO_STEP':
      return moveNoteToStep(
        state,
        action.trackId,
        action.patternIndex ?? present.transport.currentPattern,
        action.fromStepIndex,
        action.fromNoteIndex,
        action.toStepIndex,
        action.newGate,
      );

    case 'STAMP_CHORD':
      return stampChord(
        state,
        action.trackId,
        action.patternIndex ?? present.transport.currentPattern,
        action.stepIndex,
        action.notes,
        action.gate ?? 1.25,
        action.velocity ?? 0.78,
      );

    default:
      return null;
  }
};
