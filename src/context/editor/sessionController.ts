import type { Dispatch, SetStateAction } from 'react';

import { createDefaultSession, createSessionFromTemplate, type PersistedCheckpoint } from '../../project/storage';
import { type Project, type SessionTemplateId, type StudioSession, type StudioUIState } from '../../project/schema';
import {
  deleteStudioCheckpoint,
  importStudioMidiFile,
  importStudioSessionFile,
  restoreStudioCheckpoint,
  saveStudioCheckpoint,
} from '../../services/sessionWorkflow';
import type { SaveStatus } from '../../services/workflowTypes';

const normalizeSessionFileName = (projectName: string) => (
  projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sonicstudio-session'
);

interface CreateSessionControllerOptions {
  currentProject: Project;
  currentUi: StudioUIState;
  dispatchHydrateSession: (session: StudioSession) => void;
  persistCurrentSession: () => void;
  resetTransportState: () => void;
  setLastSavedAt: Dispatch<SetStateAction<string | null>>;
  setProjectCheckpoints: Dispatch<SetStateAction<PersistedCheckpoint[]>>;
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
}

const applyHydratedSession = (
  session: StudioSession,
  {
    dispatchHydrateSession,
    resetTransportState,
    setLastSavedAt,
    setSaveStatus,
  }: Pick<CreateSessionControllerOptions, 'dispatchHydrateSession' | 'resetTransportState' | 'setLastSavedAt' | 'setSaveStatus'>,
) => {
  resetTransportState();
  setLastSavedAt(null);
  setSaveStatus('idle');
  dispatchHydrateSession(session);
};

export const exportSessionToFile = (project: Project, ui: StudioUIState) => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = JSON.stringify({ project, ui }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `${normalizeSessionFileName(project.metadata.name)}.sonicstudio.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const createSessionController = ({
  currentProject,
  currentUi,
  dispatchHydrateSession,
  persistCurrentSession,
  resetTransportState,
  setLastSavedAt,
  setProjectCheckpoints,
  setSaveStatus,
}: CreateSessionControllerOptions) => {
  const currentSession: StudioSession = {
    project: currentProject,
    ui: currentUi,
  };

  const saveProject = () => {
    setSaveStatus('saving');
    persistCurrentSession();
  };

  const saveCheckpoint = (label?: string) => {
    setProjectCheckpoints(saveStudioCheckpoint(currentSession, label));
  };

  const newSession = () => {
    applyHydratedSession(createDefaultSession('blank-grid'), {
      dispatchHydrateSession,
      resetTransportState,
      setLastSavedAt,
      setSaveStatus,
    });
  };

  const loadSessionTemplate = (templateId: SessionTemplateId) => {
    applyHydratedSession(createSessionFromTemplate(templateId), {
      dispatchHydrateSession,
      resetTransportState,
      setLastSavedAt,
      setSaveStatus,
    });
  };

  const exportSession = () => {
    exportSessionToFile(currentProject, currentUi);
  };

  const importSession = async (file: File) => {
    saveCheckpoint('Before JSON import');
    const session = await importStudioSessionFile(file);
    if (!session) {
      setSaveStatus('error');
      return false;
    }

    applyHydratedSession(session, {
      dispatchHydrateSession,
      resetTransportState,
      setLastSavedAt,
      setSaveStatus,
    });
    return true;
  };

  const importMidiSession = async (file: File) => {
    saveCheckpoint('Before MIDI import');
    const session = await importStudioMidiFile(file);
    if (!session) {
      setSaveStatus('error');
      return false;
    }

    applyHydratedSession(session, {
      dispatchHydrateSession,
      resetTransportState,
      setLastSavedAt,
      setSaveStatus,
    });
    return true;
  };

  const restoreCheckpoint = (checkpointId: string) => {
    const session = restoreStudioCheckpoint(checkpointId);
    if (!session) {
      return false;
    }

    applyHydratedSession(session, {
      dispatchHydrateSession,
      resetTransportState,
      setLastSavedAt,
      setSaveStatus,
    });
    return true;
  };

  const deleteCheckpoint = (checkpointId: string) => {
    setProjectCheckpoints(deleteStudioCheckpoint(checkpointId));
  };

  return {
    deleteCheckpoint,
    exportSession,
    importMidiSession,
    importSession,
    loadSessionTemplate,
    newSession,
    restoreCheckpoint,
    saveCheckpoint,
    saveProject,
  };
};
