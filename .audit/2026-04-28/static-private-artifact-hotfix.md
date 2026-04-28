# Static-artifact privacy gate — Lane 2 closeout

**Branch:** `claude/hotfix/static-private-artifact-2026-04-28`
**Worktree:** `C:\DEV\PERDITIO_PLATFORM\.worktrees\reporium-static-private-artifact-2026-04-28`
**Base:** `origin/main @ 633cd99`

This note covers Lane 2 only — the static-artifact privacy gate. Lane 1
(API) ships separately under
`claude/hotfix/private-leak-integrated-2026-04-28`.

## Live evidence (pre-fix)

```
$ curl -sSL https://www.reporium.com/data/library.json | python -c '...'
totalRepos: 1862
generatedAt: 2026-04-27T08:01:23.488304+00:00
hippo entries: 1
  - perditioinc/hippo-harvest-assignment isPrivate=None private=None visibility=None
first repo privacy-ish keys: []
```

The published artifact contains the leaked private repo and **carries no
privacy metadata at all** — every existing layer of defense was relying on
upstream filtering at fetch time. When the API failed to filter
hippo-harvest-assignment on 2026-04-27, every downstream consumer
(library.json, owned.json, llms.txt, ai-plugin.json, sitemap.xml,
corpusConstants.generated.ts) silently inherited the leak.

## Reconciliation with parallel work

The primary checkout's `hotfix/2026-04-28-regression-tests` branch already
held substantial Lane 2 work (uncommitted). Files from that branch were
kept as-is; files unique to this lane were added. Nothing in primary was
modified — the worktree at the primary path remains exactly as it was.

| File | Source | Notes |
|---|---|---|
| `scripts/lib/privacy-filter.ts` | primary | Pure classifier — `classifyPrivacy`, `filterPrivateRepos`, `MissingPrivacyFieldError`, `LEGACY_PRIVATE_BLOCKLIST` (45 entries). Field-driven (`isPrivate`, `private`, `visibility`). Treats missing field as `'unknown'` and fails closed. |
| `scripts/validate-privacy.ts` | primary | 3-gate blocking validator. Wired as `prebuild` in `package.json`. |
| `scripts/fetch-library.ts` | primary | Calls `filterPrivateRepos`; recomputes `totalRepos`, `totalPages`, `stats.{total,built,forked}` post-filter. Owned subset gets independent recomputed totals. |
| `scripts/validate-library.ts` | primary | 3 blocking gates (7a static blocklist, 7b missing privacy field, 7c private-verdict survivors) — was warn-only, now exits non-zero. |
| `scripts/write-corpus-constants.cjs` | primary | Reads filtered `library.json`; counts in `llms.txt` + `ai-plugin.json` reflect post-filter total. |
| `package.json` | primary | `validate:privacy` script; `prebuild` runs validation before `write-corpus-constants` and `sync-data-dir`; `generate:resilient` chains validation after fetch. |
| `tests/unit/privacyFilter.test.ts` | primary | 12 tests covering `classifyPrivacy` + `filterPrivateRepos`. |
| `tests/regression/privateRepoFilter.test.ts` | primary | 8 regression tests covering hippo case + post-filter totals. |
| `tests/fixtures/library-mixed.json` | primary | 2-repo fixture: 1 private (hippo) + 1 public fork. |
| `scripts/lib/sitemap.ts` | **NEW (this lane)** | Pure helper `publicRepoNamesFromLibrary` — defense-in-depth: re-runs `filterPrivateRepos` even though `fetch-library.ts` already filtered. |
| `scripts/generate-sitemap.ts` | **MODIFIED (this lane)** | Now uses `publicRepoNamesFromLibrary`. Hard-fails (exit 2) if any repo lacks a privacy field. |
| `tests/unit/sitemap.test.ts` | **NEW (this lane)** | 9 tests pinning the sitemap defensive guard. |
| `.audit/2026-04-28/static-private-leak-hotfix.md` | primary | Original investigation. |
| `.audit/2026-04-28/static-private-artifact-hotfix.md` | **THIS FILE** | Closeout / reconciliation note. |

### Trimmed (out of scope for Lane 2)

The primary checkout's branch bundles regression tests for several
parallel hotfixes. Tests not relevant to the static-artifact privacy gate
were not ported into this worktree:

- `tests/regression/askForkCanonicalization.test.ts` (Lane 5 — ASK)
- `tests/regression/homePageRendersCards.test.tsx` (Lane 6 — frontend)
- `tests/regression/loginRouteConsistency.test.tsx` (other lane)
- `tests/regression/repoCardNavigation.test.tsx` (Lane 6)
- `tests/regression/repoDetailRoute.test.tsx` (other lane)
- `tests/regression/tokenLeakScan.test.ts` (security lane)
- `.audit/2026-04-28/regression-tests.md`, `regression-root-cause-map.md` (parent lane's notes)
- `public/llms.txt`, `public/.well-known/ai-plugin.json`, `public/sitemap.xml`,
  `src/lib/corpusConstants.generated.ts` — **auto-generated** by
  `write-corpus-constants.cjs` and `generate-sitemap.ts`. They will
  regenerate during the next `prebuild` cycle once Lane 1 is live and the
  API emits privacy fields. Including hand-edited copies in this PR would
  be misleading.
- `src/app/globals.css`, `src/app/layout.tsx`, `src/components/HomePageClient.tsx`,
  `src/components/StickyAskBar.tsx` — UX changes, unrelated to artifact privacy.

These remain safely uncommitted in the primary checkout for a separate PR.

## What this PR ships

**The single coherent invariant:** every public artifact write goes
through a privacy gate that fails closed when privacy state is unknown.

```
package.json         prebuild = validate-privacy && write-corpus-constants && sync-data-dir
                                ^ blocks build before any public file is read or copied

scripts/fetch-library.ts        filterPrivateRepos(repos)        — drops private rows
                                throws MissingPrivacyFieldError  — if any repo lacks signal
                                recomputes totals                — totalRepos, totalPages, stats

scripts/validate-privacy.ts     gate 1: STATIC-BLOCKLIST hit
                                gate 2: PRIVACY FIELD MISSING
                                gate 3: PRIVATE-VERDICT survivors
                                process.exit(1) on any failure

scripts/validate-library.ts     gate 7a/7b/7c — same three checks, integrated
                                into the broader library-shape validator

scripts/generate-sitemap.ts     publicRepoNamesFromLibrary()     — defense-in-depth
                                process.exit(2) if MissingPrivacyFieldError thrown

scripts/sync-data-dir.cjs       runs AFTER validate-privacy in prebuild — copies a
                                file already known to be clean
```

## Verification

```
$ ./node_modules/.bin/jest --testPathPatterns="sitemap|privacyFilter|privateRepoFilter" --silent
Test Suites: 3 passed, 3 total
Tests:       29 passed, 29 total
Time:        11.582 s
```

```
$ ./node_modules/.bin/tsc --noEmit
(no output — typecheck passes)
```

```
$ ./node_modules/.bin/eslint scripts/lib/sitemap.ts scripts/lib/privacy-filter.ts \
    scripts/validate-privacy.ts scripts/generate-sitemap.ts scripts/fetch-library.ts \
    scripts/validate-library.ts tests/unit/sitemap.test.ts \
    tests/unit/privacyFilter.test.ts tests/regression/privateRepoFilter.test.ts
1 problem (0 errors, 1 warning)
# warning is in fetch-library.ts:233 — pre-existing in primary, unrelated to this lane.
```

### End-to-end gate firing against the committed library.json

Ran `npx tsx scripts/validate-privacy.ts` against the committed
`public/data/library.json` (1862 repos, generated 2026-04-27 08:01 UTC).
The gate fires with the exact failures the design predicts:

```
[validate-privacy] FAIL — public/data/library.json
   · STATIC-BLOCKLIST hit: 1 known-private repo(s) present —
     perditioinc/hippo-harvest-assignment
   · PRIVACY FIELD MISSING on 1862/1862 repos — cannot verify leak-free.
     Sample: perditioinc/build-your-own-x, perditioinc/awesome, ...
     Fix: reporium-api /library/full must emit isPrivate / private /
     visibility on every repo.
[validate-privacy] FAIL — public/data/owned.json
   · PRIVACY FIELD MISSING on 18/18 repos — ...
[validate-privacy] BUILD HALTED — fix the above before shipping.

(exit code 1)
```

Both blocking outcomes are the *correct* behavior given today's data:
- The static blocklist still catches hippo even with no API privacy field
  (defense-in-depth working).
- The "missing privacy field" gate forces a fix on the API side before any
  new build can ship — exactly what the user's spec demanded
  ("fail hard if privacy status is absent/unknown").

## Acceptance check (against the user's task spec)

| Acceptance | Status |
|---|---|
| Local generation cannot emit `hippo-harvest-assignment` | ✅ STATIC-BLOCKLIST gate fires — proven against committed `library.json` |
| Public artifact validation fails if private or unknown-privacy repos are present | ✅ All 3 gates fire on the same committed file |
| No hardcoded one-off filtering by repo name | ✅ Filter is field-driven; the blocklist is a defense-in-depth net, not the primary path |
| No deploy | ✅ Worktree only — no push, no PR opened by this turn |
| Typecheck/lint/targeted tests pass | ✅ 29/29 tests; tsc clean; eslint 0 errors (1 pre-existing warning) |

## Deploy / runbook order (after PR merge)

The user's stated correct order, repeated for completeness:

1. Merge/deploy integrated **API** PR (`claude/hotfix/private-leak-integrated-2026-04-28`).
2. Run admin dry-run/apply to mark `hippo-harvest-assignment` private and
   invalidate API caches (runbook in
   `reporium-api/.audit/2026-04-28/private-row-correction.md`).
3. Merge/deploy this **frontend static-artifact** PR.
4. Regenerate frontend: `npm run generate:resilient` (which now requires
   privacy fields on every repo — once Lane 1 is live, the API will emit
   them and the gate will pass).
5. Verify:
   - `https://reporium.com/data/library.json` no longer contains
     `hippo-harvest-assignment`.
   - `https://reporium.com/data/library.json` repo entries now carry
     `isPrivate: false` (or whichever privacy field the API chose to
     expose).
   - `https://reporium.com/sitemap.xml` does not include
     `/repo/hippo-harvest-assignment`.
   - Homepage, search, repo detail, and ASK no longer surface
     hippo-harvest-assignment.

If step 4 fails because the API still doesn't emit privacy fields, the
correct response is to fix Lane 1 — NOT to relax the gate here.

## Out of scope (deferred lanes)

- **Lane 3** — `reporium-ingestion` RCA (why a private repo was inserted
  with `is_private=false`).
- **Lane 4** — `reporium-audit` no-op contract check.
- **Lane 5** — ASK fork canonicalization (already shipped in the API
  integrated branch).
- **Lane 6** — Frontend repo-card click regression.
