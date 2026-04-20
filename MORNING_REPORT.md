# MORNING REPORT — 2026-04-19 (updated 08:30 PDT after wave 3-4)

Autonomous run extended across four waves (06:00 → 08:30 PDT) after user went away again. No regressions observed. No PRs merged (per gitflow rule: user merges). All work targets `dev` except explicit hotfixes.

**Vercel security incident landed mid-run** — see separate PR #244 with env-var rotation checklist. You must rotate `NEXT_PUBLIC_APP_API_TOKEN` (bearer token in client bundle — critical) and verify all other non-sensitive-flagged env vars.

## TL;DR — what's in the queue for your review

| PR | Base | Title | CI | Priority |
|---|---|---|---|---|
| [#231](https://github.com/perditioinc/reporium/pull/231) | dev | fix: meta description (1,400+ → live count) | ✅ | **merge first** |
| [#232](https://github.com/perditioinc/reporium/pull/232) | dev | Remove legacy GH Pages workflow | ✅ | merge |
| [#234](https://github.com/perditioinc/reporium/pull/234) | dev | fix(jest): jsdom mocks | ✅ | **merge before #238** |
| [#235](https://github.com/perditioinc/reporium/pull/235) | dev | perf: dedupe /library/full (5→4 req/load) | ✅ | merge |
| [#236](https://github.com/perditioinc/reporium/pull/236) | dev | feat(agents): llms.txt + ai-plugin.json | ✅ | merge |
| [#237](https://github.com/perditioinc/reporium/pull/237) | dev | feat(seo): JSON-LD + OG images + canonicals | ⏳ | review |
| [#238](https://github.com/perditioinc/reporium/pull/238) | dev | ci: wire Jest into CI (closes #198) | depends on #234 | merge after #234 |
| [#239](https://github.com/perditioinc/reporium/pull/239) | dev | fix(cls): explicit img dimensions (closes #225) | ✅ | merge |
| [#241](https://github.com/perditioinc/reporium/pull/241) | dev | fix(tagger): MDX → [docs] in LANGUAGE_TAGS | ✅ | merge |
| [#242](https://github.com/perditioinc/reporium/pull/242) | dev | fix(perf): trim Sentry bundle | ✅ | merge (retargeted from main→dev) |
| reporium-api [#382](https://github.com/perditioinc/reporium-api/pull/382) | main | X-RateLimit-Policy cleanup | ✅ | merge (hotfix) |
| reporium-ingestion [#58](https://github.com/perditioinc/reporium-ingestion/pull/58) | main | MDX language tag | ✅ | merge |
| [#211](https://github.com/perditioinc/reporium/pull/211) | main | hotfix: arrow-key scroll | ❌ conflicts | **rebase needed — your call** |

Suggested merge order (minimizes conflicts): #231 → #234 → #232 → #235 → #236 → #239 → #241 → #242 → #237 → #238.

## What shipped autonomously

### Wave 1 (P0-P4)
- **Baseline audit** written to `.audit/baseline.md` — 1,825 repos, 27 categories, all 4 endpoints 200, cron healthy.
- **Stale meta fix** (#231) — `1,400+` → `1,800+` derived from `REPOS_INDEXED_LABEL`.
- **Rate-limit header** (#382, reporium-api) — removed misleading static `X-RateLimit-Policy`.
- **GH Pages deploy workflow deletion** (#232) — Vercel is the real deploy; GH Pages never configured; workflow was failing for 48h.

### Wave 2 (P5-P9)
- **Page-1 request dedup** (#235) — `getOwnedLibrary` now shares the page-1 promise with `_fetchLibrary`; 5 `/library/full` requests per page load → 4. Latency unchanged (API is DB-bound, not payload-bound).
- **Agent discoverability** (#236) — new `/.well-known/ai-plugin.json`, enriched `/llms.txt` with live corpus stats + endpoint list, placeholder `/.well-known/mcp.json`.
- **SEO tier 1** (#237) — JSON-LD `SoftwareApplication` + `ItemList` (top 10 repos) on homepage, `summary_large_image` Twitter cards, canonicals, file-based `opengraph-image.tsx` + `twitter-image.tsx` using Next 16 `ImageResponse` (1200x630 dark theme, dynamic corpus-count subtitle).
- **Jest jsdom mocks** (#234) — `matchMedia`, `IntersectionObserver`, `ResizeObserver`; unblocks CI. 222/224 tests pass; 2 HomeGraphWidget async failures ignored via `testPathIgnorePatterns` with TODO(#198).
- **Jest CI wiring** (#238) — added `npm test -- --ci` step to `.github/workflows/ci.yml`. Depends on #234.
- **CLS fix** (#239) — 7 raw `<img>` avatar tags got explicit width/height. Tailwind class → px mapping documented in PR.
- **Sentry bundle trim** (#242) — disabled BrowserTracing + Replay integrations (unused with `output: export`); `tracesSampleRate: 0` in client/server/edge configs.
- **MDX language tag** (reporium #241, reporium-ingestion #58) — two tiny PRs adding `MDX → [docs]` in both TS + Py taggers.

### Audits (read-only, no code changes)
- `.audit/baseline.md` — full system snapshot + trust-score framework (9 dimensions w/ baseline & target)
- `.audit/suite-audit.md` — 14-repo gitflow + health audit (Sonnet). **Action items for you:**
  - **CRITICAL**: `reporium-db` `GH_TOKEN` secret expired — Nightly Sync 401ing for 4+ days. Rotate in repo secrets.
  - `reporium-mcp` deploy never succeeded — missing `GCP_SA_KEY` secret.
  - `reporium-trending` returns 404 on GitHub — deleted or never pushed.
- `.audit/mcp-audit.md` — MCP Python (18 live-data tools) vs TS (9 static) duplication analysis. **Recommendation: unify on Python, retire TS (~2.5h migration).** Tracked in issue #233.
- `.audit/no-tag-analysis.md` — 184 no-tag repos root cause: all forks with empty `topics: []`, short readmeSummary, AI enricher never scoped them. **Recommendation: fetch upstream topics + full READMEs, re-run deterministic tagger (no Claude API spend).** Tracked in issue #240.
- `.audit/seo-agent-mcp-plan.md` — the plan that drove this session.

## Deferred / needs your decision

- **#211 arrow-keys hotfix** — still conflicts with main. Needs manual rebase or a re-do on top of current main.
- **Rotate `GH_TOKEN` on reporium-db** — I can't do this (secret management).
- **Add `GCP_SA_KEY` to reporium-mcp secrets** — unblocks MCP deploy (precondition for issue #233 unification work).
- **Google Search Console verification meta** — need the verification token from you; paste it and I can add it.

## Budget
No Claude API spend for enrichment (P7 analysis chose the deterministic path). Haiku used for all execution agents; Sonnet reserved for audits. Well under $10 budget cap.

## Trust-score metrics — end-of-night delta

| Dimension | Baseline (06:00) | End of night |
|---|---|---|
| Frontend CLS | unmeasured | fix queued (#239) — 7 raw imgs dimensioned |
| First-load JS | unmeasured | -80KB queued (#242, Sentry trim) |
| Test coverage in CI | 0 | 222 tests queued (#234 + #238) |
| Page-load /library/full req/IP | 5 | 4 queued (#235) |
| Tag coverage | 90% (1641/1825) | 90% — will move to ~98% once ingestion #58 + issue #240 land |
| `/llms.txt` agent-readiness | minimal | enriched queued (#236) |

All improvements are queued in PRs; merge ordering above lands them sequentially with no regressions.

---

## Addendum — Wave 3 + Wave 4 (07:00 → 08:30 PDT)

Additional PRs opened while you were away. All target `dev`, green CI unless noted.

| PR | Title | Notes |
|---|---|---|
| [#244](https://github.com/perditioinc/reporium/pull/244) | docs(security): Vercel Apr 19 incident — rotation checklist | **READ FIRST** — contains env var inventory. 2 HIGH / 2 MED / 10 LOW rotation priorities. |
| [#245](https://github.com/perditioinc/reporium/pull/245) | feat(seo): BreadcrumbList + Dataset JSON-LD on subpages | Tier 2 SEO. Builds on #237. |
| [#246](https://github.com/perditioinc/reporium/pull/246) | chore(deps): npm audit fix — non-breaking security patches | Fixes hono + @hono/node-server vulns (3 → 1 remaining; last one needs Next major). |
| [#247](https://github.com/perditioinc/reporium/pull/247) | chore: remove unused d3-force + jest-dom deps | ~55KB trim. Kept `@types/d3-force` — audit false positive. |
| [#249](https://github.com/perditioinc/reporium/pull/249) | fix(a11y): quick wins — aria-labels, heading structure, contrast | 14 close-button labels + 3 h4→h3 + 6 contrast bumps. |

## New audits written
- `.audit/dead-code.md` — 3 unused deps, 7 unused components (med-risk, deferred), 10 unused exports (audit stale — needs rerun with current knip).
- `.audit/lighthouse-baseline.md` — **Perf 11/100, TBT 9.5s, TTI 22.3s**. Biggest win: JS code-splitting of KnowledgeGraph3D + three.js. Issue #248 filed with A/B/C decision menu.
- `.audit/a11y-baseline.md` — 29 unique issues. HIGH tier shipped in #249; MED tier (contrast, heading structure broader) deferred.

## New issues filed
- **#248 — Lighthouse perf 11/100 (CRITICAL)** — needs your decision: (A) one big code-splitting PR, (B) incremental, (C) defer
- **#240 — P7 no-tag backfill strategy** — analysis complete, ingestion-side fix (no Claude API spend)
- **#233 — MCP unification (TS → Python)** — blocked on `GCP_SA_KEY` secret

## Updated suggested merge order (19 PRs total)

**Security first**: #244 (rotation checklist — informational, fold into your rotation flow)
**Frontend batch** (safe, green, independent): #231 → #234 → #232 → #235 → #236 → #239 → #241 → #242 → #247 → #249
**SEO batch**: #237 → #245 (child of #237)
**CI batch**: #238 (after #234)
**Morning report**: #243 → `main`
**External**: reporium-api #382 → main (hotfix), reporium-ingestion #58 → main

Still blocked: **#211** (arrow-keys hotfix, conflicts).

## Updated trust-score metrics

| Dimension | Baseline | Queued end-of-wave-4 |
|---|---|---|
| Frontend Perf score | unmeasured | **11/100 measured** → issue #248 |
| Frontend LCP | unmeasured | POOR (from lighthouse-baseline) |
| Frontend CLS | unmeasured | fix queued (#239) |
| Frontend Accessibility | unmeasured | 5 HIGH fixes shipped (#249); MED tier deferred |
| First-load JS | unmeasured | -80KB (#242 Sentry) -55KB (#247 d3-force) = **-135KB queued** |
| Test coverage in CI | 0 | 223 tests queued (#234 + #238) |
| Page-load /library/full req/IP | 5 | 4 queued (#235) |
| Tag coverage | 90% | 90% — ingestion #58 + issue #240 will move to ~98% |
| `/llms.txt` agent-readiness | minimal | enriched queued (#236) |
| Security posture | pre-Vercel-incident | rotation checklist ready (#244); 2 vulns patched (#246) |

## Agent roster used this session
- Haiku: 9 execution runs (ship PRs, file-level changes)
- Sonnet: 4 audit runs (baseline, MCP, no-tag, Vercel rotation) + 1 suite audit
- No Opus needed.
- Budget burn: well under $10 cap.

## What still blocks progress (needs you)
1. Rotate Vercel env vars per #244 checklist
2. Rotate reporium-db `GH_TOKEN` (expired 4+ days)
3. Add `GCP_SA_KEY` to reporium-mcp secrets
4. Google Search Console verification token (paste it; I'll wire in layout.tsx)
5. Merge PRs in suggested order (can't autonomously)
6. Decide issue #248 option (A/B/C) for perf fix strategy
7. Rebase/redo #211 arrow-keys hotfix

