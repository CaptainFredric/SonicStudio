import { describe, expect, it } from 'vitest';

import { getSequencerFollowScrollLeft, getSequencerWheelPanDelta } from './sequencerViewport';

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

describe('getSequencerWheelPanDelta', () => {
  const scrollable = {
    clientHeight: 400,
    clientWidth: 800,
    deltaX: 0,
    deltaY: 120,
    scrollHeight: 1200,
    scrollLeft: 240,
    scrollTop: 200,
    scrollWidth: 2400,
  };

  it('leaves a normal wheel available for lane scrolling', () => {
    expect(getSequencerWheelPanDelta(scrollable)).toBeNull();
  });

  it('hands a normal wheel to the timeline at a vertical boundary', () => {
    expect(getSequencerWheelPanDelta({ ...scrollable, scrollTop: 800 })).toBe(120);
    expect(getSequencerWheelPanDelta({ ...scrollable, deltaY: -120, scrollTop: 0 })).toBe(-120);
  });

  it('uses horizontal and shift-wheel gestures anywhere in the lane stack', () => {
    expect(getSequencerWheelPanDelta({ ...scrollable, deltaX: 90, deltaY: 20 })).toBe(90);
    expect(getSequencerWheelPanDelta({ ...scrollable, shiftKey: true })).toBe(120);
  });

  it('does not trap the wheel at a timeline edge', () => {
    expect(getSequencerWheelPanDelta({ ...scrollable, deltaY: -120, scrollLeft: 0, scrollTop: 0 })).toBeNull();
    expect(getSequencerWheelPanDelta({ ...scrollable, scrollLeft: 1600, scrollTop: 800 })).toBeNull();
  });

  it('pans a wide grid when there are not enough lanes to scroll', () => {
    expect(getSequencerWheelPanDelta({ ...scrollable, scrollHeight: 400 })).toBe(120);
  });
});
