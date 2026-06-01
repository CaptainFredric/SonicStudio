import { describe, expect, it } from 'vitest';

import { readSchemaVersion, runSchemaMigrations, type SchemaMigration } from './migrations';

describe('readSchemaVersion', () => {
  it('reads metadata.version when present and valid', () => {
    expect(readSchemaVersion({ metadata: { version: 7 } })).toBe(7);
  });

  it('defaults to 0 for missing, malformed, or non-record input', () => {
    expect(readSchemaVersion({ metadata: {} })).toBe(0);
    expect(readSchemaVersion({})).toBe(0);
    expect(readSchemaVersion(null)).toBe(0);
    expect(readSchemaVersion('nope')).toBe(0);
    expect(readSchemaVersion({ metadata: { version: -3 } })).toBe(0);
    expect(readSchemaVersion({ metadata: { version: Number.NaN } })).toBe(0);
  });
});

describe('runSchemaMigrations', () => {
  it('applies migrations in order from the stored version to the target', () => {
    const migrations: Record<number, SchemaMigration> = {
      0: (data) => ({ ...data, value: `${String(data.value)}b` }),
      1: (data) => ({ ...data, value: `${String(data.value)}c` }),
    };
    const out = runSchemaMigrations({ metadata: { version: 0 }, value: 'a' }, 2, migrations) as { value: string };
    expect(out.value).toBe('abc');
  });

  it('starts from the stored version, not from zero', () => {
    const migrations: Record<number, SchemaMigration> = {
      0: (data) => ({ ...data, touched0: true }),
      1: (data) => ({ ...data, touched1: true }),
    };
    const out = runSchemaMigrations({ metadata: { version: 1 }, value: 'x' }, 2, migrations) as Record<string, unknown>;
    expect(out.touched0).toBeUndefined(); // already past version 0
    expect(out.touched1).toBe(true);
  });

  it('treats gaps with no registered migration as identity', () => {
    const migrations: Record<number, SchemaMigration> = {
      2: (data) => ({ ...data, n: 99 }),
    };
    const out = runSchemaMigrations({ metadata: { version: 1 }, n: 1 }, 4, migrations) as { n: number };
    expect(out.n).toBe(99);
  });

  it('is a no-op when already at or beyond the target version', () => {
    const migrations: Record<number, SchemaMigration> = { 5: (data) => ({ ...data, n: 99 }) };
    const current = { metadata: { version: 5 }, n: 1 };
    expect(runSchemaMigrations(current, 5, migrations)).toEqual(current);
    // A forward version (stored newer than this build understands) is left alone.
    expect(runSchemaMigrations({ metadata: { version: 9 }, n: 1 }, 5, migrations)).toEqual({ metadata: { version: 9 }, n: 1 });
  });

  it('returns non-record input untouched', () => {
    expect(runSchemaMigrations(null, 5)).toBeNull();
    expect(runSchemaMigrations('x', 5)).toBe('x');
    expect(runSchemaMigrations(42, 5)).toBe(42);
  });

  it('ignores a migration that returns a non-record (keeps prior data)', () => {
    const migrations: Record<number, SchemaMigration> = {
      0: () => (null as unknown as Record<string, unknown>),
    };
    const input = { metadata: { version: 0 }, keep: true };
    expect(runSchemaMigrations(input, 1, migrations)).toEqual(input);
  });
});
