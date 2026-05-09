# KAN-272 FAQPanel Cleanup — Deferred Audit Note

**Date:** 2026-05-09  
**Checked by:** Claude Sonnet 4.6 (automated lane)  
**Branch:** `claude/audit/kan-272-cleanup-check-2026-05-09`  
**Prior decision doc:** `.audit/2026-04-24/pr-272-faq-decision.md`

## Summary

This run was triggered to check whether the five gates defined in the KAN-272
cleanup brief ("ship the server-side /api/ask proxy, then remove the FAQPanel
client wallet/cache shim") had all passed. **They have not.** Gates 1, 2, 3,
and 4 all fail. No code was changed.

---

## Gate Results

### Gate 1 — reporium-api has a merged server-side /api/ask proxy: FAIL

Searched `perditioinc/reporium-api` for merged PRs matching "ask proxy" and
for any route file matching the proxy pattern. Both GitHub PR search and
`search_code` returned **0 results**. No `/api/ask` proxy route (or equivalent)
exists in reporium-api at the time of this check. The full closed-PR list for
reporium-api was scanned; no title or commit message referenced an ask proxy,
client-token removal, or KAN-LATER-2 equivalent work.

**Evidence:** `mcp__github__search_pull_requests` on reporium-api with query
`ask proxy` → `{"total_count":0}`. `mcp__github__search_code` for route files
→ `{"total_count":0}`.

### Gate 2 — proxy is actually deployed: FAIL

No proxy was built (Gate 1), so deployment cannot have occurred. Checked
reporium-api README, CHANGELOG, and commit log for any Cloud Run revision
reference, deploy tag, or release note referencing an ask proxy — none found.

### Gate 3 — src/ no longer references NEXT_PUBLIC_APP_API_TOKEN at FAQ/Ask call sites: FAIL

Read `src/components/AskBar.tsx` directly. It still contains:

```ts
const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '';
```

and passes the token as `X-App-Token` to `POST /intelligence/ask/stream`.
The client-side rate-limit wallet (`RATE_KEY = 'reporium_ask_timestamps'`,
`getRateLimitState`, `recordRequest`, 10/min · 100/day) is also fully present.

Note: `src/components/FAQPanel.tsx` no longer references the token (see Gate 4
explanation), but the gate requires it to be gone from all four named call
sites; AskBar.tsx is sufficient to fail the gate.

### Gate 4 — FAQPanel.tsx still contains the wallet/cache shim: FAIL

**The shim is already gone — but not via the expected proxy lane.**

Current `src/components/FAQPanel.tsx` (SHA `75bd1bb`) is a pure static renderer
that fetches `/data/faq.json` on mount. Its top-of-file comment reads:

> "Pure renderer over public/data/faq.json (built by scripts/build-faq.ts at
> refresh time). No live API calls, no rate-limit machinery, no per-visitor
> token spend."

The symbols `RATE_KEY`, `CACHE_KEY`, `readBudget`, `recordAsk`, `readCache`,
`writeCache`, and `CachedAnswer` are entirely absent. The component is ~230 LOC
of render-only code with no API call.

**How it happened:** PR #282 (commit `554873c0`, merged 2026-05-01) implemented
a fundamentally different architectural fix — pre-computing FAQ answers at
refresh time via `scripts/build-faq.ts` into `public/data/faq.json`, making
all per-visitor `/intelligence/ask` calls unnecessary. The commit message
explicitly states: *"src/components/FAQPanel.tsx: pure renderer; drops the
entire wallet/cache/abort/429 machinery (~150 LOC → ~30 LOC + sections)."*

This means the cleanup task this brief was designed for is already complete for
FAQPanel, but through a route not anticipated by the original plan. The
codebase has diverged from the prompt's architectural assumptions. Per the
guardrails, improvising an alternative cleanup is not appropriate here.

### Gate 5 — removing the shim won't weaken rate control: N/A

Gate 4 failed (shim already absent); this gate is moot.

---

## What Changed Since the Original Decision Doc

| Date | Commit / PR | What happened |
|------------|-------------|---------------|
| 2026-04-26 | PR #273, commit `71a48bb` | FAQ page + wallet/cache shim merged to main |
| 2026-05-01 | PR #282, commit `554873c0` | FAQPanel rewritten as pure static renderer; wallet/cache machinery removed entirely as part of the pre-compute approach |
| 2026-05-01 | PR #294, commit `605ecd06` | cache: 'force-cache' bug fixed in FAQPanel |
| 2026-05-03 | PR #303, commit `33b44bd8` | KAN-183 performance fix: defer markdown render to expand-time |

---

## What Is Still Open

The server-side proxy (KAN-LATER-2) was never built. The original motivation
for it — eliminating `NEXT_PUBLIC_APP_API_TOKEN` from the client bundle and
moving rate control to the server — **remains unaddressed for AskBar, AskPanel,
and StickyAskBar**, which still call `POST /intelligence/ask/stream` directly
with the public token.

The FAQ spend surface has been independently closed by the pre-compute approach
(no live Ask calls from /faq at all), so the proxy is no longer required for
FAQ specifically. But the broader token-in-bundle problem and server-side quota
gap for the Ask bar remain open.

---

## Recommendation

The FAQPanel cleanup described in `.audit/2026-04-24/pr-272-faq-decision.md`
is effectively complete via a better route: the FAQ page makes zero live API
calls and the wallet shim has already been deleted. No further action is
needed for FAQPanel specifically. The correct next check is the broader
KAN-LATER-2 scope: (1) implement the server-side `/api/ask` proxy in
reporium-api with per-IP or per-session quota enforcement at least as strict
as the current client wallet, (2) remove `NEXT_PUBLIC_APP_API_TOKEN` from
the client bundle, and (3) migrate `AskBar.tsx`, `StickyAskBar.tsx`, and
`AskPanel.tsx` to the same-origin proxy — then remove the client wallet from
those files in that same lane. Re-run this cleanup check after those three
steps are confirmed merged and deployed.
