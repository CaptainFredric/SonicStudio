import { useSyncExternalStore } from 'react';

import { readString, writeString } from '../utils/safeStorage';
import { revealStudioPanel } from './studioViewport';

// The note editor (Piano Roll) lives as a collapsible panel inside the
// Sequencer view rather than its own tab. This tiny store lets the deep-edit
// buttons, transcription, and the arranger inspector request it open from
// anywhere, without threading state through the component tree. The open state
// is remembered between sessions, so a returning user keeps the panel they were
// working in (newcomers still start collapsed).
const STORAGE_KEY = 'sonicstudio:notes-panel-open';

let open = readString(STORAGE_KEY) === 'true';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const persist = () => {
  void writeString(STORAGE_KEY, open ? 'true' : 'false');
};

export const openNotesPanel = () => {
  if (!open) {
    open = true;
    persist();
    emit();
  }
  revealStudioPanel('[data-studio-panel-body="notes"]');
};

export const setNotesPanelOpen = (value: boolean) => {
  if (open !== value) {
    open = value;
    persist();
    emit();
  }
};

export const useNotesPanelOpen = (): boolean => useSyncExternalStore(
  (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  () => open,
  () => open,
);
