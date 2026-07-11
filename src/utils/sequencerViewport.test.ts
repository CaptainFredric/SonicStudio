import { describe, expect, it } from 'vitest';

import { getSequencerFollowScrollLeft } from './sequencerViewport';

const viewport = {
  clientWidth: 800,
  laneHeaderWidth: 300,
  scrollLeft: 0,
  scrollWidth: 2400,
  stepCellWidth: 50,
};

describe('getSequencerFollowScrollLeft', () => {
  it('leaves the viewport alone while the playhead is comfortably visible', () => {
    expect(getSequencerFollowScrollLeft({ ...viewport, stepIndex: 4 })).toBeNull();
  });

  it('brings a playhead near the right edge back into the working area', () => {
    expect(getSequencerFollowScrollLeft({ ...viewport, stepIndex: 12 })).toBe(415);
  });

  it('can center the playhead immediately when follow is re-enabled', () => {
    expect(getSequencerFollowScrollLeft({ ...viewport, forceCenter: true, stepIndex: 4 })).toBe(15);
  });

  it('clamps follow movement to the start and end of the scrollable grid', () => {
    expect(getSequencerFollowScrollLeft({ ...viewport, forceCenter: true, stepIndex: 0 })).toBe(0);
    expect(getSequencerFollowScrollLeft({ ...viewport, stepIndex: 80 })).toBe(1600);
  });
});
