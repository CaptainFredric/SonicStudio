import { describe, expect, it } from 'vitest';

import { formatBytes, measureLocalStorageUsage } from './storageUsage';

class FakeStorage {
  private entries: Array<[string, string]>;
  constructor(record: Record<string, string>) {
    this.entries = Object.entries(record);
  }
  get length(): number {
    return this.entries.length;
  }
  key(index: number): string | null {
    return this.entries[index]?.[0] ?? null;
  }
  getItem(key: string): string | null {
    return this.entries.find(([candidate]) => candidate === key)?.[1] ?? null;
  }
}

describe('formatBytes', () => {
  it('formats across units and guards zero/negative', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(-5)).toBe('0 KB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('measureLocalStorageUsage', () => {
  it('returns empty usage when storage is unavailable', () => {
    expect(measureLocalStorageUsage(null)).toEqual({ totalBytes: 0, categories: [] });
  });

  it('counts only sonicstudio keys, buckets by category, and sorts by size', () => {
    const storage = new FakeStorage({
      'sonicstudio:session:v1': 'x'.repeat(100),
      'sonicstudio:checkpoints:v1': 'y'.repeat(500),
      'sonicstudio:note-strings:v1': 'z'.repeat(50),
      'sonicstudio:preferences:v1': 'p'.repeat(10),
      'unrelated-key': 'should not count'.repeat(100),
    });

    const usage = measureLocalStorageUsage(storage);

    // Largest bucket first.
    expect(usage.categories[0].label).toBe('Recovery checkpoints');
    const labels = usage.categories.map((category) => category.label);
    expect(labels).toEqual(['Recovery checkpoints', 'Current session', 'Captured strings', 'Preferences']);
    expect(labels).not.toContain('Other settings');

    // Bytes = (key.length + value.length) * 2; total excludes the unrelated key.
    const expectedTotal = (('sonicstudio:session:v1'.length + 100)
      + ('sonicstudio:checkpoints:v1'.length + 500)
      + ('sonicstudio:note-strings:v1'.length + 50)
      + ('sonicstudio:preferences:v1'.length + 10)) * 2;
    expect(usage.totalBytes).toBe(expectedTotal);
  });

  it('files unknown sonicstudio keys under Other settings', () => {
    const storage = new FakeStorage({ 'sonicstudio:mystery:v1': 'data' });
    const usage = measureLocalStorageUsage(storage);
    expect(usage.categories).toEqual([{ label: 'Other settings', bytes: ('sonicstudio:mystery:v1'.length + 'data'.length) * 2 }]);
  });
});
