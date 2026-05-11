import { describe, expect, it } from 'vitest';

import { DEFAULT_STUDIO_PREFERENCES, normalizeStudioPreferences } from './preferences';

describe('studio preferences', () => {
  it('falls back to defaults for invalid payloads', () => {
    expect(normalizeStudioPreferences(null)).toEqual(DEFAULT_STUDIO_PREFERENCES);
    expect(normalizeStudioPreferences({ motionMode: 'unknown', uiSoundsEnabled: 'yes', accentColor: 'pumpkin', density: 'wide', defaultWorkspace: 'pluto' })).toEqual(DEFAULT_STUDIO_PREFERENCES);
  });

  it('preserves supported motion, sound, accent, density, and workspace preferences', () => {
    expect(normalizeStudioPreferences({ motionMode: 'focus', uiSoundsEnabled: false, accentColor: 'violet', density: 'compact', defaultWorkspace: 'arranger' })).toEqual({
      motionMode: 'focus',
      uiSoundsEnabled: false,
      accentColor: 'violet',
      density: 'compact',
      defaultWorkspace: 'arranger',
    });
  });
});
