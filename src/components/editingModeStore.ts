import { useSyncExternalStore } from 'react';

// The sequencer and the outer studio shell both need to react to the same
// distraction-free editing state. Keep it session-only: a reload should always
// return to the complete studio instead of stranding someone in a reduced UI.
let editingMode = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const setEditingMode = (value: boolean) => {
  if (editingMode === value) {
    return;
  }

  editingMode = value;
  emit();
};

export const useEditingMode = (): boolean => useSyncExternalStore(
  (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  () => editingMode,
  () => editingMode,
);
