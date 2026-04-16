'use client';

/**
 * Top-of-page progress bar that shows during Next.js App Router navigation.
 *
 * Why: Next.js App Router gives no built-in visual feedback between a Link
 * click and the new page being ready, so a heavy route (e.g. /repo/[name])
 * feels broken for ~300-800ms. This component bridges that gap.
 *
 * How: listens to pathname changes. On click, a fast-moving bar fills to 30%
 * instantly, creeps to 80% while the new page streams, then snaps to 100%
 * and fades on the next paint after the route change is committed.
 *
 * No dependency on nprogress or similar — keeps the bundle lean.
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const firstRender = useRef(true);

  // Clear any pending timers — useful on rapid nav.
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Intercept clicks on internal <a> / Link elements so we can start the bar
  // BEFORE Next.js begins its transition. We don't prevent default — we just
  // piggyback on the click event.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Let modified clicks (ctrl/meta/shift), middle clicks, and default-
      // prevented clicks pass through untouched.
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      // External or new-tab — ignore
      if (anchor.target && anchor.target !== '_self') return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }

      start();
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const start = () => {
    clearTimers();
    setVisible(true);
    setProgress(15);
    // Creep toward 80% so slow pages still feel alive.
    const schedule = [
      [120, 35],
      [260, 55],
      [520, 70],
      [900, 80],
    ] as const;
    schedule.forEach(([delay, pct]) => {
      timers.current.push(
        window.setTimeout(() => setProgress((p) => (p < pct ? pct : p)), delay)
      );
    });
  };

  // When the pathname actually changes, the new page is rendering — snap to 100.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    clearTimers();
    setProgress(100);
    const t1 = window.setTimeout(() => setVisible(false), 220);
    const t2 = window.setTimeout(() => setProgress(0), 400);
    timers.current.push(t1, t2);
    return () => clearTimers();
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] h-0.5 w-full"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease-out',
      }}
    >
      <div
        className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
        style={{
          width: `${progress}%`,
          transition: 'width 220ms ease-out',
        }}
      />
    </div>
  );
}
