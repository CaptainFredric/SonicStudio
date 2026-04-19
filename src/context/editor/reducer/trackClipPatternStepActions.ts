import {
  createStepEvent,
  defaultNoteForTrack,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  cloneStepEvents,
  commitProject,
  compareNotesDescending,
  updatePatternSteps,
} from './reducerUtils';
import {
  getUniqueClipPatternProject,
  updateTrack,
} from '../projectMutations';

export const handleTrackClipPatternStepAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
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

    default:
      return null;
  }
};
