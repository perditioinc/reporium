# KAN-122 — Post-#280 perf audit

**Ticket:** KAN-122 (Reporium: post-#280 load + build speed audit and remaining wins)
**Branch:** `claude/feature/KAN-122-perf-audit`
**Worktree:** `C:/DEV/PERDITIO_PLATFORM/.worktrees/reporium-KAN-122-perf-audit-2026-04-30`
**Base commit:** `554873c` (origin/main, "KAN-DRAFT: Pre-compute FAQ answers …" — PR #282)
**Lighthouse runner:** `lighthouse@12` (`npx lighthouse@12 …`), Chrome headless, default mobile + `--preset=desktop` profiles
**Captured:** 2026-04-30 (UTC 2026-05-01T02:36-02:43)

---

## TL;DR

1. Post-#280 production Lighthouse on `reporium.com/` is **mobile perf 25 / desktop perf 37** (scored against pre-#280 baseline of 11). The score moved up, but `Total Blocking Time` and `TTI` look worse than the issue-#248 numbers because Lighthouse 12 measures TBT differently (older numbers are not directly comparable).
2. The home page's biggest cost is **NOT** the JS bundle — it is the **6.9 MB total page weight** dominated by 4 paginated `/library/full?page_size=500` JSON downloads (~5.2 MB). Below-the-fold widgets (`KnowledgeGraph3D`, `framer-motion`, `react-markdown`) are already `dynamic({ ssr: false })` — code-splitting is largely done.
3. `/graph/` route is healthy: **mobile perf 91 / desktop perf 59** (graph mobile is fine; desktop perf of 59 is misleadingly low — LCP 0.8 s and CLS 0 are both green; the score is dragged down by TBT 10.6 s from the same `/library/full` ladder firing in `<HomeGraphWidget>` shells).
4. `next build` wall-time on this machine is **1m 27s** for 386 pages — well under the 240 s timeout fence and a clean recovery from the pre-#280 build hangs.
5. **KAN-248 parked branch (`d4f9296`) recommendation: graduate to a PR.** It is a clean, isolated improvement (StickyAskBar idle-boot) with a real bundle win, no behavior change, and it pre-dates the bigger KAN-122 wins so it does not conflict.
6. **Next 1–2 wins are now data-shape, not code-split:** (a) replace the 4-page `/library/full` ladder on the home with a lean `/library/preview` (top-N + minimal fields), (b) ship the recovered `verify-bounded-prerender.cjs` as a CI invariant.

---

## 1. Lighthouse measurements

All four runs are `--only-categories=performance,accessibility,best-practices,seo` against production reporium.com. Mobile uses Lighthouse defaults (4× CPU slowdown, 1638 Kbps). Desktop uses `--preset=desktop` (1× CPU, broadband). Single run per cell — variance not measured here.

### Home `/` and Graph `/graph/`

| Route | Profile | Perf | A11y | BP | SEO | LCP | FCP | TBT | CLS | SI | TTI | Raw JSON |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `/` | mobile | **0.25** | 0.90 | 1.00 | 1.00 | 3.6 s | 1.8 s | 75,980 ms | 0.925 | 23.5 s | 96.0 s | `lighthouse/home-mobile.json` |
| `/` | desktop | **0.37** | 0.96 | 1.00 | 1.00 | 0.9 s | 0.6 s | 8,330 ms | 0.578 | 7.6 s | 23.4 s | `lighthouse/home-desktop.json` |
| `/graph/` | mobile | **0.91** | 0.95 | 1.00 | 1.00 | 3.4 s | 1.8 s | 30 ms | 0.000 | 1.8 s | 3.4 s | `lighthouse/graph-mobile.json` |
| `/graph/` | desktop | **0.59** | 0.91 | 1.00 | 1.00 | 0.8 s | 0.6 s | 10,590 ms | 0.000 | 7.2 s | 23.2 s | `lighthouse/graph-desktop.json` |

(The PageSpeed Insights API was attempted first and returned `RESOURCE_EXHAUSTED` — the project quota is 0/day. Fallback to local `npx lighthouse@12` succeeded.)

### Notable diagnostic values (mobile, home `/`)

From `home-mobile.json::audits`:

- `total-byte-weight`: **6,938 KiB**, dominated by:
  - `/library/full?page=1&page_size=500` — 1.50 MB
  - `/library/full?page=2&page_size=500` — 1.40 MB
  - `/library/full?page=3&page_size=500` — 1.30 MB
  - `/library/full?page=4&page_size=500` — 0.98 MB
  - `/graph/edges?limit=10000&neighbours=5&min_similarity=0.4` — 0.68 MB
  - `/data/owned.json` (static) — 0.43 MB
  - largest JS chunk — 0.16 MB
- `mainthread-work-breakdown`: **175.6 s** simulated (Other 124.6 s, Script Eval 47.7 s)
- `bootup-time`: **47.7 s** simulated (≈ same number as Script Evaluation; the home is JS-bound *because* it parses ~5 MB of JSON, not because the bundle is huge)
- `unused-javascript`: 112 KiB savings available across the top 3 chunks (small win)
- `dom-size`: 1,235 elements (acceptable for a list-heavy page; not a hot fix)
- `cls`: 0.925 mobile / 0.578 desktop — these are LARGE; root cause is the home's progressive load (StatsBar appears, then category bar, then card grid lays in). Likely not a bundle problem; reservation/skeletons would fix it.

### Comparison vs. issue #248 baseline

Issue #248 baseline (Haiku run, 2026-04-19): perf 11, TBT ~9.5 s, TTI 22.3 s, mobile.

The post-#280 score is +14 points (11 → 25). The mobile TBT and TTI numbers in this run (76 s, 96 s) are NOT comparable to the issue-#248 numbers — Lighthouse 12 simulates throttling differently and amplifies Script Evaluation cost. Desktop is the apples-to-apples comparison: TBT 8.3 s desktop today vs. 9.5 s mobile in #248 — flat-to-slightly-better. The single biggest narrative is: **PR #280 unblocked the build (240 s timeouts → 87 s) without changing the home page's runtime data shape.**

---

## 2. Bundle analysis

### Bundle-analyzer wiring: GAP

`@next/bundle-analyzer` is **not** installed in `package.json` and **not** wired into `next.config.js` (neither `withBundleAnalyzer(...)` nor an `ANALYZE=true` branch). Instructions in issue #248 (`Run bundle analyzer: ANALYZE=true next build`) cannot be executed today without an implementation change. **This is a tooling gap worth closing in a follow-up KAN ticket** — `bundle-analyzer` should land before the next code-splitting effort. (Not actioned in this audit per scope: no production-code edits.)

Workaround used here: post-build inspection of `.next/static/chunks/`.

### Top JS chunks after `next build` (post-#280, this machine)

Build wall-time **1m 27s** (start `2026-05-01T02:43:40Z`, end `2026-05-01T02:45:08Z`), 386 pages, exit 0. Full log: `.audit/2026-04-30/build.log`.

| Size (B) | Chunk | Tentative content (heuristic grep) |
|---:|---|---|
| 615,661 | `0yjk2dg8x_l1q.js` | three.js (THREE.* 31× hits) — the `KnowledgeGraph3D` chunk; lazy-loaded via `dynamic({ ssr: false })`, NOT in home critical path |
| 227,872 | `0ourntl10mo-3.js` | React/scheduler/runtime (largest "framework" chunk) |
| 146,888 | `0vsnu1v0usehi.js` | `react-markdown` |
| 137,053 | `0dl.2g.gasy~_.js` | unknown — likely framework / Sentry overlay |
| 120,288 | `0rf59bk~3uc_3.js` | `framer-motion` (motion 20× hits) |
| 113,528 | `01vv~x.bhsgie.js` | `framer-motion` utilities (motion 12× hits) |
| 112,594 | `03~yq9q893hmn.js` | `remark-gfm`/`rehype-sanitize` plugins (RegExp 33× hits) |
|  75,890 | `0a1-r~c95t61m.js` | unknown |
|  66,615 | `128lsejtow0_7.js` | unknown |
|  54,981 | `0idv7cwl0xj3j.js` | unknown |

Lighthouse `unused-javascript` for the home critical path identifies only **112 KiB** of waste across the top three loaded chunks. The bundle is in a reasonable shape post-#280.

### `HomePageClient.tsx` already dynamic-imports the heavy widgets

```text
src/components/HomePageClient.tsx (1308 lines)
  dynamic(): FilterBar, MetricsSidebar, LibraryInsightsWidget,
            CrossDimensionWidget, RecommendationsWidget, HomeGraphWidget
```

So the work issue #248 anticipated ("convert KnowledgeGraph3D to dynamic import") has already happened. Outside of `StickyAskBar` (covered by parked KAN-248) the obvious code-splits are done.

---

## 3. Build wall-time

| Metric | Value |
|---|---|
| `npm run build` total | **1m 27s** (real) |
| Compiled (Turbopack) | 9.3 s |
| `runAfterProductionCompile` | 2.7 s |
| TypeScript | 22.7 s |
| Page generation | 386 pages, 19 workers |
| `staticPageGenerationTimeout` | 240 s (defensive fence; not hit) |
| Build start (UTC) | 2026-05-01T02:43:40Z |
| Build end (UTC) | 2026-05-01T02:45:08Z |
| Exit code | 0 |
| Full log | `.audit/2026-04-30/build.log` |

**No `/repo/[name]` 240 s timeouts.** PR #280 (TOP_N=250 + `react.cache(getRepoDetail)` + `JsonDataProvider.fs.readFileSync` SSR path) decisively closed the build-hang regression.

---

## 4. KAN-248 parked branch (`d4f9296`) recommendation

**Branch:** `claude/feature/KAN-248-frontend-performance` (single commit, no PR)
**Diff vs. origin/main:**

```
.audit/2026-04-24/frontend-performance-jira.md |  76 +++++++++++++++
src/components/LayoutShell.tsx                 |   4 +-
src/components/StickyAskBarBoot.tsx            | 124 +++++++++++++++++++++++++
3 files changed, 202 insertions(+), 2 deletions(-)
```

**What it does:** wraps `StickyAskBar` (which is rendered on every route via `LayoutShell` and pulls in `framer-motion` + `react-markdown` + `remark-gfm` + `rehype-sanitize`) in a `requestIdleCallback`-gated boot wrapper. Renders a visually-identical 56 px placeholder until the page has gone idle OR the user signals intent (`pointerdown`, `/`, `Cmd+K`, `Ctrl+K`, `?tour=`). Falls back to `setTimeout(boot, 1500)` if `requestIdleCallback` is unavailable (Safari).

**Why it still matters post-#280:** PR #280 did not change `StickyAskBar`'s eager-import path. The four heavy markdown libs in the table above are still in the root chunk for every route. The wrapper preserves the data-tour attribute and the collapsed-bar styles, so there's no layout shift and `GuidedTour`'s 30-attempt retry loop absorbs the swap.

**Recommendation: GRADUATE TO PR (rebase on origin/main first).** Justification:

- It is the **only** unshipped, isolated bundle win that targets the actual root chunk used by every page.
- It does not conflict with PR #280 (touches `LayoutShell` only at the import line, plus a new file).
- The 1.5 s timeout fallback is well-thought-through (Safari has no `requestIdleCallback`).
- The placeholder is markup-identical, so CLS risk is zero.
- The expected delta is a meaningful root-chunk shrink because `StickyAskBar` pulls FOUR heavy libs (`framer-motion`, `react-markdown`, `remark-gfm`, `rehype-sanitize`) out of the eager critical path.

**Action for the user (NOT done in this ticket — explicit out of scope):**

```
git -C C:/DEV/PERDITIO_PLATFORM/<some-fresh-worktree> \
    fetch origin && git checkout claude/feature/KAN-248-frontend-performance && \
    git rebase origin/main && git push -u origin claude/feature/KAN-248-frontend-performance
gh pr create --base dev --head claude/feature/KAN-248-frontend-performance \
    --title "KAN-248: defer StickyAskBar off the initial paint via idle-boot wrapper"
```

---

## 5. Recovered artifacts from `reporium-perf-regression-2026-04-28`

That worktree (HEAD `633cd99`, branch `claude/feature/KAN-DRAFT-perf-regression`) was the staging ground for ADR-005. Its structural code changes shipped via PR #280, but three diagnostic artifacts did NOT make it onto `origin/main`:

| Artifact (recovered → here) | Lines | On main? | Recommend |
|---|---:|---|---|
| `recovered-from-perf-regression/perf-regression-report.md` | 307 | NO | Keep as historical record under `.audit/`; no PR needed. |
| `recovered-from-perf-regression/probe-getrepo-hang.mjs` | 96 | NO | **Promote to `scripts/` in a separate KAN ticket.** Bounded 5 s probe of `JsonDataProvider.getLibrary()` / `getRepo()` / `readFileSync` — invaluable next time `/repo/[name]` hangs in build. |
| `recovered-from-perf-regression/verify-bounded-prerender.cjs` | 97 | NO | **Promote to `scripts/` AND wire into CI** in a separate KAN ticket. Static verification of ADR-005 bounded pre-render: replicates the exact sort/slice in `generateStaticParams`, prints route-count delta for both deploy targets. Catches a future `TOP_N_REPOS_FOR_BUILD` regression before it eats 240 s in CI. |

Files have been copied to `.audit/2026-04-30/recovered-from-perf-regression/` in this worktree. The perf-regression worktree was **not** modified.

---

## 6. Draft comment for issue #248

> ## Post-#280 re-baseline (2026-04-30, KAN-122)
>
> The 11/100 baseline in this issue predated PR #280. New measurements (Lighthouse 12, production reporium.com):
>
> | Route | Profile | Perf | LCP | TBT | CLS |
> |---|---|---:|---:|---:|---:|
> | `/` | mobile | 25 | 3.6 s | 75,980 ms | 0.925 |
> | `/` | desktop | 37 | 0.9 s | 8,330 ms | 0.578 |
> | `/graph/` | mobile | **91** | 3.4 s | 30 ms | 0 |
> | `/graph/` | desktop | 59 | 0.8 s | 10,590 ms | 0 |
>
> Score did move up (11 → 25 mobile, 11 → 37 desktop). Lighthouse 12 reports TBT/TTI more pessimistically than older Lighthouse, so the absolute numbers are not directly comparable, but the **dominant blocker is no longer the JS bundle** — code-split is largely done (`HomePageClient.tsx` already `dynamic()` imports `FilterBar`, `MetricsSidebar`, `LibraryInsightsWidget`, `CrossDimensionWidget`, `RecommendationsWidget`, `HomeGraphWidget`). Lighthouse's `unused-javascript` reports only 112 KiB of waste in the top three loaded chunks.
>
> The dominant blocker is the **6.9 MB page weight on `/`**, of which ~5.2 MB is the four-page `/library/full?page_size=500` ladder pulled by `JsonDataProvider._fetchLibrary()` (`src/lib/dataProvider.ts:394-437`). Mobile main-thread Script Eval is 47.7 s — that is JSON parse, not bundle parse.
>
> ### Sub-issue closure
> - [x] Convert `KnowledgeGraph3D` to dynamic import — already shipped (it's at `src/components/HomePageClient.tsx:32` via `HomeGraphWidget` `dynamic({ ssr: false })`)
> - [ ] Run `ANALYZE=true next build` — `@next/bundle-analyzer` is not wired up; closing this requires a small `next.config.js` edit. Recommend a separate KAN ticket: "Wire up @next/bundle-analyzer for ANALYZE=true builds".
> - [ ] Preconnect + DNS-prefetch for reporium-api + Sentry origins — still open; cheap win.
> - [ ] Audit Turbopack chunk splitting in Next 16 — partially done (chunks/ inspected; top three are three.js, framework, react-markdown).
>
> ### Recommendation
> **Narrow the scope of #248 and re-title** ("Reduce home-page page weight: 6.9 MB → ~1.5 MB via /library/preview"), or **close as superseded** in favor of a new ticket scoped to the data-shape fix. The original "JS code-splitting" framing no longer matches the bottleneck.
>
> Audit doc, raw Lighthouse JSON, and build log: <link to KAN-122 PR>.

(NOT posted — drafted in this audit per ticket constraints.)

---

## 7. Top 1–2 next wins

### Win 1 — Replace the home `/library/full` ladder with a lean `/library/preview`

**Mechanism.** `JsonDataProvider._fetchLibrary()` (`src/lib/dataProvider.ts:394-437`) is the only producer of the 4-page `/library/full?page_size=500` ladder. The home grid (`HomePageClient.tsx`) renders **at most ~24-100 cards** above the fold — it does not need 1,861 repos in memory to do that. A new `/library/preview?limit=300` (top 300 by stars + active=true, with a *projected* schema — name, slug, primary category, stars, summary — not the full enriched record) replaces all four current calls. The full library is still loadable on demand for `/library/full`, NL filter, and recommendations.

**Estimated saving.** ~5.2 MB → ~0.3 MB (transfer) and proportional Script Eval drop. On mobile that should pull TBT below 5 s and Perf to **mobile 60-70 / desktop 75-85** range. CLS will also drop because the grid stops re-laying-out across 4 paginated arrivals.

**Cost.** Backend: 1 new endpoint, ~50 LOC. Frontend: split `getLibrary()` into `getPreview()` (eager) + `getLibrary()` (lazy/on-demand). Estimate 1-2 days incl. tests.

**Caveats.** Recommendations widget, NLFilter, and the page-1 `getOwnedLibrary()` preview path all currently rely on the full data shape — they need to be reviewed for which fields they actually use before projection.

### Win 2 — Promote `verify-bounded-prerender.cjs` to CI

**Mechanism.** Recovered above. Add it to `scripts/` and run in `ci.yml` as a separate workflow step — fails the build if `TOP_N_REPOS_FOR_BUILD * 2 < total_repos` for the vercel target, or if a future change accidentally re-enables `output: 'export'` on Vercel without bumping `REPORIUM_DEPLOY_TARGET`. Cheap insurance against a #280-class regression.

**Cost.** ~1 hour. Single tiny PR.

### Honorable mentions (not warranted as the "next win" but worth a 1-line follow-up)

- Preconnect/DNS-prefetch for `reporium-api-573778300586.us-central1.run.app` — would shave ~200 ms off LCP per Lighthouse opportunity.
- Wire up `@next/bundle-analyzer` so this audit is actually repeatable next quarter.
- Investigate the home page's CLS 0.925 mobile / 0.578 desktop — that is by far the worst non-perf metric and is likely fixable with reserved-height skeletons on the StatsBar/category-bar/grid sequence (independent of the page-weight win).

---

## 8. Open questions for the user

1. **KAN-248 parked branch:** OK to graduate to PR against `dev` (after rebase)? Recommendation is yes.
2. **Win 1 (/library/preview):** is the backend team scoped for a 1-2 day endpoint addition? File a new KAN ticket with this audit linked, or fold into KAN-122?
3. **Issue #248:** narrow-and-rename, or close-as-superseded? Recommendation is narrow-and-rename, with a new "data-shape" ticket forked from it.
4. **`@next/bundle-analyzer`:** OK to add it in a tiny follow-up PR (devDep + `next.config.js` `ANALYZE=true` branch)? Won't affect production behavior; makes the next audit repeatable.
5. **CLS 0.925 mobile is genuinely bad** for a "home page that displays a grid"; do we want to scope a separate KAN ticket for skeleton placeholders? It is independent of the page-weight win.
