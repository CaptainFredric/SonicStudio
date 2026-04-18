import { describe, expect, it } from 'vitest';

import { type StudioSession } from './schema';
import { createSessionFromTemplate, hydrateSessionPayload } from './storage';

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
