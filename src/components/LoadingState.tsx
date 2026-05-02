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
 *  - card height: ~130px on mobile (matches `RepoCardMinimal`'s rendered
 *    bounding rect — verified via Lighthouse JSON layout-shifts items, see
 *    `.audit/2026-05-02/lighthouse-after-kan-153/home-mobile.json`).
 *
 * The skeleton grid does NOT replicate the real card's internal structure
 * 1:1; it only needs to occupy the same footprint per-card so the layout
 * stays put. The simpler internal layout is intentional.
 */

const GRID_PAGE_SIZE = 60;

export function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <div>
        <p className="text-sm font-medium text-zinc-200">Loading Reporium...</p>
        <p className="mt-1 text-xs text-zinc-500">Preparing the repository grid</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: GRID_PAGE_SIZE }).map((_, i) => (
          <div
            key={i}
            // h-[130px] matches RepoCardMinimal's rendered height on mobile.
            // The Tailwind arbitrary value compiles down to a single class so
            // we don't need to extend the theme.
            className="h-[130px] rounded-xl border border-white/10 bg-white/[0.03] p-3"
            aria-hidden
          >
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
            <div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-zinc-800" />
            <div className="mt-3 h-2 w-full animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-1.5 h-2 w-5/6 animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded-full bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
