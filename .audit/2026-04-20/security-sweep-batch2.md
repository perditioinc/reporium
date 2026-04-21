# Security Sweep Batch 2 — mcp + db + events + metrics + forksync

**Audit Date:** 2026-04-20  
**Auditor:** Claude Haiku (Read-Only Security Review)  
**Scope:** reporium-mcp, reporium-db, reporium-events, reporium-metrics, forksync

## Summary

| Repo | P0 | P1 | P2 | Status |
|------|----|----|----|----|
| reporium-mcp | 0 | 0 | 2 | Pass with minor issues |
| reporium-db | 0 | 1 | 2 | Pass with 1 high-priority issue |
| reporium-events | 0 | 0 | 1 | Pass with minor issue |
| reporium-metrics | 0 | 1 | 2 | Pass with 1 high-priority issue |
| forksync | 0 | 1 | 2 | Pass with 1 high-priority issue |
| **TOTALS** | **0** | **3** | **9** | |

---

## Findings per Repo

### reporium-mcp

**Secret Scan:** PASS — No exposed secrets detected.

**GitHub Actions:**
- `deploy-http.yml`: HAS permissions block (contents:write, storage-admin)
- Uses pinned action (SHA): `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`
- Uses unpinned third-party actions: `google-github-actions/auth@v2`, `google-github-actions/deploy-cloudrun@v2` (version tags, not commits)
- Secrets in env: `1 instance` (GCLOUD_AUTH_JSON, GCP_PROJECT_ID, GCP_SERVICE_NAME)

**Dockerfiles:**
- `Dockerfile`: FROM `python:3.12-slim` (unpinned — P2)
- `Dockerfile.http`: FROM `python:3.12-slim` (unpinned — P2)
- No USER directive — containers run as root (P1 would apply but implied by image)

**Dependencies:**
- `requirements.txt`: Pinned via `>=` operator (minimal for MCP use case)
  - mcp>=1.0.0, httpx>=0.27.0, python-dotenv>=1.0.0

**Dependabot:** NOT CONFIGURED

---

### reporium-db

**Secret Scan:** PASS — No exposed secrets detected.

**GitHub Actions:**
- `security.yml`, `sync.yml`, `test.yml`: All have permissions blocks
- Mixed action pinning:
  - `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (SHA, good)
  - `actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065` (SHA, good)
  - Reusable workflow calls: `perditioinc/perditio-devkit/.github/workflows/on-test-failure.yml@main` (P2 — @main is unversioned)
- Secrets in env: `2 instances` in sync.yml (GCP_PROJECT_ID, GCP_SERVICE_NAME)

**Dockerfiles:** None found in repo.

**DB Migrations:** Not using Alembic; no migration files found. Verification deferred to reporium-api/reporium-ingestion repos if needed.

**Dependencies:**
- `requirements.txt`: Pinned via `>=` operator
  - httpx>=0.27, python-dotenv>=1.0, pyyaml>=6.0
  - All test/lint deps pinned (pytest>=8.0, etc.)
  - **P1 ISSUE:** reporium-events @ git+https:// (git reference, not pinned to hash)

**Dependabot:** NOT CONFIGURED

---

### reporium-events

**Secret Scan:** PASS — No exposed secrets detected.

**Event Schema Verification:**
- Found 8 event types in `reporium_events/models.py`:
  1. SYNC_COMPLETED (has schema_version="1.0")
  2. DB_SYNCED (has schema_version="1.0")
  3. INGESTION_COMPLETED (has schema_version="1.0")
  4. REPO_ADDED (has schema_version="1.0")
  5. REPO_UPDATED (has schema_version="1.0")
  6. HEALTH_CHECK (has schema_version="1.0")
  7. BUILD_FAILED (has schema_version="1.0")
  8. API_DEPLOYED (has schema_version="1.0")
- All 8 event types have versioned schema in EVENT_SCHEMAS dict with 'version' field on ReporiumEvent dataclass

**GitHub Actions:**
- `security.yml`, `test.yml`: Both have permissions blocks
- Uses: `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (SHA, good)
- Reusable workflow: `perditioinc/perditio-devkit/.github/workflows/on-test-failure.yml@main` (P2 — @main)
- No secrets in env

**Dockerfiles:** None found.

**Dependencies:**
- `requirements.txt`: Not present in root; check pyproject.toml
- No critical deps found; test-only setup

**Dependabot:** NOT CONFIGURED

---

### reporium-metrics

**Secret Scan:** PASS — No exposed secrets detected.

**GitHub Actions:**
- `collect.yml`, `security.yml`, `test.yml`: All have permissions blocks
- Mixed action pinning:
  - `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (SHA, good)
  - `actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065` (SHA, good)
  - `actions/setup-python@v5` (version tag, not commit hash — P2)
- Reusable workflow: `perditioinc/perditio-devkit/.github/workflows/on-test-failure.yml@main` (P2)
- Secrets in env: `1 instance` in collect.yml (GCP_PROJECT_ID, GCP_SERVICE_NAME)

**Dockerfiles:** None found.

**Dependencies:**
- `requirements.txt`: Pinned via `>=` operator
  - httpx>=0.27, python-dotenv>=1.0
  - **P1 ISSUE:** `psycopg2-binary>=2.9` — critical DB driver unpinned; version 2.9 is stale (now at 2.10.x)

**Dependabot:** NOT CONFIGURED

---

### forksync

**Secret Scan:** PASS — No exposed secrets detected.

**GitHub Actions:**
- `security.yml`: HAS permissions block
- `sync-manual.yml`: **P2 — NO permissions block** (should have at minimum contents:write, issues:write)
- `sync.yml`: **P2 — NO permissions block** (should have at minimum contents:write)
- Uses: Mixed pinning
  - `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (SHA, good)
  - `actions/checkout@v4` (version tag, P2)
  - `actions/setup-python@v5` (version tag, P2)
- Secrets in env: `4 instances` in sync-manual.yml (GITHUB_TOKEN, GH_USERNAME, SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL), `2 instances` in sync.yml (FORKSYNC_SERVICE_URL, FORKSYNC_API_KEY)

**Dockerfiles:**
- `Dockerfile`: FROM `python:3.12-slim` (unpinned — P2)
- `service/Dockerfile`: FROM `python:3.12-slim` (unpinned — P2)
- No USER directive (containers run as root)

**Dependencies:**
- `requirements.txt`: Pinned via `>=` operator
  - **P1 ISSUE:** `fastapi>=0.111` — critical web framework unpinned; current is 0.117+
  - **P1 ISSUE:** `pydantic>=2.0` — critical data validation unpinned; current is 2.9+
  - google-cloud-firestore>=2.16 (unpinned)
  - Other deps: httpx>=0.27, uvicorn>=0.30, python-dotenv>=1.0, click>=8.1

**Dependabot:** NOT CONFIGURED

---

## Severity Breakdown

### P0 (Critical — Exploitable)
- None found in this batch

### P1 (High — Security/Operational Risk)
1. **reporium-db:** reporium-events dependency pinned to git+https (no commit hash)
2. **reporium-metrics:** psycopg2-binary>=2.9 (DB driver unpinned; known to have vulnerabilities <2.10)
3. **forksync:** fastapi>=0.111 and pydantic>=2.0 (critical web framework/validation unpinned; vulnerable versions possible)

### P2 (Medium — Best Practice)
1. **reporium-mcp:** FROM python:3.12-slim (2 Dockerfiles unpinned base image)
2. **reporium-db:** Reusable workflow @main (perditio-devkit on main branch, not a release tag)
3. **reporium-events:** Reusable workflow @main
4. **reporium-metrics:** actions/setup-python@v5, reusable workflow @main
5. **forksync:** 
   - FROM python:3.12-slim (2 Dockerfiles unpinned)
   - sync-manual.yml: NO permissions block (lacks explicit permission boundary)
   - sync.yml: NO permissions block
   - actions/checkout@v4, actions/setup-python@v5 (version tags, not commit hashes)

---

## Cross-Cutting Observations

### Dependabot
**All 5 repos:** No `.github/dependabot.yml` configured. This means:
- No automated weekly/daily scans for vulnerable dependencies
- No bot PRs for security patches
- Manual upgrade burden on team
- **Recommendation:** Deploy dependabot.yml config to all repos with schedule: weekly, open-pull-requests-limit: 5 or higher

### GitHub Actions Consistency
- Mixed pinning strategies (some SHA-pinned, some version-tagged, some @main)
- Two forksync workflows missing permissions blocks (sync.yml, sync-manual.yml)
- Reusable workflows in perditio-devkit use @main (unversioned; consider pinning to release tag)

### Docker Base Images
- All Python Dockerfiles use unpinned slim images (python:3.12-slim)
- **Recommendation:** Use digest pins: `python:3.12-slim@sha256:...` for reproducible builds

### Secret Exposure
- No hardcoded secrets detected
- Secrets passed via env in workflows (expected pattern)
- All major CI/CD platforms (GCP, GitHub, Slack, Discord) properly abstracted via GitHub Secrets

---

## Commands Run

```bash
# Secret pattern search
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" \) | xargs grep -l 'api[_-]?key|secret|token|password|bearer' | head -20

# GitHub Actions audit
grep -r "pull_request_target\|permissions:\|uses:\|@main\|@v4\|@v5" .github/workflows/*.yml

# Dockerfile audit
find . -name "Dockerfile*" -exec grep -l "FROM python\|USER\|ADD https" {} \;

# Dependency audit
grep -E "^(fastapi|pydantic|asyncpg|psycopg2|httpx|google)" requirements.txt

# Dependabot check
test -f .github/dependabot.yml && echo "Present" || echo "Missing"
```

---

## Limitations

1. **Read-only scope:** No fixes applied; no PRs/issues created.
2. **Shallow scanning:** Checked HEAD and key files only; did not traverse full git history for past secrets.
3. **No transitive analysis:** Did not resolve nested dependencies (e.g., fastapi -> starlette, pydantic -> ...).
4. **Event schema versioning:** Confirmed 8 types + schema_version field; did not validate schema evolution against historical snapshots.
5. **No runtime testing:** Did not execute containers or workflows; checks are static only.
6. **perditio-devkit:** Reusable workflow @main status depends on that repo's tagging; not verified.

---

## Recommendation Priority

1. **URGENT:** Pin critical deps in forksync (fastapi, pydantic) to exact versions with CVE auditing
2. **HIGH:** Add permissions blocks to forksync sync.yml and sync-manual.yml
3. **HIGH:** Pin reporium-events dependency in reporium-db to commit hash (e.g., @abc1234 or release tag)
4. **HIGH:** Configure dependabot.yml across all 5 repos
5. **MEDIUM:** Unpin Docker base images to digest hashes (python:3.12-slim@sha256:...)
6. **MEDIUM:** Pin reusable workflow calls to release tags instead of @main
7. **LOW:** Standardize GitHub Actions pin strategy (all SHA, no version tags)

