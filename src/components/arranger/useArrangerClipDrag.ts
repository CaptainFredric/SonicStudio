import { useEffect, useRef, useState } from 'react';
import type React from 'react';

import type { ArrangementClip } from '../../project/schema';
import { getClipUpdatesFromDragState, getDragPreview } from './interactionUtils';
import type { DragMode, DragState, SnapSize } from './types';

interface UseArrangerClipDragOptions {
  arrangerClips: ArrangementClip[];
  minClipLength: number;
  onSelectClip: (clipId: string) => void;
  pixelsPerStep: number;
  snapSize: SnapSize;
  updateArrangerClip: (clipId: string, updates: Partial<ArrangementClip>) => void;
}

export const useArrangerClipDrag = ({
  arrangerClips,
  minClipLength,
  onSelectClip,
  pixelsPerStep,
  snapSize,
  updateArrangerClip,
}: UseArrangerClipDragOptions) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const arrangerClipsRef = useRef(arrangerClips);
  const minClipLengthRef = useRef(minClipLength);
  const pixelsPerStepRef = useRef(pixelsPerStep);
  const snapSizeRef = useRef(snapSize);
  const updateArrangerClipRef = useRef(updateArrangerClip);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    arrangerClipsRef.current = arrangerClips;
  }, [arrangerClips]);

  useEffect(() => {
    minClipLengthRef.current = minClipLength;
  }, [minClipLength]);

  useEffect(() => {
    pixelsPerStepRef.current = pixelsPerStep;
  }, [pixelsPerStep]);

  useEffect(() => {
    snapSizeRef.current = snapSize;
  }, [snapSize]);

  useEffect(() => {
    updateArrangerClipRef.current = updateArrangerClip;
  }, [updateArrangerClip]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    // Keep one set of global listeners active for the lifetime of a drag.
    const clearDragState = () => {
      dragStateRef.current = null;
      setDragState(null);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const currentDragState = dragStateRef.current;
      if (!currentDragState) {
        return;
      }

      const preview = getDragPreview(
        currentDragState,
        event.clientX,
        pixelsPerStepRef.current,
        snapSizeRef.current,
        minClipLengthRef.current,
      );

      setDragState((current) => current ? {
        ...current,
        previewBeatLength: preview.beatLength,
        previewStartBeat: preview.startBeat,
      } : current);
    };

    const commitDragState = () => {
      const currentDragState = dragStateRef.current;
      if (!currentDragState) {
        clearDragState();
        return;
      }

      const clip = arrangerClipsRef.current.find((candidate) => candidate.id === currentDragState.clipId);
      if (clip) {
        const updates = getClipUpdatesFromDragState(currentDragState);
        if (Object.keys(updates).length > 0) {
          updateArrangerClipRef.current(clip.id, updates);
        }
      }

      clearDragState();
    };

    const handlePointerUp = () => {
      commitDragState();
    };

    const handlePointerCancel = () => {
      clearDragState();
    };

    const handleWindowBlur = () => {
      clearDragState();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      clearDragState();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState?.clipId, dragState?.mode, dragState?.originX, dragState?.sourceBeatLength, dragState?.sourceStartBeat]);

  const beginClipDrag = (
    clip: ArrangementClip,
    event: React.PointerEvent<HTMLDivElement>,
    mode: DragMode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectClip(clip.id);
    setDragState({
      clipId: clip.id,
      mode,
      originX: event.clientX,
      previewBeatLength: clip.beatLength,
      previewStartBeat: clip.startBeat,
      sourceBeatLength: clip.beatLength,
      sourceStartBeat: clip.startBeat,
    });
  };

  return {
    beginClipDrag,
    dragState,
  };
};
