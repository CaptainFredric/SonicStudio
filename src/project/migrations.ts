// Schema migration runner.
//
// A persisted project carries metadata.version (PROJECT_SCHEMA_VERSION at save
// time). normalizeProject is forgiving about *added* fields, since it fills
// defaults for anything missing, so the additive history up to v12 has needed
// no migrations. A *structural* change, though, such as renaming a field,
// splitting one into two, or changing units, cannot be expressed as a default;
// it needs an explicit transform that runs on the raw payload before normalize.
//
// Register such a transform here keyed by the version it upgrades FROM. The
// runner applies them in order up to the current schema version, then
// normalizeProject runs as the final safety net. The registry is empty today,
// but this makes the next breaking change safe, ordered, and testable instead
// of a silent reinterpretation of old data.

export type SchemaMigration = (data: Record<string, unknown>) => Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

// from-version -> transform. A migration keyed by N upgrades a payload stored
// at version N to the shape expected at version N + 1. Gaps are treated as
// identity, so only versions that actually changed structure need an entry.
export const PROJECT_MIGRATIONS: Record<number, SchemaMigration> = {};

// Reads metadata.version off a raw persisted project. Anything missing or
// malformed is treated as version 0 so the full migration chain runs.
export const readSchemaVersion = (data: unknown): number => {
  if (!isRecord(data)) {
    return 0;
  }
  const metadata = isRecord(data.metadata) ? data.metadata : undefined;
  const version = metadata && typeof metadata.version === 'number' ? metadata.version : undefined;
  return typeof version === 'number' && Number.isFinite(version) && version >= 0 ? version : 0;
};

// Upgrades a raw payload from its stored version to targetVersion by applying
// each registered migration in sequence. Never throws on shape: a non-record
// input is returned untouched (normalize then rejects it), and an already
// current or forward version is a no-op. Always terminates: the version
// strictly increases each step until it reaches the target.
export const runSchemaMigrations = (
  input: unknown,
  targetVersion: number,
  migrations: Record<number, SchemaMigration> = PROJECT_MIGRATIONS,
): unknown => {
  if (!isRecord(input)) {
    return input;
  }

  let data: Record<string, unknown> = input;
  let version = readSchemaVersion(data);

  while (version < targetVersion) {
    const migrate = migrations[version];
    if (migrate) {
      const next = migrate(data);
      if (isRecord(next)) {
        data = next;
      }
    }
    version += 1;
  }

  return data;
};
