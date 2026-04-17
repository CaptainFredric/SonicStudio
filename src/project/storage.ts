import {
  createProjectFromTemplate,
  type SessionTemplateId,
  normalizeProject,
  type AppView,
  type Project,
  type StudioSession,
  type StudioUIState,
} from './schema';

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
  const activeView = candidate.activeView === 'PIANO_ROLL'
    || candidate.activeView === 'MIXER'
    || candidate.activeView === 'ARRANGER'
    ? candidate.activeView
    : 'ARRANGER';
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

export const createDefaultSession = (
  templateId: SessionTemplateId = 'night-transit',
): StudioSession => {
  const project = createProjectFromTemplate(templateId);

  return {
    project,
    ui: {
      activeView: 'ARRANGER',
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

export const loadPersistedSession = (): StudioSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (isRecord(parsed) && 'session' in parsed) {
      return hydrateSessionPayload(parsed.session);
    }

    return hydrateSessionPayload(parsed);
  } catch {
    return null;
  }
};

export const hasPersistedSession = (): boolean => loadPersistedSession() !== null;

export const persistSession = (session: StudioSession): PersistedSessionEnvelope | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const envelope: PersistedSessionEnvelope = {
      savedAt: new Date().toISOString(),
      session,
      version: 1,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return envelope;
  } catch {
    return null;
  }
};

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

export const listProjectCheckpoints = (): PersistedCheckpoint[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizeCheckpoint(entry))
      .filter((entry): entry is PersistedCheckpoint => entry !== null)
      .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())
      .slice(0, MAX_CHECKPOINTS);
  } catch {
    return [];
  }
};

export const saveProjectCheckpoint = (session: StudioSession, label: string): PersistedCheckpoint | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const nextEntry: PersistedCheckpoint = {
      id: `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim().slice(0, 40) || 'Recovery point',
      projectName: session.project.metadata.name,
      savedAt: new Date().toISOString(),
      session,
      version: 1,
    };
    const nextEntries = [nextEntry, ...listProjectCheckpoints()].slice(0, MAX_CHECKPOINTS);
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(nextEntries));
    return nextEntry;
  } catch {
    return null;
  }
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
  try {
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(nextEntries));
  } catch {
    return nextEntries;
  }

  return nextEntries;
};

export const clearPersistedSession = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};
