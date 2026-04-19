import { describe, expect, it } from 'vitest';

import { createSessionFromTemplate } from '../../../project/storage';
import type { EditorState } from '../editorTypes';
import { editorReducer } from './editorReducer';

const createEditorState = (): EditorState => {
  const session = createSessionFromTemplate('night-transit');

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
          activeView: 'ARRANGER',
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
});
