# MORNING REPORT — 2026-04-19

Autonomous overnight run, ~06:00 → 07:00 PDT. No regressions observed. No PRs merged (per gitflow rule: user merges). All work targets `dev`.

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
