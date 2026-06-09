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
});
