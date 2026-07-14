export const revealStudioEditor = (behavior: ScrollBehavior = 'smooth') => {
  if (typeof window === 'undefined') return;

  window.requestAnimationFrame(() => {
    const workbench = document.querySelector('.studio-workbench');
    if (workbench instanceof HTMLElement) {
      workbench.scrollTo({ behavior, top: 0 });
    }
  });
};
