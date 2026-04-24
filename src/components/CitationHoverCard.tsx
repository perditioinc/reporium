'use client';

/**
 * CitationHoverCard.tsx — PR9 (Ask UX inline citation hover preview).
 *
 * When the user hovers (or focuses) an inline citation link rendered by the
 * PR7 markdown renderer, this component pops a small card next to the link
 * showing the matched repo's stars and a one-line description excerpt — so
 * citations are useful at a glance without forcing a click+scroll trip.
 *
 * Same overflow-clip lesson as PR6 (jellyfish tips popover): the sticky ask
 * bar root uses `overflow:hidden` so a positioned tooltip needs to render
 * through a portal to `document.body` with `position:fixed`. Otherwise the
 * card would visually clip even though it'd be in the DOM.
 *
 * Behavior:
 *   - 350 ms hover/focus delay before show (avoids flashing while scanning).
 *   - Hides immediately on mouseleave / blur.
 *   - ESC dismisses while open.
 *   - Suppressed during streaming (caller controls via `disabled` prop) so
 *     the live answer animation doesn't fight a hover popover for attention.
 *   - Click semantics on the wrapped <a> are unchanged — PR7's
 *     handleCitationClick still scrolls + ring-flashes the source card.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

// SSR-safe "are we hydrated yet" hook. Returns false on the server snapshot
// (so the portal isn't emitted into the SSR string) and true on the client
// after hydration. Avoids the lint-flagged setState-in-effect pattern.
const subscribeNoop = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,   // client snapshot
    () => false,  // server snapshot
  );
}

/**
 * Minimal repo shape used by the hover card. Compatible with the SourceRepo
 * type in StickyAskBar without importing the whole module (keeps this
 * component free of streaming/SSE coupling).
 */
export interface CitationSource {
  owner: string;
  name: string;
  forked_from: string | null;
  description: string | null;
  stars: number | null;
}

/** Format a stars count compactly: 1234 -> "1.2k", 1500000 -> "1.5M". */
function formatStars(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * Trim a description to a one-liner. Prefers the first sentence; falls back
 * to a hard char cap with an ellipsis. Keeps the card compact and scannable.
 */
export function describeForHover(description: string | null | undefined, maxLen = 140): string {
  if (!description) return '';
  const trimmed = description.trim();
  if (!trimmed) return '';
  // Prefer first sentence if it's short enough.
  const sentenceEnd = trimmed.search(/[.!?](\s|$)/);
  if (sentenceEnd > 0 && sentenceEnd <= maxLen) {
    return trimmed.slice(0, sentenceEnd + 1);
  }
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen).trimEnd() + '…';
}

/**
 * Display label for a forked repo: prefer `upstream-owner/name`, else just
 * `name` with a "fork" hint. Mirrors the formatRepoDisplay logic so the
 * hover card and the underlying source card show the same identity.
 */
function formatLabel(repo: CitationSource): { primary: string; isFork: boolean } {
  if (repo.forked_from) {
    // forked_from is "upstream-owner/name" in our schema
    return { primary: repo.forked_from, isFork: true };
  }
  return { primary: `${repo.owner}/${repo.name}`, isFork: false };
}

const SHOW_DELAY_MS = 350;

interface CitationHoverCardProps {
  href: string;
  /** Underlying anchor render — typically the PR7 violet citation link. */
  children: React.ReactNode;
  /** The matched source for `href`, or null if no preview is available. */
  source: CitationSource | null;
  /** When true, suppresses the hover card (e.g. during answer streaming). */
  disabled?: boolean;
  /** Click handler for the wrapped anchor (PR7 scroll + flash). */
  onAnchorClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Class string for the underlying anchor (PR7 violet styling). */
  anchorClassName?: string;
}

/**
 * Wraps a citation `<a>` and renders a portalled hover card next to it on
 * pointer/focus. If `source` is null (anchor map miss) or `disabled` is set,
 * behaves exactly like a bare anchor.
 */
function CitationHoverCardImpl({
  href,
  children,
  source,
  disabled,
  onAnchorClick,
  anchorClassName,
}: CitationHoverCardProps) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const mounted = useHasMounted();

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const scheduleShow = useCallback(() => {
    if (disabled || !source) return;
    clearShowTimer();
    showTimerRef.current = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  }, [disabled, source, clearShowTimer]);

  const hide = useCallback(() => {
    clearShowTimer();
    setOpen(false);
  }, [clearShowTimer]);

  // Anchor the card just above the wrapper. Recomputed on visible / scroll
  // / resize so the popover tracks during page motion.
  useLayoutEffect(() => {
    if (!open) return;
    const w = wrapperRef.current;
    if (!w) return;
    const recompute = () => {
      const r = w.getBoundingClientRect();
      setPos({ top: r.top, left: r.left + r.width / 2 });
    };
    recompute();
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [open]);

  // Global ESC dismiss while open (matches PR6 jellyfish-popover pattern).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hide]);

  // Cleanup pending show timer on unmount so a citation that scrolls offscreen
  // mid-delay doesn't flash up later.
  useEffect(() => () => clearShowTimer(), [clearShowTimer]);

  const stars = source ? formatStars(source.stars) : null;
  const desc = source ? describeForHover(source.description) : '';
  const label = source ? formatLabel(source) : null;

  // Stable id for aria-describedby wiring. `href` already encodes the anchor
  // id (e.g. `#ask-source-langchain`), so it makes a unique-per-citation key.
  const tooltipId = `citation-hover-${href}`;

  const card =
    open && pos && source && label ? (
      <div
        id={tooltipId}
        role="tooltip"
        // pointer-events-none so the card doesn't intercept mouseleave from
        // the wrapper — same flicker-prevention trick as PR6's portal popover.
        className="pointer-events-none fixed z-[60] w-[280px] -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 shadow-xl backdrop-blur"
        style={{ top: pos.top - 8, left: pos.left }}
        data-testid="citation-hover-card"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-zinc-100">{label.primary}</span>
          {stars && (
            <span className="shrink-0 tabular-nums text-amber-300">★ {stars}</span>
          )}
        </div>
        {label.isFork && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
            mirrored fork
          </div>
        )}
        {desc && <div className="mt-1 line-clamp-3 leading-snug text-zinc-300">{desc}</div>}
        <div className="mt-1.5 text-[10px] uppercase tracking-wide text-violet-400/70">
          click to view source
        </div>
      </div>
    ) : null;

  return (
    <span
      ref={wrapperRef}
      // inline-block-ish wrapper so it inherits flow but can host a hover hit area.
      className="inline"
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
      onBlur={hide}
    >
      <a
        href={href}
        onClick={onAnchorClick}
        className={anchorClassName}
        data-citation="1"
        aria-describedby={open && source ? tooltipId : undefined}
      >
        {children}
      </a>
      {mounted && card && createPortal(card, document.body)}
    </span>
  );
}

export const CitationHoverCard = memo(CitationHoverCardImpl);
