# JIRA draft — Reporium Ask / FAQ design lane (sibling of KAN-272)

> **Status:** draft. JIRA CLI is not available in this environment; create
> in perditio.atlassian.net by hand (or via `gh`-paired automation when the
> Atlassian MCP is connected).
> **Companion docs:**
> [`reporium-ask-faq-design-memo.md`](reporium-ask-faq-design-memo.md) (the substantive memo) and
> [`faq-spend-surface-jira.md`](faq-spend-surface-jira.md) (KAN-272 mitigation re-validation).

## Summary

`design(ask): trust + pacing UX for the Reporium Ask / FAQ surface` — a
phased design plan that improves answer trust cues, makes the client wallet
visible, and adds friction *only where wallet pressure is high*, without
pretending to fix the public-token spend surface that only a server-side
proxy can close.

## Type
Spike → Improvement (the spike is this memo; the implementation is a
follow-on ticket per phase).

## Component
`reporium` (frontend). Phase 3 also touches `reporium-api`, but that is
filed separately under KAN-LATER-2 / Ask architecture.

## Background

Sibling lane to KAN-272 (FAQ spend-surface mitigation). KAN-272 added a
shared client wallet + 1h answer cache to `/faq` so PR #272 can ship without
widening the burn surface. That is the right *partial* fix and is already
on the lane branch (commits `7ab8e64`, `285747d`).

What KAN-272 explicitly didn't do — and what this ticket scopes — is the
UX work that surrounds the wallet:

1. The wallet is invisible until a user hits the cap. They should see it
   counting down.
2. Cache hits are silent, so a 58-minute-old answer looks identical to a
   fresh one. That undermines the whole "trust foundation" story.
3. The four Ask call sites (AskBar, StickyAskBar, AskPanel, FAQPanel)
   don't share a visual language — the floating dock has more grounding
   cues than the page named "Ask."
4. Open-all-cards is still the worst-case path on `/faq`. The wallet
   bounds *total* burn but doesn't bound *concurrent* burn.

The substantive design and rationale live in
[`reporium-ask-faq-design-memo.md`](reporium-ask-faq-design-memo.md). This
ticket exists so that memo gets reviewed, sized, and converted into
implementation tickets.

## Scope (this ticket)

**Spike deliverable: review and triage the design memo, file the
implementation tickets.** No production code change is owned by this
ticket; the memo itself is the deliverable.

The memo proposes three phases:

- **Phase 1 (Now)**: ~8 additive UI items (wallet meter, answer receipt,
  cache-age pill, source attestation, conversation indicator on `/ask`,
  empty-state coaching, 70%-wallet confirm). All renderable from data the
  server already returns. Each will get its own KAN ticket on approval.
- **Phase 2 (Next)**: concurrent-open throttle, shared answer cache for
  AskBar/AskPanel, replace `<details>` with `<button>`, lift the streaming
  + phase-state machine from StickyAskBar into AskPanel. Cross-component,
  still frontend-owned. One or two tickets.
- **Phase 3 (Later)**: server-side proxy holding the App API token,
  per-IP / per-session quota, deletion of `NEXT_PUBLIC_APP_API_TOKEN`,
  migration of all four Ask call sites to same-origin fetch. Joint
  reporium-api + reporium frontend lane. **This is the only correct fix
  for the spend surface.** Track under KAN-LATER-2.

## Out of scope

- **Phase 3 itself.** This ticket scopes the design memo and the Phase 1
  + Phase 2 implementation tickets. Phase 3 is its own joint lane.
- **Server cost cap.** A daily dollar cap on `/intelligence/ask` is a
  backend observability concern. Filed separately.
- **Anti-abuse ML / bot detection.** Out of scope for the design lane and
  not on the proposed roadmap.

## Acceptance criteria

- [x] Memo lands in `.audit/2026-04-25/reporium-ask-faq-design-memo.md`
      with five sections required by the lane prompt: UX principles,
      groundedness/trust cues, spend-mitigation ideas, Now/Next/Later
      plan, and validation against current code.
- [x] Memo names the public-token problem honestly as backend/auth work
      (lane rule 11) and does not pretend a UI tweak solves it.
- [x] Every Phase-1 recommendation cites the file and line range it
      depends on, against the actual code on lane HEAD.
- [x] Each phase carries a rough LOC and risk estimate so a reviewer can
      size implementation tickets without re-reading the code.
- [ ] Reviewer approves the memo (or sends comments back). On approval,
      author files individual KAN tickets per Phase-1 item.
- [ ] Phase-1 implementation lands on a *separate* branch
      (`claude/feature/KAN-XXX-ask-trust-ui`), not on this lane's branch.

## Verification (lane stop-conditions)

| Check | Result |
| --- | --- |
| `origin/main` HEAD fetched and noted (`53e36ae`) | yes |
| Existing 04-25 design notes inspected before authoring | yes |
| Owned file set respected (`.audit/2026-04-25/*` only) | yes |
| Branch is `claude/feature/KAN-272-faq-spend-surface` off `main` | yes |
| No production code changed by this lane | yes |
| Token-in-bundle named as Phase 3 / backend lane | yes |

## Risk

Spike-level — none. The ticket produces documentation. Risk lives in the
implementation tickets that follow.

## Notes

- The lane branch already carries the KAN-272 mitigation. **Do not** roll
  this design lane into KAN-272's PR — it muddies the merge review for a
  spend-surface fix that is small, scoped, and ready.
- Phase 1 implementation will need the wallet helper extracted out of
  AskBar/StickyAskBar/FAQPanel into `src/lib/askWallet.ts`. That refactor
  is byte-identical behavior; it is the natural first PR if the maintainer
  wants something landed before the full Phase 1 batch.
- The Figma marketing site at
  `C:\DEV\PERDITIO_PLATFORM\figma-make-perditio-website-claude` was
  inspected as read-only design reference (per lane prompt) — it does
  not contain a literal Ask/FAQ component. Visual direction in the memo
  is consistent with the existing in-tree Reporium UI (Tailwind on
  zinc-900 surfaces), not the marketing site's palette.
