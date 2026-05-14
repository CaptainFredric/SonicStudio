import { describe, expect, it } from 'vitest';

import {
  buildSessionPlayerPatternDecks,
  buildSessionPlayerSegments,
  getSessionPlayerTrackTypes,
  SESSION_PLAYER_PROFILES,
} from './sessionPlayers';

describe('sessionPlayers', () => {
  it('builds coordinated loop layers for each profile', () => {
    const profile = SESSION_PLAYER_PROFILES[0];
    const segments = buildSessionPlayerSegments(profile.id);

    expect(segments.length).toBeGreaterThan(3);
    expect(segments.some((segment) => segment.sourceTrackType === 'kick')).toBe(true);
    expect(segments.some((segment) => segment.sourceTrackType === 'bass')).toBe(true);
  });

  it('lists unique track types used by a session player', () => {
    const trackTypes = getSessionPlayerTrackTypes('starlight-band');

    expect(trackTypes).toContain('pluck');
    expect(trackTypes).toContain('kick');
    expect(new Set(trackTypes).size).toBe(trackTypes.length);
  });

  it('returns an empty layer set for unknown profiles', () => {
    expect(buildSessionPlayerSegments('missing-player')).toEqual([]);
    expect(buildSessionPlayerPatternDecks('missing-player')).toEqual([]);
  });

  it('builds a four-pattern deck for section-aware song generation', () => {
    const decks = buildSessionPlayerPatternDecks('neon-motorik');

    expect(decks).toHaveLength(4);
    expect(decks.map((deck) => deck.patternIndex)).toEqual([0, 1, 2, 3]);
    expect(decks[0]?.role).toBe('intro');
    expect(decks[2]?.segments.some((segment) => segment.sourceTrackType === 'lead')).toBe(true);
  });
});