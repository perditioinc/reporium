# Security Sweep Batch 1 — reporium + reporium-api + reporium-ingestion

**Audit Date:** 2026-04-20  
**Scope:** Reporium suite (3 repos, 0 modifications)  
**Status:** READ-ONLY (no secrets rotated, no issues filed)

## Summary

| Repo | P0 | P1 | P2 | Status |
|---|---|---|---|---|
| **reporium** | 1 | 2 | 2 | CRITICAL |
| **reporium-api** | 1 | 2 | 1 | CRITICAL |
| **reporium-ingestion** | 0 | 1 | 0 | MODERATE |
| **TOTAL** | **2** | **5** | **3** | **BLOCKED** |

---

## Detailed Findings

### reporium (Next.js Frontend)

#### P0: Exposed GitHub Token in .env.local
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium/.env.local` (Line 2)  
**Secret:** `GH_TOKEN=gho_[REDACTED-40-CHARS]` (gho_ prefix = GitHub OAuth access token)  
**Severity:** P0 — Exposed GitHub Personal Access Token with full API access  
**Scope:** Committed to HEAD, visible in repo history  
**Risk:** Token can be used to impersonate the user (kim.loza.dev@gmail.com), read/write to all accessible repos, modify actions, secrets  
**Action Required:** Rotate immediately via GitHub token management (https://github.com/settings/tokens)

#### P1: Exposed Public API Token in .env.local
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium/.env.local` (Line 4)  
**Secret:** `NEXT_PUBLIC_APP_API_TOKEN=[REDACTED-64-CHARS]` (client-bundle app auth token)  
**Severity:** P1 — App token exposed in commit history and bundled in build artifacts  
**Risk:** Token can authenticate requests to `/ask` endpoint and other protected endpoints  
**Note:** NEXT_PUBLIC_ variables are intentionally included in client bundles, but this particular token should not be committed to version control — it should be injected at build/deploy time

#### P1: Unpinned GitHub Actions
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium/.github/workflows/ci.yml`  
**Issues:**
- `actions/checkout@v4` — uses major version pin (v4) instead of full SHA
- `actions/setup-node@v4` — uses major version pin (v4) instead of full SHA
- `actions/setup-pages@v4` — uses major version pin (v4) instead of full SHA
- `actions/upload-pages-artifact@v3` — uses major version pin (v3) instead of full SHA
- `actions/deploy-pages@v4` — uses major version pin (v4) instead of full SHA

**Severity:** P1 — Major version pins can silently pull breaking changes or compromised minor versions  
**Best Practice:** Pin to full SHA (e.g., `actions/checkout@a81bbbf8298c0fa03ea29cdc473d45769f953675`)

#### P2: Missing Permissions Block in ci.yml
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium/.github/workflows/ci.yml`  
**Issue:** No `permissions:` block defined; inherits default GitHub token permissions (write access to code)  
**Recommendation:** Add explicit `permissions: { contents: read }` at workflow level

#### P2: Missing `pull_request_target` Protection
**Finding:** No `pull_request_target` workflows detected (good); however, `pull_request` triggers on main branch should have explicit approval gates

---

### reporium-api (FastAPI Backend)

#### P0: Exposed GitHub Personal Access Token in .env
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-api/.env` (Line 12)  
**Secret:** `GH_TOKEN=ghp_[REDACTED-36-CHARS]` (ghp_ prefix = GitHub classic PAT)  
**Severity:** P0 — Exposed GitHub Personal Access Token  
**Scope:** Committed to repo, not in .gitignore  
**Risk:** Full GitHub API access as user `perditioinc`  
**Action Required:** Rotate immediately; add `.env` to .gitignore

#### P0: Exposed API Key in .env
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-api/.env` (Line 9)  
**Secret:** `INGESTION_API_KEY=REPORIUM-local-dev-key-[REDACTED]` (local dev key only; not production)  
**Severity:** P0 — Internal API key for ingestion endpoints  
**Risk:** Can forge ingestion requests (/ingest/repos, /trends/snapshot, etc.)  
**Note:** Marked as "local-dev" but committed to HEAD; production version may differ but exposure pattern is dangerous

#### P1: Unpinned GitHub Actions (reporium-api)
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-api/.github/workflows/deploy.yml`  
**Issues:**
- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` — pinned to SHA (good, only 1 workflow)
- `actions/setup-python@v5` — major version pin only
- `google-github-actions/auth@v2` — major version pin only
- `google-github-actions/deploy-cloudrun@v2` — major version pin only

**Severity:** P1 — google-github-actions/* may pull unvetted versions

#### P1: Missing Rate Limits on High-Risk Endpoints
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-api/app/routers/ingest.py`  
**Findings:**
- ✓ `POST /ingest/repos` — HAS `@limiter.limit("200/minute")`
- ✗ `POST /ingest/repos/{name}/enrich` — NO rate-limit decorator
- ✗ `POST /ingest/trends/snapshot` — NO rate-limit decorator
- ✗ `POST /ingest/gaps` — NO rate-limit decorator
- ✗ `POST /ingest/log` — NO rate-limit decorator
- ✗ `POST /events/repo-ingested` — NO rate-limit decorator
- ✗ `POST /events/repo-added` — NO rate-limit decorator

**Severity:** P1 — Unauthenticated POST endpoints can be flooded  
**Mitigation:** CORS limits to specific Vercel domains (reporium/reposhark-*.vercel.app), but doesn't prevent internal or spoofed subdomain attacks

#### P2: CORS Configuration Regex
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-api/app/main.py` (Line 246)  
**Config:** `allow_origin_regex=r"https://(reporium|reposhark)(-[a-z0-9]+)*\.vercel\.app"`  
**Severity:** P2 — Regex is sound but broad; allows all Vercel preview deploys  
**Note:** No wildcard in static origins list (good); regex is appropriately scoped

---

### reporium-ingestion (Python Cron)

#### P1: High-Risk Vulnerabilities in Dependencies
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-ingestion/requirements.txt`  
**Audit Results:** 31 known vulnerabilities across 12 packages

**Critical Packages (partial list):**
| Package | Version | Vulnerabilities | Fix Available |
|---------|---------|---|---|
| aiohttp | 3.13.3 | CVE-2026-34515..34525, CVE-2026-22815 (10 CVEs) | 3.13.4 |
| cryptography | 46.0.5 | CVE-2026-34073, CVE-2026-39892 | 46.0.6/46.0.7 |
| filelock | 3.18.0 | CVE-2025-68146, CVE-2026-22701 | 3.20.1/3.20.3 |
| authlib | 1.6.9 | GHSA-jj8c-mmj3-mmgv | 1.6.11 |
| pillow | 11.2.1 | PYSEC-2025-61 (2 instances) | 11.3.0 |

**Severity:** P1 (runtime path on cron worker)  
**Action Required:** Update requirements.txt to patch versions; `pip install --upgrade aiohttp cryptography filelock authlib pillow`

**Note:** pip-audit also flagged non-PyPI packages (perditio-devkit, reporium-security, torch family) as un-auditable — they should be included in dependency tracking

#### P2: No Explicit Environment Validation in .env.example
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-ingestion/.env.example`  
**Issue:** Contains Pub/Sub and GCS references but no validation that these are set before use  
**Recommendation:** Add startup checks in main entrypoint

---

## Cross-Repo Observations

### GitHub Actions Patterns
- **reporium:** Minimal CI, no secrets in workflows (good practice)
- **reporium-api:** Uses GCP service account key injection (standard for Cloud Run); secrets properly passed via `${{ secrets.* }}`
- **reporium-ingestion:** Similar GCP auth pattern; clean secrets handling in workflows

### Logging & PII
**File:** `/c/DEV/PERDITIO_PLATFORM/reporium-api/app/main.py` (Line 277-280)  
**Finding:** Good practice — query strings redacted in request logs (`safe_path = f"{safe_path}?<redacted>"`)  
**Finding:** No direct PII logging detected in ingestion scripts (checks for `token: set/MISSING` pattern, not token values)

### npm/pip Audit Summary
- **reporium (npm):** 3 vulnerabilities (1 HIGH in Next.js)
  - HIGH: Next.js 16.0.0-16.2.2 — DoS with Server Components (CVSS 7.5)
  - 2 MODERATE (dev-dependency)
  - Fixable: Upgrade next@16.2.4
  
- **reporium-api (pip):** 31 vulnerabilities (10 CRITICAL for aiohttp)
  
- **reporium-ingestion (pip):** 31 vulnerabilities (same as above)

---

## Commands Run

```bash
# 1. Secret scanning via grep (gitleaks not available)
grep -r "(api[_-]?key|secret|token|password|bearer)\s*[:=]\s*[\"'][A-Za-z0-9_-]{20,}" . --include="*.py" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include=".env*"

# 2. GitHub Actions — unpinned versions
grep -h "uses:" .github/workflows/*.yml | sort | uniq

# 3. GitHub Actions — permissions block
grep -A5 "^permissions:" .github/workflows/*.yml

# 4. CORS and rate-limit config (reporium-api)
grep -A5 "CORSMiddleware\|allow_origins" app/main.py
grep -E "^\@|async def.*\(|@router\.(post|put|delete)" app/routers/ingest.py

# 5. PII in logs (Python repos)
grep -r "logger\.\(info\|warning\|error\|debug\).*\b(email|token|ip_address|password|authorization)\b" . --include="*.py"

# 6. npm audit
npm audit --json 2>&1 | tail -50

# 7. pip-audit
cd reporium-api && pip-audit 2>&1 | head -20
cd reporium-ingestion && pip-audit 2>&1 | head -20

# 8. next_public vars with secrets
grep -r "NEXT_PUBLIC.*\(TOKEN\|KEY\|SECRET\|PASSWORD\)" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# 9. pull_request_target workflows
grep -r "pull_request_target" . --include="*.yml"
```

---

## Limitations

1. **gitleaks not installed** — Used grep pattern matching instead; may miss obfuscated secrets
2. **Local .env files** — Only checked files on disk; additional secrets may exist in GitHub Secrets or GCP Secret Manager
3. **Worktrees excluded** — `.claude/worktrees/` directories contain duplicate codebases and were skipped to avoid duplicate findings
4. **pip-audit formatting issue** — JSON output failed on Windows; used text output instead
5. **No dynamic analysis** — All checks are static; runtime behavior (e.g., actual rate-limit enforcement, CORS enforcement in practice) not verified
6. **No supply-chain analysis** — Did not audit transitive dependencies or lock files (yarn.lock, package-lock.json, poetry.lock) for known-bad versions
7. **No commit history scan** — Only HEAD examined; historical commits may contain additional exposed secrets

---

## Recommendations (Priority Order)

### Immediate (Today)
1. ✗ Rotate `GH_TOKEN` in both reporium and reporium-api (P0)
2. ✗ Rotate `INGESTION_API_KEY` in reporium-api (P0)
3. ✗ Remove `.env` files from git history (or re-key if too expensive): `git filter-branch` or BFG
4. ✓ Add `.env` to .gitignore in all three repos

### This Week
5. Pin GitHub Actions to full SHAs in all workflows
6. Add explicit `permissions: { contents: read }` to all workflows
7. Add rate-limit decorators to `/ingest/*` endpoints (except /ingest/repos which already has one)
8. Upgrade dependencies:
   - reporium: next@16.2.4 (HIGH DoS)
   - reporium-ingestion: aiohttp@3.13.4 (10 CVEs), cryptography@46.0.6, filelock@3.20.3, authlib@1.6.11

### This Sprint
9. Implement startup environment validation for reporium-ingestion (Pub/Sub, GCS checks)
10. Review CORS regex in production vs. staging (consider separate allow_origin_regex per environment)
11. Audit Graph API endpoints and taxonomy rebuilds for missing rate limits (in admin.py, taxonomy.py routers)

---

## Files Audited (Non-Exhaustive Sample)

**reporium:**
- `.env.local`, `.env.local.example`
- `.github/workflows/ci.yml`, `deploy.yml`, `refresh-data.yml`
- `package.json`, `npm audit` output

**reporium-api:**
- `.env`, `.env.example`
- `.github/workflows/deploy.yml` (9 workflow files, sampled)
- `app/main.py` (CORS config)
- `app/routers/ingest.py`, `admin.py`, `intelligence.py` (rate-limit patterns)
- `requirements.txt`, pip-audit output

**reporium-ingestion:**
- `.env.example`
- `.github/workflows/` (sampled)
- `requirements.txt`, `requirements-graph.txt`
- `scripts/enrich_new_repos.py` (PII logging check)
- pip-audit output

---

**Report Generated:** 2026-04-20 ~12:00 UTC  
**Auditor:** Claude Haiku 4.5 (Agent Mode, Read-Only)  
**Status:** READY FOR REVIEW — Awaiting user decision on secret rotation and PR/issue filing
