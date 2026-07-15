export const revealStudioEditor = (behavior: ScrollBehavior = 'smooth') => {
  if (typeof window === 'undefined') return;

  window.requestAnimationFrame(() => {
    const workbench = document.querySelector('.studio-workbench');
    if (workbench instanceof HTMLElement) {
      const overflowY = window.getComputedStyle(workbench).overflowY;
      const scrollsInternally = (overflowY === 'auto' || overflowY === 'scroll')
        && workbench.scrollHeight > workbench.clientHeight + 1;
      if (scrollsInternally) {
        workbench.scrollTo({ behavior, top: 0 });
      } else {
        // Phones use the document as the scroll container. Reveal the workbench
        // itself so closing a deep inspector never leaves an empty former-panel
        // position on screen.
        workbench.scrollIntoView({ behavior, block: 'start' });
      }
    }
  });
};

export const resolveInitialTimelineCollapsed = (
  storedPreference: string | null,
  compactViewport: boolean,
): boolean => {
  if (storedPreference === 'true' || storedPreference === 'collapsed') return true;
  if (storedPreference === 'expanded') return false;
  return compactViewport;
};

export const revealStudioPanel = (
  selector: string,
  behavior: ScrollBehavior = 'smooth',
  block: ScrollLogicalPosition = 'nearest',
) => {
  if (typeof window === 'undefined') return;

  window.requestAnimationFrame(() => {
    const panel = document.querySelector(selector);
    if (panel instanceof HTMLElement) {
      panel.scrollIntoView({ behavior, block });
    }
  });
};
