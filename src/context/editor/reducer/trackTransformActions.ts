import {
  createEmptyPattern,
  createStepEvent,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  clamp,
  cloneStepEvents,
  commitProject,
  transposeNote,
  updatePatternSteps,
  updateTrackAutomationPattern,
} from './reducerUtils';
import {
  getUniqueClipPatternProject,
  updateTrack,
} from '../projectMutations';

export const handleTrackTransformAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
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
