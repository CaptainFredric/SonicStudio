import { afterEach, describe, expect, it, vi } from 'vitest';

import { type StudioSession } from './schema';
import {
  createSessionFromTemplate,
  hydrateSessionPayload,
  listProjectCheckpoints,
  persistSession,
  saveProjectCheckpoint,
} from './storage';

describe('storage hydration', () => {
  it('round-trips a serialized session payload', () => {
    const session = createSessionFromTemplate('night-transit');
    const serialized = JSON.parse(JSON.stringify(session)) as StudioSession;

    const hydrated = hydrateSessionPayload(serialized);

    expect(hydrated?.project.metadata.name).toBe(session.project.metadata.name);
    expect(hydrated?.project.arrangerClips).toHaveLength(session.project.arrangerClips.length);
    expect(hydrated?.ui.activeView).toBe(session.ui.activeView);
  });

  it('normalizes invalid UI selections during hydration', () => {
    const session = createSessionFromTemplate('night-transit');

    const hydrated = hydrateSessionPayload({
      project: session.project,
      ui: {
        activeView: 'ARRANGER',
        isSettingsOpen: true,
        pinnedTrackIds: ['missing-track', session.project.tracks[0]?.id],
        selectedArrangerClipId: 'missing-clip',
        selectedTrackId: 'missing-track',
      },
    });

    expect(hydrated?.ui.isSettingsOpen).toBe(false);
    expect(hydrated?.ui.selectedTrackId).toBe(session.project.tracks[0]?.id ?? null);
    expect(hydrated?.ui.selectedArrangerClipId).toBe(session.project.arrangerClips[0]?.id ?? null);
    expect(hydrated?.ui.pinnedTrackIds).toEqual(
      session.project.tracks[0]?.id ? [session.project.tracks[0].id] : [],
    );
  });
});

// Simulates a localStorage that rejects the session write with a quota error
// while too many checkpoints are stored, then accepts it once enough have been
// pruned. Lets us verify persistSession's quota-recovery loop end to end.
class QuotaStorage {
  private store = new Map<string, string>();
  constructor(private readonly quotaWhileCheckpointsAtLeast: number) {}
  private checkpointCount(): number {
    try {
      const raw = this.store.get('sonicstudio:checkpoints:v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    if (key === 'sonicstudio:session:v1' && this.checkpointCount() >= this.quotaWhileCheckpointsAtLeast) {
      throw new DOMException('storage is full', 'QuotaExceededError');
    }
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('persistSession quota recovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prunes old checkpoints and still saves the session when storage is full', () => {
    vi.stubGlobal('window', { localStorage: new QuotaStorage(2) } as unknown as Window & typeof globalThis);
    const session = createSessionFromTemplate('night-transit');

    saveProjectCheckpoint(session, 'a');
    saveProjectCheckpoint(session, 'b');
    saveProjectCheckpoint(session, 'c');
    expect(listProjectCheckpoints()).toHaveLength(3);

    const saved = persistSession(session);

    // The session was preserved by sacrificing old recovery checkpoints.
    expect(saved).not.toBeNull();
    expect(listProjectCheckpoints().length).toBeLessThan(2);
  });

  it('gives up gracefully (returns null) when the store is unavailable', () => {
    vi.stubGlobal('window', {} as unknown as Window & typeof globalThis);
    expect(persistSession(createSessionFromTemplate('night-transit'))).toBeNull();
  });
});
