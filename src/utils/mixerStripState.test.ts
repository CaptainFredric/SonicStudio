import { describe, expect, it } from 'vitest';

import { anyTrackSoloed, isSilencedBySolo } from './mixerStripState';

describe('mixer strip state', () => {
  it('detects whether any track is soloed', () => {
    expect(anyTrackSoloed([{ solo: false }, { solo: false }])).toBe(false);
    expect(anyTrackSoloed([{ solo: false }, { solo: true }])).toBe(true);
    expect(anyTrackSoloed([])).toBe(false);
  });

  it('silences non-soloed, non-muted strips while a solo is active', () => {
    expect(isSilencedBySolo({ solo: false, muted: false }, true)).toBe(true);
  });

  it('never silences the soloed strip itself', () => {
    expect(isSilencedBySolo({ solo: true, muted: false }, true)).toBe(false);
  });

  it('leaves an already-muted strip alone so it is not double-labeled', () => {
    expect(isSilencedBySolo({ solo: false, muted: true }, true)).toBe(false);
  });

  it('silences nothing when no track is soloed', () => {
    expect(isSilencedBySolo({ solo: false, muted: false }, false)).toBe(false);
  });
});
