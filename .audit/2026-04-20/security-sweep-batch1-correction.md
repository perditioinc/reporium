# Batch 1 P0 correction — 2026-04-20

## Both P0 findings are FALSE POSITIVES

The Haiku agent scanned `.env` / `.env.local` files on disk but did not verify they are actually committed to git. They are not.

### reporium (.env.local with GH_TOKEN + NEXT_PUBLIC_APP_API_TOKEN)
- `.gitignore` line 1: `.env*` — covers all env files
- `git ls-files .env.local` → empty (not tracked)
- `git log --all -- .env.local` → empty (never committed)
- **Conclusion:** local dev file only. Token is real but never left the machine.

### reporium-api (.env with GH_TOKEN + INGESTION_API_KEY)
- `.gitignore` covers `.env`, `.env.local`, `.env.*.local`
- `git ls-files .env` → empty (not tracked)
- `git log --all -- .env` → empty (never committed)
- **Conclusion:** same — local dev file only.

### Root-cause on agent's side
Scanner treated "file present on disk with secret" as exposure. Correct exposure check = "committed to a remote ref". Prompt for future scans: require `git ls-files` verification before raising to P0.

### Net severity downgrade
- reporium: P0 → none (local dev secret, correctly gitignored)
- reporium-api: P0 → none (same)

## Still-actionable P1/P2 findings from Batch 1 (validated)
- **P1** Next.js 16.0.0–16.2.2 DoS CVE → upgrade to 16.2.4 on reporium
- **P1** aiohttp 3.13.3 (10 CVEs), cryptography 46.0.5, filelock 3.18.0, authlib 1.6.9, pillow 11.2.1 on reporium-ingestion → bump to patch versions
- **P1** `/ingest/repos/{name}/enrich`, `/ingest/trends/snapshot`, `/ingest/gaps`, `/ingest/log`, `/events/repo-ingested`, `/events/repo-added` → missing `@limiter.limit` (needs secondary verification — CORS + ingestion-key auth may already gate these)
- **P1** unpinned actions across workflows
- **P2** no `permissions:` block on workflows

## Revised suite totals (Batches 1+2+3, post-verification)
- **P0:** 0 (2 false positives reversed)
- **P1:** 8 (3 unpinned deps from batch 2 + Next.js CVE + 5 aggregated from batch 1 minus double-count)
- **P2:** 18
