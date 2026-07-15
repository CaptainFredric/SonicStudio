import { describe, expect, it } from 'vitest';

import { resolveInitialTimelineCollapsed } from './studioViewport';

describe('track timeline density preference', () => {
  it('folds the overview by default on a short viewport', () => {
    expect(resolveInitialTimelineCollapsed(null, true)).toBe(true);
    expect(resolveInitialTimelineCollapsed('false', true)).toBe(true);
  });

  it('keeps an explicit user choice across viewport sizes', () => {
    expect(resolveInitialTimelineCollapsed('collapsed', false)).toBe(true);
    expect(resolveInitialTimelineCollapsed('expanded', true)).toBe(false);
  });
});
