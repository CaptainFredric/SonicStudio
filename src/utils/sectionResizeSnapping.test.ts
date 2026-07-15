import { describe, expect, it } from 'vitest';

import { snapSectionLength } from './sectionResizeSnapping';

describe('snapSectionLength', () => {
  it('magnetically catches quarter-bar and full-bar lengths', () => {
    expect(snapSectionLength(7.4, 16)).toBe(8);
    expect(snapSectionLength(15.1, 16)).toBe(16);
    expect(snapSectionLength(16.9, 16)).toBe(16);
  });

  it('still permits exact step lengths away from musical landmarks', () => {
    expect(snapSectionLength(5.1, 16)).toBe(5);
    expect(snapSectionLength(10.2, 16)).toBe(10);
  });

  it('allows four-step sections and hard-snaps Shift drags to bars', () => {
    expect(snapSectionLength(1.5, 16)).toBe(4);
    expect(snapSectionLength(27, 16, true)).toBe(32);
  });
});
