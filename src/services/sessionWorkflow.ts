import {
  deleteProjectCheckpoint,
  hydrateSessionPayload,
  listProjectCheckpoints,
  persistSession,
  restoreProjectCheckpoint,
  saveProjectCheckpoint,
  type PersistedCheckpoint,
} from '../project/storage';
import type { StudioSession } from '../project/schema';
import { importMidiFile } from '../utils/export';

export interface SessionWorkflowApi {
  deleteProjectCheckpoint: typeof deleteProjectCheckpoint;
  hydrateSessionPayload: typeof hydrateSessionPayload;
  importMidiFile: typeof importMidiFile;
  listProjectCheckpoints: typeof listProjectCheckpoints;
  persistSession: typeof persistSession;
  restoreProjectCheckpoint: typeof restoreProjectCheckpoint;
  saveProjectCheckpoint: typeof saveProjectCheckpoint;
}

const defaultApi: SessionWorkflowApi = {
  deleteProjectCheckpoint,
  hydrateSessionPayload,
  importMidiFile,
  listProjectCheckpoints,
  persistSession,
  restoreProjectCheckpoint,
  saveProjectCheckpoint,
};

const buildCheckpointLabel = (session: StudioSession, label?: string) => (
  label?.trim() || `${session.project.metadata.name} checkpoint`
);

export const persistStudioSession = (
  session: StudioSession,
  api: SessionWorkflowApi = defaultApi,
) => api.persistSession(session);

export const listStudioCheckpoints = (
  api: SessionWorkflowApi = defaultApi,
): PersistedCheckpoint[] => api.listProjectCheckpoints();

export const saveStudioCheckpoint = (
  session: StudioSession,
  label?: string,
  api: SessionWorkflowApi = defaultApi,
): PersistedCheckpoint[] => {
  api.saveProjectCheckpoint(session, buildCheckpointLabel(session, label));
  return api.listProjectCheckpoints();
};

export const restoreStudioCheckpoint = (
  checkpointId: string,
  api: SessionWorkflowApi = defaultApi,
): StudioSession | null => api.restoreProjectCheckpoint(checkpointId);

export const deleteStudioCheckpoint = (
  checkpointId: string,
  api: SessionWorkflowApi = defaultApi,
): PersistedCheckpoint[] => api.deleteProjectCheckpoint(checkpointId);

export const importStudioSessionFile = async (
  file: Pick<File, 'text'>,
  api: SessionWorkflowApi = defaultApi,
): Promise<StudioSession | null> => {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    return api.hydrateSessionPayload(parsed);
  } catch {
    return null;
  }
};

export const importStudioMidiFile = async (
  file: File,
  api: SessionWorkflowApi = defaultApi,
): Promise<StudioSession | null> => {
  try {
    return await api.importMidiFile(file);
  } catch {
    return null;
  }
};
