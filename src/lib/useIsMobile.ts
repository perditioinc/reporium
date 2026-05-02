'use client';

import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';

/**
 * SSR-safe mobile viewport detector. Returns `false` on the server and on the
 * first client render to match SSR output, then corrects to the actual
 * viewport state after hydration. Listens for viewport changes via
 * `matchMedia` so the value updates if the user resizes or rotates the
 * device.
 *
 * KAN-153 (extracted from src/app/graph/GraphPageClient.tsx pattern). Used
 * by HomeGraphWidget to skip mounting Three.js + the 10k-edge graph fetch
 * on mobile viewports — see KAN-121 design spec for context.
 */
export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial viewport match after SSR hydration
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return isMobile;
}
