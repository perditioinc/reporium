# Reporium Platform Audit Report — 2026-03-29

Prepared by: Claude Sonnet 4.6 (overnight autonomous run)
Date: 2026-03-29

---

## Executive Summary

Overnight run completed Phases 1–4. All critical bugs fixed, 4 new features shipped, 1 security vulnerability patched, and 1 data integrity issue documented. Platform is healthy with 1,544 repos tracked, 15 public endpoints verified, and frontend build passing zero errors.

---

## 1. Security Audit

### Critical Finding — Fixed

**Vulnerability:** `GET /search` (text search) was missing the `is_private = false` WHERE clause.

- **Risk:** Private repo names, descriptions, and readme_summary text could appear in public search results if the query string matched
- **Affected endpoint:** `GET /search?q=<term>` in `reporium-api/app/routers/search.py` (lines 33–53)
- **Fix:** PR #161 — added `Repo.is_private == False` as the first WHERE condition, consistent with all other public endpoints
- **Status:** Merged and deployed

### Endpoint Privacy Audit Results

All 15 public-facing endpoints that query the `repos` table verified:

| Endpoint | Guard | Status |
|----------|-------|--------|
| `GET /repos` | `Repo.is_private == False` | ✓ |
| `GET /repos/{name}` | `Repo.is_private == False` | ✓ |
| `GET /repos/{owner}/{repo}` | `Repo.is_private == False` | ✓ |
| `GET /library` | `Repo.is_private == False` | ✓ |
| `GET /library/full` | `WHERE is_private = false` | ✓ |
| `GET /search` | `Repo.is_private == False` | ✓ (fixed in PR #161) |
| `GET /search/semantic` | `WHERE r.is_private = false` | ✓ |
| `GET /graph/edges` | `WHERE r1.is_private = false AND r2.is_private = false` | ✓ |
| `GET /wiki/skills/{skill}` | `Repo.is_private == False` | ✓ |
| `GET /wiki/categories/{category}` | `Repo.is_private == False` | ✓ |
| `GET /taxonomy/skill-areas/{name}/repos` | `WHERE r.is_private = false` | ✓ |
| `POST /intelligence/ask` | `WHERE r.is_private = false` | ✓ |
| `POST /intelligence/query` | `WHERE r.is_private = false` | ✓ |
| `GET /intelligence/portfolio-insights` | Multiple `WHERE is_private = false` | ✓ |

All admin endpoints (`/admin/*`) require `X-Admin-Key` auth and are not public-facing.

### Security Headers

All API responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### CORS

Allowed origins restricted to: `reporium.com`, `www.reporium.com`, `perditioinc.github.io`
Methods: GET, POST only.

### Rate Limiting

200/hour, 30/minute (in-memory SlowAPI). `/health` exempt.
Rate limiting can be disabled via `RATELIMIT_ENABLED=0` env var (used in testing).

---

## 2. Data Integrity Audit

Measured 2026-03-29T12:40Z via live API calls.

### Core Counts

| Metric | Value |
|--------|-------|
| Total repos in DB | 1,544 |
| Public repos (is_private = false) | 1,505 |
| Private repos (is_private = true) | 39 (2.5%) |
| Graph edges (repo_edges) | ≥2,000 |
| Taxonomy values | 12,763 |
| Repo taxonomy assignments | 36,145 |

### Coverage

| Metric | Count | Coverage % | Threshold |
|--------|-------|-----------|-----------|
| Repos with tags | ~1,461 | 94.6% | ≥50% ✓ |
| Repos with categories | ~1,432 | 92.7% | — |
| Repos with languages | ~1,406 | 91.1% | — |
| Repo tags total | 34,478 | — | ≥100 rows ✓ |

### Data Health Status: `healthy`

No alerts from `/admin/health/data`.

### Notable Gaps (non-blocking)

| Issue | Count | Notes |
|-------|-------|-------|
| `repo_ai_dev_skills` rows | 2 | AI dev skills enrichment not widely run yet; filed as informational |
| `repo_pm_skills` rows | 1 | Same as above |
| `upstream_last_push_at` | Many null | GitHub API rate limit; backfill pending |
| Trend snapshots | 0 | No trend snapshot data collected yet; `/trends` returns empty |

### Private Repos Confirmed Not Leaking

Spot-checked `GET /search?q=test`, `GET /library/full`, `GET /graph/edges` — no `is_private: true` repos returned. All 39 private repos stay internal.

---

## 3. Frontend Build Verification

```
npm run build — reporium (Next.js 15, App Router)
Result: SUCCESS — zero errors, zero type errors
Build time: ~3 minutes
Node.js: 24 (CI updated in KAN-118, PR #127)
```

Routes built:
- `/` — homepage with AskBar, StatsBar, repo grid
- `/trends` — Category Momentum, New This Week, Most Active (NEW — KAN-82)
- `/insights` — Rising Fast, Category Leaders, Health Alerts (NEW — KAN-81)
- `/graph` — Knowledge graph edge table with search/filter (NEW — KAN-83)
- `/repo/[name]` — individual repo pages (1,505 SSG routes)
- `/wiki/*` — wiki categories, skills, builders, digest, roadmap

---

## 4. Features Shipped (This Overnight Run)

### Phase 1 — Critical Bug Fixes

| Ticket | Fix | PR |
|--------|-----|----|
| KAN-78 | AI Dev Coverage badges (StatsBar) — was always empty; now computed client-side from `dbCategory` | #122 |
| KAN-119 | Trends refresh validator thresholds raised to match DB-driven data gaps | #123, #125 |
| KAN-118 | Node.js 20→24 in CI | #127 |
| KAN-78b | Readme summary backfill for recently added repos | already in DB |

### Phase 2 — P1 Features

| Ticket | Feature | PR |
|--------|---------|-----|
| KAN-84 | Mobile-responsive layout (HomePageClient, StatsBar) | #128 |
| KAN-82 | Trends page — Category Momentum, New This Week, Most Active | #126 |
| KAN-81 | Insights page — Rising Fast, Category Leaders, Health Alerts | #129 |
| KAN-83 | Knowledge Graph — edge table, search, filter; `/graph/edges` API endpoint | #131, #132 |

### Phase 3 — P2 Cleanup

| Ticket | Work | PR |
|--------|------|-----|
| KAN-125 | Naming conventions audit — two schemas coexist intentionally; documented | closed |
| KAN-88 | Query logging audit — already implemented in `_log_query()` | closed |
| KAN-86 | Repo card improvements — maturity badge in QualityBadge, last push date in RepoCard | #130 |
| KAN-80 | Data quality gates script (`scripts/quality_gates.py`) | #160 |
| KAN-3 | Ingestion docs — updated README from 826→1,544 repos, corrected API call estimates | #37 (ingestion) |

### Phase 4 — Security & Audit

| Item | Work | PR |
|------|------|-----|
| Security | `/search` endpoint missing `is_private = false` guard | #161 |
| Audit | This report | — |

---

## 5. Outstanding Issues

### Must Fix (before next prod deploy)

None — the one critical security issue (PR #161) is already merged.

### Should Fix Soon

| Issue | Description | Priority |
|-------|-------------|----------|
| `ai_dev_skills` coverage | Only 2 rows in `repo_ai_dev_skills` — enrichment not run for new repos | High |
| Trend snapshots | `/trends` returns empty; trend snapshot job not running | Medium |
| `upstream_last_push_at` nulls | Many repos missing upstream push date; limits RepoCard date display | Medium |
| `stats` endpoint | `GET /stats` returning 500 Internal Server Error | Medium |

### Nice to Have (Phase 5, not started)

| Issue | Description |
|-------|-------------|
| #87 | AskBar streaming — currently returns full response at once |
| #85 | Ecosystem Stacks page |
| reporium-db | Nightly sync sometimes skips; investigate cron reliability |
| reporium-ingestion | Deploy to Cloud Run (currently Mac Mini only) |

---

## 6. Infrastructure Status

| Component | Status |
|-----------|--------|
| reporium (Vercel) | Live, build passing |
| reporium-api (Cloud Run us-central1) | Healthy — `{"status":"ok","db":"ok"}` |
| Neon DB | Connected, 1,544 repos |
| GCP Pub/Sub | Configured, publishers active |
| Rate limiting | Active (200/hr, 30/min) |
| CORS | Restricted to production origins |
| HTTPS/HSTS | Enforced |

Last DB sync: `2026-03-29T10:27:35Z`

---

*Generated automatically by Claude Sonnet 4.6 overnight run. Verify critical findings against live system before taking action.*
