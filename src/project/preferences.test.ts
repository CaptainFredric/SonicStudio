import { describe, expect, it } from 'vitest';

import { DEFAULT_STUDIO_PREFERENCES, normalizeStudioPreferences } from './preferences';

describe('studio preferences', () => {
  it('falls back to defaults for invalid payloads', () => {
    expect(normalizeStudioPreferences(null)).toEqual(DEFAULT_STUDIO_PREFERENCES);
    expect(normalizeStudioPreferences({ motionMode: 'unknown', uiSoundsEnabled: 'yes', accentColor: 'pumpkin', density: 'wide', defaultWorkspace: 'pluto', superSonicMode: 'loud', capture: { analysisProfile: 'instant', autoPreviewMatch: 'yes', keepShelfBetweenTakes: 'forever', liveSuggestionCount: 6 }, superSonic: { guidanceBadges: 'yes', waveIntensity: 'storm' } })).toEqual(DEFAULT_STUDIO_PREFERENCES);
  });

  it('preserves supported motion, sound, accent, density, and workspace preferences', () => {
    expect(normalizeStudioPreferences({ motionMode: 'focus', uiSoundsEnabled: false, accentColor: 'violet', density: 'compact', defaultWorkspace: 'arranger', superSonicMode: true, stickyMobileTransport: false, audioStabilityMode: 'resilient', capture: { analysisProfile: 'steady', autoPreviewMatch: true, keepShelfBetweenTakes: false, liveSuggestionCount: 2 }, superSonic: { guidanceBadges: false, waveIntensity: 'flow' } })).toEqual({
      motionMode: 'focus',
      uiSoundsEnabled: false,
      midiInputEnabled: false,
      accentColor: 'violet',
      density: 'compact',
      defaultWorkspace: 'arranger',
      superSonicMode: true,
      stickyMobileTransport: false,
      audioStabilityMode: 'resilient',
      capture: {
        analysisProfile: 'steady',
        autoPreviewMatch: true,
        keepShelfBetweenTakes: false,
        liveSuggestionCount: 2,
      },
      superSonic: {
        guidanceBadges: false,
        waveIntensity: 'flow',
      },
    });
  });
});
