import { useSyncExternalStore } from 'react';

import { revealStudioPanel } from './studioViewport';

// The note editor lives as a focused workspace inside the Sequencer view.
// This tiny store lets deep-edit buttons, transcription, and the arranger
// inspector request it open from
// anywhere, without threading state through the component tree. This is
// intentionally session-only: opening a shared Song link should always reveal
// the arrangement first instead of restoring a large editor from an old visit.
let open = false;
export type NotesPanelScope = 'song' | 'clip';
let scope: NotesPanelScope = 'song';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const openNotesPanel = (requestedScope: NotesPanelScope = 'song') => {
  if (!open || scope !== requestedScope) {
    open = true;
    scope = requestedScope;
    emit();
  }
  revealStudioPanel('[data-studio-panel-body="notes"]');
};

export const setNotesPanelOpen = (value: boolean, requestedScope: NotesPanelScope = 'song') => {
  const nextScope = value ? requestedScope : 'song';
  if (open !== value || scope !== nextScope) {
    open = value;
    scope = nextScope;
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

export const useNotesPanelScope = (): NotesPanelScope => useSyncExternalStore(
  (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  () => scope,
  () => scope,
);
