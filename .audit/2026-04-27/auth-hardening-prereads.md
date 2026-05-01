# Auth + Boundary Hardening — Pre-read Notes

**Lane:** auth-hardening
**Date:** 2026-04-27
**Branch:** `claude/feature/KAN-AUTH-hardening` (worktree at `.claude/worktrees/auth-hardening/`, off `origin/main` @ `57901f7`)
**Companion:** [`auth-hardening-plan.md`](auth-hardening-plan.md)

This file is the §1 deliverable of the plan: a record of what was read, what was confirmed, and any surprises that should change the plan before code work starts.

## 1. Files read (11 of 11)

In the order the plan §1 specified:

| # | File | Result |
|---|---|---|
| 1 | [`SECURITY-VERCEL-APR19.md`](../../SECURITY-VERCEL-APR19.md) | Read in full |
| 2 | [`next.config.js`](../../next.config.js) | Read in full (55 lines) |
| 3 | [`src/components/AskBar.tsx`](../../src/components/AskBar.tsx) | Read in full (434 lines) |
| 4 | [`src/components/StickyAskBar.tsx`](../../src/components/StickyAskBar.tsx) | **Could not read in one shot** — 35,209 tokens, exceeds 25,000 reader limit. Searched via `Grep` for token references; lines 160–209 read for SSE event shape verification. Full review will need offset/limit reads in PR #5. |
| 5 | [`src/components/AskPanel.tsx`](../../src/components/AskPanel.tsx) | Read in full (281 lines) |
| 6 | [`src/components/FAQPanel.tsx`](../../src/components/FAQPanel.tsx) | Read in full (402 lines) |
| 7 | [`src/lib/dataProvider.ts`](../../src/lib/dataProvider.ts) | Read in full (619 lines) |
| 8 | [`src/server-api/repos/[username]/route.ts`](../../src/server-api/repos/[username]/route.ts) | Read in full (325 lines) |
| 9 | `reporium-api/app/auth.py` | Read in full (219 lines) — sibling repo, outside worktree |
| 10 | `reporium-api/app/routers/platform.py` | Read in full (841 lines) — sibling repo, outside worktree |
| 11 | [`.audit/2026-04-25/reporium-ask-faq-design-memo.md`](../2026-04-25/reporium-ask-faq-design-memo.md) | Read in full (215 lines) |

## 2. Confirmations (plan-as-written holds up)

- **`next.config.js` static-export** at line 6 (`output: 'export'`) and `trailingSlash: true` at line 7 — both as plan describes. The dev-only `rewrites()` block at lines 31-41 with the comment "rewrites are ignored during `next export`" matches plan's PR #2 framing.
- **`AskBar.tsx:122`** — `const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '';` — exactly as cited.
- **`dataProvider.ts:258-263`** — `buildHeaders` does read `NEXT_PUBLIC_APP_API_TOKEN` and attach `X-App-Token`. Plan citation correct.
- **`reporium-api/app/auth.py:86-110`** — `require_metrics_access` is exactly as plan describes: feature-flagged on `METRICS_REQUIRE_AUTH=1`, no-op when unset, timing-safe `_secrets_equal`. The gate is real and ready; PR #8's env flip is all that activates it.
- **`reporium-api/app/routers/platform.py:455`** — `/metrics/latest` IS gated by `Depends(require_metrics_access)`. **Plus** every other metrics endpoint in the file (`/audit/status:555`, `/metrics/slo:585`, `/metrics/latency:610`, `/metrics/backfill:630`, `/metrics/graph-quality:642`, `/metrics/data-quality:654`, `/metrics/prometheus:732`, `/metrics/spend:743`, `/metrics/export:774`, plus the legacy alias `/platform/metrics:546`). The catch-all proxy `/api/admin/metrics/[...path]/route.ts` proposed in plan §5 is the right shape — there are 10 gated metrics endpoints, not 1.
- **Apr 25 design memo** explicitly names this lane as "Phase 3" (memo §6) and treats it as the only correct fix to the spend surface (memo §5.1, §7). Plan is consistent with the memo.
- **GitFlow / branch direction.** CLAUDE.md says "Feature branches off **dev**, PRs target **dev**." That is documentation drift: `origin/dev` does not exist on the remote (`git ls-remote --heads origin` returns only `main` plus feature branches), and the 5 most-recent merged PRs (#269, #270, #271, #273, #274) all target `main`. The de-facto convention is `claude/feature/...` → `main`, which matches the plan as written. **Recommend updating CLAUDE.md in a separate housekeeping PR**, not this lane.

## 3. Surprises that change PR #5 / PR #7 file scope

These are not strategy-level deviations — the plan's overall approach (proxy → migrate → delete → flip) holds. They are **enumeration gaps in the plan's file list**.

### 3.1 Five Ask/AI surfaces, not four

Plan §5 names 4 token consumers: `AskBar`, `StickyAskBar`, `AskPanel`, `FAQPanel`. The full grep (across `src/`) finds **five**:

| File:line | Surface | Endpoint |
|---|---|---|
| `src/components/AskBar.tsx:122,213` | inline ask widget | `/intelligence/ask/stream` |
| `src/components/StickyAskBar.tsx:293,1245` | sticky ask dock | `/intelligence/ask/stream` |
| `src/components/AskPanel.tsx:47` (via `dataProvider.askQuestion`) | `/ask` page | `/intelligence/ask` |
| `src/components/FAQPanel.tsx:9,212` | `/faq` page | `/intelligence/ask` |
| **`src/components/NLFilterBar.tsx:18,51`** | NL filter bar | **`/intelligence/nl-filter`** |

`NLFilterBar.tsx` is missing from plan §5. It calls a *different* endpoint (`/intelligence/nl-filter`, not `/intelligence/ask`), so PR #5's same-origin proxy needs a second route handler: `src/app/api/intelligence/nl-filter/route.ts`. Already cross-referenced in the **April 19 security memo** (`SECURITY-VERCEL-APR19.md` lists `NLFilterBar.tsx:18` as a `NEXT_PUBLIC_APP_API_TOKEN` consumer at HIGH rotation priority); the plan inherited the gap from somewhere else, not from the security memo.

### 3.2 Two token-set sites in `dataProvider.ts`, not one

Plan §5 says "delete the `X-App-Token` branch" referring to `buildHeaders` at lines 258-263. There is a **second** site in the same file at line 593 inside the `askQuestion()` method that also sets `X-App-Token` from an `options.app_token` parameter. AskPanel calls into `askQuestion()` at `AskPanel.tsx:129` passing `app_token: APP_TOKEN`. So PR #5 must:

1. Delete `buildHeaders` X-App-Token branch (`dataProvider.ts:263-264`).
2. Either delete `askQuestion`'s `app_token` option entirely, **or** rewrite `askQuestion` to call same-origin `/api/intelligence/ask` rather than the upstream `${this.apiUrl}/intelligence/ask` at line 597.
3. Update the AskPanel call site at `AskPanel.tsx:129` to stop passing `app_token`.

The cleaner shape is: rewrite `askQuestion` to hit the proxy and remove the `app_token` option from its signature. That keeps the abstraction clean and avoids leaving a dead parameter behind.

### 3.3 User-facing error strings literally name the env var

Two surfaces have user-facing error text that includes the string `NEXT_PUBLIC_APP_API_TOKEN`:

- `src/components/FAQPanel.tsx:202` — `'Ask is not configured in this environment (missing NEXT_PUBLIC_APP_API_TOKEN).'`
- `src/components/StickyAskBar.tsx:1278` — `'Ask is not configured in this environment (missing NEXT_PUBLIC_APP_API_TOKEN). Contact the site owner.'`

After PR #5 (proxy lands) and PR #7 (env var deleted), these strings will be wrong — the env var no longer exists, the proxy's failure mode is different (server-side misconfig, not browser-side). PR #5 should update them to a generic "Ask is temporarily unavailable" or similar, and PR #7's bundle-grep test should also fail on these literal mentions if they're not updated.

**Recommend:** add to PR #5's file list and acceptance criteria. Add to PR #7's bundle-grep test (it will catch this for free if the test searches for the literal `NEXT_PUBLIC_APP_API_TOKEN` across all bundle chunks, including ones that contain user-visible error strings).

### 3.4 `StickyAskBar.tsx` line numbers in cross-references are stale

The April 19 security memo cites `StickyAskBar.tsx:174` for the `NEXT_PUBLIC_APP_API_TOKEN` read. Current line is 293; the file has grown to ~1278+ lines since the memo was written. The plan does not cite a specific line for StickyAskBar, so plan is unaffected — this note is for whoever does the actual rewrite in PR #5.

The file is also large enough that the Read tool cannot ingest it whole (35k tokens > 25k limit). PR #5 will need to read/edit it in slices. This is a code-health observation, not a blocker; out of scope to refactor here.

## 4. Open questions that the plan §8 already names — no new ones

Plan §8 lists 5 open questions (session storage, re-check cadence, sign-in UX, OAuth-vs-GitHub-App, `trailingSlash`). The pre-read did not turn up new open questions beyond those.

## 5. Recommended amendments to the plan before approval

If the user wants the committed plan to match what PR #5/#7 will actually do, the following amendments to `auth-hardening-plan.md` are low-effort and should land as a 2nd commit on PR #1:

1. **§1 pre-read list** — add line for `src/components/NLFilterBar.tsx`.
2. **§3 PR #5 "Rewire callers" bullet list** — add `NLFilterBar.tsx`; add note about `dataProvider.ts:593` second token set; rewrite `askQuestion` signature to drop `app_token`.
3. **§3 PR #5 "New env vars" / proxy list** — add `src/app/api/intelligence/nl-filter/route.ts` as a second proxy handler.
4. **§3 PR #5 acceptance** — change "every Ask surface still answers questions" → "every Ask **and NL Filter** surface still works".
5. **§3 PR #5 + PR #7** — add line items: update user-facing error strings at `FAQPanel.tsx:202` and `StickyAskBar.tsx:1278` so they no longer name the env var.
6. **§4 frontend file table** — add `src/components/NLFilterBar.tsx` row (Edit) and `src/app/api/intelligence/nl-filter/route.ts` row (New).
7. **§5 test matrix** — add a row mirroring T8 for the NL filter proxy: anon hits `/api/intelligence/nl-filter` → 200 (proxy enforces rate limit).

If the user prefers to commit the verbatim plan and treat these as known PR #5 scope additions documented only in this prereads file, that is also workable — but the plan's §5 file enumeration will then be incomplete on its own terms.

## 6. Pre-flight environment notes (operator checklist for later PRs)

These do not affect PR #1 but are worth capturing now so they don't get forgotten:

- **GitHub OAuth app registration** (PR #3): callback URLs `https://reporium.com/api/auth/callback/github` (prod) + `https://reporium-*.vercel.app/api/auth/callback/github` (preview). User account is `perditioinc` per CLAUDE.md (note: it's a *user* account, not an org — does not affect the OAuth callback but does affect the `read:org` membership endpoint scope, which still works on user-org memberships via `/user/memberships/orgs/{org}`).
- **Vercel env vars to add** (PR #3 + PR #5): `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `REPORIUM_API_URL`, `REPORIUM_APP_TOKEN`, `REPORIUM_ADMIN_KEY`. All marked Sensitive (per `SECURITY-VERCEL-APR19.md` going-forward §1).
- **Vercel env var to remove** (PR #7): `NEXT_PUBLIC_APP_API_TOKEN`.
- **Cloud Run env var to set** (PR #8 — operator, not Claude Code): `METRICS_REQUIRE_AUTH=1` on `reporium-api` service via `gcloud run services update`.
- **Worktree state**: `.claude/worktrees/auth-hardening/` was created off `origin/main`. The main `reporium` working tree remains untouched on its existing `claude/feature/KAN-272-faq-spend-surface` branch with prior-lane WIP intact.
