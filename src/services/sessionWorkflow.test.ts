import { describe, expect, it, vi } from 'vitest';

import { createProjectFromTemplate, type StudioSession } from '../project/schema';
import {
  deleteStudioCheckpoint,
  importStudioMidiFile,
  importStudioSessionFile,
  listStudioCheckpoints,
  persistStudioSession,
  restoreStudioCheckpoint,
  saveStudioCheckpoint,
  type SessionWorkflowApi,
} from './sessionWorkflow';

const createSession = (name = 'Recovered Session'): StudioSession => ({
  project: {
    ...createProjectFromTemplate('blank-grid'),
    metadata: {
      ...createProjectFromTemplate('blank-grid').metadata,
      name,
    },
  },
  ui: {
    activeView: 'ARRANGER',
    isSettingsOpen: false,
    loopRangeEndBeat: null,
    loopRangeStartBeat: null,
    pinnedTrackIds: [],
    selectedArrangerClipId: null,
    selectedTrackId: null,
  },
});

const createApi = (): SessionWorkflowApi => ({
  deleteProjectCheckpoint: vi.fn((checkpointId: string) => [{ id: checkpointId }]) as unknown as SessionWorkflowApi['deleteProjectCheckpoint'],
  hydrateSessionPayload: vi.fn((value: unknown) => value as StudioSession) as unknown as SessionWorkflowApi['hydrateSessionPayload'],
  importMidiFile: vi.fn(async () => createSession('MIDI Import')) as unknown as SessionWorkflowApi['importMidiFile'],
  listProjectCheckpoints: vi.fn(() => [{ id: 'checkpoint-a' }]) as unknown as SessionWorkflowApi['listProjectCheckpoints'],
  persistSession: vi.fn((session: StudioSession) => ({
    savedAt: '2026-04-17T12:00:00.000Z',
    session,
    version: 1 as const,
  })) as unknown as SessionWorkflowApi['persistSession'],
  restoreProjectCheckpoint: vi.fn(() => createSession('Restored')) as unknown as SessionWorkflowApi['restoreProjectCheckpoint'],
  saveProjectCheckpoint: vi.fn(() => ({
    id: 'checkpoint-a',
    label: 'Saved point',
    projectName: 'Recovered Session',
    savedAt: '2026-04-17T12:00:00.000Z',
    session: createSession(),
    version: 1 as const,
  })) as unknown as SessionWorkflowApi['saveProjectCheckpoint'],
});

describe('sessionWorkflow', () => {
  it('persists a session through the workflow boundary', () => {
    const api = createApi();
    const session = createSession();

    const result = persistStudioSession(session, api);

    expect(api.persistSession).toHaveBeenCalledWith(session);
    expect(result?.savedAt).toBe('2026-04-17T12:00:00.000Z');
  });

  it('saves a checkpoint and refreshes the checkpoint list', () => {
    const api = createApi();
    const session = createSession('Night Transit');

    const checkpoints = saveStudioCheckpoint(session, undefined, api);

    expect(api.saveProjectCheckpoint).toHaveBeenCalledWith(session, 'Night Transit checkpoint');
    expect(api.listProjectCheckpoints).toHaveBeenCalled();
    expect(checkpoints).toEqual([{ id: 'checkpoint-a' }]);
  });

  it('imports a JSON session through hydrateSessionPayload', async () => {
    const api = createApi();
    const file = {
      text: async () => JSON.stringify({ project: 'payload' }),
    };

    const session = await importStudioSessionFile(file, api);

    expect(api.hydrateSessionPayload).toHaveBeenCalledWith({ project: 'payload' });
    expect(session).toEqual({ project: 'payload' });
  });

  it('returns null when MIDI import throws', async () => {
    const api = createApi();
    api.importMidiFile = vi.fn(async () => {
      throw new Error('boom');
    }) as unknown as SessionWorkflowApi['importMidiFile'];

    const session = await importStudioMidiFile({} as File, api);

    expect(session).toBeNull();
  });

  it('delegates restore, delete, and list operations', () => {
    const api = createApi();

    expect(restoreStudioCheckpoint('checkpoint-a', api)?.project.metadata.name).toBe('Restored');
    expect(deleteStudioCheckpoint('checkpoint-a', api)).toEqual([{ id: 'checkpoint-a' }]);
    expect(listStudioCheckpoints(api)).toEqual([{ id: 'checkpoint-a' }]);
  });
});
