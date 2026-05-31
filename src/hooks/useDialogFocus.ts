import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// When a dialog or panel opens, move keyboard focus into it, and when it
// closes, hand focus back to whatever was focused before (usually the control
// that opened it). Without this, opening a panel leaves focus stranded on the
// trigger behind it, so keyboard and screen-reader users are not taken into
// the thing they just opened. This does not trap focus, so it is safe for both
// modal overlays and the docked settings panel.
export const useDialogFocus = (open: boolean, dialogRef: RefObject<HTMLElement | null>) => {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Defer a frame so the panel has rendered and animated in before we move
    // focus to its first control.
    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable ?? dialog).focus();
    }, 30);

    return () => {
      window.clearTimeout(timer);
      const previous = restoreRef.current;
      if (previous && document.contains(previous) && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open, dialogRef]);
};
