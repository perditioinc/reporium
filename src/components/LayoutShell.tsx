'use client';

import { StickyAskBar } from './StickyAskBar';
import { StickyNavBar } from './StickyNavBar';
import { RouteProgress } from './RouteProgress';
import { GlobalKeyboardScroll } from './GlobalKeyboardScroll';
import { LoadingCursorBubbles } from './LoadingCursorBubbles';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteProgress />
      <LoadingCursorBubbles />
      <GlobalKeyboardScroll />
      <StickyNavBar />
      <div className="pb-14">{children}</div>
      <StickyAskBar />
    </>
  );
}
