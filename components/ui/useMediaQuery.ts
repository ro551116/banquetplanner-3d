import { useCallback, useSyncExternalStore } from 'react';

/** Side panels dock from this width; below it they become bottom sheets. Keep in sync with the `lg:` breakpoint. */
export const DOCKED_PANELS_QUERY = '(min-width: 1024px)';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
