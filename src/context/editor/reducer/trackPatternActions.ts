import {
  createEmptyPattern,
  createStepEvent,
  defaultNoteForTrack,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  clamp,
  cloneStepEvents,
  commitProject,
  compareNotesDescending,
  transposeNote,
  updatePatternSteps,
  updateStepPattern,
  updateTrackAutomationPattern,
} from './reducerUtils';
import {
  getUniqueClipPatternProject,
  updateTrack,
} from '../projectMutations';

const updatePatternNoteEvent = (
  state: EditorState,
  trackId: string,
  patternIndex: number,
  stepIndex: number,
  noteIndex: number,
  updates: Parameters<typeof createStepEvent>[1],
) => {
  const { present } = state.history;

  return commitProject(state, updateTrack(present, trackId, (track) => {
    const currentPattern = track.patterns[patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);
    const targetStep = currentPattern[stepIndex];

    if (!targetStep || !targetStep[noteIndex]) {
      return track;
    }

    const nextSteps = [...currentPattern];
    const nextStep = cloneStepEvents(targetStep);
    const targetEvent = nextStep[noteIndex];
    nextStep[noteIndex] = createStepEvent(targetEvent.note, {
      ...targetEvent,
      ...updates,
    });
    nextSteps[stepIndex] = nextStep;

    return {
      ...track,
      patterns: {
        ...track.patterns,
        [patternIndex]: nextSteps,
      },
    };
  }));
};

export const handleTrackPatternAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'TOGGLE_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updateStepPattern(track, present.transport.currentPattern, present.transport.stepsPerPattern, action.stepIndex, action.note)
      )));

    case 'TOGGLE_PATTERN_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updateStepPattern(track, action.patternIndex, present.transport.stepsPerPattern, action.stepIndex, action.note)
      )));

    case 'TOGGLE_CLIP_PATTERN_STEP': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => (
        updatePatternSteps(candidate, clip.patternIndex, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);
          const targetNote = action.note ?? defaultNoteForTrack(track);
          const existingNoteIndex = existingStep.findIndex((entry) => entry.note === targetNote);

          if (action.mode === 'add') {
            if (existingNoteIndex >= 0) {
              return nextSteps;
            }

            const templateEvent = existingStep.at(-1);
            nextSteps[action.stepIndex] = [
              ...existingStep,
              createStepEvent(targetNote, templateEvent ?? {}),
            ].sort((left, right) => compareNotesDescending(left.note, right.note));
            return nextSteps;
          }

          if (action.mode === 'remove') {
            if (existingNoteIndex === -1) {
              return nextSteps;
            }

            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          if (!action.note) {
            nextSteps[action.stepIndex] = existingStep.length > 0
              ? []
              : [createStepEvent(targetNote)];
            return nextSteps;
          }

          if (existingNoteIndex >= 0) {
            nextSteps[action.stepIndex] = existingStep.filter((_, noteIndex) => noteIndex !== existingNoteIndex);
            return nextSteps;
          }

          const templateEvent = existingStep.at(-1);
          nextSteps[action.stepIndex] = [
            ...existingStep,
            createStepEvent(targetNote, templateEvent ?? {}),
          ].sort((left, right) => compareNotesDescending(left.note, right.note));
          return nextSteps;
        })
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    case 'SET_CLIP_PATTERN_STEP_SLICE': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => (
        updatePatternSteps(candidate, clip.patternIndex, present.transport.stepsPerPattern, (nextSteps) => {
          const existingStep = cloneStepEvents(nextSteps[action.stepIndex] ?? []);

          if (action.sliceIndex === null) {
            nextSteps[action.stepIndex] = [];
            return nextSteps;
          }

          const normalizedSliceIndex = Math.max(0, action.sliceIndex);
          const targetNote = action.note ?? existingStep[0]?.note ?? defaultNoteForTrack(track);

          if (existingStep.length === 0) {
            nextSteps[action.stepIndex] = [createStepEvent(targetNote, { sampleSliceIndex: normalizedSliceIndex })];
            return nextSteps;
          }

          nextSteps[action.stepIndex] = existingStep.map((event, noteIndex) => (
            noteIndex === 0
              ? createStepEvent(targetNote, { ...event, sampleSliceIndex: normalizedSliceIndex })
              : event
          ));
          return nextSteps;
        })
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    case 'SHIFT_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, present.transport.currentPattern, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        })
      )));

    case 'SHIFT_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
          if (currentPattern.every((step) => step.length === 0)) {
            return currentPattern;
          }

          return action.direction === 'left'
            ? [...currentPattern.slice(1).map(cloneStepEvents), []]
            : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
        })
      )));

    case 'TRANSPOSE_PATTERN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        return updatePatternSteps(track, present.transport.currentPattern, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
      }));

    case 'TRANSPOSE_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
          return track;
        }

        return updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.map((step) => (
            step.map((event) => ({ ...event, note: transposeNote(event.note, action.semitones) }))
          ))
        ));
      }));

    case 'CLEAR_TRACK':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, present.transport.currentPattern, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ))
      )));

    case 'CLEAR_PATTERN_AT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updatePatternSteps(track, action.patternIndex, present.transport.stepsPerPattern, (currentPattern) => (
          currentPattern.some((step) => step.length > 0)
            ? createEmptyPattern(present.transport.stepsPerPattern)
            : currentPattern
        ))
      )));

    case 'UPDATE_STEP_EVENT':
      return updatePatternNoteEvent(
        state,
        action.trackId,
        present.transport.currentPattern,
        action.stepIndex,
        action.noteIndex,
        action.updates,
      );

    case 'UPDATE_PATTERN_STEP_EVENT':
      return updatePatternNoteEvent(
        state,
        action.trackId,
        action.patternIndex,
        action.stepIndex,
        action.noteIndex,
        action.updates,
      );

    case 'UPDATE_CLIP_PATTERN_STEP_EVENT': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => {
        const currentPattern = candidate.patterns[clip.patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return candidate;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep.sort((left, right) => compareNotesDescending(left.note, right.note));

        return {
          ...candidate,
          patterns: {
            ...candidate.patterns,
            [clip.patternIndex]: nextSteps,
          },
        };
      });

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    case 'UPDATE_PATTERN_AUTOMATION_STEP':
      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        updateTrackAutomationPattern(
          track,
          action.patternIndex,
          present.transport.stepsPerPattern,
          (patternAutomation) => ({
            ...patternAutomation,
            [action.lane]: patternAutomation[action.lane].map((entry, entryIndex) => (
              entryIndex === action.stepIndex
                ? clamp(action.value, 0, 1)
                : entry
            )),
          }),
        )
      )));

    case 'UPDATE_CLIP_PATTERN_AUTOMATION_STEP': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      const nextProject = updateTrack(nextProjectSeed, track.id, (candidate) => (
        updateTrackAutomationPattern(
          candidate,
          clip.patternIndex,
          present.transport.stepsPerPattern,
          (patternAutomation) => ({
            ...patternAutomation,
            [action.lane]: patternAutomation[action.lane].map((entry, entryIndex) => (
              entryIndex === action.stepIndex
                ? clamp(action.value, 0, 1)
                : entry
            )),
          }),
        )
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    case 'TRANSFORM_CLIP_PATTERN': {
      const editableClip = getUniqueClipPatternProject(present, action.clipId);
      if (!editableClip) {
        return state;
      }

      const { clip, project: nextProjectSeed, track } = editableClip;
      let nextProject = nextProjectSeed;

      if (action.transform === 'reset-automation') {
        nextProject = updateTrack(nextProject, track.id, (candidate) => (
          updateTrackAutomationPattern(
            candidate,
            clip.patternIndex,
            present.transport.stepsPerPattern,
            () => ({
              level: Array.from({ length: present.transport.stepsPerPattern }, () => 0.5),
              tone: Array.from({ length: present.transport.stepsPerPattern }, () => 0.5),
            }),
          )
        ));

        return commitProject(state, nextProject, clip.trackId, clip.id);
      }

      nextProject = updateTrack(nextProject, track.id, (candidate) => (
        updatePatternSteps(candidate, clip.patternIndex, present.transport.stepsPerPattern, (currentPattern) => {
          switch (action.transform) {
            case 'clear':
              return createEmptyPattern(present.transport.stepsPerPattern);
            case 'shift-left':
              return currentPattern.every((step) => step.length === 0)
                ? currentPattern
                : [...currentPattern.slice(1).map(cloneStepEvents), []];
            case 'shift-right':
              return currentPattern.every((step) => step.length === 0)
                ? currentPattern
                : [[], ...currentPattern.slice(0, -1).map(cloneStepEvents)];
            case 'transpose':
              if (track.type === 'kick' || track.type === 'snare' || track.type === 'hihat') {
                return currentPattern;
              }

              return currentPattern.map((step) => (
                step.map((event) => ({ ...event, note: transposeNote(event.note, action.value ?? 0) }))
              ));
            case 'double-density': {
              const nextPattern = currentPattern.map(cloneStepEvents);
              for (let stepIndex = 0; stepIndex < currentPattern.length - 1; stepIndex += 1) {
                if (currentPattern[stepIndex].length > 0 && nextPattern[stepIndex + 1].length === 0) {
                  nextPattern[stepIndex + 1] = cloneStepEvents(currentPattern[stepIndex]);
                }
              }
              return nextPattern;
            }
            case 'halve-density':
              return currentPattern.map((step, stepIndex) => (stepIndex % 2 === 0 ? cloneStepEvents(step) : []));
            case 'randomize-velocity':
              return currentPattern.map((step) => step.map((event) => createStepEvent(event.note, {
                ...event,
                velocity: clamp(event.velocity + ((Math.random() * 0.16) - 0.08), 0.1, 1),
              })));
            default:
              return currentPattern;
          }
        })
      ));

      return commitProject(state, nextProject, clip.trackId, clip.id);
    }

    default:
      return null;
  }
};
