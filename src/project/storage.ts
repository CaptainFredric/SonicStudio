import {
  createProjectFromTemplate,
  type SessionTemplateId,
  normalizeProject,
  type AppView,
  type Project,
  type StudioSession,
  type StudioUIState,
} from './schema';
import { readJson, removeKey, writeJson, type StorageFailureReason } from '../utils/safeStorage';

const STORAGE_KEY = 'sonicstudio:session:v1';
const CHECKPOINT_STORAGE_KEY = 'sonicstudio:checkpoints:v1';
const MAX_CHECKPOINTS = 8;

interface PersistedSessionEnvelope {
  savedAt: string;
  session: StudioSession;
  version: 1;
}

export interface PersistedCheckpoint {
  id: string;
  label: string;
  projectName: string;
  savedAt: string;
  session: StudioSession;
  version: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const normalizeUiState = (value: unknown, project: Project): StudioUIState => {
  const candidate = isRecord(value) ? value : {};
  const activeView = candidate.activeView === 'MIXER'
    || candidate.activeView === 'SEQUENCER'
    ? candidate.activeView
    : 'SEQUENCER';
  const selectedTrackId = typeof candidate.selectedTrackId === 'string'
    ? candidate.selectedTrackId
    : project.tracks[0]?.id ?? null;
  const pinnedTrackIds = Array.isArray(candidate.pinnedTrackIds)
    ? candidate.pinnedTrackIds.filter((trackId): trackId is string => (
      typeof trackId === 'string' && project.tracks.some((track) => track.id === trackId)
    ))
    : [];
  const loopRangeStartBeat = typeof candidate.loopRangeStartBeat === 'number'
    ? Math.max(0, Math.round(candidate.loopRangeStartBeat))
    : null;
  const loopRangeEndBeat = typeof candidate.loopRangeEndBeat === 'number'
    ? Math.max(1, Math.round(candidate.loopRangeEndBeat))
    : null;
  const selectedArrangerClipId = typeof candidate.selectedArrangerClipId === 'string'
    && project.arrangerClips.some((clip) => clip.id === candidate.selectedArrangerClipId)
    ? candidate.selectedArrangerClipId
    : project.arrangerClips[0]?.id ?? null;

  return {
    activeView: activeView as AppView,
    isSettingsOpen: false,
    loopRangeEndBeat: loopRangeStartBeat !== null && loopRangeEndBeat !== null && loopRangeEndBeat > loopRangeStartBeat
      ? loopRangeEndBeat
      : null,
    loopRangeStartBeat: loopRangeStartBeat !== null && loopRangeEndBeat !== null && loopRangeEndBeat > loopRangeStartBeat
      ? loopRangeStartBeat
      : null,
    pinnedTrackIds,
    selectedArrangerClipId,
    selectedTrackId: project.tracks.some((track) => track.id === selectedTrackId)
      ? selectedTrackId
      : project.tracks[0]?.id ?? null,
  };
};

const legacySessionToProject = (value: Record<string, unknown>): Project | null => {
  if (!Array.isArray(value.tracks)) {
    return null;
  }

  return normalizeProject({
    metadata: {
      name: typeof value.projectName === 'string' ? value.projectName : 'Recovered Session',
    },
    transport: {
      bpm: value.bpm,
      currentPattern: value.currentPattern,
    },
    tracks: value.tracks,
  });
};

export const hydrateSessionPayload = (value: unknown): StudioSession | null => {
  if (!isRecord(value)) {
    return null;
  }

  const project = 'project' in value
    ? normalizeProject(value.project)
    : legacySessionToProject(value);

  if (!project) {
    return null;
  }

  return {
    project,
    ui: normalizeUiState('ui' in value ? value.ui : value, project),
  };
};

const WORKSPACE_TO_VIEW: Record<string, AppView> = {
  arranger: 'SEQUENCER',
  'piano-roll': 'SEQUENCER',
  mixer: 'MIXER',
  sequencer: 'SEQUENCER',
};

export const readDefaultWorkspaceView = (): AppView => {
  // Every new session opens in the Sequencer — the step grid is the most
  // direct surface to start sketching on. A returning user's saved
  // defaultWorkspace preference still wins.
  return readJson<AppView>('sonicstudio:preferences:v1', 'SEQUENCER', (parsed) => {
    const workspace = isRecord(parsed) ? (parsed as { defaultWorkspace?: unknown }).defaultWorkspace : undefined;
    return typeof workspace === 'string' && WORKSPACE_TO_VIEW[workspace]
      ? WORKSPACE_TO_VIEW[workspace]
      : 'SEQUENCER';
  });
};

export const createDefaultSession = (
  templateId: SessionTemplateId = 'night-transit',
): StudioSession => {
  const project = createProjectFromTemplate(templateId);

  return {
    project,
    ui: {
      activeView: readDefaultWorkspaceView(),
      isSettingsOpen: false,
      loopRangeEndBeat: null,
      loopRangeStartBeat: null,
      pinnedTrackIds: [],
      selectedArrangerClipId: project.arrangerClips[0]?.id ?? null,
      selectedTrackId: project.tracks.at(-1)?.id ?? null,
    },
  };
};

export const createSessionFromTemplate = (
  templateId: SessionTemplateId,
): StudioSession => createDefaultSession(templateId);

export const loadPersistedSession = (): StudioSession | null => (
  readJson<StudioSession | null>(STORAGE_KEY, null, (parsed) => {
    if (isRecord(parsed) && 'session' in parsed) {
      return hydrateSessionPayload(parsed.session);
    }
    return hydrateSessionPayload(parsed);
  })
);

export const hasPersistedSession = (): boolean => loadPersistedSession() !== null;

export interface SessionSaveResult {
  envelope: PersistedSessionEnvelope | null;
  reason?: StorageFailureReason;
}

export const persistSessionWithResult = (session: StudioSession): SessionSaveResult => {
  if (typeof window === 'undefined') {
    return { envelope: null, reason: 'unavailable' };
  }

  const envelope: PersistedSessionEnvelope = {
    savedAt: new Date().toISOString(),
    session,
    version: 1,
  };

  let result = writeJson(STORAGE_KEY, envelope);

  // If the store is full, sacrifice the oldest recovery checkpoints (the most
  // disposable and largest data we keep) one at a time and retry, so the live
  // autosave is never lost just because old recovery points filled the quota.
  // The loop terminates: each prune that reports progress strictly reduces the
  // stored checkpoints, and pruning stops once none remain.
  while (!result.ok && result.reason === 'quota' && pruneOldestCheckpoint()) {
    result = writeJson(STORAGE_KEY, envelope);
  }

  if (!result.ok) {
    if (typeof console !== 'undefined') {
      console.error(`SonicStudio: failed to persist session (${result.reason})`);
    }
    return { envelope: null, reason: result.reason };
  }
  return { envelope };
};

export const persistSession = (session: StudioSession): PersistedSessionEnvelope | null => (
  persistSessionWithResult(session).envelope
);

const normalizeCheckpoint = (value: unknown): PersistedCheckpoint | null => {
  if (!isRecord(value)) {
    return null;
  }

  const session = hydrateSessionPayload(value.session);
  if (!session) {
    return null;
  }

  return {
    id: typeof value.id === 'string' && value.id ? value.id : `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim().slice(0, 40) : 'Recovery point',
    projectName: typeof value.projectName === 'string' && value.projectName.trim()
      ? value.projectName.trim().slice(0, 40)
      : session.project.metadata.name,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
    session,
    version: 1,
  };
};

export const listProjectCheckpoints = (): PersistedCheckpoint[] => (
  readJson<PersistedCheckpoint[]>(CHECKPOINT_STORAGE_KEY, [], (parsed) => {
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeCheckpoint(entry))
      .filter((entry): entry is PersistedCheckpoint => entry !== null)
      .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())
      .slice(0, MAX_CHECKPOINTS);
  })
);

// Drop the single oldest checkpoint to free space, returning whether storage
// actually shrank. Used by persistSession's quota-recovery loop; returns false
// once there is nothing left to prune (or the trim write itself failed), which
// guarantees the loop ends.
const pruneOldestCheckpoint = (): boolean => {
  const checkpoints = listProjectCheckpoints();
  if (checkpoints.length === 0) {
    return false;
  }
  // listProjectCheckpoints returns newest-first, so the last entry is oldest.
  const trimmed = checkpoints.slice(0, -1);
  if (trimmed.length === 0) {
    removeKey(CHECKPOINT_STORAGE_KEY);
    return true;
  }
  return writeJson(CHECKPOINT_STORAGE_KEY, trimmed).ok;
};

export const saveProjectCheckpoint = (session: StudioSession, label: string): PersistedCheckpoint | null => {
  const nextEntry: PersistedCheckpoint = {
    id: `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim().slice(0, 40) || 'Recovery point',
    projectName: session.project.metadata.name,
    savedAt: new Date().toISOString(),
    session,
    version: 1,
  };
  const nextEntries = [nextEntry, ...listProjectCheckpoints()].slice(0, MAX_CHECKPOINTS);
  return writeJson(CHECKPOINT_STORAGE_KEY, nextEntries).ok ? nextEntry : null;
};

export const restoreProjectCheckpoint = (checkpointId: string): StudioSession | null => {
  const checkpoint = listProjectCheckpoints().find((entry) => entry.id === checkpointId);
  return checkpoint?.session ?? null;
};

export const deleteProjectCheckpoint = (checkpointId: string): PersistedCheckpoint[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const nextEntries = listProjectCheckpoints().filter((entry) => entry.id !== checkpointId);
  writeJson(CHECKPOINT_STORAGE_KEY, nextEntries);
  return nextEntries;
};

export const clearPersistedSession = (): void => {
  removeKey(STORAGE_KEY);
};
