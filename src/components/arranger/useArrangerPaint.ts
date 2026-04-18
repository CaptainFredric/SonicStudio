import { useEffect, useState } from 'react';

import type { PaintMode, PaintState } from './types';

interface UseArrangerPaintOptions {
  selectedClipId: string | null;
  setClipPatternStepSlice: (clipId: string, stepIndex: number, sliceIndex: number | null) => void;
  setSelectedPhraseNoteIndex: (value: number | null) => void;
  setSelectedPhraseStepIndex: (value: number) => void;
  toggleClipPatternStep: (clipId: string, stepIndex: number, note?: string, mode?: 'add' | 'remove' | 'toggle') => void;
}

export const useArrangerPaint = ({
  selectedClipId,
  setClipPatternStepSlice,
  setSelectedPhraseNoteIndex,
  setSelectedPhraseStepIndex,
  toggleClipPatternStep,
}: UseArrangerPaintOptions) => {
  const [paintState, setPaintState] = useState<PaintState | null>(null);

  useEffect(() => {
    if (!paintState) {
      return undefined;
    }

    const clearPaint = () => setPaintState(null);
    window.addEventListener('pointerup', clearPaint, { once: true });

    return () => {
      window.removeEventListener('pointerup', clearPaint);
    };
  }, [paintState]);

  const beginPaint = (note: string, stepIndex: number, isActive: boolean) => {
    if (!selectedClipId) {
      return;
    }

    const mode: PaintMode = isActive ? 'remove' : 'add';
    setSelectedPhraseStepIndex(stepIndex);
    setSelectedPhraseNoteIndex(0);
    setPaintState({ mode, note });
    toggleClipPatternStep(selectedClipId, stepIndex, note, mode);
  };

  const continuePaint = (note: string, stepIndex: number) => {
    if (!paintState || !selectedClipId || paintState.note !== note) {
      return;
    }

    setSelectedPhraseStepIndex(stepIndex);
    toggleClipPatternStep(selectedClipId, stepIndex, note, paintState.mode);
  };

  const beginSlicePaint = (stepIndex: number, sliceIndex: number | null, isActive: boolean) => {
    if (!selectedClipId || sliceIndex === null) {
      return;
    }

    const mode: PaintMode = isActive ? 'remove' : 'add';
    setSelectedPhraseStepIndex(stepIndex);
    setSelectedPhraseNoteIndex(0);
    setPaintState({ mode, sliceIndex });
    setClipPatternStepSlice(selectedClipId, stepIndex, mode === 'remove' ? null : sliceIndex);
  };

  const continueSlicePaint = (stepIndex: number) => {
    if (!paintState || !selectedClipId || typeof paintState.sliceIndex !== 'number') {
      return;
    }

    setSelectedPhraseStepIndex(stepIndex);
    setClipPatternStepSlice(
      selectedClipId,
      stepIndex,
      paintState.mode === 'remove' ? null : paintState.sliceIndex,
    );
  };

  return {
    beginPaint,
    beginSlicePaint,
    continuePaint,
    continueSlicePaint,
    paintState,
  };
};
