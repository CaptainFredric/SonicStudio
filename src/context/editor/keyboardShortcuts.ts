import type { Dispatch } from 'react';

import type { Project } from '../../project/schema';
import type { EditorAction } from './editorTypes';

interface CreateKeyboardShortcutHandlerOptions {
  dispatch: Dispatch<EditorAction>;
  isSettingsOpen: boolean;
  persistCurrentSession: () => void;
  project: Project;
  setSaveStatus: (status: 'saving') => void;
  togglePlay: () => Promise<void>;
}

export const createKeyboardShortcutHandler = ({
  dispatch,
  isSettingsOpen,
  persistCurrentSession,
  project,
  setSaveStatus,
  togglePlay,
}: CreateKeyboardShortcutHandlerOptions) => async (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (target && (
    target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
    || target.isContentEditable
  )) {
    return;
  }

  const isModifierPressed = event.metaKey || event.ctrlKey;
  const normalizedKey = event.key.toLowerCase();

  if (isModifierPressed && normalizedKey === 's') {
    event.preventDefault();
    setSaveStatus('saving');
    persistCurrentSession();
    return;
  }

  if (isModifierPressed && normalizedKey === 'z' && event.shiftKey) {
    event.preventDefault();
    dispatch({ type: 'REDO' });
    return;
  }

  if (isModifierPressed && normalizedKey === 'z') {
    event.preventDefault();
    dispatch({ type: 'UNDO' });
    return;
  }

  if (isModifierPressed && normalizedKey === 'y') {
    event.preventDefault();
    dispatch({ type: 'REDO' });
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    await togglePlay();
    return;
  }

  if (!isModifierPressed && normalizedKey === 'm') {
    event.preventDefault();
    dispatch({ type: 'SET_METRONOME_ENABLED', enabled: !project.transport.metronomeEnabled });
    return;
  }

  if (!isModifierPressed && normalizedKey === 'escape' && isSettingsOpen) {
    dispatch({ type: 'TOGGLE_SETTINGS' });
    return;
  }

  if (!isModifierPressed && /^[1-8]$/.test(normalizedKey)) {
    dispatch({ type: 'SET_CURRENT_PATTERN', pattern: Number(normalizedKey) - 1 });
  }
};
