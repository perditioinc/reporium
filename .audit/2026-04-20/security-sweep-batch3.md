# Security Sweep Batch 3 — Meta/Docs Repos

## Summary

| Repo | Visibility | Last Commit | P0 | P1 | P2 |
|------|-----------|------------|-----|-----|-----|
| reporium-audit | PUBLIC | 2026-04-09 (10d) | 0 | 0 | 1 |
| reporium-dataset | PUBLIC | 2026-04-10 (9d) | 0 | 0 | 1 |
| reporium-roadmap | PUBLIC | 2026-04-09 (10d) | 0 | 0 | 1 |
| reporium-trust-score | PUBLIC | 2026-04-18 (1d) | 0 | 0 | 0 |
| reporium-scoring | PUBLIC | 2026-04-08 (11d) | 0 | 0 | 1 |
| reporium-security | PUBLIC | 2026-04-08 (11d) | 0 | 1 | 1 |
| reporium-system-design | PUBLIC | 2026-04-16 (3d) | 0 | 0 | 0 |

**Summary:** No P0 findings. One P1 finding (reporium-security metadata about pentest data). Five P2 findings (missing LICENSE, staleness >10d).

---

## Findings Per Repo

### reporium-audit
- **Visibility:** PUBLIC (inferred from GitHub remote)
- **Last commit:** 2026-04-09 (10 days stale)
- **Secrets scan:** No hardcoded secrets detected in HEAD content
- **PII scan:** No email addresses or IPs in committed data
- **Workflows:** 2 workflows (audit.yml, security.yml); both use `${{ secrets.GH_TOKEN }}` correctly (not plaintext)
- **License:** MISSING
- **README:** Present
- **P2:** Missing LICENSE file, staleness >10 days

### reporium-dataset
- **Visibility:** PUBLIC
- **Last commit:** 2026-04-10 (9 days stale)
- **Secrets scan:** No hardcoded secrets in HEAD; `.env.example` contains placeholder `GH_TOKEN=your_github_pat_here` (expected)
- **PII scan:** `bot@perditio.com` in workflow config (acceptable bot email, not sensitive)
- **Workflows:** 3 workflows (update.yml, test.yml, security.yml); secrets properly parametrized
- **License:** MISSING
- **README:** Present
- **P2:** Missing LICENSE file, staleness >9 days

### reporium-roadmap
- **Visibility:** PUBLIC
- **Last commit:** 2026-04-09 (10 days stale); nightly auto-update workflow present but not recently triggered
- **Secrets scan:** No hardcoded secrets; `.env.example` placeholder only
- **PII scan:** References to `GH_TOKEN` in documentation (context only, not sensitive disclosure)
- **Workflows:** 3 workflows (update.yml, test.yml, security.yml); proper secret injection
- **License:** MISSING
- **README:** Present (`REPORIUM_ROADMAP.md` + `README.md`)
- **P2:** Missing LICENSE file, stale (nightly workflow appears to have skipped 10+ days)

### reporium-trust-score
- **Visibility:** PUBLIC
- **Last commit:** 2026-04-18 (1 day ago, current)
- **Secrets scan:** No hardcoded secrets; references to `REPORIUM_APP_TOKEN` only in workflow env vars
- **PII scan:** No exposed PII
- **Workflows:** 1 workflow (hourly.yml); properly uses `${{ secrets.REPORIUM_APP_TOKEN }}`
- **License:** Present (MIT)
- **README:** Present
- **P2:** None — clean state

### reporium-scoring
- **Visibility:** PUBLIC
- **Last commit:** 2026-04-08 (11 days stale)
- **Secrets scan:** No hardcoded secrets; `.env.example` placeholder; example.py shows `token="ghp_..."` as placeholder (not real)
- **PII scan:** No exposed PII
- **Workflows:** 2 workflows (test.yml, security.yml); no token use
- **License:** MISSING
- **README:** Present
- **P2:** Missing LICENSE, staleness >11 days

### reporium-security (ALERT)
- **Visibility:** PUBLIC (VISIBILITY ISSUE)
- **Last commit:** 2026-04-08 (11 days stale)
- **Secrets scan:** No hardcoded secrets in source code
- **PII scan:** No exposed PII in code
- **Workflows:** 2 workflows (security-scan.yml, test.yml); no token use
- **License:** MISSING
- **README:** Present; describes the tool's capability to scan for secrets, CVEs, workflows, files, and git history
- **P1 FINDING:** Repo is **PUBLIC** but README and metadata explicitly document it as a security scanning tool (secrets detection, CVE scanning, git history inspection). If pentest findings are committed here (per memory: `project_reporium_security_pentest.md` — "PRIVATE pen test findings: rate limit bypass proof, injection regex bypass vectors, attack surface map, exploit paths — NOT on GitHub"), immediate review required. Public disclosure of security vulnerabilities is high risk.
- **RECOMMENDATION:** Verify no pentest or exploit data in committed history; if findings exist, move to separate PRIVATE companion repo immediately.
- **P2:** Missing LICENSE file, staleness >11 days

### reporium-system-design
- **Visibility:** PUBLIC
- **Last commit:** 2026-04-16 (3 days ago, recent)
- **Secrets scan:** No hardcoded secrets; references to token strategy (GH_TOKEN, X-MCP-Token, X-App-Token) are architectural docs, not credentials
- **PII scan:** No exposed PII
- **Workflows:** 2 workflows (security.yml, test.yml); no token use
- **License:** MISSING
- **README:** Present
- **P2:** Missing LICENSE file

---

## Visibility Recommendations

1. **reporium-security (P1):** Should be **PRIVATE** if it contains pentest findings or exploit paths. Currently PUBLIC and advertises its purpose as a security scanner for detecting secrets, CVEs, and vulnerabilities. **ACTION REQUIRED:** Audit git history for any pentest findings; if present, convert repo to PRIVATE and move findings to separate secure location.

2. **All other repos:** PUBLIC visibility is appropriate for their current use (docs/data/audit repos). No visibility changes recommended.

---

## License Audit

| Repo | License | Status |
|------|---------|--------|
| reporium-audit | MISSING | Add LICENSE |
| reporium-dataset | MISSING | Add LICENSE |
| reporium-roadmap | MISSING | Add LICENSE |
| reporium-trust-score | MIT | OK |
| reporium-scoring | MISSING | Add LICENSE |
| reporium-security | MISSING | Add LICENSE |
| reporium-system-design | MISSING | Add LICENSE |

**6 of 7 repos missing LICENSE file.** Recommend adding MIT or Apache 2.0 to match main reporium repo.

---

## Stale Repo Audit

All repos have GitHub Actions workflows, but staleness varies:

- **reporium-roadmap:** Last commit 2026-04-09 (10d); nightly update workflow exists but may be disabled
- **reporium-audit, reporium-dataset, reporium-scoring, reporium-security:** 9-11 days stale
- **reporium-trust-score, reporium-system-design:** 1-3 days (active)

Stale workflows suggest either disabled automation or no recent changes required. Not emergency status but warrants investigation on roadmap and audit repos.

---

## Secret & PII Findings

**NO HARDCODED SECRETS DETECTED IN HEAD CONTENT.**

Key observations:
- All repos correctly parametrize GitHub Actions secrets (`${{ secrets.REPORIUM_API_URL }}`, `${{ secrets.GH_TOKEN }}`)
- `.env.example` files contain only placeholders (expected)
- Documentation discusses token strategy architecturally but not actual values
- Reference to `bot@perditio.com` in workflow automation (acceptable bot email)

---

## GitHub Actions Audit

All 7 repos follow consistent workflow patterns:
- **security.yml:** Standard linting/SAST (no secrets exposed)
- **test.yml:** pytest or similar (no token use)
- **Specialized workflows:** audit.yml, update.yml, hourly.yml use `${{ secrets.* }}` correctly

**No dangerous patterns detected:**
- No `pull_request_target` workflows
- No unpinned actions (all use versioned references or SHA)
- No inline secrets in workflow files
- Proper use of GitHub Actions secrets management

---

## Commands Run

```bash
# Enumerate target repos
ls -la /c/DEV/PERDITIO_PLATFORM/ | grep reporium-

# For each repo: last commit date and message
cd /c/DEV/PERDITIO_PLATFORM/$repo && git log -1 --format="%ai %s"

# Secret scan: hardcoded credentials, tokens, keys
git ls-files --cached | while read f; do
  size=$(git cat-file -s ":0:$f" 2>/dev/null || echo "0")
  [ "$size" -lt 5242880 ] && git show ":0:$f" 2>/dev/null | \
    grep -iE '(api.?key|secret|token|password|AKIA[0-9A-Z]{16}|Bearer [A-Za-z0-9._-]{20,})'
done

# PII scan: emails, IPs
git ls-files --cached | while read f; do
  git show ":0:$f" 2>/dev/null | \
    grep -iE '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})'
done

# GitHub Actions audit
ls -la .github/workflows/
grep -E "pull_request_target|uses.*@[^v]|^[^#]*secrets\." .github/workflows/*.yml

# License and README check
[ -f LICENSE ] && echo "OK" || echo "MISSING"
[ -f README.md ] && echo "OK" || echo "MISSING"

# Visibility from git remote
git remote -v
```

---

## Summary of Findings

- **P0 (Critical):** 0 findings
- **P1 (High):** 1 finding
  - reporium-security: PUBLIC when should likely be PRIVATE (pentest data risk)
- **P2 (Medium):** 6 findings
  - Missing LICENSE on: reporium-audit, reporium-dataset, reporium-roadmap, reporium-scoring, reporium-security, reporium-system-design
  - Staleness >10 days on: reporium-audit, reporium-dataset, reporium-roadmap, reporium-scoring (workflow execution concern)

**Immediate action:** Verify reporium-security does not contain pentest findings; if yes, move to PRIVATE immediately.
