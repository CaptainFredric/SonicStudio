import { useEffect, useState } from 'react';

const getMatch = (query: string) => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);

export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => getMatch(query));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);
    handleChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
};