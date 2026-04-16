'use client';

import { StickyAskBar } from './StickyAskBar';
import { StickyNavBar } from './StickyNavBar';
import { RouteProgress } from './RouteProgress';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteProgress />
      <StickyNavBar />
      <div className="pb-14">{children}</div>
      <StickyAskBar />
    </>
  );
}
