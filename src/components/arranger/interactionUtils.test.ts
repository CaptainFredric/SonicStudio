import { describe, expect, it } from 'vitest';

import { createProjectFromTemplate } from '../../project/schema';
import type { DragState } from './types';
import {
  getClipUpdatesFromDragState,
  getDragPreview,
  getSplitBeat,
  getViewportScrollLeft,
  resolveArrangerShortcut,
  shouldHandleTimelineWheel,
} from './interactionUtils';

const createDragState = (overrides: Partial<DragState> = {}): DragState => ({
  clipId: 'clip-1',
  mode: 'move',
  originX: 100,
  previewBeatLength: 16,
  previewStartBeat: 8,
  sourceBeatLength: 16,
  sourceStartBeat: 8,
  ...overrides,
});

describe('interactionUtils', () => {
  it('keeps drag move previews on the active snap grid and non-negative', () => {
    const preview = getDragPreview(createDragState(), 60, 20, 4, 4);

    expect(preview).toEqual({
      beatLength: 16,
      startBeat: 8,
    });

    const advancedPreview = getDragPreview(createDragState(), 0, 20, 4, 4);

    expect(advancedPreview).toEqual({
      beatLength: 16,
      startBeat: 4,
    });
  });

  it('preserves minimum clip length during trim-start previews', () => {
    const preview = getDragPreview(
      createDragState({
        mode: 'trim-start',
        sourceBeatLength: 12,
        sourceStartBeat: 4,
      }),
      320,
      20,
      4,
      4,
    );

    expect(preview).toEqual({
      beatLength: 4,
      startBeat: 12,
    });
  });

  it('preserves minimum clip length during trim-end previews', () => {
    const preview = getDragPreview(
      createDragState({
        mode: 'trim-end',
        sourceBeatLength: 8,
        sourceStartBeat: 0,
      }),
      -200,
      20,
      4,
      4,
    );

    expect(preview).toEqual({
      beatLength: 4,
      startBeat: 0,
    });
  });

  it('builds clip updates only when drag state changed', () => {
    expect(getClipUpdatesFromDragState(createDragState())).toEqual({});

    expect(getClipUpdatesFromDragState(createDragState({
      previewBeatLength: 20,
      previewStartBeat: 12,
    }))).toEqual({
      beatLength: 20,
      startBeat: 12,
    });
  });

  it('uses the snapped playhead for split when it falls inside the safe range', () => {
    const project = createProjectFromTemplate('night-transit');
    const clip = project.arrangerClips[0];
    const splitBeat = getSplitBeat(clip, clip.startBeat + 8, 4, 'SONG', 4);

    expect(splitBeat).toBe(clip.startBeat + 8);
  });

  it('falls back to the clip midpoint for invalid song-mode splits', () => {
    const project = createProjectFromTemplate('night-transit');
    const clip = project.arrangerClips[0];
    const splitBeat = getSplitBeat(clip, clip.startBeat + 1, 4, 'SONG', 4);

    expect(splitBeat).toBe(clip.startBeat + 8);
  });

  it('resolves duplicate, make-unique, remove, move, transpose, and follow shortcuts', () => {
    const project = createProjectFromTemplate('night-transit');
    const clip = project.arrangerClips[0];

    expect(resolveArrangerShortcut({ ctrlKey: false, key: 'd', metaKey: false }, clip, 4)).toEqual({ type: 'duplicate' });
    expect(resolveArrangerShortcut({ ctrlKey: false, key: 'u', metaKey: false }, clip, 4)).toEqual({ type: 'make-unique' });
    expect(resolveArrangerShortcut({ ctrlKey: false, key: 'Backspace', metaKey: false }, clip, 4)).toEqual({ type: 'remove' });
    expect(resolveArrangerShortcut({ ctrlKey: false, key: 'ArrowLeft', metaKey: false }, clip, 4)).toEqual({ amount: -4, type: 'move' });
    expect(resolveArrangerShortcut({ ctrlKey: false, key: 'ArrowRight', metaKey: false }, clip, 4)).toEqual({ amount: 4, type: 'move' });
    expect(resolveArrangerShortcut({ ctrlKey: false, key: '[', metaKey: false }, clip, 4)).toEqual({ amount: -1, type: 'transpose' });
    expect(resolveArrangerShortcut({ ctrlKey: false, key: ']', metaKey: false }, clip, 4)).toEqual({ amount: 1, type: 'transpose' });
    expect(resolveArrangerShortcut({ ctrlKey: false, key: 'f', metaKey: false }, clip, 4)).toEqual({ type: 'toggle-follow' });
  });

  it('clamps viewport scrolling and filters unsupported wheel gestures', () => {
    expect(getViewportScrollLeft(0, 600, 400, 1)).toBe(288);
    expect(getViewportScrollLeft(580, 600, 400, 1)).toBe(600);
    expect(getViewportScrollLeft(20, 600, 400, -1)).toBe(0);

    expect(shouldHandleTimelineWheel(0, 120, 1200, 500)).toBe(true);
    expect(shouldHandleTimelineWheel(40, 0, 1200, 500)).toBe(false);
    expect(shouldHandleTimelineWheel(0, 120, 400, 500)).toBe(false);
  });
});
