# Frontend Merge Gate — FAQ Lane (KAN-272)

**Date:** 2026-04-25
**Lane:** Frontend merge gate for `/faq` + spend-surface mitigation
**Workspace:** `C:\DEV\PERDITIO_PLATFORM\reporium`
**Owned scope:** `src/app/faq/page.tsx`, `src/components/FAQPanel.tsx`, `src/components/StickyNavBar.tsx`, `.audit/2026-04-25/`

---

## Live state (re-verified via `gh` + `git fetch` at 2026-04-25 ~03:15 PDT)

| Field | PR #273 (real lane) | PR #272 (superseded) |
|---|---|---|
| Title | feat(faq): /faq + client spend-surface mitigation (KAN-272, supersedes #272) | feat(faq): add /faq page rendering every curated Ask suggestion |
| Branch | `claude/feature/KAN-272-faq-spend-surface` | `claude/feature/faq-page` |
| HEAD | `6d595a1` | `63c33e4` |
| Base | `main` | `main` |
| State | OPEN, MERGEABLE, **CLEAN** | OPEN, MERGEABLE, CLEAN |
| Checks | lint-and-build ✅ (6m14s, run 24928235148), security ✅ (25s), Vercel ✅ SUCCESS (10:08:16Z), Vercel Preview Comments ✅ | lint-and-build ✅, security ✅, Vercel ✅, Vercel Preview Comments ✅ |
| Commits ahead of main | 5 | 1 |
| Files changed | 8 (3 src + 5 audit notes) | 3 (all src, in owned scope) |
| Local branch == remote HEAD | yes (6d595a1 == 6d595a1) | n/a (gate lane only) |

`origin/main` is at `53e36ae`. Merge base of #273 is `8224e3a`. No conflicts. Vercel preview flipped UNSTABLE → CLEAN since the earlier dispatch revalidation; no code changes between then and now.

## Spend-surface mitigation — present and local to owned scope

Verified in `src/components/FAQPanel.tsx`:

- **Lazy fetch** (`FAQCard.load`, line 241) — `/intelligence/ask` fires only on user `onToggle` open, not on mount. 16 cards → 0 fetches at first paint.
- **Shared client budget** with AskBar (lines 14–16) — `RATE_KEY = 'reporium_ask_timestamps'`, `RATE_PER_MIN=10`, `RATE_PER_DAY=100`. FAQ expansions and `/ask` submissions draw from one wallet.
- **Per-question 1h cache** (lines 19–20, 57–85) — repeat opens on the same question in a session do not re-hit the API; TTL pruned on write.
- **Budget-exhausted UI states** (lines 250–264) — minute/day caps short-circuit before any fetch, with explicit copy and a Retry button.
- **Honest scope comment** (lines 11–13) — explicitly notes server-side proxy is required to stop a determined attacker (Phase 3 follow-up). This is the only remaining gap and it is backend architecture, not a frontend blocker.

`StickyNavBar.tsx` change is the FAQ entry in `NAV_LINKS` (line 71) and the inline `faq` icon (lines 53–59). Pure additive nav surface.

`src/app/faq/page.tsx` is the WikiNavBar shell + `<FAQPanel />`. No data-fetching at the page boundary.

## Check status — fully green

PR #273 is now `mergeStateStatus = CLEAN`. All gates green:

- `lint-and-build` PASS (6m14s) on run 24928235148
- `security` PASS (25s) on the same run
- `Vercel` SUCCESS (preview deploy completed 10:08:16Z)
- `Vercel Preview Comments` PASS

No transient state remaining. No human wait required.

## Decision

### PR #273 — **MERGE NOW**

Mitigation is real, local to the owned scope, and matches the design memo committed to this branch. The remaining concern (server-side proxy / signed-token gateway to defeat localStorage clearing) is explicitly out-of-scope per the gate's stop conditions — it is backend architecture and does not invalidate the present client-side mitigation. All checks green; ready for merge button. Do not deploy from this lane (process rule 9).

### PR #272 — **SUPERSEDED**

Close as superseded by #273 with no merge. #272 carries the `/faq` page without the spend-surface mitigation; #273 contains the same `/faq` page **plus** the lazy-fetch + shared-budget + cache work. Merging #272 would ship the unmitigated surface that #273 was created to fix. Recommended close comment: *"Superseded by #273 which adds the KAN-272 client spend-surface mitigation on top of this branch's `/faq` page. Closing without merge — all changes here are subsumed by #273."*

## No tiny patch required

Reviewed every line of the three owned files. No nits worth blocking on; comments are accurate; no dead code; no `console.log`; sanitizer (`rehype-sanitize`) is wired on the markdown render; `noopener noreferrer` is present on every external link.

## Stop condition acknowledgement

Per gate rules 9 and 10: not merging, not deploying, not broadening into Ask UX work. Server-side proxy / signed-token rate-limiting noted as Phase 3 follow-up in the existing design memo (`.audit/2026-04-25/reporium-ask-faq-design-memo.md`) and tracked under KAN-272 — not blocking #273.
