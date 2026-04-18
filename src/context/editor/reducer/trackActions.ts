import {
  createEmptyPattern,
  createStepEvent,
  createTrack as buildTrack,
  defaultNoteForTrack,
  duplicateTrack as buildDuplicateTrack,
} from '../../../project/schema';
import type { EditorAction, EditorState } from '../editorTypes';
import {
  clearOutOfRangeTrackSliceReferences,
  clamp,
  cloneStepEvents,
  commitProject,
  compareNotesDescending,
  mergeTrackSource,
  moveItem,
  normalizeSliceMemory,
  remapTrackSampleSlices,
  sanitizeActiveSampleSlice,
  transposeNote,
  updatePatternSteps,
  updateStepPattern,
  updateTrackAutomationPattern,
} from './reducerUtils';
import {
  getUniqueClipPatternProject,
  syncArrangerClips,
  updateTrack,
} from '../projectMutations';

export const handleTrackAction = (state: EditorState, action: EditorAction): EditorState | null => {
  const { present } = state.history;

  switch (action.type) {
    case 'SET_TRACK_NAME': {
      const nextName = action.name.trim();
      if (!nextName) {
        return state;
      }

      return commitProject(state, updateTrack(present, action.trackId, (track) => (
        nextName === track.name ? track : { ...track, name: nextName }
      )));
    }

    case 'SET_TRACK_PARAMS':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        params: {
          ...track.params,
          ...action.params,
        },
      })));

    case 'SET_TRACK_SOURCE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const mergedTrack = mergeTrackSource(track, action.source);

        if (Array.isArray(action.source.sampleSlices)) {
          return clearOutOfRangeTrackSliceReferences(mergedTrack, mergedTrack.source.sampleSlices.length);
        }

        return mergedTrack;
      }));

    case 'SELECT_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        source: {
          ...track.source,
          activeSampleSlice: action.sliceIndex !== null
            && action.sliceIndex >= 0
            && action.sliceIndex < track.source.sampleSlices.length
            ? action.sliceIndex
            : null,
        },
      })));

    case 'CREATE_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextSliceIndex = track.source.sampleSlices.length;
        if (nextSliceIndex >= 8) {
          return track;
        }

        const nextSlice = normalizeSliceMemory(
          action.slice ?? {
            end: track.source.sampleEnd,
            gain: track.source.sampleGain,
            reverse: track.source.sampleReverse,
            start: track.source.sampleStart,
          },
          `Slice ${nextSliceIndex + 1}`,
        );

        return {
          ...track,
          source: {
            ...track.source,
            activeSampleSlice: nextSliceIndex,
            sampleSlices: [...track.source.sampleSlices, nextSlice],
          },
        };
      }));

    case 'UPDATE_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (!track.source.sampleSlices[action.sliceIndex]) {
          return track;
        }

        const nextSlices = track.source.sampleSlices.map((slice, index) => (
          index === action.sliceIndex
            ? normalizeSliceMemory({ ...slice, ...action.updates }, slice.label)
            : slice
        ));

        return {
          ...track,
          source: {
            ...track.source,
            activeSampleSlice: sanitizeActiveSampleSlice(track, nextSlices),
            sampleSlices: nextSlices,
          },
        };
      }));

    case 'DELETE_SAMPLE_SLICE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        if (!track.source.sampleSlices[action.sliceIndex]) {
          return track;
        }

        const nextSlices = track.source.sampleSlices.filter((_, index) => index !== action.sliceIndex);
        const remappedTrack = remapTrackSampleSlices(track, (index) => {
          if (index === action.sliceIndex) {
            return null;
          }

          return index > action.sliceIndex ? index - 1 : index;
        });

        return {
          ...remappedTrack,
          source: {
            ...remappedTrack.source,
            activeSampleSlice: track.source.activeSampleSlice === action.sliceIndex
              ? (nextSlices[0] ? 0 : null)
              : typeof track.source.activeSampleSlice === 'number' && track.source.activeSampleSlice > action.sliceIndex
                ? track.source.activeSampleSlice - 1
                : sanitizeActiveSampleSlice(remappedTrack, nextSlices),
            sampleSlices: nextSlices,
          },
        };
      }));

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

    case 'TOGGLE_VOLUME':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextVolume = clamp(action.volume, -60, 6);
        return nextVolume === track.volume ? track : { ...track, volume: nextVolume };
      }));

    case 'TOGGLE_PAN':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const nextPan = clamp(action.pan, -1, 1);
        return nextPan === track.pan ? track : { ...track, pan: nextPan };
      }));

    case 'TOGGLE_MUTE':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        muted: !track.muted,
      })));

    case 'TOGGLE_SOLO':
      return commitProject(state, updateTrack(present, action.trackId, (track) => ({
        ...track,
        solo: !track.solo,
      })));

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
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const patternId = present.transport.currentPattern;
        const currentPattern = track.patterns[patternId] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return track;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep;

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [patternId]: nextSteps,
          },
        };
      }));

    case 'UPDATE_PATTERN_STEP_EVENT':
      return commitProject(state, updateTrack(present, action.trackId, (track) => {
        const currentPattern = track.patterns[action.patternIndex] ?? createEmptyPattern(present.transport.stepsPerPattern);
        const targetStep = currentPattern[action.stepIndex];

        if (!targetStep || !targetStep[action.noteIndex]) {
          return track;
        }

        const nextSteps = [...currentPattern];
        const nextStep = cloneStepEvents(targetStep);
        const targetEvent = nextStep[action.noteIndex];
        nextStep[action.noteIndex] = createStepEvent(targetEvent.note, {
          ...targetEvent,
          ...action.updates,
        });
        nextSteps[action.stepIndex] = nextStep;

        return {
          ...track,
          patterns: {
            ...track.patterns,
            [action.patternIndex]: nextSteps,
          },
        };
      }));

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

    case 'CREATE_TRACK': {
      const nextTrack = buildTrack(action.trackType, {
        patternCount: present.transport.patternCount,
        stepsPerPattern: present.transport.stepsPerPattern,
      });

      return commitProject(state, {
        ...present,
        arrangerClips: present.transport.mode === 'SONG'
          ? syncArrangerClips(
              [
                ...present.arrangerClips,
                {
                  beatLength: present.transport.stepsPerPattern,
                  id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  patternIndex: present.transport.currentPattern,
                  startBeat: 0,
                  trackId: nextTrack.id,
                },
              ],
              [...present.tracks, nextTrack],
              present.transport.patternCount,
            )
          : present.arrangerClips,
        tracks: [...present.tracks, nextTrack],
      }, nextTrack.id);
    }

    case 'DUPLICATE_TRACK': {
      const sourceTrack = present.tracks.find((track) => track.id === action.trackId);
      if (!sourceTrack) {
        return state;
      }

      const duplicatedTrack = buildDuplicateTrack(sourceTrack, present.transport);
      const duplicatedClips = present.arrangerClips
        .filter((clip) => clip.trackId === sourceTrack.id)
        .map((clip) => ({
          ...clip,
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          trackId: duplicatedTrack.id,
        }));

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          [...present.arrangerClips, ...duplicatedClips],
          [...present.tracks, duplicatedTrack],
          present.transport.patternCount,
        ),
        tracks: [...present.tracks, duplicatedTrack],
      }, duplicatedTrack.id);
    }

    case 'MOVE_TRACK': {
      const sourceIndex = present.tracks.findIndex((track) => track.id === action.trackId);
      if (sourceIndex < 0) {
        return state;
      }

      const targetIndex = action.direction === 'up' ? sourceIndex - 1 : sourceIndex + 1;
      if (targetIndex < 0 || targetIndex >= present.tracks.length) {
        return state;
      }

      const nextTracks = moveItem(present.tracks, sourceIndex, targetIndex);

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips,
          nextTracks,
          present.transport.patternCount,
        ),
        tracks: nextTracks,
      });
    }

    case 'REMOVE_TRACK': {
      if (!present.tracks.some((track) => track.id === action.trackId)) {
        return state;
      }

      const nextTracks = present.tracks.filter((track) => track.id !== action.trackId);
      const nextSelectedTrackId = state.ui.selectedTrackId === action.trackId
        ? nextTracks[0]?.id ?? null
        : state.ui.selectedTrackId;

      return commitProject(state, {
        ...present,
        arrangerClips: syncArrangerClips(
          present.arrangerClips.filter((clip) => clip.trackId !== action.trackId),
          nextTracks,
          present.transport.patternCount,
        ),
        tracks: nextTracks,
      }, nextSelectedTrackId);
    }

    default:
      return null;
  }
};
