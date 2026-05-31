import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogFocusOptions {
  // Keep Tab cycling within the dialog. Only for true modal overlays, never
  // the docked settings panel, where the workspace beside it must stay
  // reachable by keyboard.
  trap?: boolean;
}

// When a dialog or panel opens, move keyboard focus into it, and when it
// closes, hand focus back to whatever was focused before (usually the control
// that opened it). Without this, opening a panel leaves focus stranded on the
// trigger behind it, so keyboard and screen-reader users are not taken into
// the thing they just opened. With `trap`, Tab and Shift+Tab also wrap inside
// the dialog instead of escaping to the page behind it.
export const useDialogFocus = (
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  options: DialogFocusOptions = {},
) => {
  const { trap = false } = options;
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

  useEffect(() => {
    if (!open || !trap) {
      return undefined;
    }
    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusables: HTMLElement[] = [];
      dialog.querySelectorAll(FOCUSABLE_SELECTOR).forEach((node) => {
        if (node instanceof HTMLElement && node.getClientRects().length > 0) {
          focusables.push(node);
        }
      });
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [open, trap, dialogRef]);
};
