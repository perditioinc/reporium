# ADR-005: Rendering strategy split by deployment target

**Status:** Proposed
**Date:** 2026-04-26
**Deciders:** ***REDACTED-OPERATOR-HANDLE*** (operator), CODEOWNERS

**Amends:** [ADR-001](../../DECISIONS.md) (Next.js with static export) for the Vercel primary deployment only. ADR-001 stands unchanged for the GitHub Pages fork target.

## Context

The reporium frontend's primary build is structurally fragile, and the failure mode is silent.

### Cost model in one line

> **Build cost = N × api_latency × 3**, where N is the corpus size (1,992 today, growing). Both N and api_latency trend up. The build has no headroom against either.

That `× 3` is not a guess — it is the literal number of build-time API calls each repo page makes today. The next subsection enumerates them.

### What is in place today

- `next.config.js` sets `output: 'export'` (full static HTML, no SSR/ISR).
- `src/app/repo/[name]/page.tsx`'s `generateStaticParams()` returns **every** repo in the corpus from `data/library.json` (1,992 at time of writing).
- **Each repo page issues three live API calls during build:**
  1. `generateMetadata()` calls `getRepoDetail(name)`.
  2. The page body calls `getRepoDetail(decodedName)` **again** — Next.js does not dedupe these for the custom data-provider path, so the same repo's detail is fetched twice per build.
  3. The page body calls `getRepoEvaluation(decodedName)` in parallel with the second `getRepoDetail`.
- Per-page `staticPageGenerationTimeout` defaulted to 60s with 3 retries; [reporium#274](https://github.com/perditioinc/reporium/pull/274) bumped it to 240s as a hotfix.

The duplicate `getRepoDetail` is pure waste — it would be a one-line dedupe fix on its own. The third call (`getRepoEvaluation`) does not even need to gate the build; it can be deferred to a client-side fetch. So the cost model collapses naturally:

> **Today: 3 build-time API calls per page.** Achievable target with no behavior loss: **1 call.**

That 3 → 1 reduction is the headline benefit of the rendering split below — independent of the top-N decision.

### What this caused (2026-04-25)

- SHA `71a48bb1` exhausted the per-page timeout on `/repo/rl`. Vercel deploy `dpl_7Xrjrf8mQUdRLoPJvsj5Qbe1LPTJ` → `state: failure`. Pages that hit the ceiling: `FlashRAG`, `Grounded-SAM-2`, `gemma-cookbook`, `FastVideo`, `rl`, `rdkit`.
- Production silently stayed on the prior SHA. `/faq`, added in that build, returned a CDN 404 indistinguishable from a missing-route 404.
- The failure was invisible until someone curled the new route. Closeout note: `.audit/2026-04-26/closeout-wave-2026-04-25.md`.

### The structural problem ADR-001 created

ADR-001 (2026-03-12) chose `output: 'export'` to enable free GitHub Pages hosting for forked instances. ADR-003 (forks → GitHub Pages) and ADR-004 (primary → Vercel) named the two deployment targets but **left them sharing one rendering pipeline**. Vercel does not need full static HTML; it has ISR and dynamic rendering. We have been paying the GitHub Pages constraint on every Vercel build, and that cost compounds with every repo added.

### Why this is queued ahead of the perf sprint

The frontend perf sprint ([reporium#248](https://github.com/perditioinc/reporium/issues/248)) is queued. Per-page perf optimizations on a build whose cost is dominated by `O(N × api_latency)` are wasted effort — any per-page win is swamped by the corpus-scale multiplier. **Structural fix first, then perf sprint.**

## Decision

Split the rendering strategy by deployment target. The full-corpus static export stays for forks; Vercel primary moves off it.

### Vercel primary (reporium.com)

- `generateStaticParams()` returns only the **top-N most popular repos**, ranked by stars or recent activity score. Initial target: **N ≤ 250**, tuned against actual Vercel build duration. Concrete N is an implementation parameter, not part of this ADR.
- The long tail uses **Next.js Incremental Static Regeneration (ISR)** or dynamic rendering on first request, with edge-cache TTL.
- **Per-page build-time API budget: 1 call (down from 3 today).** Eliminate the duplicate `getRepoDetail` between `generateMetadata` and the page body (React `cache` or shared fetch). Defer `getRepoEvaluation` to a client-side fetch — it does not need to gate the build.

### GitHub Pages fork (forked instances)

- Continues using `output: 'export'` with full-corpus pre-render. Acceptable because fork builds are self-contained, infrequent, and opted into by users running the workflow.
- Becomes a **deployment-target-conditional config**, gated by an env var (e.g. `REPORIUM_DEPLOY_TARGET=github-pages` enables full export; default = vercel/dynamic).

### Hard constraints to encode in the build

- Per-page network-call budget for the Vercel primary build path: **≤ 1 build-time API call.** Enforce via lint or build-time assertion if practical.
- No new `getXYZ()` calls in `generateMetadata` or page bodies for statically-generated routes without an ADR amendment.
- The full-corpus static export path remains available for the GitHub Pages target only.

## Options Considered

### Option A — Top-N prerender + ISR fallback, deployment-target-aware (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Medium — adds deployment-target gating + ISR config |
| Cost | $0/month preserved (Vercel free tier; ISR quotas are generous) |
| Scalability | Build cost flat in N, decoupled from corpus size |
| Team familiarity | Next.js-native, well-documented |

**Pros:**
- Build cost independent of corpus size.
- Long tail still served, just at first-request latency + cache.
- Fork portability preserved via the conditional export path.
- Provides a stable foundation under reporium#248.

**Cons:**
- First request to a long-tail repo pays one-time render latency.
- Two code paths to maintain (static export vs. dynamic).
- N requires tuning and ongoing observation.

### Option B — Keep bumping the build timeout (status quo after #274)

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | $0/month |
| Scalability | None — fails again at next corpus or latency tip |
| Team familiarity | High |

**Pros:** Zero immediate work.
**Cons:** Each bump (60s → 240s → ?) buys finite headroom against an unbounded growth function. Failure mode stays silent (production keeps the prior SHA when build times out). This is a delay, not a fix.

### Option C — Full SSR on Vercel (server function on every request)

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | At risk of leaving the free tier under traffic |
| Scalability | Per-request latency on every hit; no edge-cache win for read-mostly pages |
| Team familiarity | Next.js-native |

**Pros:** No build-time API calls at all.
**Cons:** Loses the static-HTML SEO advantage on >95% read-mostly pages; loses fork portability entirely; free-tier serverless minutes are a real ceiling.

### Option D — Pre-bake the entire corpus into a single JSON at build time

| Dimension | Assessment |
|---|---|
| Complexity | Medium-high (requires ingestion-side bundling) |
| Cost | $0/month |
| Scalability | Bundle size grows linearly with corpus |
| Team familiarity | Medium |

**Pros:** Reduces build-time API calls to 1.
**Cons:** Bundle bloat (extrapolating from current ~9.8 MB at 200 repos puts the full 1,992-repo bundle near 100 MB); inflates first-page payload and CDN bandwidth; just shifts the unbounded-growth problem to a different axis.

## Trade-off Analysis

The decision pivots on whether build cost should scale with corpus size. Options A and D both decouple build cost from `N × api_latency`, but A keeps the bundle small and trades one-time first-render latency for the long tail. A is also better supported by Next.js + Vercel — ISR is a first-class feature with edge-cache integration; a giant bundled JSON is not.

Option A is the **only option that finally applies the deployment-target split** that ADRs 003 and 004 already describe at the hosting level but have never been applied at the rendering level. That is the missing piece.

Option B is rejected because it is actively harmful: each successful build under the bumped timeout makes the next failure further out and more surprising, while the corpus and API-latency growth functions stay unchecked.

Option C is rejected because it sacrifices the static-HTML SEO win on read-mostly pages and the free-tier safety margin in one move.

## Consequences

**Becomes easier:**
- New repos can be ingested without considering build-time impact (long tail goes through ISR).
- Frontend perf sprint ([reporium#248](https://github.com/perditioinc/reporium/issues/248)) can target real per-page wins on a stable base.
- "Why did `/X` 404 after I merged it" debugging gets less ambiguous — build failures stop being silent at the corpus-scale tipping point.
- Fork portability becomes an **explicit policy boundary**, not an implicit one tangled with primary-prod build cost.

**Becomes harder:**
- Two code paths to maintain; CI must verify both modes. Smoke build for the GitHub Pages target should run on every PR that touches `next.config.js` or the repo page.
- Top-N tuning is a new operational dial (ranking source, cache-invalidation when ranking shifts).
- ISR cache invalidation needs a story. Initial proposal: TTL-only (e.g., 1h). Revisit if data-freshness complaints arise.

**Will need to revisit:**
- N (top-N count) — start at 250, observe Vercel build duration, adjust.
- ISR TTL — start at 1h, tune.
- Whether `getRepoEvaluation` should also be deferred for the fork build (probably yes for symmetry, but not load-bearing).
- 90-day check-in: measured Vercel build times, ISR cache hit rates, drift in N.

## Action Items

This ADR is **decision-only**. Implementation lives in its own JIRA ticket and PR.

1. [ ] Open KAN ticket: "Implement deployment-target-conditional rendering per ADR-005."
2. [ ] Implementation PR (separate from this ADR) covers:
   - [ ] `generateStaticParams()` returns top-N (configurable) for Vercel primary, full corpus for GitHub Pages target.
   - [ ] `generateMetadata` and the page body share a single `getRepoDetail` call.
   - [ ] `getRepoEvaluation` moved to a client-side fetch.
   - [ ] Env-var gate (`REPORIUM_DEPLOY_TARGET`) wired into `next.config.js`.
   - [ ] CI verifies both build targets.
   - [ ] Lint rule or build-time assertion enforcing the per-page API-call budget.
3. [ ] After the implementation lands and one full Vercel build cycle completes cleanly under the new strategy, **frontend perf sprint** [reporium#248](https://github.com/perditioinc/reporium/issues/248) can begin.
4. [ ] Revisit ADR-005 in 90 days with the metrics above.

## References

- [ADR-001](../../DECISIONS.md) — the static-export decision this ADR amends for the Vercel target.
- [ADR-003 / ADR-004](../../DECISIONS.md) — deployment-target split this ADR finally applies at the rendering layer.
- [reporium#274](https://github.com/perditioinc/reporium/pull/274) — the timeout-bump hotfix that surfaced the structural problem.
- [reporium#248](https://github.com/perditioinc/reporium/issues/248) — frontend perf sprint, blocked by this ADR.
- Vercel deploy `dpl_7Xrjrf8mQUdRLoPJvsj5Qbe1LPTJ` — the failure that motivated this ADR.
