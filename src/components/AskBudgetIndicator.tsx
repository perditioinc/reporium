'use client';

import { useEffect, useState } from 'react';

// Mirrors the constants in AskBar.tsx and StickyAskBar.tsx. Keeping them
// duplicated (rather than imported) so this component stays a pure read-only
// display with no coupling to the components that *write* the counter.
const RATE_KEY = 'reporium_ask_timestamps';
const RATE_PER_MIN = 10;
const RATE_PER_DAY = 100;
const REFRESH_MS = 10_000;

const AMBER_MIN_THRESHOLD = Math.ceil(RATE_PER_MIN * 0.7);
const AMBER_DAY_THRESHOLD = Math.ceil(RATE_PER_DAY * 0.7);

interface BudgetState {
  minuteCount: number;
  dayCount: number;
}

function readBudget(): BudgetState {
  if (typeof window === 'undefined') return { minuteCount: 0, dayCount: 0 };
  try {
    const raw = window.localStorage.getItem(RATE_KEY);
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(timestamps)) return { minuteCount: 0, dayCount: 0 };
    const now = Date.now();
    const oneMinAgo = now - 60_000;
    const oneDayAgo = now - 86_400_000;
    const minuteCount = timestamps.filter((t) => typeof t === 'number' && t > oneMinAgo).length;
    const dayCount = timestamps.filter((t) => typeof t === 'number' && t > oneDayAgo).length;
    return { minuteCount, dayCount };
  } catch {
    return { minuteCount: 0, dayCount: 0 };
  }
}

function severityClass(count: number, cap: number, amberAt: number): string {
  if (count >= cap) return 'text-red-400';
  if (count >= amberAt) return 'text-amber-400';
  return 'text-zinc-500';
}

function barColor(minuteCount: number, dayCount: number): string {
  if (minuteCount >= RATE_PER_MIN || dayCount >= RATE_PER_DAY) return 'bg-red-500/70';
  if (minuteCount >= AMBER_MIN_THRESHOLD || dayCount >= AMBER_DAY_THRESHOLD) return 'bg-amber-500/70';
  return 'bg-zinc-600/60';
}

export interface AskBudgetIndicatorProps {
  /** Optional className for the wrapper. */
  className?: string;
  /** Compact variant — drops the trailing "asks" word so it fits a status strip. */
  compact?: boolean;
}

/**
 * Always-on display of the client-side Ask budget (10/min · 100/day).
 *
 * Read-only: reads `localStorage['reporium_ask_timestamps']`, the same key
 * that AskBar and StickyAskBar already write. Does not enforce or modify
 * the budget. Refreshes on mount and every 10s.
 *
 * Design Principle P2 — "Show the budget, don't just enforce it."
 * See .audit/2026-04-24/reporium-ask-faq-design-memo.md §3, §10.1.
 */
export function AskBudgetIndicator({ className, compact = false }: AskBudgetIndicatorProps) {
  // Initial render is the SSR-safe zero state; a useEffect hydrates the real
  // value after mount so server and client markup agree on first paint.
  const [{ minuteCount, dayCount }, setBudget] = useState<BudgetState>({
    minuteCount: 0,
    dayCount: 0,
  });

  useEffect(() => {
    setBudget(readBudget());
    const id = window.setInterval(() => setBudget(readBudget()), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const minutePct = Math.min(100, (minuteCount / RATE_PER_MIN) * 100);
  const dayPct = Math.min(100, (dayCount / RATE_PER_DAY) * 100);
  const fillPct = Math.max(minutePct, dayPct);

  const minuteClass = severityClass(minuteCount, RATE_PER_MIN, AMBER_MIN_THRESHOLD);
  const dayClass = severityClass(dayCount, RATE_PER_DAY, AMBER_DAY_THRESHOLD);
  const fillClass = barColor(minuteCount, dayCount);

  const tail = compact ? '' : ' asks';
  const ariaLabel =
    `Ask budget: ${minuteCount} of ${RATE_PER_MIN} this minute, ` +
    `${dayCount} of ${RATE_PER_DAY} today.`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={`select-none ${className ?? ''}`.trim()}
      data-testid="ask-budget-indicator"
    >
      <div className="text-[11px] tabular-nums tracking-wide text-zinc-500">
        <span className={minuteClass}>{minuteCount}/{RATE_PER_MIN}</span>
        <span className="mx-1.5 text-zinc-700">·</span>
        <span className={dayClass}>{dayCount}/{RATE_PER_DAY}{tail}</span>
      </div>
      <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
        <div
          className={`h-full ${fillClass} transition-[width] duration-300 ease-out`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}

export default AskBudgetIndicator;
