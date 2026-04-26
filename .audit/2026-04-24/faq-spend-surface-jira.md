# JIRA draft — KAN-272 (FAQ spend-surface mitigation)

> **Status:** draft. JIRA CLI not available in this environment; create in
> perditio.atlassian.net by hand or via `gh`-paired automation.

## Summary

`feat(faq): client-side spend-surface mitigation for /faq` — fold a small
client-side budget gate and 1h answer cache into PR #272 before merging the
new public FAQ page that calls `/intelligence/ask` with the public
`NEXT_PUBLIC_APP_API_TOKEN`.

## Type
Improvement (rides on top of feature PR #272).

## Component
`reporium` (frontend) — files touched: `src/components/FAQPanel.tsx` only.

## Background

PR #272 ([github.com/perditioinc/reporium#272](https://github.com/perditioinc/reporium/pull/272))
adds a public `/faq` page with 16 cards. Every card expand fires
`POST /intelligence/ask` from the browser using the public app token. The PR
is CI-green and product-useful, but it strictly *expands* the browser-side
Ask spend surface — `AskBar` enforces a 10/min · 100/day client wallet, and
FAQ today bypasses it entirely.

The real fix is server-side: hold the token on the server and gate
`/intelligence/ask` calls behind a session cookie + per-IP quota. That's a
joint reporium-api + reporium frontend lane, not in scope here. This ticket
is the *small client mitigation* that ships with #272 and buys time.

## Problem
1. FAQ cards do not consume the shared `reporium_ask_timestamps` budget,
   so a user who opens 16 cards plus uses the Ask bar can fire 26+
   `/intelligence/ask` calls before any client guard kicks in.
2. FAQ questions are *hardcoded literals* — there is no reason a refresh
   should refetch any of them. There is no client cache.
3. A bot or curious tab that scripts `details.open = true` on all 16 cards
   will burn 16 tokens of LLM cost per page-load with no friction.

## Fix (this ticket)

Local to `src/components/FAQPanel.tsx` only:

- Read the same `reporium_ask_timestamps` localStorage wallet that
  `AskBar.tsx` writes. Before firing a `/intelligence/ask` request, refuse
  if `minute >= 10` or `day >= 100` and surface a friendly message
  ("you've hit Reporium's per-minute Ask budget — try again in a moment").
- After a successful response, append `Date.now()` to the wallet (mirrors
  `AskBar.recordRequest`).
- Cache successful answers in `localStorage['reporium_faq_answer_cache']`
  keyed by question text, with a 1h TTL. On expand, check cache first and
  short-circuit the fetch if a fresh entry exists.
- Both helpers degrade silently when localStorage is unavailable
  (private browsing, etc.) — the FAQ remains usable, just unmetered/uncached.

## Out of scope (filed elsewhere)

- **Real spend containment** (server-side proxy, session cookie, per-IP
  quota): KAN-LATER-2 in the design memo. This is the only correct
  long-term fix.
- **UX visibility surfaces** (budget meter, grounding badge, cache-age
  pill, unified error voice): owned by Lane Claude Design
  ([reporium-ask-faq-design-memo.md](reporium-ask-faq-design-memo.md))
  Phase 1.

## Acceptance criteria

- [x] On `/faq`, opening a card with `localStorage['reporium_ask_timestamps']`
      already at 10 entries within the past minute results in **zero**
      network calls to `/intelligence/ask` and a visible friendly message.
- [x] Opening a card the *first* time fires one fetch and writes one entry
      to `reporium_faq_answer_cache`.
- [x] Closing and reopening that card does not refetch (handled by existing
      `state.status === 'ready'` guard inside the same component instance).
- [x] Reloading `/faq` and opening the same card serves the answer from
      cache with **zero** new fetches and **zero** new wallet entries.
- [x] Same TTL behavior as the AskBar wallet — entries older than 24h are
      pruned on the next write.
- [x] No new dependencies; no API change; no edits outside FAQPanel.tsx.

## Verification (already done in lane)

Manual verification against `next dev` against /faq, with `window.fetch`
hooked to count `/intelligence/ask` calls:

| Scenario                                    | Fetches | Notes |
| ------------------------------------------- | ------- | ----- |
| Cap at 10/min, then open card               | 0       | budget-gate message renders |
| Reset, open card                            | 1       | cache + wallet write |
| Reload `/faq`, open same card               | 0       | cache hit on cold mount |

## Risk

Low. Single file, ~80 LOC additive. Falls back to current behavior if
localStorage is unavailable. Cannot regress the rest of the Ask surface
because it only reads the wallet (does not change AskBar's writer).

## Notes

- Does *not* defend against an attacker who reads the bundled token. That
  is the architecture lane (KAN-LATER-2).
- The design lane's [reporium-ask-faq-design-memo.md](reporium-ask-faq-design-memo.md)
  Phase 1 surfaces (budget meter, grounding badge) build on the wallet
  this ticket starts paying into. Don't rip the wallet out when those
  ship — extend it.
