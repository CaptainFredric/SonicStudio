// Manual key override.
//
// The Krumhansl-Schmuckler detector reads the user's notes and is right
// most of the time, but a user being intentionally chromatic, modal, or
// jazz-flavoured may want to pin the key themselves. This service holds
// that override in localStorage and emits a window event when it
// changes so every consumer (KeyTag, LaneKeyChip, chord starters, the
// PianoRoll palette, smart suggestions, next-chord hints) sees the
// same answer.

import { useEffect, useState } from 'react';

import { PITCH_CLASS_BY_NAME, type ScaleMode } from '../utils/pitch';

const STORAGE_KEY = 'sonicstudio:manual-key:v1';
const EVENT = 'sonicstudio:manual-key:change';

export interface ManualKeyOverride {
  rootName: string;
  mode: ScaleMode;
}

const isValid = (value: unknown): value is ManualKeyOverride => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.rootName !== 'string') return false;
  if (record.mode !== 'major' && record.mode !== 'minor') return false;
  return PITCH_CLASS_BY_NAME[record.rootName] !== undefined;
};

const readPersisted = (): ManualKeyOverride | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writePersisted = (value: ManualKeyOverride | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* storage may be unavailable; ignore */
  }
};

let current: ManualKeyOverride | null = readPersisted();

export const getManualKeyOverride = (): ManualKeyOverride | null => (current ? { ...current } : null);

const emit = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT));
};

export const setManualKeyOverride = (value: ManualKeyOverride | null): void => {
  if (value && !isValid(value)) return;
  // No-op if value unchanged.
  if ((current?.rootName ?? null) === (value?.rootName ?? null) && (current?.mode ?? null) === (value?.mode ?? null)) {
    return;
  }
  current = value ? { ...value } : null;
  writePersisted(current);
  emit();
};

export const useManualKeyOverride = (): readonly [
  ManualKeyOverride | null,
  (value: ManualKeyOverride | null) => void,
] => {
  const [override, setOverride] = useState<ManualKeyOverride | null>(() => getManualKeyOverride());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setOverride(getManualKeyOverride());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return [override, setManualKeyOverride] as const;
};
