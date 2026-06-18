import { describe, expect, it } from 'vitest';

import { TRACK_VOICE_PRESET_DEFINITIONS, getTrackVoicePresetDefinitions } from './schema';
import type { InstrumentType } from './schema';
import { PRESET_RECOMMENDATIONS } from '../services/smartSuggestions';

// Mirrors the InstrumentType union. The coverage check below relies on this
// being the full set of lane types a user can create, so every one of them can
// find at least one voice in the device rack.
const ALL_INSTRUMENT_TYPES: InstrumentType[] = [
  'kick', 'snare', 'hihat', 'bass', 'lead', 'pad', 'pluck', 'fx', 'violin', 'piano', 'bell',
];

describe('voice preset registry', () => {
  it('has unique ids and filled-in copy', () => {
    const ids = TRACK_VOICE_PRESET_DEFINITIONS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of TRACK_VOICE_PRESET_DEFINITIONS) {
      expect(preset.label.trim().length).toBeGreaterThan(0);
      expect(preset.focus.trim().length).toBeGreaterThan(0);
      expect(preset.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('declares valid, de-duplicated, non-empty track types', () => {
    for (const preset of TRACK_VOICE_PRESET_DEFINITIONS) {
      expect(preset.trackTypes.length, `${preset.id} has no track types`).toBeGreaterThan(0);
      expect(new Set(preset.trackTypes).size).toBe(preset.trackTypes.length);
      for (const type of preset.trackTypes) {
        expect(ALL_INSTRUMENT_TYPES, `${preset.id} → ${type}`).toContain(type);
      }
    }
  });

  it('keeps every synth parameter finite and non-negative', () => {
    for (const preset of TRACK_VOICE_PRESET_DEFINITIONS) {
      for (const [key, value] of Object.entries(preset.params ?? {})) {
        if (typeof value !== 'number') continue;
        expect(Number.isFinite(value), `${preset.id} ${key}`).toBe(true);
        expect(value, `${preset.id} ${key}`).toBeGreaterThanOrEqual(0);
      }
      // Sustain is an envelope level, so it must stay within 0..1.
      if (typeof preset.params?.sustain === 'number') {
        expect(preset.params.sustain, `${preset.id} sustain`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('offers at least one applicable voice for every instrument type', () => {
    for (const type of ALL_INSTRUMENT_TYPES) {
      expect(
        getTrackVoicePresetDefinitions(type).length,
        `${type} has no voice presets`,
      ).toBeGreaterThan(0);
    }
  });

  it('only recommends presets that exist and fit the lane they are offered for', () => {
    for (const [trackType, recommendation] of Object.entries(PRESET_RECOMMENDATIONS)) {
      const applicable = getTrackVoicePresetDefinitions(trackType as InstrumentType);
      const match = applicable.find((preset) => preset.id === recommendation.presetId);
      expect(match, `${trackType} → ${recommendation.presetId} is missing or not applicable`).toBeDefined();
    }
  });
});
