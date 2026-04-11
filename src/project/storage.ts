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

interface PersistedSessionEnvelope {
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
    : 'SEQUENCER';
  const selectedTrackId = typeof candidate.selectedTrackId === 'string'
    ? candidate.selectedTrackId
    : project.tracks[0]?.id ?? null;
  const selectedArrangerClipId = typeof candidate.selectedArrangerClipId === 'string'
    && project.arrangerClips.some((clip) => clip.id === candidate.selectedArrangerClipId)
    ? candidate.selectedArrangerClipId
    : project.arrangerClips[0]?.id ?? null;

  return {
    activeView: activeView as AppView,
    isSettingsOpen: Boolean(candidate.isSettingsOpen),
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
      activeView: 'SEQUENCER',
      isSettingsOpen: false,
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

export const clearPersistedSession = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};
