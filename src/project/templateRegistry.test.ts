import { describe, expect, it } from 'vitest';

import { SESSION_TEMPLATE_DEFINITIONS, createProjectFromTemplate } from './schema';

// Every starter scene is hand-authored, and createStepEvent passes note strings
// through unchecked, so a typo or a mis-wired clip ships silently. This walks the
// whole registry and asserts the structural invariants the app relies on, so a
// new scene (or an edit to an existing one) can't regress the library unnoticed.

// The codebase writes pitches as letter + optional sharp + octave, e.g. C1, A#3.
const NOTE_PATTERN = /^[A-G]#?-?\d+$/;

describe('session template registry', () => {
  it('has unique ids and filled-in copy', () => {
    const ids = SESSION_TEMPLATE_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const definition of SESSION_TEMPLATE_DEFINITIONS) {
      expect(definition.label.trim().length).toBeGreaterThan(0);
      expect(definition.description.trim().length).toBeGreaterThan(0);
      expect(definition.focus.trim().length).toBeGreaterThan(0);
    }
  });

  describe.each(SESSION_TEMPLATE_DEFINITIONS.map((definition) => [definition.id, definition.label] as const))(
    'template %s (%s)',
    (id, label) => {
      const project = createProjectFromTemplate(id);

      it('builds the registered scene, not a fall-through default', () => {
        // Each builder defaults its name to the definition label; an id with no
        // factory case would fall through to Night Transit and mismatch here.
        expect(project.metadata.name).toBe(label);
      });

      it('has tracks and a sane transport', () => {
        expect(project.tracks.length).toBeGreaterThan(0);
        expect(project.transport.bpm).toBeGreaterThan(0);
        expect(project.transport.stepsPerPattern).toBeGreaterThan(0);
        expect(project.transport.patternCount).toBeGreaterThan(0);
      });

      it('gives every track a pattern bank and well-formed note events', () => {
        for (const track of project.tracks) {
          expect(track.id.length).toBeGreaterThan(0);
          expect(Object.keys(track.patterns).length).toBeGreaterThan(0);
          for (const steps of Object.values(track.patterns)) {
            for (const step of steps) {
              for (const event of step) {
                expect(event.note).toMatch(NOTE_PATTERN);
                expect(event.gate).toBeGreaterThan(0);
                expect(event.velocity).toBeGreaterThanOrEqual(0);
                expect(event.velocity).toBeLessThanOrEqual(1);
              }
            }
          }
        }
      });

      it('only arranges real tracks and patterns that exist', () => {
        const trackById = new Map(project.tracks.map((track) => [track.id, track]));
        for (const clip of project.arrangerClips) {
          const track = trackById.get(clip.trackId);
          expect(track, `clip references missing track ${clip.trackId}`).toBeDefined();
          expect(clip.beatLength).toBeGreaterThan(0);
          expect(clip.startBeat).toBeGreaterThanOrEqual(0);
          expect(track!.patterns[clip.patternIndex], `clip references missing pattern ${clip.patternIndex}`).toBeDefined();
        }
      });

      it('keeps song markers in beat order', () => {
        const beats = project.markers.map((marker) => marker.beat);
        expect(beats).toEqual([...beats].sort((left, right) => left - right));
      });
    },
  );
});
