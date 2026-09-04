import { useCallback, useSyncExternalStore } from 'react';

const getMatch = (query: string) => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);

export const useMediaQuery = (query: string) => {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mediaQuery = window.matchMedia(query);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    }

    mediaQuery.addListener(onStoreChange);
    return () => mediaQuery.removeListener(onStoreChange);
  }, [query]);

  const getSnapshot = useCallback(() => getMatch(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
