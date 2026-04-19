import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
  loadPersistedSession: vi.fn(),
}));

vi.mock('../../../project/storage', async () => {
  const actual = await vi.importActual<typeof import('../../../project/storage')>('../../../project/storage');
  return {
    ...actual,
    loadPersistedSession: storageMocks.loadPersistedSession,
  };
});

import { resolveStudioRoute } from '../../../app/routeController';
import { createSessionFromTemplate } from '../../../project/storage';
import { createInitialEditorState } from './reducerUtils';

describe('createInitialEditorState route entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies explicit view and settings routes on top of a persisted session', () => {
    const persistedSession = createSessionFromTemplate('night-transit');
    persistedSession.ui.activeView = 'MIXER';
    persistedSession.ui.isSettingsOpen = false;

    storageMocks.loadPersistedSession.mockReturnValue(persistedSession);

    const state = createInitialEditorState(resolveStudioRoute('?setup=output&view=notes', true));

    expect(state.history.present.metadata.id).toBe(persistedSession.project.metadata.id);
    expect(state.ui.activeView).toBe('PIANO_ROLL');
    expect(state.ui.isSettingsOpen).toBe(true);
    expect(state.ui.selectedTrackId).toBe(persistedSession.ui.selectedTrackId);
  });

  it('builds a fresh session when none is persisted and still honors explicit deep links', () => {
    storageMocks.loadPersistedSession.mockReturnValue(null);

    const state = createInitialEditorState(resolveStudioRoute('?setup=track&view=song', false));

    expect(state.history.present.metadata.name).toBe('Blank Grid');
    expect(state.ui.activeView).toBe('ARRANGER');
    expect(state.ui.isSettingsOpen).toBe(true);
    expect(state.history.present.tracks.some((track) => track.id === state.ui.selectedTrackId)).toBe(true);
  });
});
