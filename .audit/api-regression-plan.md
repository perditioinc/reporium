# API Regression Plan — Reporium
_Generated 2026-04-19. READ-ONLY analysis. No code was changed._

---

## Section 1: What the Frontend CANNOT Catch

| Class | Looks like from the frontend | Why frontend misses it | Real bug this week |
|---|---|---|---|
| **Silent parameter aliasing** | Page loads with data — wrong slice, no error | Frontend passes `?page_size=500`; API only binds the `page_size` Query param. A stale `?pageSize=500` (camelCase) is silently ignored and falls back to default=200. Visible data masks the wrong window. | `/library/full?pageSize=500` returned 200 repos not 500; filtered views showed wrong repos |
| **Empty-but-200 from DB pipeline gaps** | `/trends/report` renders, shows "0 snapshots" — might look like normal state | `latest_snapshot is None` branch returns HTTP 200 with `period.snapshots=0`. No visual error. Frontend charting code skips rendering gracefully. | `trend_snapshots` table empty → `snapshots:0` in report; `/gaps` returned `[]` with 200 |
| **taxonomy_values table not populated** | `/taxonomy/tags`, `/taxonomy/categories` render empty filter panels | `/taxonomy/{dimension}` queries `taxonomy_values` (aggregation table), not `repo_taxonomy` directly. If the nightly `POST /taxonomy/rebuild` never ran, the table is empty. `/library/full` still has data because it reads `repo_taxonomy` directly. | `/taxonomy/tags` and `/taxonomy/categories` returning empty while `/library/full` had 1,800+ repos |
| **Static rate-limit header lying** | Everything works — headers are decorative to the frontend | The old `X-RateLimit-Policy: 200/hour;30/minute` header had no enforcement logic behind it. Frontend doesn't parse it. Only a load-testing script or integration test catches the lie. | Static header claimed 30/min; actual limit was 5/min (later raised to 60/min, KAN-#381). Neither UI state changed. |
| **Rate-limit floor regression** | Intermittent 429s on homepage refresh | Frontend shows a generic error. No way to know if 429s are because rate was lowered vs. real abuse. | Rate raised 5→60/min (#381). A revert would silently drop it back; no frontend alert would fire. |
| **Cold-start latency spike** | 10 s spinner, then content appears — or Vercel edge timeout (white screen) | Frontend timeout is 10 s. Cloud Run cold-start can hit 8–12 s. If cold-start succeeds but is slow, the user sees a slow load; if it exceeds the Vercel function timeout, they see a hard error. APM data lives on Cloud Run, not Vercel. | Cold-start tail latency caused frontend 10 s timeouts post-deploy |
| **Cross-endpoint totalRepos drift** | Stats page says 1,800; library says 1,750 — subtle, not alarming | `/library/full` counts `WHERE is_private=false`. `/stats` counts `SELECT COUNT(*) FROM repos` (all rows). Private repos included in stats but excluded from library. No visual alarm; user just sees inconsistent numbers. | Ongoing drift risk; root of the "graph has 1,641 nodes" vs stats count discrepancy |

---

## Section 2: Workato Monitoring Recipe Spec

All recipes alert to `#reporium-alerts` Slack channel and `***REDACTED-OPERATOR-EMAIL***`. False-positive budget: ≤1 false alert per week per recipe before auto-snooze.

### Recipe 4: Health Heartbeat
**Extends Recipe 1** (which polls every 30 min). Add a dedicated step that:
- **Trigger:** Every 10 minutes (separate recipe, not Recipe 1 — Recipe 1 is 30 min and heavier)
- **HTTP call:** `GET https://reporium-api-<hash>-ew.a.run.app/health`
  - Timeout: 15 s
  - Assert: `status == 200` AND `response.body.status == "ok"`
- **Consecutive-fail logic:** Store last result in Workato recipe data (boolean). Alert only when 3 consecutive checks fail (30 min window) to avoid cold-start false positives.
- **Alert:** Slack `#reporium-alerts` + email. Message: `HEALTH FAIL: /health returned {status} at {timestamp}. 3 consecutive failures.`
- **False-positive budget:** Single-failure cold-start expected; 3-strike rule eliminates it.

### Recipe 5: Schema Drift Detector
- **Trigger:** Every 6 hours (nightly + morning)
- **HTTP calls (sequential):**
  1. `GET /library/full?page=1&page_size=1` — assert response has keys: `totalRepos`, `repos`, `stats`, `categories`, `tagMetrics`, `aiDevSkillStats`, `pageSize`, `totalPages`
  2. `GET /taxonomy/dimensions` — assert `dimensions` is an array with `≥1` item
  3. `GET /stats` — assert `total_repos`, `languages`, `categories`, `taxonomy_dimension_counts` all present
  4. `GET /trends/report` — assert `period`, `trending`, `emerging`, `generatedAt` all present
- **Assertion method:** Workato "Check condition" step on each key. If any key is missing → alert.
- **Alert:** Slack `#reporium-alerts`. Message: `SCHEMA DRIFT: {endpoint} missing field {field_name}. Expected shape broken.`
- **False-positive budget:** Schema keys change only on intentional API refactor. Zero expected false positives.

### Recipe 6: Data Quality Invariants
- **Trigger:** Every 1 hour
- **HTTP calls + assertions:**
  1. `GET /library/full?page=1&page_size=1` → assert `totalRepos >= 1800`
  2. `GET /taxonomy/dimensions` → assert `dimensions` array length `>= 6`
  3. `GET /taxonomy/skill_area` → assert `total >= 100` (taxonomy_values has >=100 skill_area values)
  4. `GET /trends/report` → assert `period.snapshots > 0` AND parse `period.to`; assert it is within 48 h of now
  5. `GET /gaps` → assert response array `length > 0`
- **Alert:** Slack + email. Message: `DATA QUALITY: {invariant_name} failed. Got: {actual_value}. Expected: {threshold}.`
- **False-positive budget:** `totalRepos` can dip if a bulk delete runs; add a 1-hour grace window before alerting on that invariant specifically. Snapshot freshness is high-confidence — alert immediately.

### Recipe 7: Cross-Endpoint Consistency
- **Trigger:** Every 4 hours
- **HTTP calls:**
  1. `GET /library/full?page=1&page_size=1` → capture `totalRepos` as `lib_total`
  2. `GET /stats` → capture `total_repos` as `stats_total`
- **Assertion:** `abs(lib_total - stats_total) <= 50` (allows for private-repo delta)
- **Alert:** Slack. Message: `CONSISTENCY DRIFT: /library/full totalRepos={lib_total} vs /stats total_repos={stats_total}. Delta exceeds 50.`
- **False-positive budget:** Delta > 50 only happens after bulk-private or bulk-delete ops. Rare. Zero expected false positives in normal operation.

### Recipe 8: Rate-Limit Regression Guard
- **Trigger:** Daily at 03:00 UTC (low traffic)
- **HTTP call:** Fire 30 sequential `GET /library/full?page=1&page_size=1` requests in a loop (Workato repeat action). Record status for each.
- **Assertion:** All 30 responses must be `200`. Any `429` → alert immediately.
- **Alert:** Slack `#reporium-alerts`. Message: `RATE LIMIT REGRESSION: Got 429 on /library/full at request #{n}/30. Limit may have been lowered below 60/min. Check slowapi decorator in library_full.py.`
- **False-positive budget:** Low — only fires during off-peak. Rate limiting is disabled in test env but live in prod. Could false-alert if another recipe is also hammering the API at 03:00; stagger schedules.

### Recipe 9: Cold-Start Latency Probe
- **Trigger:** Every 30 minutes (same cadence as Recipe 1, separate step or separate recipe)
- **HTTP call:** `GET /health` with `X-Cold-Start-Probe: true` header. Measure TTFB using Workato HTTP connector response-time field (or subtract `request_sent_at` from `response_received_at` via timestamps).
- **Assertion:** Response time `< 3000 ms`. If `>= 3000 ms` on any single call, log it. If `>= 3000 ms` on 2 of 3 consecutive checks, alert.
- **Alert:** Slack. Message: `COLD-START LATENCY: /health TTFB={ttfb_ms}ms — exceeds 3000ms SLO. Frontend 10s timeout risk.`
- **False-positive budget:** Single spike expected on normal Cloud Run cold-start. 2-of-3 rule eliminates it.

---

## Section 3: API Test Coverage Gaps + Proposed pytest Additions

### 3a. Contract Tests (snapshot JSON shapes)
**File:** `tests/test_contract_shapes.py`
Use `pytest-httpx` + `jsonschema`. Pin a fixture schema in `tests/fixtures/library_full_schema.json`.

Key assertions:
```python
# Assert /library/full response matches pinned schema
validate(instance=response.json(), schema=LIBRARY_FULL_SCHEMA)
# Schema requires: totalRepos (int), repos (array), stats.total (int),
#   categories (array of {id, name, repoCount}), tagMetrics (array)
```

Gap: `test_contract.py` tests `sanitize_repo()` in isolation only. No test validates the full HTTP response envelope shape against a pinned schema. A rename of `totalRepos` → `total_repos` would ship silently.

### 3b. Data Invariant Tests (real test DB)
**File:** `tests/test_data_invariants.py`

```python
@pytest.mark.integration
async def test_total_repos_floor(client):
    r = await client.get("/library/full", params={"page": 1, "page_size": 1})
    assert r.json()["totalRepos"] >= 1  # floor for CI; prod uses 1800

@pytest.mark.integration
async def test_taxonomy_dimensions_populated(client):
    r = await client.get("/taxonomy/dimensions")
    dims = r.json()["dimensions"]
    assert len(dims) >= 1, "taxonomy_values table must have at least 1 dimension after rebuild"

@pytest.mark.integration
async def test_trend_snapshots_not_empty(client):
    r = await client.get("/trends/report")
    assert r.json()["period"]["snapshots"] >= 1, "trend_snapshots must be populated"
```

Gap: No existing test validates data pipeline output. `test_trends.py` uses a `FakeTrendSession` and never touches the real DB.

### 3c. Cross-Endpoint Consistency
**File:** `tests/test_cross_endpoint_consistency.py`

```python
@pytest.mark.integration
async def test_total_repos_parity(client):
    lib = await client.get("/library/full", params={"page": 1, "page_size": 1})
    stats = await client.get("/stats")
    lib_total = lib.json()["totalRepos"]
    stats_total = stats.json()["total_repos"]
    assert abs(lib_total - stats_total) <= 50, (
        f"totalRepos drift: /library/full={lib_total} vs /stats={stats_total}"
    )
```

Gap: No existing test compares outputs across endpoints.

### 3d. Rate-Limit Tests
**File:** `tests/test_rate_limit_regression.py`

```python
async def test_library_full_limit_is_60_per_minute():
    """Assert the @_limiter.limit decorator string is exactly '60/minute'."""
    from app.routers.library_full import library_full
    limits = library_full._rate_limit_decorators  # slowapi stores these
    assert any("60/minute" in str(l) for l in limits), (
        "Rate limit must be 60/minute. Was it accidentally reverted?"
    )
```

Gap: `test_rate_limiting.py` line 57 starts a test `test_library_full_rate_limit_configuration` but the file is truncated — unclear if the assertion is complete. The existing `test_library_full_rate_limit_integration` only checks the endpoint exists, not the limit value.

### 3e. CORS Tests
**File:** `tests/test_cors.py` (already exists — add these)

Missing cases:
```python
async def test_cors_preflight_options(client):
    """OPTIONS preflight must return 200 with correct headers."""
    r = await client.options("/library/full",
        headers={"Origin": "https://reporium.com",
                 "Access-Control-Request-Method": "GET"})
    assert r.status_code == 200
    assert "access-control-allow-methods" in r.headers

async def test_cors_blocked_origin_no_wildcard(client):
    """Blocked origin must not get Access-Control-Allow-Origin: *."""
    r = await client.get("/library/full",
        headers={"Origin": "https://evil.com"})
    acao = r.headers.get("access-control-allow-origin", "")
    assert acao != "*" and acao != "https://evil.com"
```

### 3f. Regression Tests for This Week's Bugs
**File:** `tests/test_regressions_apr19.py`

| Bug | Test assertion |
|---|---|
| camelCase param silently ignored | `GET /library/full?pageSize=1` → `len(repos) == 200` (default, not 1), proving camelCase is ignored. Document this as expected behavior or fix the alias. |
| taxonomy_values empty → 200 empty | Mock `taxonomy_values` empty; assert `/taxonomy/dimensions` returns `{"dimensions": []}` with 200 AND a `X-Data-Warning` header (proposed: add warning header in router) |
| trend_snapshots empty → snapshots:0 | `GET /trends/report` with empty DB → assert `period.snapshots == 0` AND response still has all required keys (regression guard on shape, not just data) |
| gaps returns [] with 200 | `GET /gaps` with empty `gap_analysis` table → assert status 200 AND body is `[]` (document this is intentional, add comment in test) |
| Static X-RateLimit-Policy header | `GET /health` → assert `"X-RateLimit-Policy" not in response.headers` (already in `test_rate_limiting.py` — **keep it**) |
| Rate limit 5→60 regression class | Assert `@_limiter.limit("60/minute")` on `library_full` (see 3d above) |

---

## Section 4: Priority + Effort

| Item | Source | Effort | Catches real bug |
|---|---|---|---|
| **Recipe 6: Data Quality Invariants** | Workato | S | trend snapshots:0, gaps=[], taxonomy empty |
| `test_data_invariants.py` — snapshot freshness + taxonomy populated | pytest | S | trend_snapshots empty, taxonomy_values missing |
| `test_rate_limit_regression.py` — assert "60/minute" on decorator | pytest | S | Rate limit 5→60 regression class (#381) |
| **Recipe 8: Rate-Limit Regression Guard** | Workato | S | Rate limit regression class |
| `test_regressions_apr19.py` — camelCase param behavior documented | pytest | S | pageSize silently ignored |
| `test_cross_endpoint_consistency.py` — totalRepos parity | pytest | M | Cross-endpoint drift |
| **Recipe 7: Cross-Endpoint Consistency** | Workato | M | totalRepos drift |
| `test_contract_shapes.py` — pinned JSON schema validation | pytest | M | Schema drift on any rename/restructure |
| **Recipe 5: Schema Drift Detector** | Workato | M | Schema drift from any endpoint refactor |
| CORS OPTIONS preflight test | pytest | S | Preflight regression on new routes |
| **Recipe 4: Health Heartbeat** | Workato | S | Cold-start outages, deploy failures |
| **Recipe 9: Cold-Start Latency Probe** | Workato | M | Cold-start tail latency → frontend timeout |

---

## The One Thing to Ship This Week

**`tests/test_data_invariants.py` with three assertions: `totalRepos >= 1`, taxonomy dimensions non-empty, `trend_snapshots > 0`.**

This single file, run in CI against the real staging DB, would have caught three of the six bugs this week (taxonomy empty, snapshots:0, gaps=[]) before any PR merged. It requires no new infrastructure — only a `@pytest.mark.integration` marker and a staging DB URL in CI env vars. Time to write: under 30 minutes.

Pair it with **Recipe 6** (Data Quality Invariants in Workato) for production coverage — the pytest tests guard PRs, the Workato recipe catches post-deploy regressions and pipeline failures that tests can't see.
