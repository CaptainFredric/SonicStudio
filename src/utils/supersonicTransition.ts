let clearTimer: number | null = null;

const transitionDuration = (transition: 'in' | 'out') => (transition === 'in' ? 420 : 360);

const clearTransitionState = (transition: 'in' | 'out') => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  if (root.dataset.supersonicTransition === transition) {
    delete root.dataset.supersonicTransition;
  }
};

export const getSupersonicTransitionOrigin = (element: HTMLElement | null) => {
  if (!element) {
    return {
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    };
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + (rect.width / 2),
    y: rect.top + (rect.height / 2),
  };
};

export const runSupersonicTransition = (
  enabled: boolean,
  origin: { x: number; y: number },
) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (
    document.documentElement.dataset.motionMode === 'still'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const root = document.documentElement;
  const transition = enabled ? 'in' : 'out';
  const farthestX = Math.max(origin.x, window.innerWidth - origin.x);
  const farthestY = Math.max(origin.y, window.innerHeight - origin.y);
  const diameter = Math.hypot(farthestX, farthestY) * 2.1;

  root.style.setProperty('--supersonic-origin-x', `${origin.x}px`);
  root.style.setProperty('--supersonic-origin-y', `${origin.y}px`);
  root.style.setProperty('--supersonic-wave-size', `${diameter}px`);
  delete root.dataset.supersonicTransition;
  void root.offsetWidth;
  root.dataset.supersonicTransition = transition;

  if (clearTimer !== null) {
    window.clearTimeout(clearTimer);
  }

  clearTimer = window.setTimeout(() => {
    clearTransitionState(transition);
    clearTimer = null;
  }, transitionDuration(transition));
};