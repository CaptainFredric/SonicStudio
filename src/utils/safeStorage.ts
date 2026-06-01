// Centralized, defensive access to window.localStorage.
//
// Every persistence module used to reimplement the same try/catch dance around
// localStorage, and a write that failed (most often because the origin is out
// of storage quota) was swallowed indistinguishably from any other error, so
// the app could silently drop the user's work. This module is the single place
// that touches localStorage: reads never throw, writes report *why* they
// failed (so callers can prune and retry, or warn), and everything is a no-op
// under server-side rendering or when storage is blocked (private windows).

export type StorageFailureReason = 'unavailable' | 'quota' | 'serialize' | 'error';

// `reason` is only set when `ok` is false. It is declared as an always-present
// optional (rather than a discriminated union) because this project's tsconfig
// does not reliably narrow boolean-literal discriminants.
export interface StorageWriteResult {
  ok: boolean;
  reason?: StorageFailureReason;
}

const hasStorage = (): boolean => {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    // Accessing window.localStorage can itself throw when cookies/storage are
    // blocked by browser policy.
    return false;
  }
};

// Quota errors surface with different names and codes across browsers. Chrome
// uses QuotaExceededError (code 22); Firefox uses NS_ERROR_DOM_QUOTA_REACHED
// (code 1014); both may arrive with an empty name on older engines.
const isQuotaError = (error: unknown): boolean => {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.code === 22
      || error.code === 1014
      || error.name === 'QuotaExceededError'
      || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  if (error instanceof Error) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return false;
};

const isSecurityError = (error: unknown): boolean => (
  (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'SecurityError')
  || (error instanceof Error && error.name === 'SecurityError')
);

const classifyWriteError = (error: unknown): StorageFailureReason => {
  if (isQuotaError(error)) {
    return 'quota';
  }
  if (isSecurityError(error)) {
    return 'unavailable';
  }
  return 'error';
};

// Probe whether storage actually accepts a write right now. Useful for an
// upfront capability check; the read/write helpers below are self-guarding and
// do not require calling this first.
export const isStorageAvailable = (): boolean => {
  if (!hasStorage()) {
    return false;
  }
  const probeKey = '__sonicstudio_probe__';
  try {
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
};

export const readString = (key: string): string | null => {
  if (!hasStorage()) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

// Read and JSON-parse a key, returning `fallback` if the key is missing, the
// JSON is malformed, or the optional `normalize` step throws or rejects it.
// `normalize` lets callers validate/shape the parsed value in the same guarded
// pass, so a corrupt payload can never crash a load path.
export const readJson = <T>(
  key: string,
  fallback: T,
  normalize?: (parsed: unknown) => T,
): T => {
  const raw = readString(key);
  if (raw === null) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalize ? normalize(parsed) : (parsed as T);
  } catch {
    return fallback;
  }
};

// Serialize and store a value. Never throws; returns a typed result so callers
// can react to quota pressure (prune old data and retry) or a blocked store.
export const writeJson = (key: string, value: unknown): StorageWriteResult => {
  if (!hasStorage()) {
    return { ok: false, reason: 'unavailable' };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, reason: 'serialize' };
  }
  try {
    window.localStorage.setItem(key, serialized);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: classifyWriteError(error) };
  }
};

export const removeKey = (key: string): void => {
  if (!hasStorage()) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Removing should never break a flow; ignore.
  }
};
