# KAN-121 — Minimize Knowledge Graph on home page for mobile (design spec)

- **Ticket:** [KAN-121](https://perditio.atlassian.net/browse/KAN-121)
- **Branch:** `claude/feature/KAN-121-mobile-kg-home`
- **Author:** Claude (design only — no production source changes in this commit)
- **Date:** 2026-04-30
- **Status:** Proposed

## TL;DR

`HomeGraphWidget` mounts unconditionally on the home page and, once it scrolls
into view, fetches up to 10k edges and instantiates Three.js + d3-force-3d on
mobile — heavy CPU/network for a viewport that can't usefully interact with a
3D graph. **Recommend Option A: full hide on mobile** behind a 767px
`matchMedia` gate (matching `/graph` prior art), replaced by a small static
"View graph →" CTA card. Gate **inside `HomeGraphWidget`** for single source
of truth; ship a reusable `useIsMobile` hook in `src/lib/` and migrate
`/graph` to it as a follow-up.

## Problem statement

`HomeGraphWidget` (`src/components/HomeGraphWidget.tsx`) is mounted in
`src/components/HomePageClient.tsx` around line 942 inside an
`<ErrorBoundary fallback={null}>`:

```tsx
<div className="px-3 sm:px-4 md:px-6" data-tour="graph">
  <ErrorBoundary fallback={null}>
    <HomeGraphWidget
      selectedRepoName={selectedRepoName}
      onGraphNodeSelect={handleExploreSelect}
    />
  </ErrorBoundary>
</div>
```

The widget itself has good fold-deferral via IntersectionObserver
(`HomeGraphWidget.tsx:48-63`) but **no mobile gating**. Once visible:

- `HomeGraphWidget.tsx:69-79` calls `loadGraphDataset({ limit: 10000, ... })`
  — comment at line 45 notes "saves up to ~27 MB on mobile" referring to the
  scroll deferral, but it still fires when the user scrolls down. So a mobile
  user who scrolls past the fold pays the full cost.
- `HomeGraphWidget.tsx:154-160` mounts `KnowledgeGraph3D` (Three.js + d3-force-3d)
  at fixed `height={420}` on every viewport. There is no responsive height
  shrink and no `md:hidden` wrapper.

Confirmation:
```
$ git show origin/main:src/components/HomeGraphWidget.tsx \
    | grep -ciE "matchMedia|isMobile|max-width|md:hidden"
0
```

Net effect on mobile: a 3D constellation roughly the size of a postcard, with
poor pinch-zoom UX (touch drags get hijacked by orbit/pan controls), funded by
several MB of JS chunks plus a full graph payload.

## Prior art — PR #220 (`/graph` page mobile fallback)

`src/app/graph/GraphPageClient.tsx` already ships exactly the pattern we want
to mirror. Key references (line numbers from `git show origin/main:...`):

- **L23:** `const MOBILE_QUERY = '(max-width: 767px)';`
- **L26-49:** `MobileGraphFallback` component — a static card with two link
  CTAs (`/` and `/wiki`) and an explanatory paragraph; no graph machinery is
  loaded.
- **L52-54:** `useState(false)` initial value (SSR-safe — server renders
  desktop, client hydrates and corrects). Comment on L66 acknowledges
  the `set-state-in-effect` lint exception is intentional.
- **L63-71:** `matchMedia` listener wired up in `useEffect`, with cleanup.
- **L74:** Hard gate `if (isMobile) return;` inside the data-fetch effect — so
  `loadGraphDataset` and downstream Three.js never run on mobile.
- **L124-126:** Early return:
  ```tsx
  if (isMobile) {
    return <MobileGraphFallback />;
  }
  ```

Two things to note when porting this pattern to the home widget:

1. The home widget already has IntersectionObserver fold-deferral — that stays.
   Mobile gate is checked **first**; if mobile, we skip both observer setup
   and fetch.
2. `/graph` is a dedicated route. The home widget renders inside a
   compositional layout, so the early return must produce a card that fits
   visually with the cyberpunk billboard above and the filter bar below it
   (L944-960 of `HomePageClient.tsx`).

## Recommended treatment — Option A (full hide)

**Replace the widget on mobile with a static, link-only card.** No graph
dataset fetch, no Three.js, no d3-force-3d.

### Why A over B

| Axis | A (full hide → CTA card) | B (collapsed CTA-on-tap, load on demand) |
|---|---|---|
| Initial perf delta | Best — zero graph payload, zero Three.js chunk on first paint | Same as A until user taps; then identical to today's cost |
| Discoverability of `/graph` | One link tap, same surface area as today's card | Same |
| Implementation complexity | Very low — early return + static card | Medium — need a "stub mounted, real component lazy-loaded after click" toggle, and we already do fold-deferral, so this becomes "deferral inside deferral" |
| UX honesty | User goes to a route built for graph exploration (`/graph`) | User loads a heavy 3D widget into a postcard-sized box; pinch/orbit conflicts with page scroll |
| Code shape | Mirrors `/graph` exactly — one shared mental model | New pattern unique to the home widget |
| Failure mode | If gate breaks, user sees current behaviour (worst case = today) | If gate breaks, user gets two confusing CTAs ("Load graph" → broken graph) |

The decisive argument is UX honesty: a 3D orbit-controllable graph at 420px
square on mobile **does not give users a usable interaction** — the orbit
gesture fights vertical page scroll, and labels are illegible at that scale.
A "Load graph" button would let users opt into a bad experience. The
`/graph` page already handles mobile correctly (its own `MobileGraphFallback`
points elsewhere), so the home CTA can simply link to `/graph`, which on
mobile shows the existing fallback — consistent across both surfaces.

If usage data later shows mobile users tapping the home CTA frequently, we
can revisit Option B as a follow-up KAN ticket.

## Detailed design

### 1. Breakpoint

**Use 767px**, identical to `/graph`. Justification: same component family,
same Tailwind `md` boundary (`md:` is `>=768px` in Tailwind). Splitting the
home and `/graph` thresholds creates two definitions of "mobile" that drift.

### 2. Where to gate

**Inside `HomeGraphWidget`** (single source of truth).

Trade-off considered:

- **Inside the widget (chosen):** the widget owns its own viewport policy.
  Any future mount site (e.g. inside a docs page or a future "library" tab)
  inherits the right behaviour. The widget is small enough that the extra
  `useState`/`useEffect` doesn't bloat it.
- **At the mount site (`HomePageClient.tsx:942`) with `md:hidden` + a
  desktop-only render:** purely CSS, but it doesn't stop React from mounting
  the widget — IntersectionObserver still fires (the element is in the DOM,
  just `display:none`), and we'd still need to gate the fetch effect inside
  the widget anyway. This forces a two-place change.

Single-place gate inside the widget is strictly less work and strictly fewer
places to break.

### 3. Hook vs inline

**Ship a reusable `useIsMobile` hook** in `src/lib/useIsMobile.ts`, and use it
in `HomeGraphWidget`. **Migrate `/graph` to it as a follow-up**, not in this
ticket — keep the diff focused.

Justification: there's currently zero duplication; introducing it here means
the next person who needs the pattern (likely soon — graph in repo cards,
constellation in the wiki, etc.) reaches for the existing hook instead of
copy-pasting. The hook is ~12 lines and keeps the SSR-safe initial-false
contract with a `useEffect` `matchMedia` correction. The `/graph` migration
is mechanical — replace the inline `useState`/`useEffect` block with one
hook call — and is its own commit so we can revert independently if needed.

If schedule pressure makes the migration risky, ship the hook + use it in
`HomeGraphWidget` only; leave `/graph` as-is and file the cleanup as a JIRA
follow-up. The hook still pays for itself for any future caller.

### 4. Code shape (illustrative — NOT a full implementation)

**`src/lib/useIsMobile.ts`** (new file):

```tsx
'use client';

import { useEffect, useState } from 'react';

const DEFAULT_QUERY = '(max-width: 767px)';

/**
 * SSR-safe mobile viewport detector. Returns `false` on the server and on
 * the first client render to match SSR output, then corrects to the actual
 * viewport state after hydration. Listens for viewport changes.
 *
 * KAN-121: extracted from src/app/graph/GraphPageClient.tsx for reuse.
 */
export function useIsMobile(query: string = DEFAULT_QUERY): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial viewport match after SSR hydration
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return isMobile;
}
```

**`src/components/HomeGraphWidget.tsx`** changes (illustrative):

```tsx
import Link from 'next/link';
import { useIsMobile } from '@/lib/useIsMobile';

export function HomeGraphWidget({ selectedRepoName, onGraphNodeSelect }: HomeGraphWidgetProps = {}) {
  const isMobile = useIsMobile();
  // ...existing state...

  // Existing IntersectionObserver effect — gate it on !isMobile so the
  // observer doesn't even attach for mobile viewports.
  useEffect(() => {
    if (isMobile) return;
    // ...existing observer setup unchanged...
  }, [isMobile]);

  // Existing fetch effect — add isMobile to the early return.
  useEffect(() => {
    if (isMobile || !isVisible) return;
    // ...existing loadGraphDataset call unchanged...
  }, [isVisible, isMobile]);

  // Mobile early return — placed BEFORE the observer-anchored container
  // so we don't even render the observed div.
  if (isMobile) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#0a0a0f] p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-200">Knowledge Graph</h2>
        <p className="text-xs text-zinc-500 mt-1">
          The interactive 3D graph is desktop-optimized.
        </p>
        <Link
          href="/graph"
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          View graph <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  // ...existing return unchanged (header + loading/error/graph branches)...
}
```

Notes on this shape:

- The mobile card reuses the same outer container styling (`rounded-xl`,
  `border`, `bg-[#0a0a0f]`) as the desktop widget so the cyberpunk billboard
  above and filter bar below align visually. No layout shift on
  desktop-to-mobile resize because the card's height is content-driven.
- Linking to `/graph` (not `/`) is intentional — `/graph` already shows the
  same `MobileGraphFallback` from PR #220 with consistent CTAs. So the user
  experience is: home mobile → tap CTA → `/graph` mobile → see explainer +
  links. This avoids confusing dead-ends.
- `aria-hidden` on the arrow keeps screen readers reading "View graph"
  cleanly.
- Keeping the `<h2>Knowledge Graph</h2>` heading preserves the section
  landmark in the page outline — the section doesn't disappear, it just
  collapses to a card.

### 5. SSR / static-export considerations

This site uses Next.js 16 with static export (`output: 'export'`). The
`useIsMobile` hook returns `false` on the server, which is correct: server
HTML is generated once and shipped to all viewports. The client-side
`useEffect` runs after hydration and corrects to the real viewport. There
will be a one-frame "desktop card flash" on a true mobile viewport before
the gate flips — this is the same behaviour `/graph` already exhibits and
has been shipping since PR #220 without complaints. Acceptable.

If we ever want to remove that flash, we'd need a client-side script that
sets a `mobile` class on `<html>` before React hydrates (cookies + script
tag in `app/layout.tsx`). Out of scope here.

## Verification plan

Verification runs on a Vercel preview URL (link to be filled in by the
implementing PR). Pass criteria:

1. **Network panel — mobile (Chrome DevTools "iPhone 12 Pro" emulation, 375×812):**
   - Initial home page load: **no** request to `/api/graph/edges` (or whichever
     endpoint `loadGraphDataset` hits — verify against current `lib/graphData.ts`).
   - **No** Three.js chunk in the JS waterfall on initial load. Filter for
     `three` or the dynamic-import chunk name from
     `KnowledgeGraph3D` — should be absent.
   - Scrolling past the fold does **not** trigger a graph fetch (gate
     short-circuits the IntersectionObserver effect).

2. **Network panel — desktop (1280×800):**
   - Behaviour identical to today's main: graph fetch fires when widget
     scrolls into view, Three.js chunk loads.

3. **Visual check — mobile (375×812):**
   - "Knowledge Graph" heading + one-line explainer + "View graph →" CTA.
   - Tapping the CTA navigates to `/graph` and that page shows
     `MobileGraphFallback` (already shipped behaviour — sanity check).
   - Card height ~80–100px (content-driven, no fixed 420px).

4. **Visual check — desktop (1280×800 and ≥768px tablet):**
   - Existing graph widget renders unchanged.
   - 768px exactly is desktop (Tailwind `md` boundary). 767px exactly is
     mobile. Resize across the boundary live and verify the gate flips.

5. **Lighthouse mobile perf score (Vercel preview):**
   - Baseline: capture current main score for `/` on mobile.
   - Target: improvement in TBT, LCP, and Total JS transferred. Concrete
     deltas to report in the implementing PR — no hard threshold pre-committed
     here, but if there's no measurable improvement we should re-examine the
     change since the whole point is perf.

6. **Regression sanity:**
   - Run existing core smoke tests
     (`tests/regression/` per `project_reporium_smoke_tests_parked_apr28`).
   - Run `next build` and confirm static export still produces 200 OK for `/`.
   - `git grep -n "useIsMobile"` shows the hook used in exactly one place
     (HomeGraphWidget) for this PR; `/graph` migration is a follow-up.

## Out of scope / follow-ups

- **`/graph` migration to `useIsMobile`:** mechanical follow-up, separate
  KAN ticket. Replace the inline `MOBILE_QUERY` + `useState` + `useEffect`
  block with a single `const isMobile = useIsMobile();` call.
- **Other mobile-heavy widgets:** if any other home-page widget has
  similar issues (e.g. cyberpunk billboard animations on mobile), file
  separately. Not investigated here.
- **Server-side viewport hint to remove the hydration flash:** out of
  scope. Only worth doing if user-visible flicker is reported.
- **Telemetry on the mobile CTA:** instrumenting taps on "View graph →"
  would tell us whether mobile users actually want graph access; informs
  whether to revisit Option B. Out of scope for this design — file a
  follow-up if PM wants the data.
- **Tablet (768–1023px) behaviour:** stays on the desktop branch (graph
  renders). Tablet has the screen real estate and pointer precision to use
  the 3D graph. Re-examine if real users complain.

## Open questions for the user

1. **CTA copy and target.** Proposed: "View graph →" linking to `/graph`.
   Alternatives: "Open graph", "Explore connections", or instead pointing to
   `/wiki` (which the `/graph` mobile fallback also offers). Confirm copy +
   target before implementation.
2. **Migrate `/graph` to `useIsMobile` in this PR or a follow-up?** Default
   recommendation: follow-up (keep this PR focused). Confirm.
3. **Hook location.** `src/lib/useIsMobile.ts` proposed. The codebase has
   no `src/hooks/` directory today (verified via `git ls-tree`). If you'd
   prefer to introduce one (`src/hooks/useIsMobile.ts`), say so — it's a
   one-line change and a small chance to set a convention.
4. **Lighthouse target.** Should this PR commit to a specific perf delta
   (e.g. "TBT reduces by ≥30%") as a merge gate, or just "report the
   measured deltas, ship if positive"? Default: report and ship.
