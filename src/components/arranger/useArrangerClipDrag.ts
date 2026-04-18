import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const preview = getDragPreview(
        dragState,
        event.clientX,
        pixelsPerStep,
        snapSize,
        minClipLength,
      );

      setDragState((current) => current ? {
        ...current,
        previewBeatLength: preview.beatLength,
        previewStartBeat: preview.startBeat,
      } : current);
    };

    const handlePointerUp = () => {
      const clip = arrangerClips.find((candidate) => candidate.id === dragState.clipId);
      if (clip) {
        const updates = getClipUpdatesFromDragState(dragState);
        if (Object.keys(updates).length > 0) {
          updateArrangerClip(clip.id, updates);
        }
      }

      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [arrangerClips, dragState, minClipLength, pixelsPerStep, snapSize, updateArrangerClip]);

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
