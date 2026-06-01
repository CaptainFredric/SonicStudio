import { afterEach, describe, expect, it, vi } from 'vitest';

import { isStorageAvailable, readJson, readString, removeKey, writeJson } from './safeStorage';

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const stubStorage = (storage: unknown) => {
  vi.stubGlobal('window', { localStorage: storage } as unknown as Window & typeof globalThis);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeStorage reads', () => {
  it('returns null / fallback under SSR (no window)', () => {
    expect(readString('k')).toBeNull();
    expect(readJson<string>('k', 'fallback')).toBe('fallback');
  });

  it('round-trips a parsed JSON value', () => {
    const storage = new FakeStorage();
    storage.setItem('k', JSON.stringify({ a: 1 }));
    stubStorage(storage);
    expect(readJson<{ a: number } | null>('k', null)).toEqual({ a: 1 });
  });

  it('returns the fallback for a missing key', () => {
    stubStorage(new FakeStorage());
    expect(readJson<string>('missing', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for malformed JSON instead of throwing', () => {
    const storage = new FakeStorage();
    storage.setItem('k', '{ not valid json');
    stubStorage(storage);
    expect(readJson<string>('k', 'fallback')).toBe('fallback');
  });

  it('runs the normalize step and falls back if it throws', () => {
    const storage = new FakeStorage();
    storage.setItem('good', JSON.stringify({ n: 5 }));
    storage.setItem('bad', JSON.stringify({ n: 5 }));
    stubStorage(storage);
    expect(readJson<number>('good', 0, (parsed) => (parsed as { n: number }).n * 2)).toBe(10);
    expect(readJson<number>('bad', -1, () => {
      throw new Error('rejected');
    })).toBe(-1);
  });
});

describe('safeStorage writes', () => {
  it('writes successfully and round-trips through readJson', () => {
    stubStorage(new FakeStorage());
    expect(writeJson('k', { a: 1 })).toEqual({ ok: true });
    expect(readJson<{ a: number } | null>('k', null)).toEqual({ a: 1 });
  });

  it('reports unavailable under SSR', () => {
    expect(writeJson('k', 1)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports quota when setItem throws a quota error', () => {
    const storage = new FakeStorage();
    storage.setItem = () => {
      throw new DOMException('storage is full', 'QuotaExceededError');
    };
    stubStorage(storage);
    expect(writeJson('k', 1)).toEqual({ ok: false, reason: 'quota' });
  });

  it('reports serialize for a circular structure', () => {
    stubStorage(new FakeStorage());
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson('k', circular)).toEqual({ ok: false, reason: 'serialize' });
  });

  it('reports a generic error for an unknown setItem failure', () => {
    const storage = new FakeStorage();
    storage.setItem = () => {
      throw new Error('unexpected');
    };
    stubStorage(storage);
    expect(writeJson('k', 1)).toEqual({ ok: false, reason: 'error' });
  });
});

describe('safeStorage misc', () => {
  it('isStorageAvailable reflects whether storage accepts writes', () => {
    expect(isStorageAvailable()).toBe(false);
    stubStorage(new FakeStorage());
    expect(isStorageAvailable()).toBe(true);
  });

  it('removeKey deletes a key and is a safe no-op under SSR', () => {
    const storage = new FakeStorage();
    storage.setItem('k', '1');
    stubStorage(storage);
    removeKey('k');
    expect(readString('k')).toBeNull();

    vi.unstubAllGlobals();
    expect(() => removeKey('k')).not.toThrow();
  });
});
