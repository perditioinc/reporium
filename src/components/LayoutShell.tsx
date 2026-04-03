'use client';

import { StickyAskBar } from './StickyAskBar';
import { StickyNavBar } from './StickyNavBar';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StickyNavBar />
      <div className="pb-14">{children}</div>
      <StickyAskBar />
    </>
  );
}
