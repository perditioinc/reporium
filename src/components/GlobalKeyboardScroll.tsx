'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Site-wide keyboard scrolling (ArrowUp/ArrowDown/PageUp/PageDown/Space/Home/End).
 *
 * Why: home, wiki, graph etc. use a flex column with `h-screen overflow-hidden`
 * and an inner `.overflow-y-auto` child as the actual scroll container. That
 * inner child never receives focus, so arrow keys fire against `window` which
 * has nothing to scroll — body is clipped. Site felt broken on keyboard.
 *
 * /ai-native owns its own arrow-key handler (slide nav), so this hook opts
 * out on that route to avoid double-actioning.
 */
function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

/** Largest visible `.overflow-y-auto` container that actually overflows. */
function findScrollEl(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('.overflow-y-auto'));
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const c of candidates) {
    if (c.scrollHeight > c.clientHeight + 2) {
      const rect = c.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = c;
      }
    }
  }
  return best;
}

export function GlobalKeyboardScroll() {
  const pathname = usePathname();

  useEffect(() => {
    // /ai-native runs its own slide-nav key handler — don't double-handle.
    if (pathname?.startsWith('/ai-native')) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      // Modal / menu components own their own keyboard handling.
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"]')) return;

      const key = e.key;
      const step = window.innerHeight * 0.85;
      let dy = 0;
      let toTop = false;
      let toBottom = false;

      if (key === 'ArrowDown') dy = 80;
      else if (key === 'ArrowUp') dy = -80;
      else if (key === 'PageDown' || (key === ' ' && !e.shiftKey)) dy = step;
      else if (key === 'PageUp' || (key === ' ' && e.shiftKey)) dy = -step;
      else if (key === 'Home') toTop = true;
      else if (key === 'End') toBottom = true;
      else return;

      const el = findScrollEl();

      // Always use instant scroll for keyboard nav — users expect immediate
      // response, and some container configurations ignore smooth-scroll
      // requests silently (headless preview confirmed this behavior).
      const behavior: ScrollBehavior = 'auto';

      if (toTop) {
        if (el) el.scrollTo({ top: 0, behavior });
        else window.scrollTo({ top: 0, behavior });
      } else if (toBottom) {
        if (el) el.scrollTo({ top: el.scrollHeight, behavior });
        else window.scrollTo({ top: document.body.scrollHeight, behavior });
      } else if (el) {
        el.scrollBy({ top: dy, behavior });
      } else {
        window.scrollBy({ top: dy, behavior });
      }
      e.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname]);

  return null;
}
