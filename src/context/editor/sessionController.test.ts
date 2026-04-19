import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createSessionFromTemplate } from '../../project/storage';
import { editorReducer } from './reducer/editorReducer';
import { createSessionController } from './sessionController';

const sessionWorkflowMocks = vi.hoisted(() => ({
  deleteStudioCheckpoint: vi.fn(() => []),
  importStudioMidiFile: vi.fn(),
  importStudioSessionFile: vi.fn(),
  restoreStudioCheckpoint: vi.fn(),
  saveStudioCheckpoint: vi.fn(() => []),
}));

vi.mock('../../services/sessionWorkflow', () => ({
  deleteStudioCheckpoint: sessionWorkflowMocks.deleteStudioCheckpoint,
  importStudioMidiFile: sessionWorkflowMocks.importStudioMidiFile,
  importStudioSessionFile: sessionWorkflowMocks.importStudioSessionFile,
  restoreStudioCheckpoint: sessionWorkflowMocks.restoreStudioCheckpoint,
  saveStudioCheckpoint: sessionWorkflowMocks.saveStudioCheckpoint,
}));

describe('sessionController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores a checkpoint into live editor state and resets save state', () => {
    const restoredSession = createSessionFromTemplate('night-transit');
    const dispatchHydrateSession = vi.fn();
    const resetTransportState = vi.fn();
    const setLastSavedAt = vi.fn();
    const setSaveStatus = vi.fn();

    sessionWorkflowMocks.restoreStudioCheckpoint.mockReturnValue(restoredSession);

    const controller = createSessionController({
      currentProject: restoredSession.project,
      currentUi: restoredSession.ui,
      dispatchHydrateSession,
      persistCurrentSession: vi.fn(),
      resetTransportState,
      setLastSavedAt,
      setProjectCheckpoints: vi.fn(),
      setSaveStatus,
    });

    expect(controller.restoreCheckpoint('checkpoint-a')).toBe(true);
    expect(sessionWorkflowMocks.restoreStudioCheckpoint).toHaveBeenCalledWith('checkpoint-a');
    expect(resetTransportState).toHaveBeenCalled();
    expect(setLastSavedAt).toHaveBeenCalledWith(null);
    expect(setSaveStatus).toHaveBeenCalledWith('idle');
    expect(dispatchHydrateSession).toHaveBeenCalledWith(restoredSession);
  });

  it('restores a checkpoint cleanly even when live and checkpoint selection are stale', () => {
    const baseSession = createSessionFromTemplate('blank-grid');
    const restoredSession = createSessionFromTemplate('night-transit');
    let state = {
      history: {
        future: [],
        past: [],
        present: baseSession.project,
      },
      ui: {
        ...baseSession.ui,
        pinnedTrackIds: ['missing-track'],
        selectedArrangerClipId: 'missing-clip',
        selectedTrackId: 'missing-track',
      },
    };

    sessionWorkflowMocks.restoreStudioCheckpoint.mockReturnValue({
      ...restoredSession,
      ui: {
        ...restoredSession.ui,
        pinnedTrackIds: ['missing-track'],
        selectedArrangerClipId: 'missing-clip',
        selectedTrackId: 'missing-track',
      },
    });

    const controller = createSessionController({
      currentProject: state.history.present,
      currentUi: state.ui,
      dispatchHydrateSession: (session) => {
        state = editorReducer(state, { type: 'HYDRATE_SESSION', session });
      },
      persistCurrentSession: vi.fn(),
      resetTransportState: vi.fn(),
      setLastSavedAt: vi.fn(),
      setProjectCheckpoints: vi.fn(),
      setSaveStatus: vi.fn(),
    });

    expect(controller.restoreCheckpoint('checkpoint-stale')).toBe(true);
    expect(state.ui.selectedTrackId).toBe(restoredSession.project.tracks[0]?.id ?? null);
    expect(state.ui.selectedArrangerClipId).toBe(restoredSession.project.arrangerClips[0]?.id ?? null);
    expect(state.ui.pinnedTrackIds).toEqual([]);
  });

  it('marks save status as error when imported JSON is invalid', async () => {
    const session = createSessionFromTemplate('blank-grid');
    const setSaveStatus = vi.fn();

    sessionWorkflowMocks.importStudioSessionFile.mockResolvedValue(null);

    const controller = createSessionController({
      currentProject: session.project,
      currentUi: session.ui,
      dispatchHydrateSession: vi.fn(),
      persistCurrentSession: vi.fn(),
      resetTransportState: vi.fn(),
      setLastSavedAt: vi.fn(),
      setProjectCheckpoints: vi.fn(),
      setSaveStatus,
    });

    await expect(controller.importSession({} as File)).resolves.toBe(false);
    expect(sessionWorkflowMocks.saveStudioCheckpoint).toHaveBeenCalledWith(
      { project: session.project, ui: session.ui },
      'Before JSON import',
    );
    expect(setSaveStatus).toHaveBeenCalledWith('error');
  });
});
