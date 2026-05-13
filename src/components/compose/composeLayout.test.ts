import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRESETS,
  DEFAULT_SIDE_WIDTH,
  DEFAULT_TOP_RATIO,
  MAX_SIDE_WIDTH,
  MAX_TOP_RATIO,
  MIN_SIDE_WIDTH,
  MIN_TOP_RATIO,
  normalizeLayoutPreset,
  normalizeLayoutPresets,
} from './composeLayout';

describe('compose layout helpers', () => {
  it('clamps saved pane ratios and side widths', () => {
    expect(normalizeLayoutPreset({
      name: 'Wide editor',
      topView: 'ARRANGER',
      bottomView: 'PIANO_ROLL',
      sideOpen: true,
      sidePlacement: 'left',
      sideView: 'MIXER',
      sideWidth: 9999,
      topRatio: 4,
    })).toMatchObject({
      name: 'Wide editor',
      sidePlacement: 'left',
      sideWidth: MAX_SIDE_WIDTH,
      topRatio: MAX_TOP_RATIO,
    });

    expect(normalizeLayoutPreset({
      name: 'Tiny editor',
      topView: 'SEQUENCER',
      bottomView: 'PIANO_ROLL',
      sideOpen: false,
      sidePlacement: 'right',
      sideView: 'MIXER',
      sideWidth: 1,
      topRatio: -1,
    })).toMatchObject({
      sideWidth: MIN_SIDE_WIDTH,
      topRatio: MIN_TOP_RATIO,
    });
  });

  it('falls back when persisted preset shape is invalid', () => {
    expect(normalizeLayoutPreset({
      name: 'Broken',
      topView: 'ARRANGER',
      bottomView: 'NOPE',
      sidePlacement: 'right',
      sideView: 'MIXER',
    })).toBeNull();

    expect(normalizeLayoutPresets('bad')).toBe(DEFAULT_PRESETS);
    expect(normalizeLayoutPresets([{ bad: true }])).toBe(DEFAULT_PRESETS);
  });

  it('keeps valid presets bounded and readable', () => {
    const presets = normalizeLayoutPresets(Array.from({ length: 8 }, (_, index) => ({
      bottomView: 'PIANO_ROLL',
      name: `  User preset ${index + 1} with a very long name  `,
      sideOpen: index % 2 === 0,
      sidePlacement: 'right',
      sideView: 'MIXER',
      sideWidth: Number.NaN,
      topRatio: Number.NaN,
      topView: 'ARRANGER',
    })));

    expect(presets).toHaveLength(6);
    expect(presets[0]).toMatchObject({
      name: 'User preset 1 with a ver',
      sideWidth: DEFAULT_SIDE_WIDTH,
      topRatio: DEFAULT_TOP_RATIO,
    });
  });
});
