// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRetryingImport } from './lazyWithRetry';

const reload = vi.fn();

beforeEach(() => {
  window.sessionStorage.clear();
  reload.mockClear();
  // jsdom's location.reload is a non-configurable no-op; replace it so we can
  // assert on the guarded reload without navigating.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ok = { default: () => null };

describe('createRetryingImport', () => {
  it('returns the module and leaves no retry flag on success', async () => {
    const load = createRetryingImport(() => Promise.resolve(ok), 'demo');
    await expect(load()).resolves.toBe(ok);
    expect(reload).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('chunk-retry:demo')).toBeNull();
  });

  it('reloads once on the first failure and parks the promise', async () => {
    const load = createRetryingImport(() => Promise.reject(new Error('missing chunk')), 'demo');
    let settled = false;
    void load().then(() => { settled = true; }, () => { settled = true; });
    // Let the rejected import microtask flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('chunk-retry:demo')).toBe('1');
    expect(settled).toBe(false); // parked so Suspense keeps its fallback
  });

  it('rethrows instead of reloading again once the flag is set', async () => {
    window.sessionStorage.setItem('chunk-retry:demo', '1');
    const error = new Error('still missing');
    const load = createRetryingImport(() => Promise.reject(error), 'demo');
    await expect(load()).rejects.toBe(error);
    expect(reload).not.toHaveBeenCalled();
    // Flag cleared so a later, unrelated failure still gets its own reload.
    expect(window.sessionStorage.getItem('chunk-retry:demo')).toBeNull();
  });

  it('keys the flag per chunk so one stale surface does not mask another', async () => {
    window.sessionStorage.setItem('chunk-retry:mixer', '1');
    const load = createRetryingImport(() => Promise.reject(new Error('missing')), 'settings');
    void load().then(undefined, () => {});
    await Promise.resolve();
    await Promise.resolve();
    // settings has its own key, so it still gets a first reload.
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('chunk-retry:settings')).toBe('1');
  });
});
