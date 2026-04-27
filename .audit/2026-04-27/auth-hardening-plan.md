# Auth + Boundary Hardening — Implementation Plan

**Lane:** auth-hardening
**Repos:** `reporium` (primary), `reporium-api` (config-only)
**Author of this plan:** Cowork session 2026-04-27
**Status:** plan-only. PR #1 of this lane is a plan-only PR carrying just this file. PR #2+ carries code.
**Stop-condition rule:** if any step demands a contract change in `reporium-api` (new endpoint, changed shape, changed auth dep), stop and write that up as a separate JIRA before continuing in this lane.

## TL;DR

Reporium's frontend ships a public app token (`NEXT_PUBLIC_APP_API_TOKEN`) in the JS bundle and is deployed as a static export, so cookie/session-based gating is impossible today. The reporium-api side has a feature-flagged metrics gate (`METRICS_REQUIRE_AUTH=1`) that's currently a no-op in production, leaving `/metrics/*` and `/audit/status` browser-public.

This lane removes the static-export deployment constraint, adds GitHub SSO via Auth.js with a server-side org-membership check for `perditioinc`, builds same-origin server proxies for every privileged API surface, and only after every consumer is migrated does it delete the public app token. The metrics gate is flipped *last*, after the proxy carries traffic, to avoid breaking the dashboard for everyone in a single release.

Public Reporium browsing stays open. The `/audit` dashboard becomes perditioinc-only. Any signed-in GitHub user gets insights on their own public repos via a migrated route handler.

## 1. Pre-read (mandatory before any code)

Read in order:

- `reporium/SECURITY-VERCEL-APR19.md` — prior security decisions and constraints
- `reporium/next.config.js` — current static-export + env-bundle setup
- `reporium/src/components/AskBar.tsx` (esp. line 122)
- `reporium/src/components/StickyAskBar.tsx` (compare to AskBar — most informative surface today)
- `reporium/src/components/AskPanel.tsx` (the `/ask` page)
- `reporium/src/components/FAQPanel.tsx` (the `/faq` page)
- `reporium/src/lib/dataProvider.ts` (esp. lines 240–263)
- `reporium/src/server-api/repos/[username]/route.ts` — reference logic, NOT a production handler
- `reporium-api/app/auth.py` (esp. `require_admin_key` and `require_metrics_access`)
- `reporium-api/app/routers/platform.py` (esp. `/metrics/latest` at line 455)
- `reporium/.audit/2026-04-25/reporium-ask-faq-design-memo.md` — already names this lane as "Phase 3" and treats it as the only correct fix to the spend-surface problem

Pre-read deliverable: a `.audit/2026-04-27/auth-hardening-prereads.md` file listing what was read and any surprises (e.g., a fifth Ask surface that didn't exist on 2026-04-25, a different env var, etc.). If the pre-read turns up anything that invalidates this plan, **stop and revise the plan PR before any code work**.

## 2. Key decisions, locked

| Decision | Choice | Why |
|---|---|---|
| Hosting target | Vercel, server-capable Next.js | Sessions, cookies, route handlers, middleware all need server runtime |
| Static export | Remove `output: 'export'` | Required for everything below |
| `trailingSlash: true` | **Keep** unless a concrete routing/auth issue surfaces | Server-capable Next is fine with it; URL/SEO continuity matters |
| Auth library | Auth.js (NextAuth v5+) with GitHub provider | Standard, supported, app-router native |
| OAuth scope | `read:org` (minimum) | Sufficient for membership read; nothing larger needed |
| Org-membership endpoint | `GET /user/memberships/orgs/perditioinc` with the **user's** OAuth token, accept where `state == "active"` | `/orgs/{org}/members/{username}` only sees public membership; most company org membership is private. The user-token endpoint sees the user's own active memberships regardless of visibility |
| Membership cache | Boolean only, in the session JWT/DB record. **Never cache the raw OAuth token** | Token rotates; boolean is the access decision |
| Privileged API access | Same-origin route handlers in `reporium`'s `app/api/` calling `reporium-api` with server-held secrets | The browser must never see admin or app tokens |
| Metrics gate flip | Phased: proxy → verify → flip env → drop direct calls | Flipping the env first breaks the dashboard for everyone |
| API contract | Frozen for this lane | If a contract change feels needed, file separate JIRA |
| Worktree | Single owned branch off `main` per repo: `claude/feature/KAN-AUTH-hardening` | Lane discipline matches existing `.audit/` pattern |

## 3. Phased rollout — 8 PRs, in order

### PR #1 — plan-only (this file)

- Adds `reporium/.audit/2026-04-27/auth-hardening-plan.md` (this content) and `reporium/.audit/2026-04-27/auth-hardening-prereads.md` (notes from §1).
- No code change.
- Reviewer can stop the lane here if the plan looks wrong; everything below assumes PR #1 is approved.

### PR #2 — remove static export

- `reporium/next.config.js`: delete `output: 'export'`. Keep `trailingSlash: true`. Keep the existing `env` block as-is for now (the keys are still in use; deletion comes in PR #7).
- Move the dev-only `rewrites()` for `/api/proxy/:path*` to a real production same-origin proxy under `app/api/proxy/[...path]/route.ts`. (Even before SSO lands, the proxy path must work in prod, not just dev — that's exactly the gap that makes the static-export comment in `next.config.js` accurate today.)
- Verify Vercel deploy: framework auto-detects Next.js, build command stays `next build`, no `next export`.
- Verify the home, `/ask`, `/faq`, `/wiki/*`, `/graph/*` routes all still load and behave identically. Snapshot one anonymous network trace before/after to prove no functional regression.
- **Acceptance:** Vercel deploy is green, all existing pages render, no behavior change visible to a logged-out user.

### PR #3 — Auth.js GitHub provider, no UI yet

- Add deps: `next-auth@^5` (or `@auth/nextjs` if Auth.js v5 is installed under that name in your monorepo).
- New `src/lib/auth.ts` with `authOptions`: GitHub provider, scope `read:org user:email`, JWT session strategy, callbacks scaffolded but no membership check yet.
- New env vars (Vercel: prod + preview): `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Document in `reporium/.env.example`.
- Register GitHub OAuth app: callback URLs `https://reporium.com/api/auth/callback/github` (prod) and `https://reporium-*.vercel.app/api/auth/callback/github` (preview).
- New `src/app/api/auth/[...nextauth]/route.ts` to mount the handler.
- Add a `/sign-in` page (server component, single button) for testing.
- **Acceptance:** a developer can sign in with GitHub at `/sign-in` and `getServerSession()` returns their `name`, `email`, `login`. Membership check not yet wired.

### PR #4 — server-side perditioinc membership check + protected `/audit`

- New `src/lib/github-org-check.ts`:
  ```ts
  // GET /user/memberships/orgs/perditioinc with user OAuth token.
  // 200 + state==="active"  → member
  // 200 + state==="pending" → not member yet (treat as deny)
  // 403/404                  → not member
  // 5xx                      → fail closed (deny + log)
  // Returns boolean.
  ```
- Auth.js `jwt` callback: on first sign-in, call `isPerditioMember(token)`, store the boolean in the JWT as `isPerditioMember`. **Do not** persist the OAuth token after the check.
- Augment session type in `src/types/next-auth.d.ts` to include `isPerditioMember: boolean` and `login: string`.
- New `src/middleware.ts` matching `/audit/:path*`: redirect anonymous to `/sign-in?from=/audit`; respond 403 (or render an `/audit/access-denied` page) for signed-in non-members.
- New `src/app/audit/page.tsx`: server component, calls `getServerSession()`, renders the audit dashboard for `isPerditioMember === true` only. Lift the HTML structure from the existing `reporium-suite-audit-dashboard` Cowork artifact (`C:\Users\PERDITIO\reporium-audit-2026-04-27\` for reference; do not import the artifact wholesale, it has Cowork-specific bindings).
- Add `/audit/access-denied` page for the 403 path.
- **Acceptance:** anon → sign-in redirect; signed-in non-member → 403; signed-in active perditioinc member → audit dashboard renders. All three states have a Playwright/Vitest test.

### PR #5 — same-origin proxy for `/intelligence/ask` and metrics

- New env vars (server-only — no `NEXT_PUBLIC_` prefix): `REPORIUM_API_URL`, `REPORIUM_APP_TOKEN`, `REPORIUM_ADMIN_KEY`. The first replaces today's `NEXT_PUBLIC_REPORIUM_API_URL` for server-side use; the latter two were never browser-safe.
- New `src/app/api/intelligence/ask/route.ts`: POST forwarding handler. Reads request body, forwards to `${REPORIUM_API_URL}/intelligence/ask` with `X-App-Token: ${REPORIUM_APP_TOKEN}` server-side. Streams the SSE response back unchanged.
- New `src/app/api/admin/metrics/[...path]/route.ts`: server handler for metrics surfaces. **Requires** `getServerSession()` to return `isPerditioMember === true`; otherwise 403. Forwards to `${REPORIUM_API_URL}/metrics/${path}` with `X-Admin-Key: ${REPORIUM_ADMIN_KEY}`.
- Rewire callers — replace `process.env.NEXT_PUBLIC_APP_API_TOKEN` reads with same-origin fetches:
  - `src/components/AskBar.tsx` line 122 + the fetch call site
  - `src/components/StickyAskBar.tsx` (mirror change)
  - `src/components/AskPanel.tsx`
  - `src/components/FAQPanel.tsx`
  - `src/lib/dataProvider.ts` `buildHeaders()` lines 258–263 (delete the `X-App-Token` branch — same-origin handler holds the token now)
- The audit dashboard's metrics fetches go through `/api/admin/metrics/*`, never directly to Cloud Run.
- **Acceptance:** every Ask surface still answers questions; the audit dashboard still renders metrics; bundle has zero references to `process.env.NEXT_PUBLIC_APP_API_TOKEN` *in functions that fire requests*. (The `next.config.js` `env` declaration is still present at this stage; deletion in PR #7.)

### PR #6 — migrate `[username]/route.ts` to `app/api/`

- Move `src/server-api/repos/[username]/route.ts` to `src/app/api/repos/[username]/route.ts`. Adjust imports.
- Refactor: extract the public-repo fetch + enrichment functions to `src/lib/github-public-repos.ts` so the route handler is a thin wrapper.
- Add a default-route convenience: `src/app/api/me/repos/route.ts` returns the signed-in user's own public repos by reading `session.login` and calling the same lib. Backs the "any signed-in GitHub user gets insights on their own public repos" feature.
- Delete `src/server-api/` after confirming no remaining imports.
- The 4 worktree copies (`.claude/worktrees/sad-elion/...`, `dazzling-kilby`, `thirsty-galileo`, `faq-ask-followup`) are untouched — they belong to other lanes.
- **Acceptance:** `GET /api/repos/{login}` returns the same shape it did from `src/server-api/`; `GET /api/me/repos` returns the signed-in user's own repos; `src/server-api/` no longer exists.

### PR #7 — remove `NEXT_PUBLIC_APP_API_TOKEN` from the bundle

**Order matters here.** The token disappears from the bundle *only after* every consumer is gone (PRs #5 and #6).

- Sweep the entire `reporium/src/` tree for `NEXT_PUBLIC_APP_API_TOKEN`. Expected hits after PRs #5–#6: zero in `src/`. If any remain, fix them before continuing.
- Delete the line from `next.config.js:14`.
- Add a build-time guard test: a script that runs `next build` against a temp dir and greps `out/_next/static/chunks/*.js` (or `.next/static/chunks/*.js` after server build) for both `NEXT_PUBLIC_APP_API_TOKEN` (the literal env name) and the actual production token value (loaded from a CI secret, never committed). Test fails on any match.
- Remove the env var from Vercel project settings.
- **Acceptance:** the bundle-grep test is green in CI; the prod bundle has zero references; the dashboard still works through the proxy.

### PR #8 — operator: flip `METRICS_REQUIRE_AUTH=1` (Cloud Run env, not a code PR)

This is **the last step**, not the first. The order is non-negotiable, and the gate before step 2 is a human gate, not a CI gate.

**Pre-flip human gate.** A human operator (not Claude Code, not CI) must verify on the Vercel production deployment:
- (a) Every audit dashboard metrics call goes to same-origin `/api/admin/metrics/*`.
- (b) Zero direct browser calls to `*.run.app/metrics/*`.
- (c) Zero direct browser calls to `*.run.app/audit/status`.
- (d) Network trace (HAR or DevTools screenshot) capturing (a)–(c) is attached to PR #8's description.

If any direct browser call to those paths is still observed, **do not proceed**. Open a new lane to track down the remaining caller, ship that fix, then re-run the gate.

**After the gate passes:**

1. Set `METRICS_REQUIRE_AUTH=1` on the `reporium-api` Cloud Run service:
   `gcloud run services update reporium-api --update-env-vars METRICS_REQUIRE_AUTH=1 --region=us-central1`
2. Wait for the next revision to come up healthy (~30–60s).
3. Confirm anonymous browser hits to `${API}/metrics/*` return 403; same-origin proxy hits return 200 (test rows T13 and T14).
4. Update `reporium-api/.env.example` to flag `METRICS_REQUIRE_AUTH=1` as the production default.

If step 3 returns 200 for anonymous, **rollback step 1** immediately — that means there's still a direct browser caller somewhere that the human gate missed:
`gcloud run services update reporium-api --remove-env-vars METRICS_REQUIRE_AUTH --region=us-central1`

## 4. Files touched (proposed)

**`reporium` (frontend):**

| File | Action | Purpose |
|---|---|---|
| `next.config.js` | Edit | Remove `output: 'export'`; later (PR #7) drop `NEXT_PUBLIC_APP_API_TOKEN` from `env` |
| `package.json` | Edit | Add `next-auth` |
| `src/lib/auth.ts` | New | Auth.js config |
| `src/lib/github-org-check.ts` | New | Server-side org membership |
| `src/lib/github-public-repos.ts` | New | Extracted from server-api/ |
| `src/types/next-auth.d.ts` | New | Session augmentation |
| `src/middleware.ts` | New | Protect `/audit/*` |
| `src/app/api/auth/[...nextauth]/route.ts` | New | Auth.js handler mount |
| `src/app/api/intelligence/ask/route.ts` | New | Same-origin ask proxy |
| `src/app/api/admin/metrics/[...path]/route.ts` | New | Same-origin metrics proxy (perditio-gated) |
| `src/app/api/repos/[username]/route.ts` | New (migrated from `server-api/`) | Public-repo route |
| `src/app/api/me/repos/route.ts` | New | Signed-in user's own repos |
| `src/app/api/proxy/[...path]/route.ts` | New | Promote dev rewrite to prod proxy |
| `src/app/audit/page.tsx` | New | Protected audit dashboard |
| `src/app/audit/access-denied/page.tsx` | New | 403 view for non-members |
| `src/app/sign-in/page.tsx` | New | Sign-in entry |
| `src/components/AskBar.tsx` | Edit | Drop `NEXT_PUBLIC_APP_API_TOKEN` read; call `/api/intelligence/ask` |
| `src/components/StickyAskBar.tsx` | Edit | Same |
| `src/components/AskPanel.tsx` | Edit | Same |
| `src/components/FAQPanel.tsx` | Edit | Same |
| `src/lib/dataProvider.ts` | Edit | Drop `X-App-Token` branch in `buildHeaders` |
| `src/server-api/` | Delete | After PR #6 migration |
| `tests/auth/*.test.ts` | New | Three-state tests + bundle grep |
| `.audit/2026-04-27/auth-hardening-plan.md` | New (PR #1) | This file |
| `.audit/2026-04-27/auth-hardening-prereads.md` | New (PR #1) | Pre-read notes |
| `.env.example` | Edit | Add new server-side keys; document removal of `NEXT_PUBLIC_APP_API_TOKEN` |

**`reporium-api` (backend):**

| File | Action | Purpose |
|---|---|---|
| `app/auth.py` | None | `require_metrics_access` already correct; activated via env |
| `app/routers/platform.py` | None | Gate dependency already wired |
| `.env.example` | Edit (PR #8) | Document `METRICS_REQUIRE_AUTH=1` as prod default |

## 5. Test matrix

| ID | Scenario | Expected | Lane |
|---|---|---|---|
| T1 | Anon hits `/audit` | 302 to `/sign-in?from=/audit` | PR #4 |
| T2 | Signed-in non-perditioinc member hits `/audit` | 403 (or `/audit/access-denied`) | PR #4 |
| T3 | Signed-in active perditioinc member hits `/audit` | 200, dashboard renders | PR #4 |
| T4 | Signed-in pending perditioinc invite hits `/audit` | 403 (state ≠ active) | PR #4 |
| T5 | Anon hits `/api/admin/metrics/latest` | 401 | PR #5 |
| T6 | Signed-in non-member hits `/api/admin/metrics/latest` | 403 | PR #5 |
| T7 | Signed-in member hits `/api/admin/metrics/latest` | 200, payload from API | PR #5 |
| T8 | Anon hits `/api/intelligence/ask` POST | 200 with rate-limit (proxy enforces) | PR #5 |
| T9 | Anon hits `/ask`, `/faq`, `/`, `/wiki/*`, `/graph/*` | 200, public Reporium browsing intact | PR #2/#5 |
| T10 | Signed-in user hits `/api/me/repos` | 200, their own public repos | PR #6 |
| T11 | Bundle grep for `NEXT_PUBLIC_APP_API_TOKEN` literal in `chunks/*.js` | zero matches | PR #7 |
| T12 | Bundle grep for the actual prod token value | zero matches | PR #7 |
| T13 | Anonymous direct call to `${API}/metrics/latest` after PR #8 | 403 | PR #8 |
| T14 | Same-origin proxy call to `/api/admin/metrics/latest` after PR #8 | 200 | PR #8 |

## 6. Rollout & rollback

**Vercel side (rollout):**
- Each PR deploys to a preview URL first.
- Smoke-test the preview against the matching test rows above.
- Promote to production on green CI + reviewer approval.

**GCP side (rollout, PR #8 only):**
- Set env on `reporium-api` Cloud Run service via `gcloud run services update --update-env-vars METRICS_REQUIRE_AUTH=1`.
- Wait for next revision to come up healthy (~30–60s).
- Run T13 + T14 within 5 min.

**Rollback:**
- PRs #2–#7: standard Git revert + Vercel re-deploy.
- PR #8: `gcloud run services update --remove-env-vars METRICS_REQUIRE_AUTH` (or set to `0`). Re-deploys in ~30s.
- If PRs #2 or #3 introduce session/cookie problems with `trailingSlash: true`, that's the *only* concrete trigger for removing it. Document the symptom in a follow-up `.audit/` note before changing it.

## 7. What this lane does NOT do

- Does not change any `reporium-api` endpoint shapes or auth deps. (`require_metrics_access` already exists; we only flip the env that activates it.)
- Does not redesign the Ask UX. The Apr 25 design memo's Phase 1 (`<AnswerReceipt />`, `<WalletMeter />`, cache-age pill, source attestations) is a separate lane that *builds on* this one.
- Does not unify the four Ask surfaces (`AskBar`, `StickyAskBar`, `AskPanel`, `FAQPanel`). Same comment.
- Does not touch the knowledge-graph quality issue (60.1% invalid edges). Separate lane.
- Does not address the 5-night Nightly Graph Build red streak. That's `reporium-ingestion` + ops.
- Does not move the public marketing/library experience behind auth. Only `/audit/*` is gated.
- Does not migrate any `reporium-api` endpoints to use OAuth tokens. The frontend proxy uses the existing app/admin keys server-side; that's the simplest correct fix and avoids a contract change in `reporium-api`.

## 8. Open questions for the reviewer

1. **Session storage:** JWT (default) or DB? JWT is simplest; DB lets you revoke tokens server-side. Default to JWT unless reviewer prefers DB.
2. **Org-membership re-check cadence:** check on sign-in only, or on every session refresh? Default: re-check on every session refresh (~1h) — cheap (1 GitHub API call) and keeps the boolean fresh after a member is removed.
3. **Sign-in UX:** dedicated `/sign-in` page (proposed) or hidden behind `/audit` redirect with a Toast on the public side? Default: dedicated page; clearer for the "any user can sign in" feature.
4. **OAuth app vs GitHub App:** OAuth app proposed (simpler, smallest scope). Reviewer: is there an org-policy reason to require a GitHub App? If yes, document and we adjust PR #3.
5. **`trailingSlash: true`:** keep unless concrete issue. Reviewer: any pre-existing canonical/SEO commitments to redirect-without-slash? If yes, change in a follow-up, not here.

## 9. Provenance + cross-references

- Cowork audit 2026-04-27: `C:\Users\PERDITIO\reporium-audit-2026-04-27\AUDIT.md` (P0 findings D2, D3 reference this lane as the only correct fix)
- Apr 25 Ask/FAQ design memo: `reporium/.audit/2026-04-25/reporium-ask-faq-design-memo.md` §5 + §6 Phase 3 (treats this lane as Phase 3 of the spend-surface fix)
- Existing security note: `reporium/SECURITY-VERCEL-APR19.md` (must be read in §1 pre-read)
- Auth.js docs: https://authjs.dev/
- Next.js route handlers: https://nextjs.org/docs/app/getting-started/route-handlers-and-middleware
- GitHub OAuth scopes: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- GitHub user memberships endpoint: `GET /user/memberships/orgs/{org}` — https://docs.github.com/en/rest/orgs/members#get-an-organization-membership-for-the-authenticated-user
- Next.js static export limitations: https://nextjs.org/docs/app/building-your-application/deploying/static-exports
