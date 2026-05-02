'use client';

/**
 * Skeleton loading state for the repo grid.
 *
 * KAN-154: shape-matched to the real grid (HomePageClient `data-tour="grid"`)
 * to eliminate the dominant ~0.5 CLS shift when `isLoading` flips and the
 * grid swaps from skeleton → real cards. The grid container's height must
 * match the post-load state so nothing below the grid (Footer, About,
 * Library page links) gets pushed.
 *
 * Mirrors:
 *  - column counts: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
 *  - gap: `gap-2`
 *  - card count: 60 (matches `GRID_PAGE_SIZE` in HomePageClient)
 *  - card height: 111px on mobile — matches `RepoCardMinimal`'s rendered
 *    `boundingRect.height` from the post-KAN-153 Lighthouse trace
 *    (`190x111` per layout-shifts items).
 *
 * The skeleton grid does NOT replicate the real card's internal structure
 * 1:1; it only needs to occupy the same footprint per-card so the layout
 * stays put. The simpler internal layout is intentional.
 *
 * The "Loading Reporium..." header is intentionally compact (no margin
 * below) so it doesn't add to the wrapper's total height — the wrapper's
 * `min-h` floor in HomePageClient is sized assuming this skeleton is
 * close to but not over the natural post-load grid height.
 */

const GRID_PAGE_SIZE = 60;

export function LoadingState() {
  return (
    <div role="status" aria-live="polite">
      <p className="sr-only">Loading Reporium…</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: GRID_PAGE_SIZE }).map((_, i) => (
          <div
            key={i}
            // h-[111px] matches RepoCardMinimal's rendered height on mobile.
            // The Tailwind arbitrary value compiles to a single class so we
            // don't need to extend the theme.
            className="h-[111px] rounded-xl border border-white/10 bg-white/[0.03] p-3"
            aria-hidden
          >
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
            <div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-zinc-800" />
            <div className="mt-3 h-2 w-full animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-1.5 h-2 w-5/6 animate-pulse rounded bg-zinc-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
