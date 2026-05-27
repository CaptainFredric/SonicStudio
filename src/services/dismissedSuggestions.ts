// Lightweight memory for suggestion cards the user has dismissed.
//
// The smart-suggestions service is stateless — it recomputes every
// render from the current session. To keep a dismissed tip from
// popping right back, we keep the set of dismissed ids in localStorage
// and let the panel filter against it. A "Reset dismissed" action
// brings them all back.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sonicstudio:dismissed-suggestions:v1';
const EVENT = 'sonicstudio:dismissed-suggestions:change';

const readPersisted = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
};

const writePersisted = (ids: Set<string>): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* storage may be unavailable; ignore */
  }
};

let current: Set<string> = readPersisted();

export const getDismissedSuggestionIds = (): Set<string> => new Set(current);

const emit = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT));
};

export const dismissSuggestion = (id: string): void => {
  if (!id) return;
  if (current.has(id)) return;
  current = new Set(current);
  current.add(id);
  writePersisted(current);
  emit();
};

export const resetDismissedSuggestions = (): void => {
  if (current.size === 0) return;
  current = new Set();
  writePersisted(current);
  emit();
};

/**
 * React hook for the dismissed-id set. Returns the current snapshot
 * plus a stable updater.
 */
export const useDismissedSuggestionIds = (): readonly [Set<string>, (id: string) => void, () => void] => {
  const [ids, setIds] = useState<Set<string>>(() => getDismissedSuggestionIds());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setIds(getDismissedSuggestionIds());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return [ids, dismissSuggestion, resetDismissedSuggestions] as const;
};
