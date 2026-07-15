import { describe, expect, it } from 'vitest';

import { createSessionFromTemplate, hydrateSessionPayload } from '../../../project/storage';
import type { EditorState } from '../editorTypes';
import { SONG_FORM_DEFINITIONS } from '../songFormDefinitions';
import { editorReducer } from './editorReducer';

const createEditorState = (templateId: 'night-transit' | 'blank-grid' = 'night-transit'): EditorState => {
  const session = createSessionFromTemplate(templateId);

  return {
    history: {
      future: [],
      past: [],
      present: session.project,
    },
    ui: session.ui,
  };
};

describe('editorReducer', () => {
  it('normalizes invalid UI selections during hydration', () => {
    const state = createEditorState();
    const session = createSessionFromTemplate('night-transit');

    const nextState = editorReducer(state, {
      type: 'HYDRATE_SESSION',
      session: {
        project: session.project,
        ui: {
          activeView: 'MIXER',
          isSettingsOpen: true,
          loopRangeEndBeat: null,
          loopRangeStartBeat: null,
          pinnedTrackIds: ['missing-track', session.project.tracks[0]?.id ?? ''],
          selectedArrangerClipId: 'missing-clip',
          selectedTrackId: 'missing-track',
        },
      },
    });

    expect(nextState.ui.isSettingsOpen).toBe(true);
    expect(nextState.ui.selectedTrackId).toBe(session.project.tracks[0]?.id ?? null);
    expect(nextState.ui.selectedArrangerClipId).toBe(session.project.arrangerClips[0]?.id ?? null);
    expect(nextState.ui.pinnedTrackIds).toEqual(
      session.project.tracks[0]?.id ? [session.project.tracks[0].id] : [],
    );
  });

  it('removes deleted tracks from selection and pinned state', () => {
    const state = createEditorState();
    const removedTrackId = state.history.present.tracks[0]?.id;
    const fallbackTrackId = state.history.present.tracks[1]?.id ?? null;
    if (!removedTrackId) {
      throw new Error('Expected first track');
    }

    const nextState = editorReducer({
      ...state,
      ui: {
        ...state.ui,
        pinnedTrackIds: [removedTrackId],
        selectedTrackId: removedTrackId,
      },
    }, {
      type: 'REMOVE_TRACK',
      trackId: removedTrackId,
    });

    expect(nextState.history.present.tracks.some((track) => track.id === removedTrackId)).toBe(false);
    expect(nextState.history.present.arrangerClips.some((clip) => clip.trackId === removedTrackId)).toBe(false);
    expect(nextState.ui.pinnedTrackIds).toEqual([]);
    expect(nextState.ui.selectedTrackId).toBe(fallbackTrackId);
  });

  it('reorders a track to an arbitrary index', () => {
    const state = createEditorState();
    const tracks = state.history.present.tracks;
    const firstId = tracks[0]?.id;
    const thirdId = tracks[2]?.id;
    if (!firstId || !thirdId) {
      throw new Error('Expected at least three tracks');
    }

    const nextState = editorReducer(state, { type: 'REORDER_TRACK', trackId: firstId, toIndex: 2 });
    const next = nextState.history.present.tracks;

    expect(next[2]?.id).toBe(firstId); // moved track lands at the target index
    expect(next[1]?.id).toBe(thirdId); // the track that was there shifts up
    expect(next.length).toBe(tracks.length);
    expect(new Set(next.map((track) => track.id)).size).toBe(tracks.length);
  });

  it('falls back to a remaining clip when the selected arranger clip is removed', () => {
    const state = createEditorState();
    const removedClipId = state.history.present.arrangerClips[0]?.id;
    if (!removedClipId) {
      throw new Error('Expected clip');
    }

    const nextState = editorReducer({
      ...state,
      ui: {
        ...state.ui,
        selectedArrangerClipId: removedClipId,
      },
    }, {
      type: 'REMOVE_ARRANGER_CLIP',
      clipId: removedClipId,
    });

    expect(nextState.history.present.arrangerClips.some((clip) => clip.id === removedClipId)).toBe(false);
    expect(nextState.ui.selectedArrangerClipId).toBe(nextState.history.present.arrangerClips[0]?.id ?? null);
  });

  it('keeps song markers sorted when updating marker position', () => {
    const state = createEditorState();
    const markerId = 'marker-b';
    const nextState = editorReducer({
      ...state,
      history: {
        ...state.history,
        present: {
          ...state.history.present,
          markers: [
            { beat: 24, id: markerId, name: 'B' },
            { beat: 8, id: 'marker-a', name: 'A' },
          ],
        },
      },
    }, {
      type: 'UPDATE_SONG_MARKER',
      markerId,
      updates: { beat: 2 },
    });

    expect(nextState.history.present.markers.map((marker) => marker.id)).toEqual([markerId, 'marker-a']);
    expect(nextState.history.present.markers[0]?.beat).toBe(2);
  });

  it('sets settings state deterministically', () => {
    const state = createEditorState();

    const opened = editorReducer(state, {
      type: 'SET_SETTINGS_OPEN',
      open: true,
    });
    const closed = editorReducer(opened, {
      type: 'SET_SETTINGS_OPEN',
      open: false,
    });

    expect(opened.ui.isSettingsOpen).toBe(true);
    expect(closed.ui.isSettingsOpen).toBe(false);
  });

  it('preserves edited note gate and velocity through session hydration', () => {
    const state = createEditorState('blank-grid');
    const leadTrackId = state.history.present.tracks.find((track) => track.type === 'lead')?.id;
    if (!leadTrackId) {
      throw new Error('Expected lead track');
    }

    const seededState = editorReducer(state, {
      type: 'TOGGLE_STEP',
      note: 'C4',
      stepIndex: 3,
      trackId: leadTrackId,
    });
    const editedState = editorReducer(seededState, {
      type: 'UPDATE_STEP_EVENT',
      noteIndex: 0,
      stepIndex: 3,
      trackId: leadTrackId,
      updates: {
        gate: 2.75,
        velocity: 0.63,
      },
    });

    const hydrated = hydrateSessionPayload(JSON.parse(JSON.stringify({
      project: editedState.history.present,
      ui: editedState.ui,
    })));
    const hydratedTrack = hydrated?.project.tracks.find((track) => track.id === leadTrackId);
    const hydratedEvent = hydratedTrack?.patterns[0]?.[3]?.[0];

    expect(hydratedEvent).toMatchObject({
      gate: 2.75,
      note: 'C4',
      velocity: 0.63,
    });
  });

  it('applies a song form through reducer history and live selection', () => {
    const state = createEditorState();
    const definition = SONG_FORM_DEFINITIONS.find((candidate) => candidate.id === 'club-lift');
    const nextState = editorReducer(state, {
      type: 'APPLY_SONG_FORM',
      formId: 'club-lift',
    });

    if (!definition) {
      throw new Error('Expected club lift song form');
    }

    expect(nextState.history.past).toHaveLength(1);
    expect(nextState.history.present.transport.mode).toBe('SONG');
    expect(nextState.history.present.markers.map((marker) => marker.name)).toEqual(
      definition.sections.map((section) => section.label),
    );
    expect(nextState.ui.selectedArrangerClipId).toBe(nextState.history.present.arrangerClips[0]?.id ?? null);
    expect(nextState.ui.selectedTrackId).toBe(nextState.history.present.arrangerClips[0]?.trackId ?? null);
  });

  it('applies a saved pattern segment onto a target pattern', () => {
    const state = createEditorState('blank-grid');
    const leadTrackId = state.history.present.tracks.find((track) => track.type === 'lead')?.id;
    if (!leadTrackId) {
      throw new Error('Expected lead track');
    }

    const nextState = editorReducer(state, {
      type: 'APPLY_PATTERN_SEGMENT',
      automation: {
        level: Array.from({ length: state.history.present.transport.stepsPerPattern }, (_, index) => (index === 0 ? 0.82 : 0.5)),
        tone: Array.from({ length: state.history.present.transport.stepsPerPattern }, (_, index) => (index === 1 ? 0.22 : 0.5)),
      },
      patternIndex: 0,
      steps: [
        [{ gate: 1.5, note: 'E4', velocity: 0.66 }],
        [{ gate: 0.75, note: 'G4', velocity: 0.58 }],
      ],
      trackId: leadTrackId,
    });

    const targetTrack = nextState.history.present.tracks.find((track) => track.id === leadTrackId);
    expect(targetTrack?.patterns[0]?.[0]?.[0]).toMatchObject({ gate: 1.5, note: 'E4', velocity: 0.66 });
    expect(targetTrack?.patterns[0]?.[1]?.[0]).toMatchObject({ gate: 0.75, note: 'G4', velocity: 0.58 });
    expect(targetTrack?.automation?.[0]?.level[0]).toBe(0.82);
    expect(targetTrack?.automation?.[0]?.tone[1]).toBe(0.22);
  });

  it('preserves existing automation when a segment only replaces notes', () => {
    const state = createEditorState('blank-grid');
    const leadTrack = state.history.present.tracks.find((track) => track.type === 'lead');
    if (!leadTrack) {
      throw new Error('Expected lead track');
    }
    const automation = {
      level: Array.from({ length: state.history.present.transport.stepsPerPattern }, (_, index) => (index === 4 ? 0.88 : 0.5)),
      tone: Array.from({ length: state.history.present.transport.stepsPerPattern }, (_, index) => (index === 5 ? 0.24 : 0.5)),
    };
    const seededState: EditorState = {
      ...state,
      history: {
        ...state.history,
        present: {
          ...state.history.present,
          tracks: state.history.present.tracks.map((track) => (
            track.id === leadTrack.id
              ? { ...track, automation: { ...track.automation, 0: automation } }
              : track
          )),
        },
      },
    };

    const edited = editorReducer(seededState, {
      type: 'APPLY_PATTERN_SEGMENT',
      patternIndex: 0,
      steps: [[{ gate: 1, note: 'D4', velocity: 0.7 }]],
      trackId: leadTrack.id,
    });

    expect(edited.history.present.tracks.find((track) => track.id === leadTrack.id)?.automation[0]).toEqual(automation);
  });

  it('applies multi-lane note edits as one undoable action without resetting automation', () => {
    const state = createEditorState('blank-grid');
    const [firstTrack, secondTrack] = state.history.present.tracks;
    if (!firstTrack || !secondTrack) {
      throw new Error('Expected at least two tracks');
    }

    const automation = {
      level: Array.from({ length: state.history.present.transport.stepsPerPattern }, (_, index) => (index === 2 ? 0.91 : 0.5)),
      tone: Array.from({ length: state.history.present.transport.stepsPerPattern }, (_, index) => (index === 3 ? 0.17 : 0.5)),
    };
    const seededState: EditorState = {
      ...state,
      history: {
        ...state.history,
        present: {
          ...state.history.present,
          tracks: state.history.present.tracks.map((track) => (
            track.id === firstTrack.id
              ? { ...track, automation: { ...track.automation, 0: automation } }
              : track
          )),
        },
      },
    };

    const edited = editorReducer(seededState, {
      type: 'APPLY_PATTERN_STEP_BATCH',
      patternIndex: 0,
      segments: [
        { steps: [[{ gate: 1, note: 'C4', velocity: 0.72 }]], trackId: firstTrack.id },
        { steps: [[], [{ gate: 0.75, note: 'G3', velocity: 0.64 }]], trackId: secondTrack.id },
      ],
    });

    expect(edited.history.past).toHaveLength(1);
    expect(edited.history.present.tracks.find((track) => track.id === firstTrack.id)?.patterns[0]?.[0]?.[0]?.note).toBe('C4');
    expect(edited.history.present.tracks.find((track) => track.id === secondTrack.id)?.patterns[0]?.[1]?.[0]?.note).toBe('G3');
    expect(edited.history.present.tracks.find((track) => track.id === firstTrack.id)?.automation[0]).toEqual(automation);

    const undone = editorReducer(edited, { type: 'UNDO' });
    expect(undone.history.present).toEqual(seededState.history.present);
  });

  it('grows the pattern and writes a phrase in the same history entry', () => {
    const state = createEditorState('blank-grid');
    const firstTrack = state.history.present.tracks[0];
    if (!firstTrack) {
      throw new Error('Expected a track');
    }

    const originalLength = state.history.present.transport.stepsPerPattern;
    const nextLength = originalLength + 4;
    const steps = Array.from({ length: nextLength }, (_, index) => (
      index === nextLength - 1 ? [{ gate: 1, note: 'A4', velocity: 0.8 }] : []
    ));
    const edited = editorReducer(state, {
      type: 'APPLY_PATTERN_STEP_BATCH',
      patternIndex: 0,
      segments: [{ steps, trackId: firstTrack.id }],
      stepsPerPattern: nextLength,
    });

    expect(edited.history.past).toHaveLength(1);
    expect(edited.history.present.transport.stepsPerPattern).toBe(nextLength);
    expect(edited.history.present.tracks[0]?.patterns[0]?.[nextLength - 1]?.[0]?.note).toBe('A4');

    const undone = editorReducer(edited, { type: 'UNDO' });
    expect(undone.history.present.transport.stepsPerPattern).toBe(originalLength);
  });

  it('commits a runway continuation and pattern resize as one undoable edit', () => {
    const state = createEditorState('blank-grid');
    const leadTrackId = state.history.present.tracks.find((track) => track.type === 'lead')?.id;
    if (!leadTrackId) {
      throw new Error('Expected lead track');
    }

    const originalLength = state.history.present.transport.stepsPerPattern;
    const steps = Array.from({ length: originalLength + 3 }, (_, index) => (
      index >= originalLength
        ? [{ gate: 1.5, note: 'G4', velocity: 0.64 }]
        : []
    ));
    const continued = editorReducer(state, {
      type: 'CONTINUE_PATTERN_RUNWAY',
      patternIndex: 0,
      steps,
      stepsPerPattern: originalLength + 3,
      trackId: leadTrackId,
    });

    expect(continued.history.past).toHaveLength(1);
    expect(continued.history.present.transport.stepsPerPattern).toBe(originalLength + 3);
    expect(continued.history.present.tracks.find((track) => track.id === leadTrackId)?.patterns[0]?.slice(originalLength).map((step) => step[0]?.note)).toEqual(['G4', 'G4', 'G4']);

    const undone = editorReducer(continued, { type: 'UNDO' });
    expect(undone.history.present.transport.stepsPerPattern).toBe(originalLength);
  });

  it('moves a complete time column across every lane and its automation', () => {
    const state = createEditorState('blank-grid');
    const [firstTrack, secondTrack] = state.history.present.tracks;
    if (!firstTrack || !secondTrack) {
      throw new Error('Expected at least two tracks');
    }

    const seededState: EditorState = {
      ...state,
      history: {
        future: [],
        past: [],
        present: {
          ...state.history.present,
          tracks: state.history.present.tracks.map((track) => ({
            ...track,
            automation: {
              ...track.automation,
              0: {
                level: Array.from({ length: 16 }, (_, index) => (index === 4 ? 0.84 : index === 5 ? 0.31 : 0.5)),
                tone: Array.from({ length: 16 }, (_, index) => (index === 4 ? 0.18 : index === 5 ? 0.72 : 0.5)),
              },
            },
            patterns: {
              ...track.patterns,
              0: Array.from({ length: 16 }, (_, index) => (
                index === 4
                  ? [{ gate: 1, note: track.id === firstTrack.id ? 'C4' : 'C2', velocity: 0.7 }]
                  : index === 5
                    ? [{ gate: 1, note: track.id === firstTrack.id ? 'D4' : 'D2', velocity: 0.6 }]
                    : []
              )),
            },
          })),
        },
      },
    };

    const moved = editorReducer(seededState, {
      type: 'EDIT_PATTERN_COLUMN',
      operation: 'move-right',
      patternIndex: 0,
      stepIndex: 4,
    });

    expect(moved.history.past).toHaveLength(1);
    expect(moved.history.present.tracks[0]?.patterns[0]?.[4]?.[0]?.note).toBe('D4');
    expect(moved.history.present.tracks[0]?.patterns[0]?.[5]?.[0]?.note).toBe('C4');
    expect(moved.history.present.tracks[1]?.patterns[0]?.[5]?.[0]?.note).toBe('C2');
    expect(moved.history.present.tracks[0]?.automation[0]?.level.slice(4, 6)).toEqual([0.31, 0.84]);
    expect(moved.history.present.tracks[0]?.automation[0]?.tone.slice(4, 6)).toEqual([0.72, 0.18]);
    expect(editorReducer(moved, { type: 'UNDO' }).history.present).toEqual(seededState.history.present);
  });

  it('clears a time column without changing the pattern length or other banks', () => {
    const state = createEditorState('blank-grid');
    const seededState: EditorState = {
      ...state,
      history: {
        future: [],
        past: [],
        present: {
          ...state.history.present,
          tracks: state.history.present.tracks.map((track) => ({
            ...track,
            automation: {
              ...track.automation,
              0: {
                level: Array.from({ length: 16 }, (_, index) => (index === 6 ? 0.91 : 0.5)),
                tone: Array.from({ length: 16 }, (_, index) => (index === 6 ? 0.12 : 0.5)),
              },
            },
            patterns: {
              ...track.patterns,
              0: Array.from({ length: 16 }, (_, index) => (
                index === 6 ? [{ gate: 1, note: 'C4', velocity: 0.7 }] : []
              )),
              1: Array.from({ length: 16 }, (_, index) => (
                index === 6 ? [{ gate: 1, note: 'G4', velocity: 0.7 }] : []
              )),
            },
          })),
        },
      },
    };

    const cleared = editorReducer(seededState, {
      type: 'EDIT_PATTERN_COLUMN',
      operation: 'clear',
      patternIndex: 0,
      stepIndex: 6,
    });

    expect(cleared.history.present.transport.stepsPerPattern).toBe(16);
    expect(cleared.history.present.tracks.every((track) => track.patterns[0]?.[6]?.length === 0)).toBe(true);
    expect(cleared.history.present.tracks.every((track) => track.patterns[1]?.[6]?.[0]?.note === 'G4')).toBe(true);
    expect(cleared.history.present.tracks[0]?.automation[0]?.level[6]).toBe(0.5);
    expect(cleared.history.present.tracks[0]?.automation[0]?.tone[6]).toBe(0.5);
    expect(cleared.history.past).toHaveLength(1);
  });

  it('deletes a time column from every bank and compresses song timing', () => {
    const state = createEditorState('blank-grid');
    const resized = editorReducer(state, { type: 'SET_STEPS_PER_PATTERN', stepsPerPattern: 22 });
    const firstTrack = resized.history.present.tracks[0];
    if (!firstTrack) {
      throw new Error('Expected a track');
    }
    const makePattern = (deletedNote: string, shiftedNote: string) => Array.from({ length: 22 }, (_, index) => (
      index === 19
        ? [{ gate: 1, note: deletedNote, velocity: 0.6 }]
        : index === 20
          ? [{ gate: 1, note: shiftedNote, velocity: 0.8 }]
          : []
    ));
    const seededState: EditorState = {
      ...resized,
      history: {
        future: [],
        past: [],
        present: {
          ...resized.history.present,
          arrangerClips: [
            { beatLength: 22, id: 'clip-a', patternIndex: 0, startBeat: 0, trackId: firstTrack.id },
            { beatLength: 22, id: 'clip-b', patternIndex: 1, startBeat: 22, trackId: firstTrack.id },
          ],
          markers: [{ beat: 22, id: 'marker-b', name: 'Second section' }],
          tracks: resized.history.present.tracks.map((track) => ({
            ...track,
            automation: {
              ...track.automation,
              0: {
                level: Array.from({ length: 22 }, (_, index) => (index === 19 ? 0.9 : index === 20 ? 0.24 : 0.5)),
                tone: Array.from({ length: 22 }, () => 0.5),
              },
            },
            patterns: {
              ...track.patterns,
              0: makePattern('C4', 'D4'),
              1: makePattern('E4', 'F4'),
            },
          })),
        },
      },
    };

    const deleted = editorReducer(seededState, {
      type: 'EDIT_PATTERN_COLUMN',
      operation: 'delete',
      patternIndex: 0,
      stepIndex: 19,
    });

    expect(deleted.history.present.transport.stepsPerPattern).toBe(21);
    expect(deleted.history.present.tracks.every((track) => track.patterns[0]?.length === 21)).toBe(true);
    expect(deleted.history.present.tracks[0]?.patterns[0]?.[19]?.[0]?.note).toBe('D4');
    expect(deleted.history.present.tracks[0]?.patterns[1]?.[19]?.[0]?.note).toBe('F4');
    expect(deleted.history.present.tracks[0]?.automation[0]?.level[19]).toBe(0.24);
    expect(deleted.history.present.arrangerClips.map((clip) => [clip.startBeat, clip.beatLength])).toEqual([[0, 21], [21, 21]]);
    expect(deleted.history.present.markers[0]?.beat).toBe(21);
    expect(deleted.history.past).toHaveLength(1);
    expect(editorReducer(deleted, { type: 'UNDO' }).history.present).toEqual(seededState.history.present);
  });

  it('duplicates one bank column while inserting blank time into the other banks', () => {
    const state = createEditorState('blank-grid');
    const firstTrack = state.history.present.tracks[0];
    if (!firstTrack) {
      throw new Error('Expected a track');
    }
    const seededState: EditorState = {
      ...state,
      history: {
        future: [],
        past: [],
        present: {
          ...state.history.present,
          arrangerClips: [{ beatLength: 16, id: 'clip-a', patternIndex: 0, startBeat: 0, trackId: firstTrack.id }],
          tracks: state.history.present.tracks.map((track) => ({
            ...track,
            patterns: {
              ...track.patterns,
              0: Array.from({ length: 16 }, (_, index) => (
                index === 3 ? [{ gate: 1, note: 'C4', velocity: 0.7 }] : []
              )),
              1: Array.from({ length: 16 }, (_, index) => (
                index === 4 ? [{ gate: 1, note: 'G4', velocity: 0.7 }] : []
              )),
            },
          })),
        },
      },
    };

    const duplicated = editorReducer(seededState, {
      type: 'EDIT_PATTERN_COLUMN',
      operation: 'duplicate',
      patternIndex: 0,
      stepIndex: 3,
    });

    expect(duplicated.history.present.transport.stepsPerPattern).toBe(17);
    expect(duplicated.history.present.tracks[0]?.patterns[0]?.slice(3, 5).map((step) => step[0]?.note)).toEqual(['C4', 'C4']);
    expect(duplicated.history.present.tracks[0]?.patterns[1]?.[4]).toEqual([]);
    expect(duplicated.history.present.tracks[0]?.patterns[1]?.[5]?.[0]?.note).toBe('G4');
    expect(duplicated.history.present.arrangerClips[0]?.beatLength).toBe(17);
    expect(duplicated.history.past).toHaveLength(1);
  });

  it('records MIDI notes additively without toggling existing notes off', () => {
    const state = createEditorState('blank-grid');
    const leadTrackId = state.history.present.tracks.find((track) => track.type === 'lead')?.id;
    if (!leadTrackId) {
      throw new Error('Expected lead track');
    }

    const notesAtStep = (editorState: EditorState) => (
      editorState.history.present.tracks.find((track) => track.id === leadTrackId)
        ?.patterns[0]?.[2]?.map((event) => event.note) ?? []
    );

    const afterFirst = editorReducer(state, { type: 'RECORD_STEP_NOTE', note: 'C4', stepIndex: 2, trackId: leadTrackId });
    expect(notesAtStep(afterFirst)).toEqual(['C4']);

    // A second pitch stacks into a chord rather than replacing the first.
    const afterSecond = editorReducer(afterFirst, { type: 'RECORD_STEP_NOTE', note: 'E4', stepIndex: 2, trackId: leadTrackId });
    expect(notesAtStep(afterSecond).sort()).toEqual(['C4', 'E4']);

    // Replaying a pitch already on the step is a no-op (unlike TOGGLE_STEP,
    // which would remove it), so a held or repeated key never erases input.
    const afterRepeat = editorReducer(afterSecond, { type: 'RECORD_STEP_NOTE', note: 'C4', stepIndex: 2, trackId: leadTrackId });
    expect(notesAtStep(afterRepeat).sort()).toEqual(['C4', 'E4']);
  });

  it('PLACE_SONG_STEP drops a clip and places a note in an empty song region', () => {
    const state = createEditorState('blank-grid');
    const present = state.history.present;
    const stepsPer = present.transport.stepsPerPattern;
    const track = present.tracks[4];
    const laneTail = present.arrangerClips
      .filter((clip) => clip.trackId === track.id)
      .reduce((max, clip) => Math.max(max, clip.startBeat + clip.beatLength), 0);
    const songStep = laneTail + stepsPer + 5; // clearly past any existing clip
    const expectedStart = Math.floor(songStep / stepsPer) * stepsPer;

    const next = editorReducer(state, { type: 'PLACE_SONG_STEP', note: 'C3', songStep, trackId: track.id });
    const np = next.history.present;

    const newClip = np.arrangerClips.find((clip) => clip.trackId === track.id && clip.startBeat === expectedStart);
    expect(newClip).toBeDefined();
    expect(newClip?.patternIndex).toBe(present.transport.currentPattern);
    const localStep = songStep - expectedStart;
    const nextTrack = np.tracks.find((candidate) => candidate.id === track.id);
    expect((nextTrack?.patterns[newClip?.patternIndex ?? 0]?.[localStep] ?? []).some((event) => event.note === 'C3')).toBe(true);
  });

  it('PLACE_SONG_STEP edits inside an existing clip without adding one', () => {
    const state = createEditorState('blank-grid');
    const present = state.history.present;
    const track = present.tracks[4];
    const existing = present.arrangerClips.find((clip) => clip.trackId === track.id);
    if (!existing) {
      throw new Error('Expected a clip for the track');
    }
    const clipsBefore = present.arrangerClips.filter((clip) => clip.trackId === track.id).length;
    const songStep = existing.startBeat + 1;

    const next = editorReducer(state, { type: 'PLACE_SONG_STEP', note: 'D3', songStep, trackId: track.id });
    const np = next.history.present;

    expect(np.arrangerClips.filter((clip) => clip.trackId === track.id).length).toBe(clipsBefore);
    const localStep = (songStep - existing.startBeat) % present.transport.stepsPerPattern;
    const nextTrack = np.tracks.find((candidate) => candidate.id === track.id);
    expect((nextTrack?.patterns[existing.patternIndex]?.[localStep] ?? []).some((event) => event.note === 'D3')).toBe(true);
  });

  it('deletes a song section as one undoable cut and clears an overlapping loop', () => {
    const state = createEditorState('blank-grid');
    const track = state.history.present.tracks[0];
    const seeded: EditorState = {
      ...state,
      history: {
        future: [],
        past: [],
        present: {
          ...state.history.present,
          arrangementLength: 48,
          arrangerClips: [0, 16, 32].map((startBeat, patternIndex) => ({
            beatLength: 16,
            id: `section_clip_${patternIndex}`,
            patternIndex,
            startBeat,
            trackId: track.id,
          })),
          markers: [
            { beat: 0, id: 'section_intro', name: 'Intro' },
            { beat: 16, id: 'section_verse', name: 'Verse' },
            { beat: 32, id: 'section_hook', name: 'Hook' },
          ],
        },
      },
      ui: { ...state.ui, loopRangeEndBeat: 32, loopRangeStartBeat: 16 },
    };

    const deleted = editorReducer(seeded, { type: 'DELETE_SONG_RANGE', endBeat: 32, startBeat: 16 });

    expect(deleted.history.past).toHaveLength(1);
    expect(deleted.history.present.arrangementLength).toBe(32);
    expect(deleted.history.present.arrangerClips.map((clip) => clip.startBeat)).toEqual([0, 16]);
    expect(deleted.history.present.markers.map((marker) => marker.name)).toEqual(['Intro', 'Hook']);
    expect(deleted.ui.loopRangeStartBeat).toBeNull();
    expect(deleted.ui.loopRangeEndBeat).toBeNull();
    expect(editorReducer(deleted, { type: 'UNDO' }).history.present).toEqual(seeded.history.present);
  });

  it('keeps a loop stable at an insertion boundary and grows it for an internal insertion', () => {
    const state = createEditorState('blank-grid');
    const seeded: EditorState = {
      ...state,
      history: {
        ...state.history,
        present: { ...state.history.present, arrangementLength: 32 },
      },
      ui: { ...state.ui, loopRangeEndBeat: 16, loopRangeStartBeat: 0 },
    };

    const insertedAfterLoop = editorReducer(seeded, {
      type: 'INSERT_BLANK_SONG_SECTION',
      atBeat: 16,
      beatLength: 16,
      name: 'Verse',
    });
    expect(insertedAfterLoop.ui.loopRangeStartBeat).toBe(0);
    expect(insertedAfterLoop.ui.loopRangeEndBeat).toBe(16);

    const insertedInsideLoop = editorReducer(
      { ...seeded, ui: { ...seeded.ui, loopRangeEndBeat: 24 } },
      {
        type: 'INSERT_BLANK_SONG_SECTION',
        atBeat: 16,
        beatLength: 16,
        name: 'Break',
      },
    );
    expect(insertedInsideLoop.ui.loopRangeStartBeat).toBe(0);
    expect(insertedInsideLoop.ui.loopRangeEndBeat).toBe(40);
  });

  it('resizes a section as one undoable edit and keeps later music aligned', () => {
    const state = createEditorState('blank-grid');
    const track = state.history.present.tracks[0];
    const seeded: EditorState = {
      ...state,
      history: {
        future: [],
        past: [],
        present: {
          ...state.history.present,
          arrangementLength: 48,
          arrangerClips: [0, 16, 32].map((startBeat, patternIndex) => ({
            beatLength: 16,
            id: `resize_clip_${patternIndex}`,
            patternIndex,
            startBeat,
            trackId: track.id,
          })),
          markers: [
            { beat: 0, id: 'resize_intro', name: 'Intro' },
            { beat: 16, id: 'resize_verse', name: 'Verse' },
            { beat: 32, id: 'resize_hook', name: 'Hook' },
          ],
        },
      },
      ui: { ...state.ui, loopRangeEndBeat: 48, loopRangeStartBeat: 32 },
    };

    const resized = editorReducer(seeded, {
      type: 'RESIZE_SONG_SECTION_END',
      currentEndBeat: 16,
      nextEndBeat: 24,
      startBeat: 0,
    });

    expect(resized.history.past).toHaveLength(1);
    expect(resized.history.present.arrangementLength).toBe(56);
    expect(resized.history.present.arrangerClips.map((clip) => clip.startBeat)).toEqual([0, 24, 40]);
    expect(resized.history.present.markers.map((marker) => marker.beat)).toEqual([0, 24, 40]);
    expect(resized.ui.loopRangeStartBeat).toBe(40);
    expect(resized.ui.loopRangeEndBeat).toBe(56);
    expect(editorReducer(resized, { type: 'UNDO' }).history.present).toEqual(seeded.history.present);
  });

  it('saves and recalls a section through reducer history', () => {
    const state = createEditorState('blank-grid');
    const saved = editorReducer(state, {
      type: 'SAVE_SONG_RANGE',
      endBeat: 16,
      name: 'Opening',
      startBeat: 0,
    });
    const savedSection = saved.history.present.savedSongSections[0];
    if (!savedSection) {
      throw new Error('Expected a saved section');
    }

    const recalled = editorReducer(saved, {
      type: 'INSERT_SAVED_SONG_SECTION',
      atBeat: 16,
      savedSectionId: savedSection.id,
    });

    expect(saved.history.past).toHaveLength(1);
    expect(recalled.history.past).toHaveLength(2);
    expect(recalled.history.present.arrangementLength).toBe(32);
    expect(recalled.history.present.transport.patternCount).toBe(state.history.present.transport.patternCount + 1);
    expect(recalled.history.present.markers.some((marker) => marker.beat === 16 && marker.name === 'Opening')).toBe(true);
  });
});
