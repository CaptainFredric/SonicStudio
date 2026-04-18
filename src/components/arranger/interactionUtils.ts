import type { ArrangementClip } from '../../project/schema';
import type { DragState, SnapSize } from './types';

export interface ClipFrame {
  beatLength: number;
  startBeat: number;
}

export type ArrangerShortcutAction =
  | { type: 'duplicate' }
  | { type: 'make-unique' }
  | { type: 'remove' }
  | { amount: number; type: 'move' }
  | { amount: number; type: 'transpose' }
  | { type: 'toggle-follow' };

export const snapStepDelta = (offsetPx: number, pixelsPerStep: number, snapSize: SnapSize) => (
  Math.round(offsetPx / pixelsPerStep / snapSize) * snapSize
);

export const snapStepValue = (value: number, snapSize: SnapSize) => (
  Math.round(value / snapSize) * snapSize
);

export const getRenderedClipFrame = (
  clip: ArrangementClip,
  dragState: DragState | null,
): ClipFrame => {
  if (!dragState || dragState.clipId !== clip.id) {
    return {
      beatLength: clip.beatLength,
      startBeat: clip.startBeat,
    };
  }

  return {
    beatLength: dragState.previewBeatLength,
    startBeat: dragState.previewStartBeat,
  };
};

export const getDragPreview = (
  dragState: DragState,
  clientX: number,
  pixelsPerStep: number,
  snapSize: SnapSize,
  minClipLength: number,
): ClipFrame => {
  const stepDelta = snapStepDelta(clientX - dragState.originX, pixelsPerStep, snapSize);

  if (dragState.mode === 'move') {
    return {
      beatLength: dragState.sourceBeatLength,
      startBeat: Math.max(0, dragState.sourceStartBeat + stepDelta),
    };
  }

  if (dragState.mode === 'trim-end') {
    return {
      beatLength: Math.max(minClipLength, dragState.sourceBeatLength + stepDelta),
      startBeat: dragState.sourceStartBeat,
    };
  }

  const requestedStart = Math.max(0, dragState.sourceStartBeat + stepDelta);
  const maxStartBeat = dragState.sourceStartBeat + dragState.sourceBeatLength - minClipLength;
  const nextStartBeat = Math.min(requestedStart, maxStartBeat);

  return {
    beatLength: dragState.sourceBeatLength - (nextStartBeat - dragState.sourceStartBeat),
    startBeat: nextStartBeat,
  };
};

export const getClipUpdatesFromDragState = (dragState: DragState) => {
  const updates: Partial<ArrangementClip> = {};

  if (dragState.previewStartBeat !== dragState.sourceStartBeat) {
    updates.startBeat = dragState.previewStartBeat;
  }

  if (dragState.previewBeatLength !== dragState.sourceBeatLength) {
    updates.beatLength = dragState.previewBeatLength;
  }

  return updates;
};

export const getSplitBeat = (
  clip: ArrangementClip,
  currentStep: number,
  snapSize: SnapSize,
  transportMode: 'PATTERN' | 'SONG',
  minClipLength: number,
) => {
  const clipCenter = clip.startBeat + Math.floor(clip.beatLength / 2 / snapSize) * snapSize;
  if (transportMode !== 'SONG') {
    return clipCenter;
  }

  const snappedPlayhead = snapStepValue(currentStep, snapSize);
  const minSplit = clip.startBeat + minClipLength;
  const maxSplit = clip.startBeat + clip.beatLength - minClipLength;

  if (snappedPlayhead < minSplit || snappedPlayhead > maxSplit) {
    return clipCenter;
  }

  return snappedPlayhead;
};

export const getViewportScrollLeft = (
  currentScrollLeft: number,
  maxTimelineScrollLeft: number,
  viewportWidth: number,
  direction: -1 | 1,
) => (
  Math.max(
    0,
    Math.min(
      maxTimelineScrollLeft,
      currentScrollLeft + direction * Math.max(160, viewportWidth * 0.72),
    ),
  )
);

export const shouldHandleTimelineWheel = (
  deltaX: number,
  deltaY: number,
  scrollWidth: number,
  clientWidth: number,
) => {
  if (scrollWidth <= clientWidth) {
    return false;
  }

  if (deltaX !== 0) {
    return false;
  }

  if (Math.abs(deltaY) < Math.abs(deltaX)) {
    return false;
  }

  return true;
};

export const resolveArrangerShortcut = (
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>,
  selectedClip: ArrangementClip | null,
  snapSize: SnapSize,
): ArrangerShortcutAction | null => {
  if (!selectedClip) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (key === 'd' && !event.metaKey && !event.ctrlKey) {
    return { type: 'duplicate' };
  }

  if (key === 'u' && !event.metaKey && !event.ctrlKey) {
    return { type: 'make-unique' };
  }

  if (key === 'backspace' && !event.metaKey && !event.ctrlKey) {
    return { type: 'remove' };
  }

  if (event.key === 'ArrowLeft') {
    return { amount: -snapSize, type: 'move' };
  }

  if (event.key === 'ArrowRight') {
    return { amount: snapSize, type: 'move' };
  }

  if (event.key === '[') {
    return { amount: -1, type: 'transpose' };
  }

  if (event.key === ']') {
    return { amount: 1, type: 'transpose' };
  }

  if (key === 'f' && !event.metaKey && !event.ctrlKey) {
    return { type: 'toggle-follow' };
  }

  return null;
};
