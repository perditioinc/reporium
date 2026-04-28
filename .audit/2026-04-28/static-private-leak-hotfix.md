# P0 Hotfix — Static Private-Repo Leak

**Date:** 2026-04-28
**Branch:** `hotfix/2026-04-28-static-private-leak` (off `claude/feature/KAN-272-faq-spend-surface`)

> **Note on branch state at end of session:** the branch was created as
> instructed and all edits were authored against it. Mid-session another
> process (auto-orchestration in this workspace) checked out a sibling branch
> `hotfix/2026-04-28-regression-tests` from the same SHA. Both branches still
> point at `ca0fbbc` and the uncommitted hotfix changes live in the working
> tree, so a stale `.git/index.lock` left from a prior process prevented this
> session from switching back. To recover after lock cleanup, run:
> `cd reporium && git checkout hotfix/2026-04-28-static-private-leak` (or
> rename: `git branch -m hotfix/2026-04-28-regression-tests
> hotfix/2026-04-28-static-private-leak --force`). The working-tree changes
> carry over unchanged — both branch tips are identical.
**Class of bug:** recurring — second incident in 5 days (2026-04-23 SEC-HOTFIX #264, then 2026-04-27 hippo-harvest re-leak)

## TL;DR

`hippo-harvest-assignment` (a private perditioinc repo) was being served at
`https://www.reporium.com/data/library.json` because the build pipeline had no
field-driven privacy filter and the static blocklist hadn't been re-synced. This
hotfix replaces the brittle name-list with a field-driven filter that **fails
closed** when the API response lacks privacy metadata, and wires a blocking
validator into the Vercel build chain so a missing privacy field can never ship
silently again.

No deploy. No force push. WIP for KAN-272 was preserved on the source branch.

---

## 1. Live evidence captured (2026-04-28 ~05:08 UTC)

Fetched `https://www.reporium.com/data/library.json` with cache-busting query
string. Cached at the CDN edge but represents the most recent successful build.

| Item | Value |
| --- | --- |
| HTTP status | `200` |
| `last-modified` | `Tue, 28 Apr 2026 04:59:08 GMT` |
| `etag` | `34043b5b6ae8c58c89209b06d4189fee` |
| `x-vercel-cache` | `HIT` |
| `x-vercel-id` | `sfo1::26vmq-1777352874263-d07ce9d2a805` |
| `content-length` | `18,533,497` bytes (≈18.5 MB) |
| Payload `generatedAt` | `2026-04-27T08:01:23.488304+00:00` |
| Payload `totalRepos` | `1862` |
| `repos[]` length | `1862` |
| `hippo-harvest-assignment` present? | **YES — leaked** |
| Privacy fields present anywhere in `repos[]` | **none — `isPrivate`, `private`, `visibility` all absent** |

Hippo entry contents (subset):

```
name:        hippo-harvest-assignment
fullName:    perditioinc/hippo-harvest-assignment
isFork:      false
isArchived:  false
url:         https://github.com/perditioinc/hippo-harvest-assignment
isPrivate:   <missing>
private:     <missing>
visibility:  <missing>
```

**Smoking gun:** the entire payload shape lacks any privacy field. The
generator script at `scripts/fetch-library.ts` was checking `r.isPrivate ===
true`, which is unreachable when the API never emits it. The defensive static
blocklist did not contain `hippo-harvest-assignment` (created after the list
was last synced on 2026-04-23), so it slipped straight through.

## 2. Root cause

Three failures stacked:

1. **Generator lacked a structural privacy gate.** `scripts/fetch-library.ts`
   relied on the API to emit `isPrivate`, but the API strips that field. With
   nothing to filter on, the only line of defense was a hardcoded name list.
2. **The hardcoded name list rotted.** `LEGACY_PRIVATE_BLOCKLIST` was last
   updated 2026-04-23. `hippo-harvest-assignment` was created after that and
   was therefore not in the list.
3. **The validator was not wired into the build path.** `vercel.json`'s
   `buildCommand` was `npm run generate:resilient && npm run build`. Neither
   of those invoked `npm run validate`, so even though the validator existed
   it was effectively dead code on the deploy path. The 2026-04-23 hotfix
   shipped the validator but not the wiring.

## 3. Files changed

```
NEW   scripts/lib/privacy-filter.ts
NEW   scripts/validate-privacy.ts
NEW   tests/unit/privacyFilter.test.ts
NEW   .audit/2026-04-28/static-private-leak-hotfix.md
EDIT  scripts/fetch-library.ts
EDIT  scripts/validate-library.ts
EDIT  package.json
```

## 4. Privacy field semantics (the field-driven filter)

`scripts/lib/privacy-filter.ts` exports `classifyPrivacy(repo)` which inspects
exactly three optional fields on each repo entry:

- `isPrivate: boolean`     — Reporium API shape (preferred)
- `private: boolean`       — GitHub REST shape
- `visibility: string`     — GitHub GraphQL shape (`public` / `private` / `internal`)

Any single positive private signal → classify `private`.
Any single explicit-public signal → classify `public`.
**None of the above present → classify `unknown`, and the filter throws
`MissingPrivacyFieldError`. The build halts.**

This is the contract the API must satisfy. The hotfix does NOT guess.

## 5. The new filter (snippet)

```ts
// scripts/lib/privacy-filter.ts
export function classifyPrivacy(repo: PrivacyEvaluable): PrivacyDecision {
  if (repo.isPrivate === true) return 'private'
  if (repo.private === true) return 'private'
  if (typeof repo.visibility === 'string') {
    const v = repo.visibility.toLowerCase()
    if (v === 'private' || v === 'internal') return 'private'
    if (v === 'public') return 'public'
    return 'unknown'
  }
  if (repo.isPrivate === false) return 'public'
  if (repo.private === false) return 'public'
  return 'unknown'
}

export function filterPrivateRepos<T extends PrivacyEvaluable>(repos: T[]): FilterResult<T> {
  const missing = repos.filter(r => classifyPrivacy(r) === 'unknown')
  if (missing.length > 0) throw new MissingPrivacyFieldError(missing.map(r => String(r.fullName ?? r.name)))
  // ... then drop verdict==='private' and any fullName in LEGACY_PRIVATE_BLOCKLIST.
}
```

## 6. The blocking validator (snippet)

```ts
// scripts/validate-privacy.ts — runs in package.json `prebuild` and after `generate:resilient`.
const blockListed   = repos.filter(r => r.fullName && LEGACY_PRIVATE_BLOCKLIST.has(r.fullName))
const missingField  = repos.filter(r => classifyPrivacy(r) === 'unknown')
const privateVerdict = repos.filter(r => classifyPrivacy(r) === 'private')

if (blockListed.length || missingField.length || privateVerdict.length) {
  console.error('[validate-privacy] BUILD HALTED')
  process.exit(1)   // BLOCKING — Vercel build fails.
}
```

Wired in `package.json`:

```diff
- "prebuild": "node scripts/write-corpus-constants.cjs && node scripts/sync-data-dir.cjs",
+ "prebuild": "npm run validate:privacy && node scripts/write-corpus-constants.cjs && node scripts/sync-data-dir.cjs",
- "generate:resilient": "npx tsx scripts/generate-with-fallback.ts",
+ "generate:resilient": "npx tsx scripts/generate-with-fallback.ts && npx tsx scripts/validate-privacy.ts",
+ "validate:privacy": "npx tsx scripts/validate-privacy.ts",
```

`scripts/validate-library.ts` was also tightened to call the same shared module
so the daily nightly refresh fails closed in CI just like a Vercel build does.

## 7. Counts: before vs after

| Surface | Before hotfix | After hotfix (with current API payload) |
| --- | --- | --- |
| Live `library.json` repos | 1862 (incl. hippo) | n/a — no deploy |
| Local `public/data/library.json` repos | 1856 (no hippo, but cannot prove leak-free) | same file — but `npm run validate:privacy` exits **1** because no repo has a privacy field |
| `npm run validate:privacy` exit code | n/a (script didn't exist) | **1** (BUILD HALTED) on current artifact |
| Unit tests | 241 | **256** (+15 new privacy filter tests) |

The validator exit-code-1 on the current local artifact is **the correct
behavior**: until the API ships a privacy field, the artifact is not provably
leak-free, so we refuse to ship it. This matches the spec: "fail generation
rather than guess."

Note on totals recomputation: `fetch-library.ts` now recomputes
`totalRepos`, `totalPages`, `stats.total`, `stats.built`, `stats.forked`
AFTER filtering, instead of copying upstream. Owned.json gets its own
recomputed totals. This guarantees `stats.total === repos.length`.

## 8. Test coverage

`tests/unit/privacyFilter.test.ts` — 15 cases. Run:

```
npx jest tests/unit/privacyFilter.test.ts
```

Coverage matrix:

- `isPrivate: true` → `private`
- `private: true` → `private`
- `visibility: 'private' | 'internal' | 'public'`
- `isPrivate: false` → `public`
- No field at all → `unknown` (this is today's live API shape)
- `isPrivate: null` (with no other signal) → `unknown`
- Name-pattern guess (e.g. `name === 'private-tool'`) → must NOT classify; `unknown`
- Fixture: 1 public + 1 private → drops the private one, keeps the public one
- Fixture: 1 public + 1 missing-field → throws `MissingPrivacyFieldError`
- Error carries `culprits` array with the offending fullNames
- Static blocklist still wins even if API mislabels a known-private repo as public
- Carry-through fields on kept repos are preserved (no mutation)
- `perditioinc/hippo-harvest-assignment` is in the static blocklist (regression test for the 2026-04-27 incident)

All 15 cases pass.

## 9. What's NOT done (deliberately)

- **No deploy.** Per task spec.
- **No force push, no main-branch commit.** Per task spec.
- **No DB-row deletion.** Per task spec.
- **No fix in reporium-api.** The API still strips the privacy field. That's a
  follow-up; with this hotfix in place, the build now FAILS LOUDLY rather than
  silently leaking. The natural next ticket is "reporium-api `/library/full`
  must emit `isPrivate` on every repo entry".
- **No takedown of the currently-leaked file.** That would require a deploy.
  Once this hotfix is reviewed and the API patch lands, the daily refresh job
  will rebuild a clean `library.json` and the leak rotates out.

## 10. Acceptance check (local-only)

| Acceptance criterion | Status |
| --- | --- |
| After `npm run generate:resilient`, `data/library.json` does NOT contain `hippo-harvest-assignment` | Cannot run live (would need API access + private fields). However: **with the current API payload, `generate:resilient` now FAILS at `validate-privacy` instead of silently writing a leaked file**. That is the spec'd behavior ("fail generation rather than guess"). |
| Build/validation fails (exit non-zero, clear error) if a private repo would be emitted | **YES** — `npm run validate:privacy` returns exit code `1` with a clear message naming the offending repos. Verified against synthetic fixture (hippo with `isPrivate: true`) and against the real local artifact (which fails on missing-field gate). |
| No fabricated repo data, no hardcoded one-off `if (name === 'hippo...') skip` | **YES** — the filter is field-driven via `classifyPrivacy`. The static blocklist (where hippo IS now listed) is a SECONDARY belt-and-suspenders gate, not the primary filter. |
| No deploy, no force-push, no main-branch commits | **YES** — only edits on `hotfix/2026-04-28-static-private-leak`. Pre-existing KAN-272 WIP carried over to that branch and left unstaged. |
