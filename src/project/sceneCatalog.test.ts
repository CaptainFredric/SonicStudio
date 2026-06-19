import { describe, expect, it } from 'vitest';

import { SESSION_TEMPLATE_DEFINITIONS } from './schema';
import { FEATURED_IDS, FEATURED_POOL, START_OPTIONS } from '../components/launchpadScenes';
import { TEMPLATE_ALIASES } from '../app/routeController';

// A scene is wired through several hand-maintained lists in separate files: the
// definition registry, the Launchpad catalog, the featured rotation, and the
// route aliases. A mismatch fails silently — a scene with no card never appears
// in the library (this is how Late Hours hid), a stale featured id or alias
// points at nothing. These checks keep the lists in sync with the definitions.

const definitionIds = new Set(SESSION_TEMPLATE_DEFINITIONS.map((definition) => definition.id));
const cardIds = new Set(START_OPTIONS.map((option) => option.id));

describe('scene catalog consistency', () => {
  it('gives every registered scene a Launchpad card', () => {
    for (const id of definitionIds) {
      expect(cardIds.has(id), `${id} has no Launchpad card, so it never shows in the library`).toBe(true);
    }
  });

  it('only shows cards for scenes that actually exist', () => {
    for (const option of START_OPTIONS) {
      expect(definitionIds.has(option.id), `card ${option.id} has no template definition`).toBe(true);
    }
    // Cards carry their own copy; keep it filled in.
    for (const option of START_OPTIONS) {
      expect(option.label.trim().length, `${option.id} label`).toBeGreaterThan(0);
      expect(option.body.trim().length, `${option.id} body`).toBeGreaterThan(0);
      expect(option.genre.trim().length, `${option.id} genre`).toBeGreaterThan(0);
      expect(option.bpm, `${option.id} bpm`).toBeGreaterThan(0);
    }
  });

  it('features only real, browsable scenes', () => {
    for (const id of FEATURED_IDS) {
      expect(definitionIds.has(id), `featured id ${id} has no definition`).toBe(true);
      expect(cardIds.has(id), `featured id ${id} has no card`).toBe(true);
    }
    for (const entry of FEATURED_POOL) {
      expect(definitionIds.has(entry.id), `featured pool id ${entry.id} has no definition`).toBe(true);
      expect(cardIds.has(entry.id), `featured pool id ${entry.id} has no card`).toBe(true);
      expect(entry.weight, `${entry.id} weight`).toBeGreaterThan(0);
    }
  });

  it('routes every alias to a real scene, and aliases every scene', () => {
    const aliasTargets = Object.values(TEMPLATE_ALIASES);
    for (const target of aliasTargets) {
      expect(definitionIds.has(target), `alias target ${target} has no definition`).toBe(true);
    }
    const aliased = new Set(aliasTargets);
    for (const id of definitionIds) {
      expect(aliased.has(id), `${id} has no route alias, so ?template=${id} can't reach it`).toBe(true);
    }
  });
});
