# KAN-248: Frontend performance — defer StickyAskBar bundle off the initial paint

**Date:** 2026-04-24
**Lane:** Reporium frontend performance hardening
**Issue:** [perditioinc/reporium#248](https://github.com/perditioinc/reporium/issues/248) — Lighthouse perf score extremely low, heavy JS/TBT
**Base:** `main` · **Branch:** `claude/feature/KAN-248-frontend-performance` · **PR target:** `main`
**Owned scope:** `src/components/LayoutShell.tsx`, `src/components/StickyAskBarBoot.tsx` (new), `.audit/2026-04-24/`
**Author:** Opus 4.7

---

## Problem

`LayoutShell` renders `<StickyAskBar />` on every page. `StickyAskBar.tsx` is the single largest client component in the app (1,945 lines / 88 KB source) and eagerly imports four heavy dependencies:

- `framer-motion` — motion + useReducedMotion
- `react-markdown` — full MDAST pipeline
- `remark-gfm` — GFM parser
- `rehype-sanitize` — HTML sanitizer

All four are pulled into the root-layout chunk, so every page pays the download + parse + compile cost before first paint — including `/repo`, `/stacks`, `/wiki`, `/trends`, `/taxonomy`, `/ai-native` — pages where the Ask bar starts collapsed (56 px bottom strip) and the user may never interact with it.

Issue #248 calls out heavy JS and high TBT. StickyAskBar is the cheapest high-impact target: it ships on every route, it is dominantly unused on first paint, and it starts in a `collapsed` state whose visual footprint is trivial to stub.

## Non-goals / stop-conditions

- **Not a KnowledgeGraph3D refactor.** `KnowledgeGraph3D` (three.js + d3-force-3d) is already dynamic-imported via `HomeGraphWidget` and `GraphPageClient`.
- **Not overlapping with the FAQ lane.** Per `.audit/2026-04-24/pr-272-faq-decision.md`, FAQ lane's owned files are `src/app/faq/page.tsx`, `src/components/FAQPanel.tsx`, `src/components/StickyNavBar.tsx`. This lane does not touch any of those.
- **Not rewriting StickyAskBar.** The bar's internals (streaming, feedback, citations, tips popover) are out of scope. We only change *when* the module is loaded, not *what* it does.
- **Not adding a bundle analyzer dep.** Ship the behavioral fix; measurement work can follow.

## Approach: interaction-boot + idle preload

Replace the eager `<StickyAskBar />` mount in `LayoutShell` with `<StickyAskBarBoot />`, a thin wrapper that:

1. Renders a **static visual placeholder** that matches the 56 px collapsed-bar footprint exactly (same position, border, backdrop, jellyfish-icon slot, input skeleton, `data-tour="ask"`). No CLS on the real-bar swap.
2. Dynamic-imports `StickyAskBar` (`next/dynamic`, `ssr: false`) only after one of:
   - `requestIdleCallback` fires (fallback: 1500 ms `setTimeout` for Safari).
   - User interacts with the page: `pointerdown`, or `keydown` with `/`, `Ctrl+K`, `Cmd+K`.
   - URL carries the `?tour=` query (the guided tour targets `[data-tour="ask"]`).
3. Once the dynamic chunk mounts, the real component replaces the placeholder. Its existing keyboard/focus handlers register on mount and behavior continues as before.

The placeholder stays mounted during the network fetch of the dynamic chunk (`next/dynamic`'s `loading:` fallback), so there is no gap in visual continuity.

## Expected impact

- The entire `StickyAskBar` module graph — StickyAskBar itself + `framer-motion` + `react-markdown` + `remark-gfm` + `rehype-sanitize` + `askCitations` helpers — moves off the root-layout chunk into a lazy chunk that most first-paint budgets never fetch.
- Initial JS evaluated before LCP drops by the size of those packages + the 88 KB source module. TBT on mid-tier mobile should fall proportionally because there is less JS to parse + compile during the main-thread contention window.
- Ask-interaction latency for users who *do* open the bar: the chunk is pre-warmed on idle for ~95% of sessions, so the observed delta is the placeholder→real swap (≤ 1 frame in the idle-pre-boot case). Users who interact before idle fires see one dynamic-import round-trip (≤ 300 ms typical) before the real bar takes focus — acceptable, bounded, and only affects the first interaction of the first page view.

A Lighthouse re-run on preview should produce a visible movement on the Performance score; exact delta to be captured in the PR description once Vercel preview is live.

## Risk inventory

| Risk | Mitigation |
|---|---|
| Layout shift on swap | Placeholder uses the exact same fixed-bottom/height-14/padding/border classes as the collapsed real bar; `data-tour="ask"` lives on both. |
| Keyboard shortcuts (`/`, `Ctrl+K`) fail before boot | `keydown` listener in the boot wrapper catches those keys and triggers boot. Real bar's own `keydown` handler then registers on mount and the user's next keystroke lands in a live input. First keystroke is "lost" only in the extremely narrow window of user-typing-before-idle-fires AND the key being one of these shortcuts. |
| Guided tour (`?tour=1`) can't find the bar | Placeholder carries `data-tour="ask"`. Tour already has a 30-attempt retry loop (GuidedTour.tsx:484) for dynamic-imported landmarks, so the swap is absorbed. Boot wrapper additionally short-circuits to eager load when URL carries the `tour` param. |
| Static export (`output: 'export'`) cannot render client-only dynamics | `ssr: false` already matches the pattern used by `HomeGraphWidget` and `GraphPageClient` — both ship today on the same static export. |
| Someone imports `StickyAskBar` elsewhere and re-introduces the eager cost | Grepped: only `LayoutShell.tsx` imports the component; all other references are comments or related-but-separate components (AskPanel, AskBar, MiniAskBar). |

## Validation

- `npm run type-check` green.
- `npm run build` completes (static export emits placeholder HTML; StickyAskBar compiled as its own chunk).
- Visual smoke: load `/`, confirm bottom bar appears at 56 px from first paint, confirm real bar replaces it without a size jump once boot fires. Confirm `/` and `Ctrl+K` focus behavior still works post-boot.
- Interaction smoke: on a fresh page load, click the placeholder input → boot fires → real bar mounts and accepts focus on the user's next click.

## Follow-up perf targets (out of scope for this PR)

1. **`HomePageClient` splitting.** 1,800-line mega-component ships eagerly on `/`. The largest unused-at-paint slices (`CyberpunkBillboard`, `GuidedTour`, `CategoryFilterBar` on mobile) could follow the same idle/interaction-boot pattern. Biggest remaining root-page JS cost.
2. **`@next/bundle-analyzer` wiring.** Add `ANALYZE=true npm run build` so subsequent perf lanes have a numeric baseline. ~5 lines in `next.config.js`, one devDep.
3. **`framer-motion` usage audit.** AmbientBubbles / LoadingCursorBubbles / StickyNavBar all pull framer. Several could be replaced with CSS keyframes at zero JS cost.
4. **`react-markdown` consolidation.** Three separate call sites (StickyAskBar, AskPanel, possibly FAQPanel after #272 lands). One shared lazy wrapper would dedupe the MDAST pipeline and shrink chunks across the board.
5. **Sentry client SDK gate.** `@sentry/nextjs` adds ~50 KB gz to every page. Check if sampling / `beforeSend` could swap for `@sentry/browser` lazy-bootstrapped after idle.
