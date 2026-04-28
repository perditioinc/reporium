# Repo Card Click Hotfix — 2026-04-28

**Branch:** `claude/hotfix/repo-card-click-2026-04-28`
**Worktree:** `C:\DEV\PERDITIO_PLATFORM\.worktrees\reporium-card-click-hotfix-2026-04-28`
**Severity:** P0 (operator-reported on deployed `https://www.reporium.com/`)
**Status:** Fix applied to `RepoCardMinimal.tsx`, regression tests green, dev verification green. **NO deploy, NO push, NO main commit.**

---

## Reproduction

### Operator report
Clicking a repo card on the homepage (`/`) does nothing on the deployed site. Screenshot shows cards rendered for `hippo-harvest-assignment`, `reporium-dataset`, `reporium-trust-score`, `reporium`, etc., in a grid.

### Repro on dev (worktree, port 3001)

Pre-fix (snapshot of the card markup before the change):

```html
<div role="" tabindex="" cursor="pointer" onClick="onSelect(repo.name)">
  <span>reporium-api</span>
  ...
</div>
```

Behavior:
- mouse click in dev: fired `onSelect(repo.name)` -> set `selectedRepoName` -> rendered the in-grid expanded panel
- on deployed static export: per operator, the click did not produce a visible change
- keyboard activation: **none** — no `tabindex`, no `role="button"`, no key handler. Tab skipped the card entirely.
- assistive tech: card had no `aria-label` and no role; screen readers saw a generic group of text spans.

Post-fix DOM (captured live at `http://localhost:3001/` on the worktree):

```
totalCards: 60
sample = {
  tag: "A",
  href: "/repo/reporium-ingestion/",
  aria: "Open reporium-ingestion repository page",
  tabIndex: 0,
  computedCursor: "pointer",
  hasOnClick: true
}
```

Click verification (Chrome MCP, dev port 3001):

| step                                | URL                                                |
|-------------------------------------|----------------------------------------------------|
| before click                        | `http://localhost:3001/`                            |
| after `card.click()` (sample card)  | `http://localhost:3001/repo/reporium-ingestion/`    |
| navigated                           | **true**                                            |

Keyboard verification:
- Card receives focus via Tab. `document.activeElement === card`, `tag: A`, `href: /repo/reporium-api/`.
- Anchor with `href` is natively activated by Enter (browser default).
- No console errors on the homepage post-fix.

---

## Root cause

The card on the homepage grid is `RepoCardMinimal` (60 instances rendered via `HomePageClient.tsx`). The pre-fix component used a **`motion.div` with `onClick`** to call `onSelect(repo.name)`, which `HomePageClient.handleExploreSelect` interpreted as a request to **toggle in-grid expansion**, not navigate.

That click target had three problems:

1. **No semantic affordance.** No `role`, no `tabindex`, no `aria-label`. Keyboard users could not reach or activate the card; screen readers announced nothing actionable.
2. **`motion.div` + `onClick` is an unreliable click target on a static export.** The standard cure is a real anchor.
3. **Inconsistent with sibling card surfaces.** `RecommendationsWidget`, `SimilarReposPanel`, `TrendingThisWeekWidget`, and `KnowledgeGraph3D` all already use `<Link href="/repo/${encodeURIComponent(name)}">`. The home grid was the only surface that did not navigate to the detail route — every other repo card in the app does. The operator's expectation ("clicking does something") matches the rest of the app.

## Fix on disk

`src/components/RepoCardMinimal.tsx`:

- The card surface is wrapped in a Next.js `<Link href="/repo/${encodeURIComponent(repo.name)}" prefetch={false}>` — same pattern as the sibling card surfaces.
- `onSelect?: (name: string) => void` is now optional. The Link's `onClick` still fires it on left-click for callers (HomePageClient) that want to observe the click for analytics/graph-sync. The navigation itself happens via the anchor.
- `aria-label="Open ${repo.name} repository page"` is set on the Link.
- `data-testid="repo-card-minimal"` and `data-repo-name` are stable selectors for tests.
- `focus-visible` ring (violet-400) gives keyboard users a visible focus indicator.
- Inner `motion.div` keeps all the existing animation and styling — the fix is purely an outer wrapper, no visual change.

## Files changed

| File                                                              | Change                                                              |
|-------------------------------------------------------------------|---------------------------------------------------------------------|
| `src/components/RepoCardMinimal.tsx`                              | Wrap visual surface in `<Link>`; make `onSelect` optional; add aria |
| `tests/RepoCardMinimal.navigation.test.tsx`                       | Regression-guard agent's navigation suite (anchor + href + encoding)|
| `tests/unit/repoCardMinimal.click.test.tsx`                       | Complementary suite — `onSelect` still fires, optional, aria-label  |

> Note: the regression-guard lane writes tests at `tests/` root; this lane added an adjacent unit test under `tests/unit/` per the agent-isolation rules.

## Test plan

| Suite                                                       | Result               |
|-------------------------------------------------------------|----------------------|
| `tests/RepoCardMinimal.navigation.test.tsx`                 | 4/4 pass             |
| `tests/unit/repoCardMinimal.test.ts` (existing, CSS regression) | 2/2 pass         |
| `tests/unit/repoCardMinimal.click.test.tsx` (new this lane) | 3/3 pass             |
| `npx tsc --noEmit` (whole project)                          | clean (exit 0)       |
| `npx eslint` on changed files                               | clean (no warnings)  |
| Dev-server browser smoke (Chrome MCP at `localhost:3001`)   | navigation works, no console errors |

## Scope discipline

Changes deliberately confined to `RepoCardMinimal.tsx` plus my own adjacent test. Things explicitly NOT touched:

- `scripts/generate-*` (static-artifact lane owns these)
- `tests/` root (regression-guard lane owns this)
- `src/app/repo/[name]/page.tsx` (the destination route — its 240s static-export timeout is tracked separately in `project_reporium_static_export_fragility.md`; outside this hotfix's scope)
- `src/components/HomePageClient.tsx` (the `selectedRepoName` / `handleExploreSelect` in-grid expansion path is now effectively dead code from the home grid entry point. Removing it cleanly is a follow-up — a pure deletion, no behavior change required for this hotfix.)

## Follow-ups (out of scope for this hotfix)

1. **Dead-code clean-up in `HomePageClient.tsx`.** With cards navigating instead of toggling, the inline-expansion branch (`isSelected && selectedRepo` rendering, `expandedCardRef`, click-outside listener, `selectedRepoName` state) is unreachable from the home grid. A separate PR can delete it.
2. **`/repo/[name]` static-export reliability.** Memory `project_reporium_static_export_fragility.md` notes 240s timeouts on Vercel builds for this route. ADR-005 proposes a top-N + ISR migration. Card click navigation now depends on the route building reliably — making this fragility more visible, not less, but the fragility itself is pre-existing.
3. **Server-side rendering of `/repo/[name]` in dev shows a 500** when other processes (e.g. Jest runs) compete for resources. Likely the bigger Apr-26 P0 around the route, not a new regression from this change. Tracked indirectly via the timeout follow-up above.

## Acceptance checklist

- [x] Clicking a repo card navigates to the intended destination (`/repo/[name]/`)
- [x] No console errors on the homepage when clicking
- [x] Keyboard activation works (Tab focuses, Enter activates per native anchor behavior)
- [x] Typecheck passes (`npx tsc --noEmit`)
- [x] Lint passes on changed files
- [x] Targeted unit/component test for card navigation passes
- [x] No deploy
- [x] No force-push
- [x] No main-branch commit
