import { describe, expect, it } from 'vitest';

import { DEFAULT_STUDIO_PREFERENCES, normalizeStudioPreferences } from './preferences';

describe('studio preferences', () => {
  it('falls back to defaults for invalid payloads', () => {
    expect(normalizeStudioPreferences(null)).toEqual(DEFAULT_STUDIO_PREFERENCES);
    expect(normalizeStudioPreferences({ motionMode: 'unknown', uiSoundsEnabled: 'yes' })).toEqual(DEFAULT_STUDIO_PREFERENCES);
  });

  it('preserves supported motion and sound preferences', () => {
    expect(normalizeStudioPreferences({ motionMode: 'focus', uiSoundsEnabled: false })).toEqual({
      motionMode: 'focus',
      uiSoundsEnabled: false,
    });
  });
});
