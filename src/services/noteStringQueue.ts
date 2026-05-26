// Cross-component channel for the captured-note-string "queue".
//
// HTML5 drag and drop is unreliable on touch devices, so the shelf lets
// the user "queue" a string with a tap, then tap any sequencer cell or
// lane header to drop it. The queue state needs to be readable from
// both the shelf (in Studio Settings) and the workspace (cells, lanes),
// without dragging it through the AudioContext or the route props.
//
// This module keeps the queued id in a singleton plus a window event so
// every subscriber stays in lock-step.

import { useEffect, useState } from 'react';

const EVENT = 'sonicstudio:queue-note-string';
const STORAGE_KEY = 'sonicstudio:note-string-queue:v1';

const readPersisted = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 && raw.length < 256 ? raw : null;
  } catch {
    return null;
  }
};

const writePersisted = (id: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be full or blocked. The in-memory queue still
    // works for the current session.
  }
};

let current: string | null = readPersisted();

export const getQueuedNoteStringId = (): string | null => current;

export const setQueuedNoteStringId = (id: string | null): void => {
  if (current === id) return;
  current = id;
  writePersisted(id);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
};

export const subscribeQueuedNoteStringId = (
  listener: (id: string | null) => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener(current);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};

/**
 * React hook: returns the current queued string id and a setter.
 * Components that read the id re-render whenever it changes.
 */
export const useQueuedNoteStringId = (): readonly [string | null, (id: string | null) => void] => {
  const [id, setId] = useState<string | null>(() => getQueuedNoteStringId());
  useEffect(() => subscribeQueuedNoteStringId(setId), []);
  return [id, setQueuedNoteStringId] as const;
};
