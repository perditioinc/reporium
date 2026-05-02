'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// ---------------------------------------------------------------------------
// KAN-248 — StickyAskBar boot wrapper
//
// StickyAskBar pulls framer-motion + react-markdown + remark-gfm +
// rehype-sanitize into the root-layout chunk on every page. Most first-paint
// users never interact with it. This wrapper renders a visually-identical
// 56 px placeholder for the collapsed state and defers the real module until
// the page has gone idle OR the user signals intent (pointerdown / `/` /
// Cmd+K / Ctrl+K, or ?tour= in the URL).
//
// Once boot fires, `next/dynamic` swaps the placeholder for the real bar. The
// placeholder's markup mirrors the collapsed-bar classes so the swap does not
// shift layout.
// ---------------------------------------------------------------------------

const StickyAskBarDynamic = dynamic(
  () => import('./StickyAskBar').then((m) => ({ default: m.StickyAskBar })),
  { ssr: false, loading: StickyAskBarPlaceholder },
);

function StickyAskBarPlaceholder() {
  return (
    <div
      data-tour="ask"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-2 px-3 py-2 h-14 bg-zinc-950/95 md:bg-zinc-950/80 md:backdrop-blur-md border-t border-zinc-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-hidden="true"
      role="presentation"
    >
      <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-800/60" />
      <div className="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-800/60 py-1.5 px-3 text-base sm:text-sm text-zinc-500 truncate select-none">
        Ask anything about the repo library…
      </div>
    </div>
  );
}

type IdleHandle =
  | { kind: 'idle'; id: number }
  | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

function scheduleIdleBoot(boot: () => void): IdleHandle {
  if (typeof window === 'undefined') {
    return { kind: 'timeout', id: setTimeout(boot, 0) };
  }
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(boot, { timeout: 2500 });
    return { kind: 'idle', id };
  }
  const id = setTimeout(boot, 1500);
  return { kind: 'timeout', id };
}

function cancelIdleBoot(handle: IdleHandle) {
  if (handle.kind === 'timeout') {
    clearTimeout(handle.id);
    return;
  }
  const w = window as Window & { cancelIdleCallback?: (id: number) => void };
  w.cancelIdleCallback?.(handle.id);
}

function urlWantsTour(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('tour');
  } catch {
    return false;
  }
}

export function StickyAskBarBoot() {
  const [shouldBoot, setShouldBoot] = useState(false);

  useEffect(() => {
    if (shouldBoot) return;

    // Tour deep-link needs the real bar mounted so the tour can target it
    // and inject suggested questions.
    if (urlWantsTour()) {
      setShouldBoot(true);
      return;
    }

    let booted = false;
    const boot = () => {
      if (booted) return;
      booted = true;
      setShouldBoot(true);
    };

    const idleHandle = scheduleIdleBoot(boot);

    const onPointer = () => boot();
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '/' ||
        (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))
      ) {
        boot();
      }
    };

    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('keydown', onKey);

    return () => {
      cancelIdleBoot(idleHandle);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [shouldBoot]);

  if (!shouldBoot) return <StickyAskBarPlaceholder />;
  return <StickyAskBarDynamic />;
}
