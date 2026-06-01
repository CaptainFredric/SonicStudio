// Measures how much room SonicStudio's saved data is taking, for the "Studio
// data" panel in Settings. localStorage has a small (~5 MB) per-origin budget,
// so showing the breakdown lets a user see what is large and clear it before a
// save starts failing.

interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
}

export interface StorageUsage {
  totalBytes: number;
  categories: Array<{ label: string; bytes: number }>;
}

const KEY_PREFIX = 'sonicstudio:';
const OTHER_LABEL = 'Other settings';

// Maps a storage key to a human label. First match wins; anything unmatched
// falls into "Other settings" so the total always accounts for every key.
const CATEGORY_MATCHERS: Array<{ test: (key: string) => boolean; label: string }> = [
  { test: (key) => key === 'sonicstudio:session:v1', label: 'Current session' },
  { test: (key) => key === 'sonicstudio:checkpoints:v1', label: 'Recovery checkpoints' },
  { test: (key) => key === 'sonicstudio:scoresheets:v1', label: 'Scoresheets' },
  { test: (key) => key === 'sonicstudio:recorded-notes:v1', label: 'Recorded notes' },
  { test: (key) => key.startsWith('sonicstudio:note-string'), label: 'Captured strings' },
  { test: (key) => key === 'sonicstudio:pattern-segments:v1', label: 'Pattern segments' },
  { test: (key) => key.startsWith('sonicstudio:compose'), label: 'Layout presets' },
  { test: (key) => key === 'sonicstudio:preferences:v1', label: 'Preferences' },
];

const labelForKey = (key: string): string => (
  CATEGORY_MATCHERS.find((matcher) => matcher.test(key))?.label ?? OTHER_LABEL
);

const getDefaultStorage = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

// localStorage stores UTF-16 code units, so a rough byte cost is
// (key.length + value.length) * 2. Exact enough to guide the user.
export const measureLocalStorageUsage = (storage: StorageLike | null = getDefaultStorage()): StorageUsage => {
  if (!storage) {
    return { totalBytes: 0, categories: [] };
  }

  const bytesByLabel = new Map<string, number>();
  let totalBytes = 0;

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.startsWith(KEY_PREFIX)) {
        continue;
      }
      const value = storage.getItem(key) ?? '';
      const bytes = (key.length + value.length) * 2;
      totalBytes += bytes;
      const label = labelForKey(key);
      bytesByLabel.set(label, (bytesByLabel.get(label) ?? 0) + bytes);
    }
  } catch {
    return { totalBytes: 0, categories: [] };
  }

  const categories = Array.from(bytesByLabel.entries())
    .map(([label, bytes]) => ({ label, bytes }))
    .sort((left, right) => right.bytes - left.bytes);

  return { totalBytes, categories };
};

// Origin-wide estimate (covers IndexedDB and the service worker cache too, not
// just localStorage). Best-effort; returns null where the API is unavailable.
export const estimateOriginStorage = async (): Promise<{ usageBytes: number; quotaBytes: number } | null> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return null;
    }
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) {
      return null;
    }
    return { usageBytes: usage, quotaBytes: quota };
  } catch {
    return null;
  }
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
