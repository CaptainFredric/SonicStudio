import { useSyncExternalStore } from 'react';

// The note editor (Piano Roll) lives as a collapsible panel inside the
// Sequencer view rather than its own tab. This tiny store lets the deep-edit
// buttons, transcription, and the arranger inspector request it open from
// anywhere, without threading state through the component tree.
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const openNotesPanel = () => {
  if (!open) {
    open = true;
    emit();
  }
};

export const setNotesPanelOpen = (value: boolean) => {
  if (open !== value) {
    open = value;
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
