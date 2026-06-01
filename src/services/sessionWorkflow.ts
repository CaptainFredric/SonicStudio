import {
  deleteProjectCheckpoint,
  hydrateSessionPayload,
  listProjectCheckpoints,
  persistSession,
  restoreProjectCheckpoint,
  saveProjectCheckpoint,
  type PersistedCheckpoint,
} from '../project/storage';
import { PROJECT_SCHEMA_VERSION, type StudioSession } from '../project/schema';
import { readSchemaVersion } from '../project/migrations';
import { importMidiFile } from '../utils/export';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export interface SessionImportResult {
  ok: boolean;
  session: StudioSession | null;
  // Set only on failure: the file could not be read/parsed, or it parsed but is
  // not a SonicStudio session.
  reason?: 'unreadable' | 'unrecognized';
  // Set on success when the file came from a newer schema than this build reads.
  warning?: string;
}

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

// Validates and loads an exported session file, classifying any failure so the
// UI can explain it. A file from a newer schema still loads (normalizeProject
// is forgiving) but comes back with a warning so the user knows why something
// might be missing.
export const importStudioSessionFileDetailed = async (
  file: Pick<File, 'text'>,
  api: SessionWorkflowApi = defaultApi,
): Promise<SessionImportResult> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, session: null, reason: 'unreadable' };
  }

  const session = api.hydrateSessionPayload(parsed);
  if (!session) {
    return { ok: false, session: null, reason: 'unrecognized' };
  }

  // Read the version off the raw payload (hydrate restamps it to current).
  const projectPayload = isRecord(parsed) && isRecord(parsed.project) ? parsed.project : parsed;
  const storedVersion = readSchemaVersion(projectPayload);
  const warning = storedVersion > PROJECT_SCHEMA_VERSION
    ? `This session is from a newer SonicStudio (format v${storedVersion}; this build reads v${PROJECT_SCHEMA_VERSION}). It loaded, but anything newer may be missing.`
    : undefined;

  return { ok: true, session, warning };
};

export const importStudioSessionFile = async (
  file: Pick<File, 'text'>,
  api: SessionWorkflowApi = defaultApi,
): Promise<StudioSession | null> => {
  const result = await importStudioSessionFileDetailed(file, api);
  return result.session;
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
