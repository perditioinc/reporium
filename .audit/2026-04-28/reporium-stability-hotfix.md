# Reporium stability hotfix

Date: 2026-04-28
Branch: `claude/hotfix/reporium-stability-2026-04-28`
Base: `origin/main` at `091d2f2`

## Production audit facts

- Latest production deploy was `091d2f2` and Vercel reported roughly 15 minutes from build start to ready.
- `https://www.reporium.com/data/library.json` is privacy-clean, but the source artifact is still large enough to make fallback loads expensive.
- Live `library.json`, `owned.json`, and `sitemap.xml` have zero `hippo-harvest-assignment` references.
- The dirty primary checkout still contained older generated sitemap dates, so this branch was created from a clean `origin/main` worktree.

## Fixes included

- Folded in the already-green repo-card navigation hotfix so cards are real links to `/repo/[name]`.
- Split rendering behavior by `REPORIUM_DEPLOY_TARGET`: Vercel/default uses managed output, while `github-pages` keeps full static export.
- Capped Vercel repo pre-rendering at the top 250 repos while preserving full static export for `github-pages`.
- Moved repository evaluation fetches out of server build time into a client panel.
- Replaced server-side relative JSON fetches with disk reads to avoid build-worker hangs.
- Made launch feel alive sooner by showing the static owned artifact before waiting for the heavy API page.
- Added visible loading copy and a root route skeleton.
- Added stability tests for privacy fields, known private repo absence, sitemap date freshness, and artifact size budget.

## Verification

- `npm test -- --runInBand`: 36 suites, 298 tests passed.
- `npx tsc --noEmit`: passed.
- Targeted ESLint on changed files: 0 errors, 2 pre-existing warnings in `src/lib/dataProvider.ts`.
- `REPORIUM_DEPLOY_TARGET=vercel npx next build --webpack`: passed, 386 static pages, 250 repo pages.
- `REPORIUM_DEPLOY_TARGET=github-pages npx next build --webpack`: passed, 1996 static pages.

## Remaining risk

- Default Turbopack build was not re-run locally because this worktree reused `node_modules` through a local junction and Turbopack rejects that layout. CI/Vercel will install dependencies inside the project directory, so this is a local verification constraint rather than a code constraint.
- The full source library artifact remains large. This branch budgets it below 30 MB, but a follow-up should ship a true `library.thin.json` first-paint artifact.
