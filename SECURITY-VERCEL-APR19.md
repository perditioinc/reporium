# Vercel Security Incident — April 19 2026

> **Status:** Rotation required. Work through the checklist below before the next production deploy.

---

## Summary

On April 19 2026, Vercel published a security bulletin confirming that environment variables **not marked "Sensitive"** in the Vercel dashboard were stored unencrypted at rest and were accessible to an unauthorised party during the incident window (reported dates: approximately April 17–19 2026). Variables flagged as Sensitive are encrypted at rest and were not exposed. Any plaintext env var visible in the Vercel project settings — including build-time variables and public `NEXT_PUBLIC_*` keys — should be treated as potentially compromised and rotated immediately. Secret values baked into the static bundle at build time (all `NEXT_PUBLIC_*` vars) should be rotated even if they appear non-sensitive, because they were present in the build environment when the incident occurred.

---

## Env vars inventory

Variables referenced across the codebase, ranked by rotation priority.

| Variable | Representative location | Scope | Rotate? |
|---|---|---|---|
| `NEXT_PUBLIC_APP_API_TOKEN` | `src/components/AskBar.tsx:122`, `src/components/AskPanel.tsx:33`, `src/components/NLFilterBar.tsx:18`, `src/components/StickyAskBar.tsx:174`, `next.config.js:14`, `.github/workflows/deploy.yml:63` | Build-time + client bundle | **HIGH** — bearer token granting access to the `/intelligence/ask/stream` endpoint on reporium-api; exposed in the client bundle AND in Vercel env vars |
| `GH_TOKEN` | `src/server-api/repos/[username]/route.ts:68,77,122,157,192,214`, `scripts/generate-library.ts:77`, `scripts/fix-fork-info.ts:39`, `.github/workflows/deploy.yml:55` | Runtime (server) + CI | **HIGH** — GitHub Personal Access Token with `read:user` / `public_repo` scopes; write-capable if over-scoped |
| `NEXT_PUBLIC_SENTRY_DSN` | `sentry.client.config.ts:6`, `sentry.server.config.ts:6`, `sentry.edge.config.ts:6`, `next.config.js:17`, `.github/workflows/deploy.yml:64` | Build-time + client bundle | **MED** — Sentry DSN is a public-safe ingest URL but rotation invalidates any forged event submission; rotate via Sentry project settings |
| `NEXT_PUBLIC_REPORIUM_API_URL` | `src/lib/dataProvider.ts:37`, `src/lib/apiUrl.ts:13`, `src/components/RepoCard.tsx:288`, `src/components/SimilarReposPanel.tsx:7`, `src/app/ask/page.tsx:5`, `src/app/insights/page.tsx:19`, `src/app/repo/[name]/page.tsx:13`, `src/app/taxonomy/page.tsx:5`, `src/app/trends/page.tsx:18`, `scripts/fetch-library.ts:33`, `next.config.js:15`, `.github/workflows/deploy.yml:39,53,62`, `.github/workflows/refresh-data.yml:25` | Build-time + client bundle | **MED** — Cloud Run service URL; not a secret but confirms the API surface; verify no unauthorised requests in Cloud Run logs |
| `GH_USERNAME` | `src/config/index.ts:2`, `scripts/generate-library.ts:76`, `scripts/fix-fork-info.ts:38`, `.github/workflows/deploy.yml:54,60,61` | Build-time + CI | **LOW** — GitHub username (`perditioinc`); public information, no rotation needed but confirm no secrets were stored under this key |
| `NEXT_PUBLIC_GITHUB_USERNAME` | `src/config/index.ts:2`, `next.config.js:16`, `.github/workflows/deploy.yml:61` | Build-time + client bundle | **LOW** — Public display value; no rotation needed |
| `NEXT_PUBLIC_APP_TITLE` | `src/config/index.ts:3`, `.env.example:9` | Build-time | **LOW** — Display string only |
| `NEXT_PUBLIC_APP_DESCRIPTION` | `src/config/index.ts:4`, `.env.example:10` | Build-time | **LOW** — Display string only |
| `NEXT_PUBLIC_BASE_PATH` | `src/lib/dataProvider.ts:60,69,79,88`, `src/lib/graphData.ts:66`, `next.config.js:18`, `.env.local.example:16`, `.github/workflows/deploy.yml:65` | Build-time | **LOW** — Path prefix (`/reporium` or empty); no secret value |
| `NEXT_PUBLIC_VERCEL_ENV` | `sentry.client.config.ts:7`, `sentry.server.config.ts:7`, `sentry.edge.config.ts:7` | Runtime (Vercel-injected) | **LOW** — Auto-injected by Vercel (`production`/`preview`/`development`); not rotatable |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | `sentry.client.config.ts:8`, `sentry.server.config.ts:8`, `sentry.edge.config.ts:8` | Runtime (Vercel-injected) | **LOW** — Auto-injected by Vercel; not rotatable |
| `NEXT_RUNTIME` | `instrumentation.ts:4,8` | Runtime (Next.js-injected) | **LOW** — Framework internal; not rotatable |
| `LIBRARY_PATH` | `src/mcp/server.ts:18,254,255` | Runtime (MCP server) | **LOW** — File path for local MCP server; not present in Vercel |
| `NODE_ENV` | `src/lib/apiUrl.ts:11` | Build-time (framework) | **LOW** — Standard Node.js flag; not rotatable |

> **Note on `SENTRY_ORG` and `SENTRY_PROJECT`:** referenced in a comment in `next.config.js:40` as future vars; source map upload is currently disabled (`disableSourceMapUpload: true`). Not present in Vercel yet — no action required.

---

## Rotation checklist

Work HIGH → MED → LOW. Tick each item once confirmed.

### HIGH priority

- [ ] **`NEXT_PUBLIC_APP_API_TOKEN`** — Generate a new random token in reporium-api (or your secret manager). Update in Vercel project settings → Environment Variables. Mark it **Sensitive**. Redeploy.
- [ ] **`GH_TOKEN`** — Revoke the existing token at <https://github.com/settings/tokens>. Generate a new fine-grained token scoped to `public_repo` (read-only) for the `perditioinc` account. Update in Vercel and in GitHub Actions secret `GH_TOKEN`. Mark it **Sensitive** in Vercel.

### MED priority

- [ ] **`NEXT_PUBLIC_SENTRY_DSN`** — In the Sentry dashboard → Project Settings → Client Keys, roll the DSN. Paste the new value into Vercel env vars. Mark it **Sensitive**. Trigger a redeploy to pick up the new DSN in the bundle.
- [ ] **`NEXT_PUBLIC_REPORIUM_API_URL`** — No rotation needed unless you rotate the Cloud Run service URL. Do check Cloud Run request logs (Apr 17–19) for unexpected traffic patterns from unknown IPs.

### LOW priority

- [ ] **`GH_USERNAME`** — Confirm the stored value is just `perditioinc` (a public username). No rotation needed; verify nothing sensitive was stored under this key by mistake.
- [ ] All remaining `NEXT_PUBLIC_*` display/config vars — Confirm none have had real secrets stored in them. No rotation required if values are truly public.

---

## Verification steps

After rotating each credential, confirm the deployment is healthy:

1. **Redeploy on Vercel** — trigger a new production deployment. Check the build log exits cleanly (no env-var-not-found errors).
2. **AskBar / NLFilterBar** — open the live site, fire a query in the ask bar. A 200 response with streamed results confirms `NEXT_PUBLIC_APP_API_TOKEN` is correct.
3. **Sentry event delivery** — throw a test error in the browser console (`Sentry.captureMessage('rotation-test')`). Confirm it appears in the Sentry dashboard within 30 s.
4. **GitHub data refresh** — manually trigger the `Refresh Library Data` workflow in GitHub Actions. A clean run confirms `GH_TOKEN` is valid.
5. **Cloud Run health check** — `curl https://reporium-api-573778300586.us-central1.run.app/health` should return `{"status":"ok"}` (or equivalent).

---

## Audit log review

In the Vercel dashboard, review the following for the Apr 17–19 window:

- **Activity log** (`Settings → Activity`) — look for unexpected env-var reads, project config changes, or deployments not triggered by your own GitHub pushes.
- **Deployment list** — any deployments whose Git SHA does not map to a known commit on `main` or `dev` branches are a red flag.
- **Team member access log** — confirm no new members were added or permission levels changed.
- **Domain / DNS settings** — verify no custom domain rewrites were added pointing traffic off-platform.
- **Webhook list** — confirm no new webhooks were registered that could exfiltrate env vars on future deploys.

---

## Going forward

1. **Mark all secrets Sensitive in Vercel.** In the Vercel dashboard, edit every env var that is not a purely public display value and toggle "Sensitive". This enables at-rest encryption and hides the value from the UI after saving. At minimum: `NEXT_PUBLIC_APP_API_TOKEN`, `GH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`.

2. **Pre-commit hook: block accidental secret commits.** Add a pre-commit hook (e.g. via `husky` + `detect-secrets` or `gitleaks`) to reject commits that introduce high-entropy strings or known secret patterns. A minimal `gitleaks` config in `.gitleaks.toml` is enough to catch PATs and DSNs.

3. **Principle of least privilege for GH_TOKEN.** When recreating the GitHub token, use a fine-grained token scoped only to the `perditioinc` account with `Contents: Read` permission on public repos. Do not grant `write` unless explicitly needed.

4. **Secret scanning on the repo.** Enable GitHub Secret Scanning (`Settings → Security → Secret scanning`) on the `reporium` repository. It will alert on future accidental commits of known secret formats.

5. **Vercel environment variable audit cadence.** Schedule a quarterly review of all Vercel env vars to confirm: (a) each is still needed, (b) it is marked Sensitive if it contains a credential, (c) the value rotated in the last 90 days for HIGH-priority vars.
