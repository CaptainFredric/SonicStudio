import { lazy, type ComponentType } from 'react';

// A lazy() that survives a deploy landing mid-session.
//
// The studio ships on every push, and each deploy replaces the hashed chunk
// files. A visitor whose tab predates a deploy who then opens a lazy surface
// (Settings, the Mixer, a dialog) requests a chunk filename the server no
// longer has and that isn't in their cache either, so the dynamic import
// rejects and the surface would stay broken until a manual refresh.
//
// On the first such failure we reload once: a navigation is network-first, so
// it pulls the new index.html and its current chunk names, and the retried
// import resolves. A per-chunk sessionStorage flag makes the reload single-shot
// — if the import still fails after reloading (a genuine network or build
// problem, not a stale tab), we rethrow so the error boundary takes over
// instead of reloading forever.

const RETRY_PREFIX = 'chunk-retry:';

const readRetried = (key: string): boolean => {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    // Private mode or disabled storage: treat as "not yet retried" so a stale
    // tab still gets its one reload; it just can't be remembered across it.
    return false;
  }
};

const writeRetried = (key: string, value: boolean) => {
  try {
    if (value) {
      window.sessionStorage.setItem(key, '1');
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing to do; the worst case is one extra reload attempt.
  }
};

// The async factory React.lazy actually calls. Exported so the reload-guard can
// be unit-tested without rendering a Suspense tree.
export const createRetryingImport = <T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string,
) => async (): Promise<{ default: T }> => {
  const retryKey = `${RETRY_PREFIX}${chunkName}`;
  try {
    const module = await factory();
    writeRetried(retryKey, false);
    return module;
  } catch (error) {
    if (typeof window !== 'undefined' && !readRetried(retryKey)) {
      writeRetried(retryKey, true);
      window.location.reload();
      // Keep the Suspense fallback up while the page reloads instead of
      // resolving to a broken component.
      return new Promise<{ default: T }>(() => {});
    }
    writeRetried(retryKey, false);
    throw error;
  }
};

export const lazyWithRetry = <T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string,
) => lazy(createRetryingImport(factory, chunkName));
