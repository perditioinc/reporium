# Reporium Ask / FAQ — Design Memo (KAN-272 sibling lane)

**Date:** 2026-04-25
**Lane:** Claude Design — safer Reporium Ask / FAQ UX
**Branch:** `claude/feature/KAN-272-faq-spend-surface` (existing, off `main`)
**Status:** design-only (no production code change in this lane)
**Companion docs:**
- [`pr-272-faq-decision.md`](../2026-04-24/pr-272-faq-decision.md) — merge-with-mitigation rationale
- [`faq-spend-surface-jira.md`](faq-spend-surface-jira.md) — KAN-272 mitigation re-validation
- [`reporium-ask-faq-design-jira.md`](reporium-ask-faq-design-jira.md) — this lane's JIRA draft

## TL;DR

PR [#272](https://github.com/perditioinc/reporium/pull/272) is product-useful and should ship with the in-tree mitigation already on this branch (`7ab8e64`, `285747d`). The remaining gap is **UX, not architecture**: the Ask surface today does not *show* the user what it knows, what it cost, or what budget they have left, and that gap is what makes the spend-surface complaint feel sharper than it actually is.

This memo proposes a small set of trust-and-pacing surfaces that ride on top of the wallet KAN-272 already pays into, plus an honest carve-out for the only thing a UI tweak cannot fix: the public token in the bundle. That part is a backend lane (Phase 3 below); calling it a UI problem would be dishonest.

> **Stop-condition check (per lane prompt rule 11):** the *complete* fix to the spend surface — closing the public-token attack — is server-side, not UI. This memo makes that explicit and only proposes UI work that compounds correctly with the future server proxy. No UI change is offered as a substitute for it.

## 1. Current state — verified against `main` and this branch

Files inspected today (`origin/main` HEAD `53e36ae`, lane HEAD `285747d`):

| File | Role | Wallet? | Cache? | Trust cues today |
| --- | --- | --- | --- | --- |
| `src/components/AskBar.tsx` | Embedded ask widget (e.g. /repos) | yes (writes) | no | "x remaining this minute" warning at <2; injection regex; sources cards w/ % match; 500-char cap |
| `src/components/StickyAskBar.tsx` | Floating dock-style ask | yes (writes) | no (server cache via `cache_hit`) | phase state machine (`warming` cold-start hint); thumbs feedback (`query_id`); model/latency/tokens footer; cache/route badges; injection regex |
| `src/components/AskPanel.tsx` (`/ask`) | Full-page ask | no (delegates to provider) | no | basic source cards, no model/latency footer, no thumbs, no streaming |
| `src/components/FAQPanel.tsx` (`/faq`) | 16-card curated FAQ | yes (reads + writes, KAN-272) | yes (1h, KAN-272) | friendly gated message on cap; markdown w/ rehype-sanitize; source pill list; "Open in Ask" deep link |

Findings:
- **Three Ask surfaces, three different visual languages.** AskBar is compact and warns near the cap; StickyAskBar is the most informative (phase, footer, thumbs, route badge); `/ask` (AskPanel) is the least — no phase machine, no model footer, no thumbs. The user sees more trust cues from a sidebar widget than from the page named "Ask."
- **Wallet is invisible.** Three of four call sites write to `reporium_ask_timestamps`, but the only surface that ever *names* it is FAQPanel's gated error and AskBar's "x remaining" sub-2-warning. There is no positive "you have 9 questions left this minute" affordance — the user discovers the budget by hitting it.
- **Cache is invisible.** FAQPanel serves the 1h cache silently (good for spend, bad for trust): a user reloading `/faq` and getting an instant card has no idea whether the answer is fresh or 58 minutes stale. StickyAskBar surfaces server-side `cache_hit` as a `⚡ cached` badge; FAQPanel does not surface its own client cache the same way.
- **Grounding is implied, not asserted.** Source cards render under the answer, but the answer text itself does not say "answered from N sources, smart-route X" up-top. For a "trust foundation" product, the trust cue should lead, not trail.
- **Token-in-bundle is real but out of UI scope.** `NEXT_PUBLIC_APP_API_TOKEN` is exposed in every Ask surface bundle. No UI affordance can fix this; only the server proxy in Phase 3 can.

## 2. UX principles for the Ask / FAQ surface

These are the rules I want every Phase-1 and Phase-2 change to satisfy. They're sized so a reviewer can apply them in one pass.

1. **Show the receipt.** Every answer surface should make grounding, model, latency, and cost visible *by default*, not behind a "details" expand. StickyAskBar's `ResponseFooter` is the right shape — promote it everywhere.
2. **Wallet is a positive number, not an error.** "9 / 10 questions left this minute · 87 / 100 today" should sit quietly under the input at all times. The user should never be surprised by the cap; they should *see* it crossing 0.
3. **Cache is named, not silent.** A served-from-cache answer should say so, with the age. Cached freshness is a feature; hiding it is not.
4. **Friction is the cheapest spend defense.** Every multi-card surface (today: only `/faq`, but tomorrow: any Ask "explore" page) should require an *explicit* expand per card. No "expand all," no `?open=*` URL, no scripts that script `details.open = true` getting a free pass.
5. **One voice on errors.** The four call sites currently produce four worded variants of "rate limit." Pick one. (Suggestion: the FAQPanel phrasing.)
6. **Be honest about the bundled token.** The product surface doesn't have to mention it, but the docs and the design memo do. UI should not pretend to fix it.
7. **Conversation is opt-in, visible, and reset-able.** AskBar's "Continuing conversation (3 turns)" / "New conversation" pattern is the right model — extend it to `/ask`. A user who can't see they're in a conversation can't trust the answer is about *their* question.

## 3. Groundedness / trust cues (Phase 1 — additive, in-scope)

For each cue, I'll name the surface(s), the data already available, and the LOC-shape so the reviewer can sanity-check effort.

### 3.1 Grounding ribbon (above answer, all surfaces)
A one-line ribbon that names *how* the answer was produced — not just what it is.

```
✓ Grounded · 8 repos searched · smart-route: leaderboard · Haiku 4.5 · 1.4s · 412 tokens
```

Components:
- **`✓ Grounded`** badge — green when `sources.length > 0`, amber when `sources.length === 0` ("ungrounded — model used general knowledge"). FAQ cards that hit the curated smart-route always have sources, so they're always green; `/ask` queries that fall through to the LLM-only path get amber and a hover tooltip explaining what that means.
- **Source count + smart-route** — already on `done.route` for StickyAskBar. AskPanel doesn't read it; should.
- **Model · latency · tokens** — already in `ResponseFooter`. Lift to a shared `<AnswerReceipt />` and use everywhere.

### 3.2 Wallet meter (under input, all surfaces with input)
Replace the current "x remaining" warning that only fires near the cap with a permanent, calm meter:

```
○○○○○○○○● ●  9 / 10 questions left this minute    87 / 100 today
```

- Two filled dots = used (1 minute) and 13 used (day).
- Filled becomes amber when `>=8/10` minute or `>=80/100` day; red at cap.
- Tooltip explains: "Per-tab, resets every minute / 24h. Shared with FAQ."
- LOC: ~40-line component, single `useEffect` polling the wallet every 1s. (The wallet is already in localStorage; readBudget() exists in FAQPanel and `getRateLimitState()` exists in AskBar/StickyAskBar — extract once.)

### 3.3 Cache-age pill (FAQPanel + future cached surfaces)
Where the answer was served from local cache, render a small pill *inside* the answer block:

```
⚡ cached · 12 min ago · refresh
```

- "refresh" is a button that *bypasses* the cache for that one card (still consumes wallet — bypassing is a deliberate cost). This is the user's escape hatch when an answer feels stale.
- Reuses StickyAskBar's `⚡` cached badge styling for visual consistency.
- LOC: ~25 lines in FAQPanel; mirror the API in AskBar when cache lands there in Phase 2.

### 3.4 Source-attestation row (under answer)
Today, sources render as bare pills. Add micro-attestations directly on each:

```
[★ 71k  langchain-ai/langchain   used: license, stars]
```

- Tags the *fields the answer cited* from each source. (Server already returns `integration_tags` per source; smart-router already knows which fields it pulled. Surface that.)
- Why: a user reading "LangChain has 71k stars" needs to *see* that the system is reading the same row they would read on GitHub. This is the cheapest "no-hallucination" affordance available.
- LOC: ~20 lines in the source pill renderer (FAQPanel + AskBar + StickyAskBar already share a similar structure; consolidate).

### 3.5 Sticky-bar conversation indicator on `/ask`
The full Ask page (`AskPanel.tsx`) is the only surface without conversation continuity UI. AskBar has it (`turnCount`, `New conversation` button). Lift the same component to AskPanel. LOC: ~10 lines plus a hook.

### 3.6 Empty-state coaching
First-load on `/ask` with no `?q=` is currently a blank input. Replace with three example prompts (cribbed from `/faq` Library Stats section — they're guaranteed grounded). One click prefills the input — does not auto-submit (per principle 4: friction is the spend defense).

## 4. Ways to reduce spammy / accidental spend (Phase 1 — UI-only)

Each item below is bounded to UI, in-scope for this lane, and forward-compatible with the Phase 3 server proxy.

### 4.1 Per-card click confirmation when wallet >= 70%
When a `/faq` card is opened with `minute >= 7` or `day >= 70`, the *first* click expands the card but does not fetch — instead, render:

```
You've used 7 of 10 minute requests. Open this answer? [Yes, fetch]  [Just close]
```

This is friction *only when needed*. Below 70%, opens fetch immediately as today.

### 4.2 Refuse all-cards expansion
Today, `details` elements are stateless to the page — a user can scroll-and-tap-everything. Add a `useFAQOpenCounter()` hook that throttles concurrent opens to **3 active fetches per 10 seconds** at the page level. Beyond that, additional opens render the gated message immediately and don't decrement the wallet. The wallet still bounds total cost; this bounds a synchronized burst.

### 4.3 Defeat-the-script prompts
Replace `<details>` `onToggle` with a `<button>`-driven open. `<details open>` set via dev-tools or URL hash today fetches; an explicit click handler doesn't. Roughly the same DOM, different control surface, immune to programmatic open. (Only worth doing if 4.1/4.2 land — they cover the same ground for honest users.)

### 4.4 Cap concurrent in-flights per surface
Across all four Ask surfaces, hold a shared `AbortController` registry keyed by surface. New ask cancels the previous in-flight *on the same surface*. Already true for StickyAskBar (`abortRef`); extend to AskBar and FAQPanel. Stops the user from triple-clicking Submit and burning three answers they'll never read.

### 4.5 Cache extension to AskBar / AskPanel
FAQPanel's 1h cache is keyed on the literal question. Lift the same helper to a shared `lib/askAnswerCache.ts` and apply on AskBar / AskPanel — but with a tighter TTL (15 min) since user-written queries drift in intent and a stale answer is more confusing than a fresh fetch. Cache hit always renders `cache-age pill` from §3.3.

### 4.6 Diff cache and wallet — never both write on a hit
Audit acceptance criterion: a wallet write should happen *only* when a real `fetch()` occurred. KAN-272 already gets this right on FAQPanel; lift the same shape into the shared cache helper so AskBar/AskPanel inherit it.

## 5. What this lane explicitly does NOT solve

Said plainly so a future reviewer doesn't mistake the design memo for a security memo:

1. **Public app token in the JS bundle.** `NEXT_PUBLIC_APP_API_TOKEN` is readable by anyone who opens DevTools. No UI affordance closes this. The proxy in §6 Phase 3 is the only fix.
2. **Server-side rate limiting.** The server enforces 429 and the client has a friendly message for it, but the *primary* defense should be server-side per-IP / per-session quota. Phase 3.
3. **Cost cap.** A daily *dollar* cap on `/intelligence/ask` (separate from per-user rate) is a backend concern. Out of scope here; track in a separate observability ticket.
4. **Anti-abuse ML.** Detecting "this is a scraping bot vs. a curious user" is its own lane. Not even on this roadmap.

## 6. Phased plan — Now / Next / Later

### Phase 1 — Now (this lane, UI-only, no backend dependency)
*Goal: improve trust + UX without widening surface area. All compounds correctly with Phase 3.*

| Item | File(s) | Rough LOC | Owner | Risk |
| --- | --- | --- | --- | --- |
| Extract shared wallet helper (`lib/askWallet.ts`) | new file + 3 call sites | ~80 | design lane | Low — pure refactor, byte-identical behavior |
| `<AnswerReceipt />` component | new file + 4 call sites | ~120 | design lane | Low — additive |
| `<WalletMeter />` component | new file + 3 call sites | ~80 | design lane | Low — additive |
| Cache-age pill in FAQPanel | FAQPanel.tsx | ~25 | design lane | Low |
| Source attestation row | shared SourceList | ~40 | design lane | Low |
| Conversation indicator on AskPanel | AskPanel.tsx | ~30 | design lane | Low |
| Empty-state example prompts on `/ask` | AskPanel.tsx | ~25 | design lane | Low |
| 70%-wallet confirm-before-fetch on `/faq` | FAQPanel.tsx | ~30 | design lane | Low |

**This lane today does not implement Phase 1.** It produces this memo. Implementation gets its own follow-up branch (`claude/feature/KAN-XXX-ask-trust-ui`) once a JIRA is filed against this memo. See §7 for why.

### Phase 2 — Next (1–2 weeks; cross-component but still frontend-owned)
*Goal: tighten anti-burst behavior and unify the Ask surfaces around one component family.*

- Concurrent-open throttle for `/faq` (4.2). Two-line hook in FAQPanel.
- Shared `lib/askAnswerCache.ts` with 15-min TTL applied to AskBar/AskPanel (4.5).
- Replace `<details>` with `<button>` toggles for FAQ (4.3) — only worth doing if §4.2 lands.
- Migrate `AskPanel.tsx` to use the StickyAskBar streaming + phase-state machine. Today `/ask` is the *worst* of the three surfaces; aligning it lifts the floor.
- Unified error voice: pick FAQPanel's phrasing as canonical and propagate.

### Phase 3 — Later (joint reporium-api + reporium frontend; right thing)
*Goal: actually close the spend surface. The only correct fix.*

1. Add same-origin `/api/ask` route in `reporium` that proxies `/intelligence/ask` server-side, holding the App API token as a Vercel env-only secret (never `NEXT_PUBLIC_*`).
2. Move per-IP / per-session quota enforcement to that proxy (or to `reporium-api` directly with a session cookie set by the proxy).
3. Delete `NEXT_PUBLIC_APP_API_TOKEN` from the build. Migrate all four Ask call sites to same-origin fetch.
4. Decommission the `reporium_ask_timestamps` localStorage wallet at the *same* PR — it becomes legacy. Don't pull it earlier or honest users lose pacing.
5. Drop the `<WalletMeter />` UI in favor of a server-fed "questions remaining today" header, reusing the same component contract.

This is real work — separate JIRA, joint lane, multi-PR. The trigger for starting it is "we see actual abuse traffic" or "we want to public-launch `/faq`". Not before. KAN-272 mitigation buys time; it does not eliminate the need.

## 7. Why this lane delivers a memo, not a patch

Per lane rule 3: implement only if "one small, high-confidence frontend mitigation fits cleanly." On inspection:

- **The smallest cohesive Phase-1 win is `<WalletMeter />`** — but it depends on extracting `lib/askWallet.ts` first to avoid duplicating the helper for the *fourth* time. That extraction touches AskBar, StickyAskBar, FAQPanel, and a new `lib` file — four files, ~150 LOC delta. That is past the "one small, high-confidence" bar in this prompt.
- **The KAN-272 mitigation is already in this branch** (commits `7ab8e64`, `285747d`). The next thing to add is not a patch but a JIRA so the design memo gets reviewed, sized, and assigned. Shipping a half-Phase-1 here would muddy that review.
- **Rule 9: one lane, one branch, one PR, one owned file set.** The owned file set today is `.audit/2026-04-25/*`. Anything more is a separate lane.

If the maintainer wants the smallest concrete patch, the right cut is "extract `lib/askWallet.ts`" only — pure refactor, no behavior change. I can ship that as a follow-up if asked, but it should be its own branch and PR ([`claude/refactor/ask-wallet-helper`](https://github.com/perditioinc/reporium/compare/main...claude/refactor/ask-wallet-helper) — does not exist yet).

## 8. Validation — recommendations were checked against current code

Each Phase-1 recommendation was verified against the actual files on this lane HEAD (`285747d`):

| Recommendation | Where it lands | Code dependency |
| --- | --- | --- |
| Wallet meter | new component + AskBar L159-163, StickyAskBar L224-236, FAQPanel L28-41 | All three already compute `{minute, day}`; meter is a render-only consumer |
| Answer receipt | promote StickyAskBar L355-403 `ResponseFooter` to shared | Server sends `model`, `latency_ms`, `tokens`, `route`, `cache_hit` on `done` event; AskPanel currently *ignores* these |
| Cache-age pill | FAQPanel L57-85 (cache helpers) + state shape | `CachedAnswer.at` already stored; just needs render |
| Source attestation | FAQPanel L327-353, AskBar L370-411, StickyAskBar source list | `integration_tags` already returned per source; not displayed |
| Conversation indicator on `/ask` | AskPanel L91-103, lift AskBar L296-308 component | AskPanel reads `session_id` from localStorage but doesn't track `turnCount` |
| 70%-wallet confirm | FAQPanel L241-276 `load()` | Trivial check before `setState({status:'loading'})` |

All five trust cues are *renderable from data the server already returns* — no API change required for Phase 1. Phase 2 cache extension also no-API-change. Phase 3 is the only API-change phase.

## 9. Stop-conditions check (per lane rules)

- ✅ Rule 1: fetched `origin/main` (HEAD `53e36ae`).
- ✅ Rule 2: existing FAQ/Ask design notes inspected — none in `.audit/2026-04-25/` before today other than the spend-surface JIRA, which references *this* memo as the design-lane deliverable.
- ✅ Rule 3: JIRA-first acknowledged; companion JIRA draft authored as `reporium-ask-faq-design-jira.md` (rule 4 fallback).
- ✅ Rule 5/6: branch `claude/feature/KAN-272-faq-spend-surface` is off `main`; no new branch created.
- ✅ Rule 7/8/9: PR target would be `main`; one lane, one branch, one owned file set (this memo + its JIRA).
- ✅ Rule 10: no merge, no deploy.
- ✅ Rule 11: token-in-bundle is named as backend/auth architecture work in §5 and §6 Phase 3 — not pretended away as a UI tweak.
