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

/**
 * Largest visible scrollable container anywhere on the page.
 *
 * The earlier implementation only scanned `.overflow-y-auto`. That missed
 * `.overflow-y-scroll`, `.overflow-auto`, inline `overflow: auto`, and any
 * Tailwind variant that didn't match the literal class string — breaking
 * arrow-key scroll on /ai-native (uses overflow-y-scroll), /graph,
 * /taxonomy, /stacks, /insights, /trends, /architecture (rely on the
 * document scroller via min-h-screen + body overflow-y: auto).
 *
 * Strategy:
 *   1. Query every plausible class + inline-overflow element
 *   2. Verify each candidate with computed style (overflow-y: auto|scroll)
 *      and actual scroll range (scrollHeight > clientHeight + 2)
 *   3. Pick the visible one with the largest on-screen area
 *   4. Fall through to the document-level scroller (scrollingElement /
 *      body / html) if nothing matched — some routes scroll the document
 *      itself and have no inner wrapper at all.
 */
function findScrollEl(): HTMLElement | null {
  const selector =
    '.overflow-y-auto, .overflow-y-scroll, .overflow-auto, .overflow-scroll, [style*="overflow"]';
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const c of candidates) {
    if (c.scrollHeight <= c.clientHeight + 2) continue;
    const cs = getComputedStyle(c);
    if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue;
    const rect = c.getBoundingClientRect();
    // Must actually be on screen and non-trivial size
    if (rect.width < 60 || rect.height < 60) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const area = rect.width * rect.height;
    if (area > bestArea) {
      bestArea = area;
      best = c;
    }
  }
  if (best) return best;

  // Fall back to the document-level scroller. Prefer `document.scrollingElement`
  // (the browser's own canonical root scroller) when it actually overflows.
  const se = document.scrollingElement as HTMLElement | null;
  if (se && se.scrollHeight > se.clientHeight + 2) return se;
  const body = document.body;
  if (body && body.scrollHeight > body.clientHeight + 2) return body;
  const html = document.documentElement;
  if (html && html.scrollHeight > html.clientHeight + 2) return html;
  return null;
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
