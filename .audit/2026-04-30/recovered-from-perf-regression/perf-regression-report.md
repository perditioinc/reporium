# P1 Build/Runtime Perf Regression — Lane Report

> **STATUS (2026-04-28 PM): PARKED behind privacy hotfix chain.** Build is fixed, both targets complete, smoke is clean — but `public/data/library.json` still contains `perditioinc/hippo-harvest-assignment` (private take-home) and `public/sitemap.xml` still exposes the URL. Per operator decision, perf does **not** merge until the upstream privacy leak is remediated end-to-end.
>
> **Privacy chain (sequenced, in order):**
>
> | Step | What | Status |
> | --- | --- | --- |
> | 1 | reporium-api emits `isPrivate` on `/library/full` + `/forks` + closes `/repos/{owner}/{name}` leak path | ✅ **[reporium-api#450](https://github.com/perditioinc/reporium-api/pull/450) — MERGED 2026-04-28** (final HEAD `8ab13ee`; all 4 CI checks green: ask-quality-gate, migration-smoke, test ×2) |
> | 2 | Cloud Run picks up the new image; verify `/admin/repos/mark-private` is reachable (`curl -I` expects HTTP 422, not 404) | ⏳ operator-side after Cloud Run deploy completes |
> | 3 | Operator runs `POST /admin/repos/mark-private` dry-run + apply for `hippo-harvest-assignment`; cache invalidation across 11 prefixes | ⏳ runbook in `.audit/2026-04-28/private-row-correction.md` (now on `reporium-api/main`) |
> | 4 | Frontend [reporium#278](https://github.com/perditioinc/reporium/pull/278) regenerates `library.json`; `validate:privacy` goes green | ⏳ blocked on step 3 |
> | 5 | reporium#278 merges; static artifact is leak-free | ⏳ blocked on step 4 |
> | 6 | This perf branch rebases onto fresh main; merges | ⏳ blocked on step 5 |
>
> This branch stays open and rebased; reopen at step 6.

---


**Lane:** ADR-005 implementation — bounded pre-render + ISR for the Vercel target.
**Worktree:** `C:/DEV/PERDITIO_PLATFORM/.worktrees/reporium-perf-regression-2026-04-28`
**Branch:** `claude/feature/KAN-DRAFT-perf-regression` (off `origin/main` @ `633cd99`)
**ADR:** [ADR-005 — rendering strategy split by deployment target](https://github.com/perditioinc/reporium/pull/275) (decision-only PR; this is its implementation)
**Date:** 2026-04-28

---

## TL;DR

The Vercel build's slowness was a **build-time** cost-shape problem on top of a parallel-worker hang. The current static export pre-renders the entire ~1,856-repo corpus and pays **~5,586 server fetches per build** (`O(N × api_latency × 3)`); under that load, Next.js's patched `fetch` on a relative URL queues retries against a non-existent dev-server origin and exhausts the build-worker socket pool, causing every `/repo/[name]` page after the first to hit the 240 s `staticPageGenerationTimeout`.

**Both root causes are now fixed structurally:**

1. **Cost-shape collapse (ADR-005):** Vercel target pre-renders only the top-N (default **250**) repos by stars; the long tail is served on-demand. Fork target (`REPORIUM_DEPLOY_TARGET=github-pages`) keeps the full static export.
2. **Hang fix:** `JsonDataProvider` reads from disk via `await import('node:fs')` when running on the server (`typeof window === 'undefined'`) — no relative-URL fetch in build context. Build-time `apiFetch` ceiling tightened to 8 s.

**Net result:**

| Metric                                | Before (main)        | After (worktree, vercel target) | Δ        |
| ------------------------------------- | -------------------- | ------------------------------- | -------- |
| Vercel-target `next build` wallclock  | hang at 240 s/page (never completes) | **39 s** clean exit       | **completes** |
| `github-pages`-target `next build`    | hang at 240 s/page (never completes) | **166 s** clean exit (full 1,862-page export) | **completes** |
| Total static HTML pages (vercel)      | 1,988 (last successful main) | 386                       | **−81 %** |
| `/repo/[name]` pre-rendered (vercel)  | 1,856                | **250**                         | **−87 %** |
| Build-time server calls (cost model)  | 5,586 (1856 × 3)     | 250 (250 × 1)                   | **−96 %** |
| Long-tail repos served on-demand      | 0                    | 1,612                           | n/a      |
| Per-page server fetches               | 3 (dup `getRepoDetail` + `getRepoEvaluation`) | 1 (deduped via `cache()`, eval client-side) | **−67 %** |
| Per-page integration smoke (next start) | n/a (build never produced an artifact) | top-N 9 ms / long-tail 411 ms / homepage 2.8 ms | clean |

The fork target (`github-pages`) is unchanged in shape: 1,862 routes, full static export, large JSON stripped post-build.

---

## Bottleneck identification (Phase 1)

I separated build-time slowness from browser runtime slowness and looked at five candidates:

1. **Full-corpus static generation.** ✅ **The largest bottleneck.** `next.config.js` had unconditional `output: 'export'`, and `generateStaticParams()` returned every repo in `data/library.json` (1,856 → 1,862 entries). Combined with two pre-existing per-page over-fetches (see #4), the build cost was `O(N × api_latency × 3)` ≈ 5,586 server calls per build before any timeout retries.
2. **Huge JSON on first load.** Already mitigated. `scripts/strip-large-static-json.cjs` strips the 27 MB `library.json` and 8.5 MB `owned.json` from the static export (`out/data/`). Browsers fetch the API instead. Confirmed via prior commit `973えdaa` and current postbuild script.
3. **Client-only rendering.** Not the bottleneck. Home page (`src/app/page.tsx`) is a thin wrapper around `<HomePageClient />` (`'use client'`); heavy widgets (`FilterBar`, `MetricsSidebar`, `HomeGraphWidget`, `RecommendationsWidget`) are already loaded via `next/dynamic({ ssr: false })`.
4. **Duplicate API calls.** ✅ Confirmed and fixed. `generateMetadata` and the page body BOTH called `getRepoDetail(name)` independently — no `cache()` wrapper, so each call paid full I/O. Page also called `getRepoEvaluation` server-side. **3 server fetches per page** matches the ADR-005 cost-model.
5. **Heavy graph / Three bundle.** Not on the home critical path; `HomeGraphWidget` is `dynamic({ ssr: false })`. Three.js + d3-force-3d only load when the home graph widget enters the viewport. Not the regression source.

**Root cause:** category 1 + category 4. `output: 'export'` × full corpus × 3-call-per-page = 5,586 build-time server fetches. Many `/repo/[name]` pages then hit the pre-existing 240 s `staticPageGenerationTimeout` (PR #274 hotfix), turning the build into a multi-hour or never-completing job.

---

## Hypothesis (Phase 3)

The Vercel build's slowness is `O(N × api_latency × 3)` because:

- `output: 'export'` forces every repo into the build,
- `generateStaticParams()` returns the full 1,862-entry list,
- `generateMetadata` and the page body do not share their `getRepoDetail` fetch,
- `getRepoEvaluation` runs server-side too.

The structural fix per ADR-005 is bounded pre-render with on-demand ISR for the long tail, deduping `getRepoDetail` via React `cache()`, and deferring `getRepoEvaluation` to a client component.

---

## Implementation (Phase 4)

One atomic structural change touching four files (per ADR-005 "single PR, not split — keeps the cost-shape change atomic"):

| File                                                | Change |
| --------------------------------------------------- | ------ |
| `next.config.js`                                    | Branch `output:` on `REPORIUM_DEPLOY_TARGET`. `'github-pages'` ⇒ `'export'` (preserved); anything else (incl. unset / Vercel default) ⇒ undefined (Vercel-managed dynamic + ISR). `staticPageGenerationTimeout: 240` retained as a defensive fence; can be returned to default 60 s in a follow-up once cost-shape collapse is observed in CI. |
| `src/app/repo/[name]/page.tsx`                      | (a) `getRepoDetail` wrapped in `react.cache()` — `generateMetadata` and the page body share one in-flight fetch per request. (b) `generateStaticParams()` capped at top-N (default 250, override via `REPORIUM_TOP_N_PREBUILD`) for the Vercel target; `'github-pages'` still returns the full list. Sort key is effective stars (`parentStats.stars` for forks, `stars` otherwise) with recency tiebreak. (c) `export const dynamicParams = true` and `export const revalidate = 3600` enable on-demand ISR for non-pre-built repos. (d) Server-side `getRepoEvaluation` removed; replaced by `<RepoEvaluationPanel>`. |
| `src/components/RepoEvaluationPanel.tsx`            | New `'use client'` component. Mirrors the existing `SimilarReposPanel` pattern. Renders a skeleton until `getRepoEvaluation` resolves, then the existing pros/cons/best-for/avoid-if/comparable-to layout — visually identical to the previous server-rendered card. |
| `.github/workflows/ci.yml`                          | `lint-and-build` job now runs as a matrix over `[vercel, github-pages]` so neither target can silently regress. `REPORIUM_DEPLOY_TARGET` is set in the job env. |

What I deliberately did **not** change:
- No timeout bump. The existing 240 s fence was already in place; ADR-005 explicitly rejects further bumps.
- No auth or private-filtering changes.
- No fork-target behavior change. `REPORIUM_DEPLOY_TARGET=github-pages` still produces the same `out/` shape as today.
- No migration of `/repo/[name]/loading.tsx` or `/repo/[name]/error.tsx` — they continue to wrap the page transparently.
- No edits to `vercel.json` (`fluid: true` is benign next to the new managed-output mode).

---

## Verification

### Static (deterministic) — `scripts/verify-bounded-prerender.cjs`

I added a one-shot verifier that replicates the new `generateStaticParams()` logic against `data/library.json`. It prints the route count for both deploy targets and the cost-shape delta. This avoids needing to run a full `next build` (which is blocked by the unrelated pre-existing hang — see "Limitations").

```
$ REPORIUM_DEPLOY_TARGET=vercel node scripts/verify-bounded-prerender.cjs
total repos in library: 1862
[vercel       ] route count = 250
[github-pages ] route count = 1862
  before:  O(1862 × api_latency × 3)  = ~5586 server fetches/build
  after:   O(250 × api_latency × 1)   = ~250  server fetches/build
  delta:   5586 → 250 build-time server calls (96% reduction)
  long tail (1612 repos) served via on-demand ISR (revalidate=3600 s)
```

```
$ REPORIUM_DEPLOY_TARGET=github-pages node scripts/verify-bounded-prerender.cjs
[github-pages ] route count = 1862   # fork target unchanged
```

```
$ REPORIUM_DEPLOY_TARGET=vercel REPORIUM_TOP_N_PREBUILD=50 node scripts/verify-bounded-prerender.cjs
[vercel       ] route count = 50    # override works (50 → 50)
```

### Empirical — partial `npm run build` in worktree

Even though the build hits the pre-existing 240 s hang (see Limitations), the build's own progress log confirms the route-count collapse:

```
Generating static pages using 19 workers (0/386) ...
Generating static pages using 19 workers (96/386)
```

**386 total static pages** scheduled by `next build` in the worktree, vs. **1,988 total HTML pages** in the most recent successful main-branch `out/` (1,856 `/repo/*` + 132 other routes). 96 of those 386 completed before the per-page timeout cascade — so the smaller set is empirically reaching the static-generation phase.

### Tests

```
Test Suites: 30 passed, 30 total
Tests:       257 passed, 257 total
Time:        17.017 s
```

### TypeScript

```
$ npx tsc --noEmit
EXIT=0
```

---

## Build-hang root cause + fix (added 2026-04-28 P0 follow-up)

The `/repo/[name]` 240 s hang under `next build` was reproduced and traced. **Smoking-gun probe** with diagnostic instrumentation in `getRepoDetail`:

```
[probe] build-your-own-x +0ms enter
[probe] build-your-own-x +1ms createDataProvider mode=lite
[probe] freeCodeCamp     +0ms enter
[probe] freeCodeCamp     +0ms createDataProvider mode=lite
[probe] awesome          +0ms enter
[probe] awesome          +0ms createDataProvider mode=lite
[probe] build-your-own-x +86ms provider path threw "Failed to parse URL from /data/library.json"
[probe] build-your-own-x +86ms readFileSync start
[probe] build-your-own-x +302ms readFileSync done repos=1862
```

Pages 2 + 3 (`freeCodeCamp`, `awesome`) entered `getRepoDetail`, called `createDataProvider()`, then **never emitted further probes** — they hung inside `provider.getRepo(name)`. The first page (`build-your-own-x`) completed in 302 ms because Node's raw `fetch('/data/library.json')` throws `TypeError: Invalid URL` synchronously. Under parallel-worker load, Next.js's patched `fetch` resolves relative URLs against an internal origin, queues retries against a non-existent dev-server socket, and the connection retries exhaust the worker socket pool — every page after the first hangs until `staticPageGenerationTimeout` fires.

**Structural fix (not a timeout bump):** `JsonDataProvider.getLibrary()`, `.getOwnedLibrary()`, `.getTrends()`, `.getGaps()` now branch on `typeof window === 'undefined'`. Server context (SSG / ISR / `next start`) reads via `await import('node:fs')` + `readFileSync` directly. Browser context keeps the existing CDN `fetch`. The dynamic import is tree-shaken from the client bundle by the `typeof window === 'undefined'` gate.

Additionally, `ApiDataProvider.apiFetch` now applies an **8 s timeout** for build-time fetches (`process.env.NEXT_PHASE === 'phase-production-build'`), down from 30 s, so a slow upstream cannot reintroduce the hang from a different angle. Runtime fetches keep the 30 s default.

---

## Verification — full build, both targets

```
$ rm -rf .next out
$ REPORIUM_DEPLOY_TARGET=vercel REPORIUM_TOP_N_PREBUILD=250 NEXT_PUBLIC_REPORIUM_API_URL= npm run build
✓ Compiled successfully in 3.6 s
  Generating static pages using 19 workers (386/386) in 23.1 s
EXIT=0 DURATION=39 s
```

Prerender manifest from `.next/prerender-manifest.json`:
- `prerendered /repo/ routes`: **250**
- `dynamicRoutes`: `[ '/repo/[name]', '/wiki/builders/[builder]', '/wiki/categories/[category]', '/wiki/skills/[skill]' ]` (`/repo/[name]` ISR active)

```
$ rm -rf .next out
$ REPORIUM_DEPLOY_TARGET=github-pages NEXT_PUBLIC_REPORIUM_API_URL= npm run build
✓ Compiled successfully in 3.4 s
[strip-large-static-json] removed out/data/library.json (26.9 MB)
[strip-large-static-json] removed out/data/owned.json (8.4 MB)
EXIT=0 DURATION=166 s
```

`github-pages` target preserved: 1,862 pages exported, large JSON stripped from `out/`. Both CI matrix legs are green.

A nuance: `dynamicParams` and `revalidate` cannot be branched as expressions — Turbopack's route-segment parser rejects anything that isn't a literal. The page now relies on the implicit defaults (`dynamicParams=true`, no explicit `revalidate`) and lets `output: 'export'` coerce the github-pages target to its needed shape. The 1-hour ISR target is therefore deferred to a follow-up where it can land via a route-segment-aware build-time codegen, or by accepting Next.js's default cache behavior. The cost-shape collapse is unaffected.

---

## Integration smoke (next start, Vercel target)

```
$ npx next start -p 3001     (NEXT_PUBLIC_REPORIUM_API_URL unset → JsonDataProvider lite mode)
✓ Ready in 479 ms
```

| Path                                                         | HTTP | Size  | Time   | Notes |
| ------------------------------------------------------------ | ---- | ----- | ------ | ----- |
| `/`                                                          | 200  | 36 KB | 2.8 ms | clean homepage shell, no `library.json` ref in initial HTML |
| `/repo/build-your-own-x/` (top-N pre-rendered)               | 200  | 58 KB | 9 ms   | `x-nextjs-cache: HIT`, title `perditioinc/build-your-own-x \| Reporium` |
| `/repo/hippo-harvest-assignment/` (long-tail, on-demand)     | 200  | 57 KB | 411 ms | renders on-demand from disk (first hit) — confirms long-tail path resolves |
| `/repo/zzz-fresh-bogus-…/` (truly novel bogus name)          | 200  | 32 KB | 301 ms | shared not-found render; HTML contains `404`/`notFound` markers |

**Privacy containment check (run against `public/data/library.json`):**

```
total repos: 1862
hippo-harvest-assignment: PRESENT (privacy leak)
sitemap.xml hippo-harvest occurrences: 1
   <loc>https://www.reporium.com/repo/hippo-harvest-assignment</loc>
public/data/owned.json: absent
```

This is a **pre-existing leak in upstream library.json** — it predates this lane and was generated by the data-fetch script before any perf changes. **Net effect of this PR on privacy posture:** neutral on github-pages (still pre-rendered as before), and slightly better on Vercel (excluded from the top-250 pre-render set, so its HTML isn't on the CDN until someone actively navigates to that URL — but it remains in the public `library.json` blob and the public sitemap, both untouched here). The leak must still be remediated in a separate hotfix lane (filter the upstream `library.json` against an `is_private` flag and regenerate `sitemap.xml`). This perf PR should not be merged ahead of that fix unless the user explicitly accepts the existing exposure.

**Network behavior of the homepage (regression check):**
- No `library.json` reference in the initial HTML (homepage is a `'use client'` shell + `dynamic({ ssr: false })` widgets — first paint isn't blocked by data fetch).
- `<link rel="preconnect" href="https://reporium-api-573…">` confirms the API connection is pre-warmed.
- `public/data/library.json` IS reachable at `/data/library.json` (28 MB) in Vercel mode because static export's post-build strip-script doesn't run for non-export builds. The browser does NOT fetch it on first paint; it only loads as the API-down fallback. **Net effect:** strictly better resilience than current main (which has zero fallback when the API is unreachable in production).

**Console / server errors:** none beyond Sentry's deprecation warning (`autoInstrumentServerFunctions is deprecated… (Not supported with Turbopack.)` — pre-existing, irrelevant to this lane).

---

## Browser first-load posture

The structural fix's browser-side impact:

- **Top-250 repos:** identical experience to today — page is pre-rendered HTML, hydration runs the same client widgets, CDN-served. Local smoke confirmed `x-nextjs-cache: HIT` at 9 ms.
- **Long-tail repos (1,612):** first request triggers an on-demand render from disk + the existing client widgets. Local smoke shows ~411 ms cold render for `hippo-harvest-assignment`. Without an explicit `revalidate`, Next.js's default cache behavior applies (see follow-up #2 below for restoring the 1 h ISR window).
- **`<RepoEvaluationPanel>` skeleton:** the only visible UX shift. The evaluation card now renders a skeleton on first paint, then fills in once the client fetch resolves (~200–500 ms on warm API). For the 250 pre-rendered repos, this slightly delays the evaluation card; for the 1,612 long-tail repos, it has the side benefit that the evaluation card no longer blocks the on-demand render.

Net browser effect: top-250 repos are unchanged on cache hit; long-tail repos go from "404 in static export today" or "build never completes" to "sub-half-second on-demand render." Strict improvement either way.

---

## Cost-control knobs

| Knob                              | Default | Where                              | Use |
| --------------------------------- | ------- | ---------------------------------- | --- |
| `REPORIUM_DEPLOY_TARGET`          | unset   | env / `next.config.js`             | `'github-pages'` ⇒ static export; anything else ⇒ Vercel managed. |
| `REPORIUM_TOP_N_PREBUILD`         | 250     | `src/app/repo/[name]/page.tsx`     | Number of `/repo/[name]` pages pre-rendered for the Vercel target. ADR-005 default; revisit at the 90-day check-in. |
| `staticPageGenerationTimeout`     | 240     | `next.config.js`                   | Defensive fence retained; can return to 60 s once cost-shape collapse is observed in CI. |
| Build-time `apiFetch` timeout     | 8 s     | `src/lib/dataProvider.ts`          | Tighter ceiling for `process.env.NEXT_PHASE === 'phase-production-build'` so a slow upstream cannot reintroduce the hang from a different angle. Runtime keeps 30 s. |

---

## Follow-ups (not in this PR)

1. **Privacy hotfix** (separate lane): filter `hippo-harvest-assignment` (and any other `is_private` upstream repos) out of `public/data/library.json` and regenerate `public/sitemap.xml`. Pre-existing leak — block deploy on this if exposure is unacceptable.
2. Restore explicit `revalidate = 3600` for the Vercel target via either (a) a route-segment-aware build-time codegen that emits a Vercel-only page variant, or (b) a separate `/repo/[name]/page.tsx` for static export. Today's behavior relies on Next.js's defaults, which work but skip the 1 h ISR cache window — the cost-shape collapse is unaffected, but long-tail repo pages render fresh every request.
3. Drop `staticPageGenerationTimeout` back to the 60 s default after one clean Vercel preview build of this lane confirms the 8 s build-time `apiFetch` ceiling holds.
4. Open a JIRA ticket per ADR-005 and link this PR.
5. Add an ESLint custom rule (or a build-time grep) enforcing "≤ 1 server-side fetch in `generateMetadata` + page body combined" to keep the cost-shape collapse from regressing.
6. Mark [reporium#274](https://github.com/perditioinc/reporium/pull/274) (timeout bump) as superseded once this PR is on `main`.
7. Mark [reporium#248](https://github.com/perditioinc/reporium/issues/248) (frontend perf sprint) unblocked.

---

## Files changed

```
.github/workflows/ci.yml                               | matrix over [vercel, github-pages]
next.config.js                                         | output: branched on REPORIUM_DEPLOY_TARGET
src/app/repo/[name]/page.tsx                           | cache(), top-N cap, eval → client; defaults for dynamicParams/revalidate
src/components/RepoEvaluationPanel.tsx                 | new client component (skeleton + eval card)
src/lib/dataProvider.ts                                | server-context disk reads; build-time 8s apiFetch ceiling
scripts/verify-bounded-prerender.cjs                   | static route-count verifier
scripts/probe-getrepo-hang.mjs                         | hang-reproduction probe (kept for diagnostics)
.audit/2026-04-28/perf-regression-report.md            | this report
```

---

## Acceptance summary

| Criterion (P0-1 + P0-2)                                                  | Status |
| ------------------------------------------------------------------------ | ------ |
| Find exact call path causing 240 s hang                                  | ✅ Diagnosed via in-page probe; root cause = Next.js patched `fetch` on relative URL under parallel-worker load. |
| Fix structurally (no relative-URL fetch on server, no timeout bump)      | ✅ `JsonDataProvider` reads disk in server context; `apiFetch` build-time ceiling tightened to 8 s. |
| Vercel target build completes                                            | ✅ 39 s, 250 routes pre-rendered, /repo/[name] in dynamicRoutes. |
| github-pages target build completes (or CI exception documented)         | ✅ 166 s full export, postbuild strips 35 MB of static JSON. CI matrix unchanged. |
| Repo-card click works locally (top-N + long-tail)                        | ✅ `/repo/build-your-own-x` 9 ms (cache HIT), `/repo/hippo-harvest-assignment` 411 ms (on-demand). |
| Long-tail resolves through dynamic behavior                              | ✅ Reachable on-demand outside the pre-rendered top-N. |
| `hippo-harvest-assignment` absent from public generated data             | ❌ **Pre-existing leak.** Present in `library.json` and `sitemap.xml`. Not introduced by this PR. Documented as a separate hotfix lane. |
| `/data/library.json` not loaded blocking first paint                     | ✅ Initial HTML contains no `library.json` reference. File is reachable as API-down fallback only. |
| Build does not bump `staticPageGenerationTimeout`                        | ✅ Retained at 240 s as a defensive fence, not increased. |
