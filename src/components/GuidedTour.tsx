'use client';

/**
 * GuidedTour — three-stop walkthrough of the Reporium home page.
 *
 * Activates when the URL contains `?utm_mode=guide` (the /ai-native handoff
 * CTA links here). Walks the visitor through:
 *   01 · Knowledge Graph           → [data-tour="graph"]
 *   02 · Search the repo library   → [data-tour="search"]
 *   03 · Ask the library           → [data-tour="ask"]
 *
 * Design language: cyberpunk + underwater — gradient borders, neon glow,
 * rising bubbles on the popup rim, monospace step indicator. Dismiss via
 * the × button OR clicking outside the popup (click-away on the backdrop).
 *
 * SSR-safe: renders nothing until mounted, so there's no hydration to
 * mismatch (this is entirely a post-navigation interaction).
 *
 * Zero regression footprint: the tour only runs when the URL asks for it,
 * and it never mutates any target element — just overlays a card anchored
 * to each target's bounding rect.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ─── Tour steps ──────────────────────────────────────────────────────────────

interface TourStep {
  key: string;
  n: string; // display label "01" etc.
  title: string;
  body: string;
  /** Optional list of edge-type chips for the graph step. */
  chips?: string[];
  selector: string;
  /** Extra selectors that should also trigger the step's click action.
      Used by the search step so clicks on the filter bar OR repo cards
      OR any other related element all count as "engaging with search". */
  advanceSelectors?: string[];
  /** Which axis to prefer when placing popover relative to target */
  prefer?: 'above' | 'below';
  /** What clicking inside the target does — advance to next, or finish (with
      optional suggested question sent to the ask input). */
  clickAction?: 'advance' | 'finish-ask';
}

const SUGGESTED_ASK = 'What are the most popular AI agent frameworks in this library?';

const STEPS: TourStep[] = [
  {
    key: 'graph',
    n: '01',
    title: 'Knowledge Graph',
    body: 'Every repo and its relationships — live. Five edge types connect the library:',
    chips: ['DEPENDS_ON', 'ALTERNATIVE_TO', 'COMPATIBLE_WITH', 'EXTENDS', 'SIMILAR_TO'],
    selector: '[data-tour="graph"]',
    prefer: 'above',
    clickAction: 'advance',
  },
  {
    key: 'search',
    n: '02',
    title: 'Search the library',
    body: 'Filter by category, skill, or keyword — or click any repo card. The graph and the results update together.',
    selector: '[data-tour="search"]',
    // Any click on filter bar OR a repo card advances the tour.
    advanceSelectors: ['[data-tour="search"]', '[data-tour="grid"]', '[data-tour="repo-card"]'],
    prefer: 'below',
    clickAction: 'advance',
  },
  {
    key: 'ask',
    n: '03',
    title: 'Ask the library',
    body: 'Every answer cites the exact repos it reasoned from — sources over guesses. Click Ask to run a sample question now.',
    selector: '[data-tour="ask"]',
    prefer: 'above',
    clickAction: 'finish-ask',
  },
];

// ─── Anchor / layout helpers ────────────────────────────────────────────────

type Rect = { top: number; left: number; width: number; height: number };

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Position the popup relative to the target rect with clamp-to-viewport.
 * Returns viewport coordinates + which side it landed on (for the pointer
 * direction).
 */
function placePopup(
  targetRect: Rect,
  popupSize: { w: number; h: number },
  prefer: 'above' | 'below',
): { top: number; left: number; side: 'above' | 'below'; h: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const MARGIN = 16;
  const GAP = 18;

  const spaceAbove = targetRect.top;
  const spaceBelow = vh - (targetRect.top + targetRect.height);

  const side: 'above' | 'below' =
    prefer === 'above' && spaceAbove >= popupSize.h + GAP ? 'above' :
    prefer === 'below' && spaceBelow >= popupSize.h + GAP ? 'below' :
    spaceBelow >= spaceAbove ? 'below' : 'above';

  let top =
    side === 'above'
      ? targetRect.top - popupSize.h - GAP
      : targetRect.top + targetRect.height + GAP;

  // Horizontal: center on target, clamp to viewport
  let left = targetRect.left + targetRect.width / 2 - popupSize.w / 2;
  left = Math.max(MARGIN, Math.min(vw - popupSize.w - MARGIN, left));
  top = Math.max(MARGIN, Math.min(vh - popupSize.h - MARGIN, top));

  return { top, left, side, h: popupSize.h };
}

// ─── Jellyfish mascot pointer ────────────────────────────────────────────────

/**
 * Draws a small jellyfish near the popup and a glowing, animated tether
 * curving from the jellyfish's bell toward the center of the target rect.
 * Feels like the mascot is guiding the visitor: "look here."
 */
function JellyfishPointer({
  targetRect,
  popupPos,
}: {
  targetRect: Rect;
  popupPos: { top: number; left: number; side: 'above' | 'below'; h: number };
}) {
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Big mascot — sized so even small viewports keep it fully visible next to
  // the popup. Scales with viewport; clamped for mobile legibility.
  const JELLY_W = Math.min(140, Math.max(90, Math.floor(Math.min(vw, vh) * 0.15)));
  const JELLY_BELL_H = JELLY_W * 0.55;
  const JELLY_TOTAL_H = JELLY_BELL_H + JELLY_W * 0.7;

  // ANCHOR TO THE POPUP (not the target). The popup is always viewport-clamped
  // by placePopup(), so anchoring here guarantees the jelly stays on-screen.
  // Jelly sits at the popup's bottom-right corner on wide screens, or tucked
  // above/below on narrow ones.
  const POPUP_W = Math.min(360, vw - 32);
  const POPUP_H = popupPos.h; // measured actual popup height passed from parent
  const targetCx = targetRect.left + targetRect.width / 2;
  const targetCy = targetRect.top + targetRect.height / 2;

  // Prefer the side of the popup facing the target (so the jelly sits
  // between popup and target, reading as "pointing at it").
  const popupCenterX = popupPos.left + POPUP_W / 2;
  const targetIsRightOfPopup = targetCx > popupCenterX;

  // Horizontal: park jellyfish just OUTSIDE the popup on the side facing the
  // target, with an 8px gap. If there's no room outside on that side,
  // fall back to the opposite side. Final hard clamp to viewport.
  const GAP = 10;
  let jellyX: number;
  if (targetIsRightOfPopup) {
    jellyX = popupPos.left + POPUP_W + GAP;
    if (jellyX + JELLY_W > vw - 12) {
      // No room to the right → tuck to the left of popup instead.
      jellyX = popupPos.left - JELLY_W - GAP;
    }
  } else {
    jellyX = popupPos.left - JELLY_W - GAP;
    if (jellyX < 12) {
      // No room on the left → tuck to the right.
      jellyX = popupPos.left + POPUP_W + GAP;
    }
  }
  // Final fallback: if it STILL doesn't fit (very narrow viewport), stack
  // the jelly above or below the popup instead.
  let stackedVertically = false;
  if (jellyX < 12 || jellyX + JELLY_W > vw - 12) {
    stackedVertically = true;
    jellyX = Math.max(12, Math.min(vw - JELLY_W - 12, popupCenterX - JELLY_W / 2));
  }

  // Vertical: normally vertically-center on popup; if we had to stack, place
  // jelly on the OPPOSITE side of the popup from the target so it reads as
  // "jelly → popup → target". If the preferred side doesn't fit, flip.
  let jellyY: number;
  if (stackedVertically) {
    const belowY = popupPos.top + POPUP_H + GAP;
    const aboveY = popupPos.top - JELLY_TOTAL_H - GAP;
    if (popupPos.side === 'above') {
      // Popup is above target → jelly should be ABOVE the popup (opposite side
      // from target), so the visual order is: jelly → popup → ask bar / target.
      // Fall back to below only if there truly isn't room above.
      if (aboveY >= 12) {
        jellyY = aboveY;
      } else {
        jellyY = belowY;
      }
    } else {
      // Popup is below target → jelly ABOVE popup (between popup and target
      // which is above). Fall back to below if no room above.
      if (aboveY >= 12) {
        jellyY = aboveY;
      } else {
        jellyY = belowY;
      }
    }
  } else {
    // Side-by-side: vertically center on popup midline.
    // When popup.side === 'above' (target is below popup), bias jelly upward
    // so it sits higher and the visual order reads jelly → popup → target.
    const popupMidY = popupPos.top + POPUP_H / 2;
    jellyY = popupMidY - JELLY_TOTAL_H / 2;
    if (popupPos.side === 'above') {
      // Bias jelly toward the TOP of the popup so it appears above center.
      const biasY = -POPUP_H * 0.25;
      jellyY += biasY;
    } else {
      // Gentle bias toward target so tether curves naturally
      const biasY = (targetCy - popupMidY) * 0.15;
      jellyY += biasY;
    }
  }
  // Hard viewport clamp — this is the safety net that guarantees visibility.
  jellyX = Math.max(12, Math.min(vw - JELLY_W - 12, jellyX));
  jellyY = Math.max(12, Math.min(vh - JELLY_TOTAL_H - 12, jellyY));

  const jellyCx = jellyX + JELLY_W / 2;
  const jellyBellBottomY = jellyY + JELLY_BELL_H;

  // Tentacle geometry — same pattern as AmbientBigJellyfish (12 deterministic
  // curves hanging from the bell rim).
  const tentacles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI;
    const r = JELLY_W / 2;
    const startX = r + Math.cos(angle) * r * 0.82;
    const startY = JELLY_BELL_H;
    const endX = startX + (i % 2 === 0 ? 1 : -1) * (6 + (i % 5) * 4);
    const endY = startY + JELLY_W * 0.62 + (i % 3) * 10;
    const cp1X = startX + ((i % 3) - 1) * 10;
    const cp1Y = startY + JELLY_W * 0.2;
    const cp2X = endX + ((i % 2) - 0.5) * 14;
    const cp2Y = endY - JELLY_W * 0.1;
    return { i, startX, startY, endX, endY, cp1X, cp1Y, cp2X, cp2Y };
  });

  // Tether: cubic bezier from jelly bell bottom → target center
  const dx = targetCx - jellyCx;
  const dy = targetCy - jellyBellBottomY;
  const cp1x = jellyCx + dx * 0.2;
  const cp1y = jellyBellBottomY + Math.abs(dy) * 0.35;
  const cp2x = jellyCx + dx * 0.7;
  const cp2y = targetCy - dy * 0.25;

  return (
    <>
      {/* Connector tether — drawn in a full-viewport SVG so coordinates are
          absolute screen pixels. */}
      <svg
        aria-hidden
        className="gt-tether-svg"
        width={vw}
        height={vh}
        viewBox={`0 0 ${vw} ${vh}`}
        style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="gt-tether-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(196,181,253,0.95)" />
            <stop offset="50%" stopColor="rgba(240,171,252,0.9)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.95)" />
          </linearGradient>
          <filter id="gt-tether-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base glow line */}
        <path
          d={`M ${jellyCx} ${jellyBellBottomY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetCx} ${targetCy}`}
          stroke="url(#gt-tether-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#gt-tether-glow)"
          opacity="0.85"
        />
        {/* Flow line — dashes march from jelly → target */}
        <path
          className="gt-tether-flow"
          d={`M ${jellyCx} ${jellyBellBottomY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetCx} ${targetCy}`}
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="2 10"
          fill="none"
        />
        {/* Target pulse dot */}
        <circle
          cx={targetCx}
          cy={targetCy}
          r="5"
          fill="rgba(240,171,252,1)"
          className="gt-target-pulse"
          filter="url(#gt-tether-glow)"
        />
      </svg>

      {/* Jellyfish mascot — scaled AmbientBigJellyfish from /ai-native */}
      <div
        aria-hidden
        className="gt-jelly"
        style={{ position: 'fixed', top: jellyY, left: jellyX, width: JELLY_W, height: JELLY_TOTAL_H, pointerEvents: 'none', opacity: 0.95 }}
      >
        <svg
          width={JELLY_W}
          height={JELLY_TOTAL_H}
          viewBox={`0 0 ${JELLY_W} ${JELLY_TOTAL_H}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <radialGradient id="gt-jbell" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="rgba(216,180,254,0.55)" />
              <stop offset="55%" stopColor="rgba(139,92,246,0.38)" />
              <stop offset="100%" stopColor="rgba(91,33,182,0.12)" />
            </radialGradient>
            <radialGradient id="gt-jglow" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="rgba(196,181,253,0.55)" />
              <stop offset="100%" stopColor="rgba(109,40,217,0)" />
            </radialGradient>
            <radialGradient id="gt-jhi" cx="38%" cy="28%" r="35%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {/* Outer glow halo */}
          <ellipse
            cx={JELLY_W / 2}
            cy={JELLY_BELL_H * 0.5}
            rx={(JELLY_W / 2) * 1.4}
            ry={JELLY_BELL_H * 0.9}
            fill="url(#gt-jglow)"
          />

          {/* Bell */}
          <path
            d={`M ${(JELLY_W / 2) * 0.05},${JELLY_BELL_H} Q 0,${JELLY_BELL_H * 0.3} ${JELLY_W / 2},0 Q ${JELLY_W},${JELLY_BELL_H * 0.3} ${JELLY_W * 0.95},${JELLY_BELL_H} Q ${JELLY_W / 2},${JELLY_BELL_H * 1.12} ${(JELLY_W / 2) * 0.05},${JELLY_BELL_H} Z`}
            fill="url(#gt-jbell)"
            stroke="rgba(196,181,253,0.5)"
            strokeWidth="1.25"
            className="gt-big-bell"
          />

          {/* Highlight */}
          <path
            d={`M ${(JELLY_W / 2) * 0.3},${JELLY_BELL_H * 0.7} Q ${(JELLY_W / 2) * 0.22},${JELLY_BELL_H * 0.3} ${(JELLY_W / 2) * 0.55},${JELLY_BELL_H * 0.05} Q ${(JELLY_W / 2) * 0.7},${JELLY_BELL_H * 0.25} ${(JELLY_W / 2) * 0.62},${JELLY_BELL_H * 0.72} Z`}
            fill="url(#gt-jhi)"
          />

          {/* Long curved tentacles — 12 deterministic strokes */}
          {tentacles.map((t) => (
            <path
              key={t.i}
              className="gt-big-tent"
              d={`M ${t.startX},${t.startY} C ${t.cp1X},${t.cp1Y} ${t.cp2X},${t.cp2Y} ${t.endX},${t.endY}`}
              stroke="rgba(196,181,253,0.6)"
              strokeWidth="1.15"
              fill="none"
              strokeLinecap="round"
              style={{ animationDelay: `${t.i * -0.55}s` }}
            />
          ))}
        </svg>
      </div>

      {/* Jellyfish animations — global scope so keyframe names aren't hashed
          away from the class selectors (AmbientBigJellyfish parity). */}
      <style jsx global>{`
        .gt-big-bell {
          animation: gt-big-bell-pulse 5.5s ease-in-out infinite;
          transform-origin: center;
        }
        .gt-big-tent {
          animation: gt-big-tent-sway 4s ease-in-out infinite alternate;
          transform-origin: top center;
        }
        @keyframes gt-big-bell-pulse {
          0%, 100% { transform: scale(1) translateY(0);        filter: drop-shadow(0 0 28px rgba(168,85,247,0.3)); }
          50%      { transform: scale(1.03) translateY(-6px);  filter: drop-shadow(0 0 42px rgba(168,85,247,0.5)); }
        }
        @keyframes gt-big-tent-sway {
          0%   { transform: skewX(-5deg) scaleX(0.93); }
          100% { transform: skewX(5deg)  scaleX(1.07); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-big-bell, .gt-big-tent { animation: none !important; }
        }
      `}</style>
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GuidedTour() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; side: 'above' | 'below'; h: number } | null>(null);

  const popupRef = useRef<HTMLDivElement>(null);

  // Mount gate — this is a post-hydration, client-only UI.
  useEffect(() => setMounted(true), []);

  // Activate when ?utm_mode=guide is present on the home route. Reads the URL
  // directly (avoids Next's useSearchParams Suspense requirement) and listens
  // for popstate/navigation so SPA-style transitions still trigger.
  useEffect(() => {
    if (!mounted) return;

    const tryOpen = () => {
      if (window.location.pathname !== '/') return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('utm_mode') !== 'guide') return;
      setStepIdx(0);
      setOpen(true);
    };

    tryOpen();

    // Also open on custom event (from the nav "?" button when already on /).
    const onOpenGuide = () => {
      setStepIdx(0);
      setTargetRect(null);
      setPopupPos(null);
      setOpen(true);
    };

    window.addEventListener('popstate', tryOpen);
    window.addEventListener('reporium:open-guide', onOpenGuide);
    return () => {
      window.removeEventListener('popstate', tryOpen);
      window.removeEventListener('reporium:open-guide', onOpenGuide);
    };
  }, [mounted]);

  const currentStep = STEPS[stepIdx];

  // Find the target element and scroll it into view. Retry briefly — some
  // landmarks (HomeGraphWidget is dynamic-imported) may still be mounting.
  useEffect(() => {
    if (!open || !currentStep) return;
    let cancelled = false;
    let attempts = 0;

    function tick() {
      if (cancelled) return;
      const el = document.querySelector(currentStep.selector);
      if (!el) {
        if (attempts++ < 30) {
          window.setTimeout(tick, 150);
        }
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Give the smooth-scroll a moment before measuring.
      window.setTimeout(() => {
        if (cancelled) return;
        setTargetRect(readRect(el));
      }, 350);
    }

    tick();
    return () => { cancelled = true; };
  }, [open, currentStep, stepIdx]);

  // Recalculate position on scroll / resize while open.
  useEffect(() => {
    if (!open) return;
    const recalc = () => {
      const el = document.querySelector(currentStep.selector);
      if (el) setTargetRect(readRect(el));
    };
    window.addEventListener('scroll', recalc, { passive: true, capture: true });
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true as unknown as EventListenerOptions);
      window.removeEventListener('resize', recalc);
    };
  }, [open, currentStep]);

  // Place popup after the DOM paints so we can measure its actual size.
  // Runs whenever the target rect changes OR the current step changes.
  useLayoutEffect(() => {
    if (!open || !targetRect) return;
    // Ensure the popup node has been rendered into the DOM.
    const node = popupRef.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    // Use fallback if the element hasn't laid out yet (0x0).
    const w = r.width || 360;
    const h = r.height || 180;
    const pos = placePopup(targetRect, { w, h }, currentStep.prefer ?? 'below');
    setPopupPos(pos);
  }, [open, targetRect, currentStep, stepIdx]);

  // Second-pass: after browser paint, re-measure popup's actual rendered
  // height and update popupPos.h. Uses rAF to ensure the browser has fully
  // reflowed text/chips before measuring (catches taller-than-estimated steps).
  useEffect(() => {
    if (!open || !targetRect || !popupPos) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const node = popupRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const h = r.height;
      if (h > 0 && h !== popupPos.h) {
        setPopupPos((prev) => prev ? { ...prev, h } : prev);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, popupPos?.top, popupPos?.left, stepIdx]);

  // Escape key dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') rewind();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIdx]);

  // Strip utm param from URL when the tour closes so refreshes don't reopen
  // the tour and the URL stays clean for sharing. (No sessionStorage block —
  // if someone lands with ?utm_mode=guide they explicitly asked for it.)
  const clearUtm = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('utm_mode');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch { /* noop */ }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setTargetRect(null);
    setPopupPos(null);
    clearUtm();
  }, [clearUtm]);

  const advance = useCallback(() => {
    setStepIdx((i) => {
      if (i >= STEPS.length - 1) {
        // Finished — close.
        window.setTimeout(() => close(), 0);
        return i;
      }
      setTargetRect(null);
      setPopupPos(null);
      return i + 1;
    });
  }, [close]);

  const rewind = useCallback(() => {
    setStepIdx((i) => {
      if (i <= 0) return i;
      setTargetRect(null);
      setPopupPos(null);
      return i - 1;
    });
  }, []);

  // Finish the tour AND fire a suggested question into the ask bar.
  const finishWithAsk = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('reporium:ask', { detail: { question: SUGGESTED_ASK } }),
    );
    close();
  }, [close]);

  // Document click handler — advances the tour when the user clicks inside
  // the highlighted target area. Clicks elsewhere on the page are IGNORED
  // (dismissal only via the × button or Esc). We never preventDefault /
  // stopPropagation so the page's own behavior (graph node select, input
  // focus, ask submit) still runs normally.
  useEffect(() => {
    if (!open || !currentStep?.clickAction) return;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      // Ignore clicks on the tour's own popup.
      if (target.closest('.gt-popup')) return;

      // Check the primary selector AND any extra advanceSelectors (so a click
      // anywhere in the step's related region — filter bar, repo cards, etc —
      // triggers the action).
      const selectors = [currentStep.selector, ...(currentStep.advanceSelectors ?? [])];
      const matched = selectors.some((sel) => {
        const host = document.querySelector(sel);
        return !!host && host.contains(target);
      });
      if (!matched) return;

      if (currentStep.clickAction === 'finish-ask') {
        finishWithAsk();
      } else if (currentStep.clickAction === 'advance') {
        advance();
      }
    };

    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [open, currentStep, advance, finishWithAsk]);

  const jumpTo = useCallback((target: number) => {
    if (target === stepIdx) return;
    setTargetRect(null);
    setPopupPos(null);
    setStepIdx(target);
  }, [stepIdx]);

  if (!mounted || !open || !currentStep) return null;

  // Render into a portal so the overlay isn't trapped by page stacking
  // contexts (sticky nav, transforms, backdrop-filter).
  return createPortal(
    <div
      aria-live="polite"
      aria-label="Guided walkthrough"
      className="gt-root"
    >
      {/* Spotlight backdrop — darkens everything outside a softened cutout
          around the target rect. Uses a radial mask so the focus reads
          ambient/underwater rather than boxy. */}
      {targetRect && (
        <div
          aria-hidden
          className="gt-spotlight"
          style={{
            background: (() => {
              const cx = targetRect.left + targetRect.width / 2;
              const cy = targetRect.top + targetRect.height / 2;
              const r = Math.max(targetRect.width, targetRect.height) * 0.75 + 40;
              return `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) 0, rgba(0,0,0,0) ${r - 30}px, rgba(3,7,18,0.72) ${r + 20}px)`;
            })(),
          }}
        />
      )}

      {/* Target outline — a glowing ring on the element the step is about */}
      {targetRect && (
        <>
          <div
            aria-hidden
            className="gt-target-ring"
            style={{
              top: targetRect.top - 10,
              left: targetRect.left - 10,
              width: targetRect.width + 20,
              height: targetRect.height + 20,
            }}
          />
          <div
            aria-hidden
            className="gt-target-ring-outer"
            style={{
              top: targetRect.top - 18,
              left: targetRect.left - 18,
              width: targetRect.width + 36,
              height: targetRect.height + 36,
            }}
          />
        </>
      )}

      {/* Jellyfish mascot + tether — points from the jellyfish to the target.
          Positioned to the side of the popup that has more room. */}
      {targetRect && popupPos && (
        <JellyfishPointer targetRect={targetRect} popupPos={popupPos} />
      )}

      {/* Popup — always rendered (when we have a target) so popupRef can be
          measured by the placement effect. Kept invisible until placed. */}
      {targetRect && (
        <div
          ref={popupRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="gt-title"
          className="gt-popup"
          style={{
            top: popupPos ? popupPos.top : -9999,
            left: popupPos ? popupPos.left : -9999,
            opacity: popupPos ? 1 : 0,
            transition: 'opacity 180ms ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pointer caret indicating which element this refers to */}
          <span
            aria-hidden
            className={`gt-caret ${popupPos?.side === 'above' ? 'gt-caret-bottom' : 'gt-caret-top'}`}
          />

          {/* Rising bubble micro-interaction on the popup's leading edge */}
          <span aria-hidden className="gt-bubbles">
            {[
              { s: 7, l: 6,  d: -0.4, t: 2.4 },
              { s: 5, l: 14, d: -1.5, t: 2.1 },
              { s: 9, l: 22, d: -2.7, t: 2.8 },
            ].map((b, i) => (
              <span
                key={i}
                className="gt-bubble"
                style={{
                  width: b.s, height: b.s, left: b.l,
                  animationDelay: `${b.d}s`,
                  animationDuration: `${b.t}s`,
                }}
              />
            ))}
          </span>

          <div className="gt-header">
            <div className="gt-meta">
              <span className="gt-step">{currentStep.n}</span>
              <span className="gt-sep">/</span>
              <span className="gt-total">{STEPS.length.toString().padStart(2, '0')}</span>
              <span className="gt-divider" />
              <span className="gt-kind">guided tour</span>
            </div>
            <button
              type="button"
              onClick={close}
              className="gt-close"
              aria-label="Close walkthrough"
              title="Close (Esc)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <h3 id="gt-title" className="gt-title">{currentStep.title}</h3>
          <p className="gt-body">{currentStep.body}</p>

          {currentStep.chips && currentStep.chips.length > 0 && (
            <div className="gt-chips" aria-label="Edge types">
              {currentStep.chips.map((c) => (
                <span key={c} className="gt-chip">{c}</span>
              ))}
            </div>
          )}

          <div className="gt-footer">
            <div className="gt-dots" role="tablist" aria-label="Tour steps">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={i === stepIdx}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  onClick={() => jumpTo(i)}
                  className={`gt-dot ${i === stepIdx ? 'gt-dot-active' : ''} ${i < stepIdx ? 'gt-dot-done' : ''}`}
                />
              ))}
            </div>
            <div className="gt-actions">
              {stepIdx > 0 && (
                <button type="button" onClick={rewind} className="gt-btn gt-btn-ghost" aria-label="Previous step">
                  ← prev
                </button>
              )}
              {stepIdx === STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={finishWithAsk}
                  className="gt-btn gt-btn-finish"
                  aria-label="Finish walkthrough and run sample question"
                >
                  <span className="gt-btn-finish-glass" aria-hidden />
                  <span className="gt-btn-finish-tint" aria-hidden />
                  <span className="gt-btn-finish-highlight" aria-hidden />
                  <span className="gt-btn-finish-label">finish ✓</span>
                </button>
              ) : (
                <button type="button" onClick={advance} className="gt-btn gt-btn-primary" aria-label="Next step">
                  next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .gt-root {
          position: fixed;
          inset: 0;
          /* Max-out z-index to guarantee forefront over every other layer
             (sticky nav z-20, StickyAskBar z-50, modals, portals). */
          z-index: 2147483000;
          /* CRITICAL: root is click-transparent so the page underneath stays
             interactive (user can click graph nodes, search bar, ask button).
             Only the popup re-enables pointer events below. */
          pointer-events: none;
        }
        .gt-spotlight {
          position: fixed;
          inset: 0;
          pointer-events: none;
          transition: background 300ms ease-out;
        }
        .gt-target-ring {
          position: fixed;
          border-radius: 14px;
          border: 2px solid rgba(240,171,252,1);
          box-shadow:
            0 0 0 3px rgba(34,211,238,0.55),
            0 0 36px rgba(217,70,239,0.85),
            0 0 72px rgba(34,211,238,0.55),
            inset 0 0 22px rgba(217,70,239,0.2);
          pointer-events: none;
          animation: gt-ring-pulse 2.2s ease-in-out infinite;
        }
        .gt-target-ring-outer {
          position: fixed;
          border-radius: 18px;
          border: 1px solid rgba(240,171,252,0.35);
          box-shadow:
            0 0 48px rgba(217,70,239,0.45),
            0 0 96px rgba(34,211,238,0.3);
          pointer-events: none;
          animation: gt-ring-pulse-outer 2.2s ease-in-out infinite;
        }
        @keyframes gt-ring-pulse {
          0%, 100% { opacity: 1;    transform: scale(1);    }
          50%      { opacity: 0.8;  transform: scale(1.015); }
        }
        @keyframes gt-ring-pulse-outer {
          0%, 100% { opacity: 0.6; transform: scale(1);    }
          50%      { opacity: 0.3; transform: scale(1.04); }
        }

        /* Jellyfish mascot + tether */
        .gt-tether-svg {
          position: fixed;
          top: 0;
          left: 0;
          pointer-events: none;
          overflow: visible;
        }
        .gt-tether-flow {
          animation: gt-tether-march 1.4s linear infinite;
        }
        @keyframes gt-tether-march {
          from { stroke-dashoffset: 0;   }
          to   { stroke-dashoffset: -36; }
        }
        .gt-target-pulse {
          animation: gt-target-pulse-anim 1.6s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        @keyframes gt-target-pulse-anim {
          0%, 100% { transform: scale(1);    opacity: 1;    }
          50%      { transform: scale(1.6);  opacity: 0.55; }
        }
        .gt-jelly {
          position: fixed;
          pointer-events: none;
          opacity: 0.95;
          filter: drop-shadow(0 0 28px rgba(168,85,247,0.4));
        }
        /* Jellyfish bell pulse + tentacle sway are defined in a global
           style block inside JellyfishPointer so keyframe names are not
           hashed away from the class selectors. */

        .gt-popup {
          position: fixed;
          /* Re-enable pointer events on the popup (root is click-transparent) */
          pointer-events: auto;
          width: min(360px, calc(100vw - 32px));
          padding: 14px 16px 14px;
          background: linear-gradient(160deg, rgba(9,9,15,0.94), rgba(18,6,28,0.94));
          border: 1.5px solid rgba(240,171,252,0.45);
          border-radius: 14px;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow:
            0 0 30px rgba(217,70,239,0.35),
            0 0 60px rgba(34,211,238,0.22),
            inset 0 0 18px rgba(217,70,239,0.08);
          color: #f5d0fe;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Roboto Mono", monospace;
          isolation: isolate;
          animation: gt-pop-in 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes gt-pop-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        .gt-caret {
          position: absolute;
          width: 12px;
          height: 12px;
          background: linear-gradient(160deg, rgba(9,9,15,0.94), rgba(18,6,28,0.94));
          border-left: 1.5px solid rgba(240,171,252,0.45);
          border-top: 1.5px solid rgba(240,171,252,0.45);
          left: 50%;
        }
        .gt-caret-top {
          top: -7px;
          transform: translateX(-50%) rotate(45deg);
        }
        .gt-caret-bottom {
          bottom: -7px;
          transform: translateX(-50%) rotate(225deg);
        }

        .gt-bubbles {
          position: absolute;
          top: 10px;
          right: 14px;
          width: 34px;
          height: 30px;
          pointer-events: none;
          overflow: visible;
        }
        .gt-bubble {
          position: absolute;
          bottom: 0;
          border-radius: 9999px;
          background: radial-gradient(circle at 35% 30%, rgba(165,243,252,0.9), rgba(34,211,238,0.5) 60%, transparent 85%);
          border: 0.5px solid rgba(34,211,238,0.45);
          animation-name: gt-bubble-rise;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          opacity: 0;
        }
        @keyframes gt-bubble-rise {
          0%   { transform: translateY(0)   scale(0.85); opacity: 0; }
          18%  { opacity: 0.95; }
          70%  { opacity: 0.55; }
          100% { transform: translateY(-22px) scale(1.05); opacity: 0; }
        }

        .gt-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .gt-meta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #a5f3fc;
        }
        .gt-step {
          color: #f0abfc;
          text-shadow: 0 0 8px rgba(240,171,252,0.7);
          font-weight: 800;
          font-size: 12px;
        }
        .gt-sep  { color: rgba(255,255,255,0.25); }
        .gt-total { color: rgba(165,243,252,0.75); }
        .gt-divider {
          width: 16px;
          height: 1px;
          background: linear-gradient(90deg, rgba(34,211,238,0.3), rgba(217,70,239,0.3));
          margin: 0 4px;
        }
        .gt-kind { color: rgba(165,243,252,0.7); }
        .gt-close {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(240,171,252,0.25);
          border-radius: 6px;
          color: #f5d0fe;
          background: transparent;
          transition: all 140ms ease-out;
          cursor: pointer;
        }
        .gt-close:hover {
          border-color: rgba(240,171,252,0.75);
          background: rgba(217,70,239,0.12);
          box-shadow: 0 0 12px rgba(217,70,239,0.4);
        }
        .gt-close:focus-visible {
          outline: 2px solid rgba(240,171,252,0.9);
          outline-offset: 2px;
        }

        .gt-title {
          margin-top: 10px;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto;
          font-size: 18px;
          font-weight: 800;
          color: #f5d0fe;
          text-shadow: 0 0 10px rgba(240,171,252,0.55);
          letter-spacing: -0.01em;
        }
        .gt-body {
          margin-top: 6px;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(228,228,231,0.9);
        }

        .gt-footer {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .gt-dots { display: inline-flex; align-items: center; gap: 6px; }
        .gt-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: rgba(161,161,170,0.35);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 160ms ease-out;
        }
        .gt-dot:hover { background: rgba(165,243,252,0.7); }
        .gt-dot-done { background: rgba(34,211,238,0.75); }
        .gt-dot-active {
          background: #f0abfc;
          box-shadow: 0 0 10px rgba(240,171,252,0.9);
          width: 18px;
          border-radius: 9999px;
        }
        .gt-actions { display: inline-flex; align-items: center; gap: 6px; }
        .gt-btn {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 160ms ease-out;
        }
        .gt-btn-ghost {
          background: transparent;
          color: rgba(165,243,252,0.9);
          border: 1px solid rgba(34,211,238,0.35);
        }
        .gt-btn-ghost:hover {
          background: rgba(34,211,238,0.08);
          border-color: rgba(34,211,238,0.7);
          box-shadow: 0 0 12px rgba(34,211,238,0.3);
        }
        .gt-btn-primary {
          color: #0b0b14;
          background: linear-gradient(120deg, #d946ef, #22d3ee);
          background-size: 200% 200%;
          border: 1px solid rgba(255,255,255,0.28);
          font-weight: 700;
          box-shadow: 0 0 18px rgba(217,70,239,0.45), 0 0 34px rgba(34,211,238,0.32);
          animation: gt-primary-sweep 4s linear infinite;
        }
        .gt-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 22px rgba(217,70,239,0.6), 0 0 44px rgba(34,211,238,0.45);
        }
        @keyframes gt-primary-sweep {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        /* Edge-type chips — for the Knowledge Graph step */
        .gt-chips {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .gt-chip {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 999px;
          color: #a5f3fc;
          border: 1px solid rgba(34,211,238,0.45);
          background: linear-gradient(120deg, rgba(217,70,239,0.12), rgba(34,211,238,0.12));
          box-shadow: 0 0 10px rgba(34,211,238,0.18) inset;
        }

        /* Glass-style FINISH button — mirrors the s11-cta from /ai-native:
           frosted base, translucent tint, inner highlight, sheen sweep. */
        .gt-btn-finish {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          padding: 8px 16px;
          border-radius: 10px;
          border: 1.5px solid rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(10px) saturate(140%);
          -webkit-backdrop-filter: blur(10px) saturate(140%);
          color: #ffffff;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(255,255,255,0.8), 0 0 18px rgba(240,171,252,0.5);
          cursor: pointer;
          box-shadow:
            0 0 18px rgba(217,70,239,0.35),
            0 0 34px rgba(34,211,238,0.28),
            inset 0 1px 0 rgba(255,255,255,0.4),
            inset 0 0 18px rgba(255,255,255,0.08);
          animation: gt-finish-pulse 2.4s ease-in-out infinite;
          transform-origin: center;
          transition: box-shadow 200ms ease-out;
        }
        .gt-btn-finish:hover {
          animation-duration: 1.6s;
        }
        .gt-btn-finish:active {
          transform: scale(0.97);
          animation-play-state: paused;
        }
        .gt-btn-finish-glass {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.18) 0%,
            rgba(255,255,255,0.06) 45%,
            rgba(255,255,255,0.02) 100%
          );
        }
        .gt-btn-finish-tint {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            120deg,
            rgba(217,70,239,0.32) 0%,
            rgba(168,85,247,0.26) 35%,
            rgba(14,165,233,0.26) 65%,
            rgba(34,211,238,0.32) 100%
          );
          background-size: 300% 300%;
          mix-blend-mode: screen;
          animation: gt-finish-sweep 6s linear infinite;
        }
        .gt-btn-finish-highlight {
          position: absolute;
          left: 6%;
          right: 6%;
          top: 6%;
          height: 42%;
          z-index: 2;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.55) 0%,
            rgba(255,255,255,0.12) 60%,
            transparent 100%
          );
        }
        .gt-btn-finish-label {
          position: relative;
          z-index: 3;
        }
        @keyframes gt-finish-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 0 18px rgba(217,70,239,0.35),
              0 0 34px rgba(34,211,238,0.28),
              inset 0 1px 0 rgba(255,255,255,0.4),
              inset 0 0 18px rgba(255,255,255,0.08);
          }
          50% {
            transform: scale(1.04);
            box-shadow:
              0 0 30px rgba(217,70,239,0.6),
              0 0 56px rgba(34,211,238,0.5),
              inset 0 1px 0 rgba(255,255,255,0.5),
              inset 0 0 22px rgba(255,255,255,0.14);
          }
        }
        @keyframes gt-finish-sweep {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .gt-target-ring,
          .gt-target-ring-outer,
          .gt-popup,
          .gt-bubble,
          .gt-btn-primary,
          .gt-btn-finish,
          .gt-btn-finish-tint,
          .gt-tether-flow,
          .gt-target-pulse,
          .gt-jelly { animation: none !important; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
