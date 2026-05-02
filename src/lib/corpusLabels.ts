import { REPOS_INDEXED_LABEL } from './corpusConstants.generated';

/**
 * Returns the formatted repos-indexed count for footer/UI display.
 *
 * When `liveCount` is null/undefined (initial render before data loads, or
 * provider failure), falls back to the build-time `REPOS_INDEXED_LABEL`
 * constant so the visible label never reads "0" while the corpus is non-zero.
 *
 * Audit ref S2 (2026-04-27): footer "0 repos indexed" while API reports 1,856.
 */
export function reposIndexedLabel(liveCount: number | null | undefined): string {
  if (liveCount == null) return REPOS_INDEXED_LABEL;
  return liveCount.toLocaleString('en-US');
}

/**
 * Rounds a corpus-count label down to the nearest 100 for marketing copy.
 * Example: "1,856" → "1,800" (used in metadata description as "1,800+ AI dev tools").
 *
 * Audit ref S3 (2026-04-27): meta description must not lag the corpus
 * (was hardcoded "1,400+" while corpus is 1,856).
 */
export function marketingCount(label: string): string {
  const n = parseInt(label.replace(/,/g, ''), 10);
  if (!Number.isFinite(n)) return label;
  const rounded = Math.floor(n / 100) * 100;
  return rounded.toLocaleString('en-US');
}

/**
 * The marketing-rounded corpus count derived from the generated constant.
 * Single source of truth for any "1,800+" / "X+ AI dev tools" copy.
 */
export const MARKETING_REPOS_LABEL = marketingCount(REPOS_INDEXED_LABEL);
