'use client';

import { StickyAskBar } from './StickyAskBar';
import { StickyNavBar } from './StickyNavBar';
import { RouteProgress } from './RouteProgress';
import { GlobalKeyboardScroll } from './GlobalKeyboardScroll';
import { LoadingCursorBubbles } from './LoadingCursorBubbles';
import { AmbientBubbles } from './AmbientBubbles';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteProgress />
      {/* Ambient underwater bubbles — site-wide, behind everything */}
      <AmbientBubbles />
      <LoadingCursorBubbles />
      <GlobalKeyboardScroll />
      <StickyNavBar />
      <div className="pb-14">{children}</div>
      <StickyAskBar />
    </>
  );
}
