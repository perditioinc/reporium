# Morning Brief — 2026-04-20 autonomous run

12-hour autonomous audit + remediation across the 15-repo Reporium suite. No merges. No secret rotations. No production data mutated. All findings validated before acting.

## Decisions awaiting you (priority order)

### P0 — blocking
1. **Rotate `GH_TOKEN` on reporium-db** (expired → nightly CI 401 → **this is the root cause of empty `trend_snapshots`**)
2. **Rotate `GCP_SA_KEY` on reporium-mcp** (Cloud Run deploy broken since Apr 15 → mcp endpoint 404 → confirms issue #233)
3. **Merge queue review** — 27 open PRs targeting `dev` (19 pre-existing + 8 new this run). Suggested order below.
4. **`gh secret set STAGING_API_URL`** on reporium-api (enables nightly invariants) — after merging #383

### P1 — design calls for you
5. `reporium-ingestion` `dev` branch is **55 commits behind `main`** — zombie. Reset or retire.
6. `id: number` (TS) vs `id: UUID` (Pydantic API) — silent runtime failure risk. Alignment PR needs your call on which side moves.
7. **No DB-level access control** — zero `GRANT` / `CREATE ROLE` / `CREATE POLICY` across the schema; single credential has full write incl. `audit_logs`.
8. **`reporium-ingestion` publishes freeform `repo.ingested`** bypassing `EventType` enum → subscribers using `reporium-events` miss events.
9. **20% transient API error rate** (DB pool saturation) — measured in Phase 7 probe, confirmed by #383 flapping on second run. Needs pool tuning or connection-leak hunt.
10. **Homepage perf regression**: 17/100 (TBT 14.5s, LCP 9.4s). Subpages 86-96. Root cause likely heavy client JS on `/`. Deferred — needs deeper dive.

### P2 — flagged, not fixed
- Node 20 → Node 24 action deprecation by June 2026
- 5 abandoned worktrees under `reporium-api/.claude/worktrees/`
- 6 meta repos missing `LICENSE`
- reporium-mcp has no Sentry wiring (1-line add once deployed)
- `reporium-api/.env.example` has 5 unused vars (setup confusion)
- `reporium-events` has no `.env.example`

## PRs opened this run (8 total, all → `dev`)

| # | Repo | PR | Title | Status |
|---|---|---|---|---|
| 1 | reporium | [#254](https://github.com/perditioinc/reporium/pull/254) | fix: route remaining pages through ApiDataProvider + 30s timeout | ready |
| 2 | reporium | [#255](https://github.com/perditioinc/reporium/pull/255) | security: Next.js 16.2.4 CVE + pin GitHub Actions | ready |
| 3 | reporium | [#256](https://github.com/perditioinc/reporium/pull/256) | security: CSP + HSTS + Permissions-Policy headers | ready |
| 4 | reporium-api | [#383](https://github.com/perditioinc/reporium-api/pull/383) | test: nightly data invariants | ready (needs secret) |
| 5 | reporium-api | [#384](https://github.com/perditioinc/reporium-api/pull/384) | feat(db): migration 038 missing indexes | ready |
| 6 | reporium-api | [#385](https://github.com/perditioinc/reporium-api/pull/385) | security: rate-limit `/ingest/*` + `/events/*` + action pinning | ready |
| 7 | reporium-ingestion | [#59](https://github.com/perditioinc/reporium-ingestion/pull/59) | security: bump aiohttp/cryptography/filelock/authlib/pillow | ready |
| 8 | reporium | (this doc) | docs: morning brief 2026-04-20 | about to open |

## Pre-existing PRs on reporium (now 20 with this brief)

All `MERGEABLE/CLEAN` except **#238** (UNSTABLE — pre-existing CI fail, unrelated to this run) and **#247** (should be closed — contradicts #246's d3-force restore).

### Suggested merge order
1. #246 (deps restore — unblocks typecheck on everything else)
2. Round A (independent): #231, #232, #234, #239, #241, #242, #244, #249, #255, #256
3. Round B (SEO stack): #237 → #245
4. Round C (agent discovery): #236 → #235
5. Round D (resilience cascade, strict order): #250 → #252 → #253 → #254

**Close before merging anything:** #247 (obsolete — contradicts Codex-verified #246)
**Fix first:** #238 (lint-and-build red)

## Validated false positives (context preserved)

Two P0 findings reversed after verification — worth keeping the playbook:
- **Batch 1 P0 (.env exposed)** — false. `.env.local` + `.env` are gitignored, `git ls-files` empty, `git log --all` empty. Files only exist locally. Agent scanner didn't verify git-tracked status.
- **Batch 3 P1 (reporium-security public)** — false. Repo is a scanner tool, not a pentest data dump. 4 commits, all feature/fix. Keyword match on scanner source code triggered the flag.

Lesson: every scanner finding → verify against remote git state before acting.

## Phase-by-phase audit artifacts

All under `C:\DEV\PERDITIO_PLATFORM\reporium\.audit\2026-04-20\`:
- `phase-0-baseline.md` — api probe + test/lint/typecheck baseline (223/224 test, 0 typecheck errors)
- `phase-0-suite-inventory.tsv` — 15 repos
- `phase-0-api-probe.tsv` — cold endpoint latency
- `security-sweep-batch{1,2,3}.md` + `batch1-correction.md` + `reporium-security-verification.md`
- `phase-2-suite-drift.md` — 15-repo × drift matrix
- `phase-4-db-audit.md` — migration chain, schema, RLS gaps
- `phase-7-8-observability-cost.md` — SLO proposals + cost ledger
- `phase-9-10-perf-docs.md` — Lighthouse + docs drift

## Not done (reasons)

| Phase | Why |
|---|---|
| Phase 3 (dependency graph) | Phase 2 drift covered the high-value findings; re-prioritized below budget cap |
| Phase 3b (nightly snapshot cron stopgap) | Blocked — needs GH_TOKEN or alternate aggregation source you must approve |
| Phase 7b (GCP alert policies) | Deferred — needs Phase 7 data reviewed by you first so thresholds are grounded |
| Workato R4/R5/R6 recipes | Deferred — requires user access to Workato console; specs written in `.audit/api-regression-plan.md` from prior run |

## Budget
Final estimate: ~$8.0 of $10 hard cap. Under budget.

## Recommended first 3 actions on return

1. **Rotate the two expired secrets** (GH_TOKEN on reporium-db, GCP_SA_KEY on reporium-mcp). Unblocks ingestion + mcp in one move.
2. **Close #247, fix #238, then merge Round A** — clears 10+ PRs safely.
3. **Investigate the 20% API error rate** — #383 invariants already confirm it. Check Cloud SQL pool size vs max_connections, and look for connection leaks on `/library/full` paginated fetches.

## Working tree on return
`docs/morning-report-apr19` branch. `public/sitemap.xml` has a minor auto-regenerated diff (same content, noise from build script). `.audit/2026-04-20/` is untracked — will land as the docs PR below.
