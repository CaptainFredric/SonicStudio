import { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { ArrangementClip } from '../../project/schema';
import { resolveArrangerShortcut } from './interactionUtils';
import type { SnapSize } from './types';

interface UseArrangerShortcutsOptions {
  duplicateArrangerClip: (clipId: string) => void;
  makeClipPatternUnique: (clipId: string) => void;
  removeArrangerClip: (clipId: string) => void;
  selectedClip: ArrangementClip | null;
  setFollowPlayhead: Dispatch<SetStateAction<boolean>>;
  snapSize: SnapSize;
  transformClipPattern: (clipId: string, transform: 'clear' | 'double-density' | 'halve-density' | 'randomize-velocity' | 'reset-automation' | 'shift-left' | 'shift-right' | 'transpose', value?: number) => void;
  updateArrangerClip: (clipId: string, updates: Partial<ArrangementClip>) => void;
}

const isEditableTarget = (target: HTMLElement | null) => (
  Boolean(target && (
    target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
    || target.isContentEditable
  ))
);

export const useArrangerShortcuts = ({
  duplicateArrangerClip,
  makeClipPatternUnique,
  removeArrangerClip,
  selectedClip,
  setFollowPlayhead,
  snapSize,
  transformClipPattern,
  updateArrangerClip,
}: UseArrangerShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (isEditableTarget(target) || !selectedClip) {
        return;
      }

      const shortcutAction = resolveArrangerShortcut(event, selectedClip, snapSize);
      if (!shortcutAction) {
        return;
      }

      event.preventDefault();

      switch (shortcutAction.type) {
        case 'duplicate':
          duplicateArrangerClip(selectedClip.id);
          return;
        case 'make-unique':
          makeClipPatternUnique(selectedClip.id);
          return;
        case 'remove':
          removeArrangerClip(selectedClip.id);
          return;
        case 'move':
          updateArrangerClip(selectedClip.id, { startBeat: Math.max(0, selectedClip.startBeat + shortcutAction.amount) });
          return;
        case 'transpose':
          transformClipPattern(selectedClip.id, 'transpose', shortcutAction.amount);
          return;
        case 'toggle-follow':
          setFollowPlayhead((current) => !current);
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    duplicateArrangerClip,
    makeClipPatternUnique,
    removeArrangerClip,
    selectedClip,
    setFollowPlayhead,
    snapSize,
    transformClipPattern,
    updateArrangerClip,
  ]);
};
