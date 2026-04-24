# PR #272 — Decision: merge with mitigation

**Date:** 2026-04-24
**Lane:** `claude/feature/KAN-272-faq-spend-surface-v2` off `main`
**Reviewer:** Claude Opus 4.7 (spend-surface lane)
**Subject:** [PR #272 — feat(faq): add /faq page rendering every curated Ask suggestion](https://github.com/perditioinc/reporium/pull/272)

## TL;DR

**Merge with the small mitigation in this lane.** Do not wait for the
server-side proxy. The proxy is the right long-term fix and is *not* in
scope here, but #272 is product-useful as-is and the local mitigation
removes the worst of the new client-side burn risk in ~80 lines.

## What #272 does

- New public `/faq` page with 16 hardcoded curated questions across 5
  sections, each pinned to a deterministic smart-route in `reporium-api`.
- Each card lazy-fetches `POST /intelligence/ask` on first expand using
  `NEXT_PUBLIC_APP_API_TOKEN` (the same public token the AskBar already
  exposes).
- Adds a `/faq` link to the sticky nav.
- Files: `src/app/faq/page.tsx` (40 LOC), `src/components/FAQPanel.tsx`
  (296 LOC), `src/components/StickyNavBar.tsx` (+8 LOC).

CI is green. The PR is honest about smart-route grounding and the answers
are useful product surface — it's the right Phase-2 build for the trust
story (`/ai-native` slide 2 + 4).

## What #272 makes worse

- **Spend surface widens.** AskBar enforces a `reporium_ask_timestamps`
  client wallet (10/min · 100/day) before allowing `/intelligence/ask`.
  FAQ bypasses it — its own `fetchAnswer` writes nothing to that wallet
  and reads nothing from it. So a user who used the AskBar 8 times in the
  last minute can still expand 16 FAQ cards on top of that with no
  client-side push-back, and a bot can script `details.open = true`
  across all 16 cards in one tick.
- **No cache, despite hardcoded inputs.** FAQ questions are literals.
  Refresh refetches all of them. There is no reason a returning visitor
  should reburn the LLM-summary cards (Comparisons section) when nothing
  in the input changed and the answer was good 30 minutes ago.
- **The token-in-bundle problem is unchanged.** That's true of the whole
  Ask surface today — #272 doesn't make it worse, it just adds another
  call site.

## Why not "wait for server-side proxy"

- The proxy is a real piece of work — new server route, session cookie,
  per-IP quota plumbing, then deletion of `NEXT_PUBLIC_APP_API_TOKEN`
  from the client bundle and migration of all four Ask call sites
  (AskBar, StickyAskBar, AskPanel, FAQPanel). That's a separate joint
  lane (frontend + reporium-api), described as Phase 3 / KAN-LATER-2 in
  [reporium-ask-faq-design-memo.md](reporium-ask-faq-design-memo.md).
- Holding #272 hostage to it costs us a useful product surface for an
  unknown number of weeks. The local mitigation in this lane closes the
  worst *new* burn vector #272 introduces (multi-card expansion bypassing
  the wallet) without pretending to fix the architectural one.
- The mitigation is forward-compatible: when the proxy ships, the
  client-side wallet becomes redundant, not in the way. Pull it out at
  that time.

## Why not "merge as-is"

The two delta costs above are cheap to remove and high-leverage:
- One curious user reading top-to-bottom is the worst case path today
  and could fire 16 LLM calls with no client friction at all.
- Refresh-on-FAQ refires 16 calls. Trivial cache eliminates that.

These are *new* spend vectors specific to #272. We're already on the
hook for AskBar's existing spend surface; this lane keeps #272 from
*widening* it.

## The mitigation (this lane's diff)

Local to `src/components/FAQPanel.tsx`. ~80 additive lines. No new files,
no API change, no other call sites touched.

1. **Shared budget wallet.** Add `readBudget()` and `recordAsk()` helpers
   that read/write the same `reporium_ask_timestamps` localStorage key
   `AskBar.tsx` uses. Same constants (`RATE_PER_MIN = 10`,
   `RATE_PER_DAY = 100`).
2. **Pre-flight gate inside `load()`.** Before firing `fetchAnswer`,
   check the wallet. If `minute >= 10` or `day >= 100`, set state to
   `error` with a friendly message; do not fetch.
3. **Record on success.** After a `'ready'` response, append `Date.now()`
   to the wallet — same pruning policy as AskBar.
4. **1h answer cache.** Add `readCache(question)` / `writeCache(...)`
   against `reporium_faq_answer_cache` keyed by question text. On
   expand, check the cache first; on hit, render directly with zero
   network call. On any successful fetch, write the cache. Cache TTL is
   1 hour; entries older than that are pruned on the next write.
5. **Degrade silently on localStorage failure.** Both helpers `try/catch`
   and fall through to "no wallet, no cache" — `/faq` remains usable in
   private browsing.

That is the entire mitigation. No UI surfaces (no budget meter, no
"served from cache" pill — those belong to the design lane's Phase 1,
which builds on the wallet this lane starts paying into).

## Verified locally (next dev against /faq)

`window.fetch` was hooked to count `/intelligence/ask` calls.

| Scenario                                    | Fetches | Wallet ticks |
| ------------------------------------------- | ------- | ------------ |
| Wallet pre-loaded with 10 timestamps; open card | 0   | 0 (gated)    |
| Reset, open one card fresh                  | 1       | 1            |
| Reload `/faq`, open the same card           | 0       | 0 (cache)    |

Friendly gated message rendered as expected:
`"You've hit Reporium's per-minute Ask budget (10/min). Try again in a moment."`

## Note on future Ask architecture

This lane does **not** replace, defer, or compete with the server-side
proxy. The proxy is the only thing that actually closes the spend
surface; no UI patch can. The mitigation here is a 1h speed-bump that
keeps the *new* `/faq` surface from doubling the existing burn risk
while the proxy is scoped.

When the proxy ships:
- `NEXT_PUBLIC_APP_API_TOKEN` is deleted from the bundle.
- All four Ask call sites switch to same-origin `/api/ask`.
- Per-IP / per-session quotas move to the server.
- The client wallet becomes legacy. Remove it then, in the same lane that
  ships the proxy. Do not rip it out before — losing the wallet would
  un-pace honest users for no architectural gain.

## Recommendation

**Merge with mitigation.** The PR target is `main`; this lane carries
the cherry-picked PR #272 commit plus the mitigation commit on a single
branch (`claude/feature/KAN-272-faq-spend-surface-v2`) so the diff
reviewer sees the full delta against `main` in one PR. The original
`claude/feature/faq-page` PR can be closed in favor of this one, or the
mitigation commit can be folded into PR #272 directly — either is fine,
but the merged result must include the mitigation.

## Stop-conditions check

- ✅ Owned scope respected: only `FAQPanel.tsx` was *modified*.
  `page.tsx` and `StickyNavBar.tsx` are unchanged from #272.
- ✅ No edits outside owned files (`.audit/2026-04-24/*` is the lane's
  decision documentation, not a code change).
- ✅ No merge, no deploy.
- ✅ Honest about backend: server-side proxy is the real fix and is out
  of scope for this lane.
- ✅ No collision with the sibling design lane — that lane authored
  `.audit/2026-04-24/reporium-ask-faq-design-{memo,jira}.md`; this lane
  only adds `pr-272-faq-decision.md` and `faq-spend-surface-jira.md`.
