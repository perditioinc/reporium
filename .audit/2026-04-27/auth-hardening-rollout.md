# Auth + Boundary Hardening — Rollout & Runbook

**Lane:** auth-hardening
**Date:** 2026-04-27
**Companion:** [`auth-hardening-plan.md`](auth-hardening-plan.md), [`auth-hardening-prereads.md`](auth-hardening-prereads.md)

This is the operator-facing companion to the plan. The plan documents *strategy*; this file documents the concrete *steps* for each PR. Keep it open in a second tab while shipping.

## PR #1 — plan-only (this PR)

- **Action:** review the three files in `reporium/.audit/2026-04-27/`. Confirm the plan matches your intent, the prereads findings are acceptable (or request amendments), and the rollout below is realistic.
- **Operator steps:** none. Approve or request changes via standard PR review.
- **Rollback:** trivially revertable. Closes the PR; the worktree at `.claude/worktrees/auth-hardening/` can be removed via `git worktree remove .claude/worktrees/auth-hardening` from the main `reporium` checkout.

## PR #2 — remove static export

### Vercel project settings (one-time check before merging)

Open the Vercel dashboard → `reporium` project → Settings → Build & Development Settings:

- **Framework Preset:** Next.js (should already auto-detect; confirm it does)
- **Build Command:** `next build` (or leave blank for the framework default; do NOT use `next export`)
- **Output Directory:** leave blank (Vercel auto-uses `.next`); explicitly NOT `out`
- **Install Command:** leave default

### Vercel env vars (no change in this PR)

No env-var change yet. The existing `NEXT_PUBLIC_*` vars stay in place; PR #5 adds new server-side keys.

### Smoke test on the Vercel preview URL

Capture a HAR file or DevTools network screenshot for these routes (each as an anonymous browser):

- `/` (home)
- `/ask`
- `/faq`
- `/wiki/*` (any one wiki page)
- `/graph/*` (any one graph page)

Each should return 200 and render. Compare to the same routes on production *before* merging — the goal is "no behavior change visible to a logged-out user."

### Rollback

`git revert` the merge commit + Vercel re-deploys the prior production build automatically. ~2-minute recovery.

## PR #3 — Auth.js GitHub provider

### Register a GitHub OAuth app (one-time, before merging)

Go to https://github.com/settings/developers → "OAuth Apps" → "New OAuth App":

- **Application name:** `Reporium`
- **Homepage URL:** `https://reporium.com` (or your prod domain)
- **Application description:** `Sign in to Reporium with your GitHub account.`
- **Authorization callback URL:** `https://reporium.com/api/auth/callback/github`

After saving, click "Generate a new client secret" and copy both the Client ID and the Client Secret immediately. You can't recover the secret later — only regenerate.

For preview deployments, you have two options:
- **Single OAuth app, multi-callback:** GitHub OAuth apps support multiple callbacks. Add `https://reporium-*.vercel.app/api/auth/callback/github` as a second callback (note: GitHub does support a list, separated by newlines in the dashboard).
- **Separate "Reporium (Preview)" OAuth app:** safer for principle-of-least-privilege, but means tracking two sets of credentials.

Recommend the single-app multi-callback approach unless the org-policy review pushes back.

### Vercel env vars to add (Production + Preview scopes)

In Vercel dashboard → reporium project → Settings → Environment Variables:

| Name | Value | Scope | Sensitive? |
|---|---|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | from GitHub OAuth app | Production + Preview | **Yes** |
| `GITHUB_OAUTH_CLIENT_SECRET` | from GitHub OAuth app | Production + Preview | **Yes** |
| `NEXTAUTH_URL` | `https://reporium.com` (prod) and `https://reporium-{branch}.vercel.app` (preview — Vercel can substitute via `VERCEL_URL`, see Auth.js docs) | Production + Preview | No |
| `NEXTAUTH_SECRET` | generate with `openssl rand -base64 32` | Production + Preview | **Yes** |

Mark Sensitive any time the value is a credential — per the April 19 security memo, that's enabling at-rest encryption.

### Smoke test

After merging, on the preview URL: visit `/sign-in`, click the GitHub button, complete OAuth, return to the app. `getServerSession()` should yield `name`, `email`, `login` for your account. **Membership check is not yet wired in this PR**; both perditioinc members and non-members will sign in successfully. That's by design — gating happens in PR #4.

### Rollback

Two layers:
1. `git revert` the merge commit. Vercel re-deploys.
2. **Do not delete the GitHub OAuth app** — you may need to re-merge later. Just revoke any session via Vercel rollback. The OAuth app is dormant if the env vars and routes are gone.

## PR #4 — server-side perditioinc membership check + protected `/audit`

### Vercel env vars

No new env vars in this PR (the membership check uses the OAuth token from the user's own session).

### Smoke test (must run on the preview URL with three accounts)

| Account | URL | Expected |
|---|---|---|
| Anonymous (cleared cookies) | `/audit` | 302 redirect to `/sign-in?from=/audit` |
| Signed in, *not* a perditioinc member | `/audit` | 403 (or `/audit/access-denied`) |
| Signed in, *active* perditioinc member | `/audit` | 200, dashboard renders |
| Signed in with a *pending* invite to perditioinc | `/audit` | 403 (state ≠ active) |

The third account is the canonical "you" path — sign in with `kim.loza.dev@gmail.com` if that GitHub account has active perditioinc membership; otherwise use any account that does.

The fourth account is the trickiest to test. To simulate: invite a throwaway GitHub account to perditioinc, do not have it accept, then sign in with that account. Membership endpoint returns `state: "pending"`; the gate must deny.

### Rollback

`git revert` + Vercel re-deploy. The middleware disappears with the revert, and `/audit` becomes anonymously accessible again. **This is a temporary regression of access control** — if the merge is rolled back, the dashboard goes wide-open until the next deploy. Mitigation: add Vercel password protection on the project for the duration of the rollback. Simple checkbox in project settings.

## PR #5 — same-origin proxy for `/intelligence/ask` and metrics

### Vercel env vars to add (Production + Preview)

| Name | Value | Scope | Sensitive? |
|---|---|---|---|
| `REPORIUM_API_URL` | `https://reporium-api-573778300586.us-central1.run.app` (or current Cloud Run URL) | Production + Preview | No (it's a URL, not a secret) |
| `REPORIUM_APP_TOKEN` | the same value currently in `NEXT_PUBLIC_APP_API_TOKEN` (do **not** rotate yet — rotate in PR #7's window) | Production + Preview | **Yes** |
| `REPORIUM_ADMIN_KEY` | the existing reporium-api `ADMIN_API_KEY` | Production + Preview | **Yes** |

Note: `REPORIUM_APP_TOKEN` and `REPORIUM_ADMIN_KEY` have **no** `NEXT_PUBLIC_` prefix. That is the entire point. Next.js will *not* inline them into the client bundle — they're available only to server-side route handlers.

### Smoke test

| Test | URL | Expected |
|---|---|---|
| T8 (anon ask) | `POST /api/intelligence/ask` from a logged-out browser | 200 with rate-limit enforced server-side |
| T8a (anon nl-filter) | `POST /api/intelligence/nl-filter` from a logged-out browser | 200 with rate-limit enforced server-side (only present if PR #5 includes the NLFilterBar fix per prereads §3.1) |
| T5 (anon metrics) | `GET /api/admin/metrics/latest` from a logged-out browser | 401 (no session) |
| T6 (signed-in non-member metrics) | `GET /api/admin/metrics/latest` from a signed-in non-perditioinc browser | 403 |
| T7 (signed-in member metrics) | `GET /api/admin/metrics/latest` from a signed-in perditioinc browser | 200 with payload |

Plus regression tests:
- Every Ask surface (AskBar, StickyAskBar, AskPanel, FAQPanel) still answers a sample question end-to-end.
- The audit dashboard still renders metrics (it now goes through `/api/admin/metrics/*`).
- `NLFilterBar` still applies a filter when given a natural-language query.

### Rollback

`git revert` + Vercel re-deploy. The route handlers disappear; the inline `NEXT_PUBLIC_APP_API_TOKEN` consumers are still in the same files so the surfaces continue to work via the old direct path. **No outage** during rollback.

## PR #6 — migrate `[username]/route.ts` to `app/api/`

### Smoke test

| Test | URL | Expected |
|---|---|---|
| Existing route shape | `GET /api/repos/perditioinc` | 200 with same `LibraryData` shape as before, same `Cache-Control` headers, `X-Cache: HIT/MISS` reflects cache state |
| New me route | `GET /api/me/repos` (signed-in user) | 200, returns the signed-in user's own public repos |
| Anonymous me route | `GET /api/me/repos` (logged out) | 401 |

Confirm `src/server-api/` directory is **deleted** after the migration — `ls reporium/src/server-api 2>/dev/null` should produce nothing.

### Rollback

`git revert` restores the directory. The 4 worktree copies under `.claude/worktrees/...` are unaffected (they're separate git worktrees — `git revert` only touches the current branch's tree).

## PR #7 — remove `NEXT_PUBLIC_APP_API_TOKEN` from the bundle

### Bundle-grep test (must run as part of CI)

Add a CI job that:
1. Runs `next build` with the production env (mock secrets are fine — what matters is whether the literal env-var name appears in the output).
2. Greps `.next/static/chunks/*.js` for the literal string `NEXT_PUBLIC_APP_API_TOKEN`. **Must return zero matches.**
3. Greps `.next/static/chunks/*.js` for the actual production token value (loaded as a CI secret at test time, never committed). **Must return zero matches.**

A leading implementation:

```bash
# CI step (sketch — Bash; adjust for your runner)
set -euo pipefail
npm run build
# Test #1: literal env-var name
if grep -r --include='*.js' 'NEXT_PUBLIC_APP_API_TOKEN' .next/static/chunks/; then
  echo 'FAIL: NEXT_PUBLIC_APP_API_TOKEN literal still in bundle'
  exit 1
fi
# Test #2: actual prod token value (passed in via CI secret)
if [[ -n "${PROD_APP_TOKEN_VALUE:-}" ]] && grep -r --include='*.js' --fixed-strings "${PROD_APP_TOKEN_VALUE}" .next/static/chunks/; then
  echo 'FAIL: production app token value found in bundle'
  exit 1
fi
echo 'PASS: bundle is clean'
```

### Vercel env vars to remove (after PR #7 merges)

In Vercel dashboard → reporium project → Settings → Environment Variables:

- **Delete** `NEXT_PUBLIC_APP_API_TOKEN` from Production and Preview scopes.

Confirm the next deploy succeeds without that var (it should — PR #7 also removes the declaration from `next.config.js`).

### Rollback

`git revert` + re-add the Vercel env var (Production + Preview). Re-deploy. The bundle once again contains the public token, but the proxy paths from PR #5 still work — the rollback only re-introduces the *option* of using the public token directly. To force re-use of the public path, also `git revert` PR #5.

## PR #8 — operator: flip `METRICS_REQUIRE_AUTH=1`

**This is not a code PR.** It is a Cloud Run env-var update. Open it as a PR-shaped record (or a JIRA ticket) so there's an audit trail of when the env was flipped and who approved it.

### Pre-flip human gate (mandatory — do NOT skip)

Before flipping, capture and attach to the PR/JIRA description:

1. **Vercel production network trace** showing every dashboard metrics call goes to same-origin `/api/admin/metrics/*`. Open prod, sign in as a perditioinc member, navigate to `/audit`, capture HAR or DevTools screenshot.
2. **Confirm** in the same trace: zero direct browser calls to `*.run.app/metrics/*`.
3. **Confirm** in the same trace: zero direct browser calls to `*.run.app/audit/status`.

If any direct browser call to `*.run.app/metrics/*` or `*.run.app/audit/status` is observed, **do not flip**. Open a new lane to track down the remaining caller, ship that fix, then re-run this gate.

### Cloud Run env-var update

Once the gate passes:

```bash
# Set the gate. Wait ~30-60s for the new revision to come up healthy.
gcloud run services update reporium-api \
  --region=us-central1 \
  --update-env-vars METRICS_REQUIRE_AUTH=1
```

### Post-flip verification (within 5 minutes)

```bash
# T13 — anonymous direct call must now 403
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://reporium-api-573778300586.us-central1.run.app/metrics/latest
# Expected: 403

# T14 — same-origin proxy must still 200 (use a signed-in perditioinc cookie)
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H 'Cookie: <session-cookie-from-signed-in-perditioinc-browser>' \
  https://reporium.com/api/admin/metrics/latest
# Expected: 200
```

### Rollback (if T13 returns 200 — gate didn't take, or there's still a public caller)

```bash
gcloud run services update reporium-api \
  --region=us-central1 \
  --remove-env-vars METRICS_REQUIRE_AUTH
```

Cloud Run rolls forward to a new revision (~30s). Anonymous calls to `/metrics/*` will succeed again. Do **not** retry the flip until the cause is found.

### Update `reporium-api/.env.example`

After the flip succeeds in production, update `reporium-api/.env.example` (separate trivial PR or amendment):

```
# Production default — required for HTTPS endpoints to be admin-key-gated.
METRICS_REQUIRE_AUTH=1
```

## Cross-PR appendix

### Summary table of env-var changes

| PR | Action | Env var | Scope |
|---|---|---|---|
| #3 | Add | `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | Vercel (prod + preview) |
| #5 | Add | `REPORIUM_API_URL`, `REPORIUM_APP_TOKEN`, `REPORIUM_ADMIN_KEY` | Vercel (prod + preview) |
| #7 | Remove | `NEXT_PUBLIC_APP_API_TOKEN` | Vercel (prod + preview) |
| #8 | Add | `METRICS_REQUIRE_AUTH=1` | Cloud Run (`reporium-api`) |

### Order of merges (non-negotiable)

```
PR #1 (plan)
  ↓
PR #2 (remove static export)
  ↓
PR #3 (Auth.js)
  ↓
PR #4 (membership check + /audit)
  ↓
PR #5 (proxies + rewire callers)        ← critical: must land before PR #7
  ↓
PR #6 (migrate [username]/route.ts)
  ↓
PR #7 (delete NEXT_PUBLIC_APP_API_TOKEN) ← critical: callers gone first
  ↓
PR #8 (Cloud Run env flip — operator)    ← critical: human gate before flip
```

### Where to look if something breaks mid-rollout

- **`/audit` returns 500 after PR #4 merge** → check Vercel function logs for `getServerSession` errors. Most common cause: `NEXTAUTH_SECRET` missing or truncated in Vercel.
- **Ask widget returns "Network error" after PR #5 merge** → check Vercel function logs for `/api/intelligence/ask` route handler. Most common cause: `REPORIUM_APP_TOKEN` not set in Vercel, or `REPORIUM_API_URL` missing the leading `https://`.
- **Bundle grep test fails after PR #7 merge** → re-run `Grep -r 'NEXT_PUBLIC_APP_API_TOKEN' src/` (it should be empty); if any callers were missed in PR #5/#6, fix them in a hotfix PR before re-running PR #7.
- **`/metrics/latest` returns 500 after PR #8 flip** → check Cloud Run logs for `Server misconfiguration` from `require_metrics_access`. Most common cause: `ADMIN_API_KEY` not actually set on Cloud Run when `METRICS_REQUIRE_AUTH=1` was flipped. Set it (`gcloud run services update reporium-api --update-env-vars ADMIN_API_KEY=<value>`) and the next revision recovers.
