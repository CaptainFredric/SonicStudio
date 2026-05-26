import type { Dispatch } from 'react';

import type { Project } from '../../project/schema';
import type { EditorAction } from './editorTypes';

interface CreateKeyboardShortcutHandlerOptions {
  dispatch: Dispatch<EditorAction>;
  isSettingsOpen: boolean;
  project: Project;
  saveProject: () => void;
  setSuperSonicMode: (enabled: boolean) => void;
  superSonicMode: boolean;
  togglePlay: () => Promise<void>;
  toggleRecording: () => Promise<void>;
}

export const createKeyboardShortcutHandler = ({
  dispatch,
  isSettingsOpen,
  project,
  saveProject,
  setSuperSonicMode,
  superSonicMode,
  togglePlay,
  toggleRecording,
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

  if (event.altKey && event.code === 'KeyS') {
    event.preventDefault();
    setSuperSonicMode(!superSonicMode);
    return;
  }

  if (event.altKey && event.code === 'KeyR') {
    event.preventDefault();
    await toggleRecording();
    return;
  }

  if (event.altKey && event.code === 'KeyC') {
    event.preventDefault();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sonicstudio:open-quick-capture'));
    }
    return;
  }

  if (event.altKey && /^Digit[1-5]$/.test(event.code)) {
    event.preventDefault();
    const views = ['SEQUENCER', 'PIANO_ROLL', 'MIXER', 'ARRANGER', 'COMPOSE'] as const;
    const nextView = views[Math.max(0, Math.min(views.length - 1, Number(event.code.slice(-1)) - 1))];
    dispatch({ type: 'SET_ACTIVE_VIEW', view: nextView });
    return;
  }

  if (isModifierPressed && normalizedKey === 's') {
    event.preventDefault();
    saveProject();
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
    dispatch({ type: 'SET_SETTINGS_OPEN', open: false });
    return;
  }

  if (!isModifierPressed && /^[1-8]$/.test(normalizedKey)) {
    dispatch({ type: 'SET_CURRENT_PATTERN', pattern: Number(normalizedKey) - 1 });
  }
};
