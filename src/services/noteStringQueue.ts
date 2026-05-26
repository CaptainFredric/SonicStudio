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

let current: string | null = null;

export const getQueuedNoteStringId = (): string | null => current;

export const setQueuedNoteStringId = (id: string | null): void => {
  if (current === id) return;
  current = id;
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
