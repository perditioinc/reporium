'use client';

import { StickyAskBar } from './StickyAskBar';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-14">{children}</div>
      <StickyAskBar />
    </>
  );
}
