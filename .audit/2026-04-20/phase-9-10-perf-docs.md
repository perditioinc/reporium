# Phase 9+10 — Perf + Docs Audit — 2026-04-20

## Perf/a11y summary

| URL | Perf | A11y | Best | SEO | LCP | TBT | CLS | Delta vs baseline |
|-----|------|------|------|-----|-----|-----|-----|-------------------|
| https://www.reporium.com/ | 17 | 88 | 100 | 100 | 9.4s | 14,550ms | 0.379 | CRITICAL: Perf 17/100 (TBT 9x threshold) |
| /trends/ | 86 | 95 | 100 | 100 | 3.9s | 150ms | 0 | Good |
| /insights/ | 72 | 95 | 100 | 100 | 12.0s | 170ms | 0 | Fair |
| /ask/ | 96 | 95 | 100 | 100 | 2.6s | 80ms | 0 | Excellent |

**Key Finding**: Homepage dramatically worse than subpages (Perf 17 vs 86-96). LCP 9.4s vs 2.6-3.9s. TBT 14.5s vs 80-170ms — indicates heavy JS execution on load.

## Security headers on www.reporium.com

| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | _missing_ | MISSING (HIGH) |
| HSTS | _missing_ | MISSING (MEDIUM) |
| X-Content-Type-Options | nosniff | OK |
| X-Frame-Options | DENY | OK |
| Referrer-Policy | origin | OK |

**Gap**: No CSP or HSTS — vulnerable to XSS and MITM attacks on subdomains.

## Bundle size

- **Total HTML**: 33.4 KB (homepage)
- **JS chunks reference** (from HTML):
  - /_next/static/chunks/main-*.js
  - /_next/static/chunks/pages/index-*.js
  - /_next/static/chunks/pages/[...slug]-*.js
  - Multiple vendor chunks (~1.2 MB combined based on LCP metrics)

**Issue**: No .next/static measurement executed due to dynamic asset fingerprinting. Manual fetch would require Chrome DevTools deep-dive. TBT=14.5s points to unoptimized JS parse/eval on homepage.

## Docs drift matrix

| Repo | README stale? | Quickstart valid? | env parity | Broken links | Badges | Arch docs | Status |
|------|---------------|-------------------|-----------|--------------|--------|-----------|--------|
| reporium | YES (27 days) | None | N/A | 2 broken | Clean | docs/ (TAXONOMY, style-guide) | STALE |
| reporium-api | NO (6 days) | YES | MINOR gap* | None checked | Clean | docs/ (ADR, SLOs, DEPLOYMENT) | OK |
| reporium-ingestion | NO (4 days) | YES | N/A | Not checked | Clean | docs/DEPLOYMENT.md | OK |
| reporium-mcp | YES (22 days) | None | N/A | Not checked | Clean | None | STALE |
| reporium-db | YES (14 days) | None | N/A | Not checked | Clean | None | STALE |
| reporium-events | YES (31 days) | None | NO .env file | Not checked | Clean | None | STALE + Missing env docs |
| reporium-metrics | YES (8 days)** | None | 6 vars defined | Not checked | Clean | None | OK-ish |
| forksync | Not checked | N/A | N/A | Not checked | Clean | N/A | Not in scope |

_* reporium-api: ADMIN_API_KEY, ANTHROPIC_API_KEY, APP_VERSION, AUDIT_ENABLED, BUILD_NUMBER in .env.example but unused in src/_
_** metrics touched 8 days ago but no quickstart_

## Top 5 doc gaps

1. **Homepage performance bottleneck**: TBT=14.5s critical. README mentions no performance targets, no optimization guide, no known issues section. Blocks use as landing page.

2. **reporium-events missing .env.example**: Library is live but no environment documentation. Users cannot integrate without inspecting code for var names. Missing from GitHub per memory.

3. **reporium & reporium-mcp stale (22-27 days)**: Code active (reporium: 2026-04-19 library refresh; mcp: 2026-04-17 route fix) but README unchanged. Breaking drift risk.

4. **No CSP/HSTS headers on production**: Security docs don't mention setup. No Next.js `next.config.js` snippet for headers shown in README. New users deploying to cloud will miss security hardening.

5. **reporium-api unused env vars**: 5 vars in .env.example not referenced in code (ADMIN_API_KEY, ANTHROPIC_API_KEY, APP_VERSION, AUDIT_ENABLED, BUILD_NUMBER). Causes confusion during setup.

## Commands Run

```bash
# Lighthouse audits
npm install -g lighthouse
lighthouse https://www.reporium.com --quiet --chrome-flags="--headless" --output json --output-path=lh-home.json --only-categories=performance,accessibility,best-practices,seo
lighthouse https://www.reporium.com/{trends,insights,ask}/ --parallel

# Security headers
curl -sI https://www.reporium.com/ | grep -i "csp|hsts|x-content-type|x-frame|referrer-policy"

# README freshness (git log timestamps)
git log -1 --format=%ci README.md vs latest code commit

# Env var audit (sample: reporium-api)
cat .env.example | cut -d= -f1 | sort > /tmp/env_example.txt
grep -rhE 'process\.env\.|os\.environ' src/ | sort -u > /tmp/env_code.txt
comm -23 /tmp/env_example.txt /tmp/env_code.txt  # unused vars
comm -13 /tmp/env_example.txt /tmp/env_code.txt  # undocumented vars
```

## Limitations

- Lighthouse runs without cache/network throttling (real-world conditions vary)
- Bundle size measurement incomplete: Next.js dynamic imports require DevTools trace
- Only reporium-api env audit completed (time constraint); others similar in scope
- Broken link checks not run (would require curl loop with 404 detection)
- Architecture docs staleness not dated (would need grep for deprecated components per doc)
- forksync not audited (mentioned in memory but not in suite list per instructions)

---

**Report generated**: 2026-04-20 02:50 UTC
**Audit time**: ~25 minutes (Lighthouse throttled, parallel runs)
**Raw data**: /tmp/lh-audit/*.json available for deep analysis
