'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Shows floating bubble particles around the cursor while a route is loading.
 *
 * Why: Next.js App Router offers no native visual feedback between a Link
 * click and the new page being ready. The RouteProgress bar is at the top of
 * the viewport and easy to miss — people look at their cursor. Bubbling at
 * the cursor makes loading legible in peripheral vision.
 *
 * How: intercept internal-link clicks (same heuristic as RouteProgress) to
 * enter "loading" state, exit ~250ms after the pathname commit. While loading
 * we track mousemove and emit a new bubble particle every ~80ms; each bubble
 * floats up and fades out over 900ms via CSS animation.
 */
type Bubble = {
  id: number;
  x: number;
  y: number;
  size: number;
  drift: number;
};

export function LoadingCursorBubbles() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastEmit = useRef(0);
  const firstRender = useRef(true);
  const idRef = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Track mouse position always — cheap and avoids a cold-start gap when the
  // first bubble needs to emit.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Start loading on internal-link click. Same filter as RouteProgress so the
  // two stay in sync.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target && anchor.target !== '_self') return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      // Seed mouse from the click event itself — move listener may not have
      // fired yet on first interaction.
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      setLoading(true);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // End loading shortly after the pathname commit.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    clearTimers();
    const t = window.setTimeout(() => setLoading(false), 250);
    timers.current.push(t);
    return () => clearTimers();
  }, [pathname]);

  // Emit bubbles while loading.
  useEffect(() => {
    if (!loading) {
      // Let existing bubbles finish their animation, then drop them.
      const t = window.setTimeout(() => setBubbles([]), 1000);
      timers.current.push(t);
      return;
    }
    let raf = 0;
    function tick(now: number) {
      if (now - lastEmit.current > 80) {
        lastEmit.current = now;
        const id = ++idRef.current;
        const size = 6 + Math.random() * 10;
        const drift = (Math.random() - 0.5) * 40;
        setBubbles((prev) => [
          ...prev.slice(-20),
          { id, x: mouse.current.x, y: mouse.current.y, size, drift },
        ]);
        // Remove this bubble after its animation completes.
        const t = window.setTimeout(
          () => setBubbles((prev) => prev.filter((b) => b.id !== id)),
          950
        );
        timers.current.push(t);
      }
      raf = window.requestAnimationFrame(tick);
    }
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [loading]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
    >
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="lcb-bubble"
          style={{
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            // @ts-expect-error -- CSS custom property
            '--lcb-drift': `${b.drift}px`,
          }}
        />
      ))}
      <style jsx>{`
        .lcb-bubble {
          position: absolute;
          display: block;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 30% 30%,
            rgba(236, 200, 255, 0.95),
            rgba(168, 85, 247, 0.55) 55%,
            rgba(168, 85, 247, 0) 72%
          );
          box-shadow:
            0 0 12px rgba(168, 85, 247, 0.55),
            inset 0 0 4px rgba(255, 255, 255, 0.5);
          transform: translate(-50%, -50%);
          animation: lcb-rise 900ms ease-out forwards;
        }
        @keyframes lcb-rise {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.4);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--lcb-drift, 0px)), calc(-50% - 60px))
              scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}
