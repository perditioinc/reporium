# Banner Diagnosis — "Live data is unavailable" false-positive

**Date:** 2026-04-19
**Ticket:** (companion to fix/trends-empty-state-and-banner-diag PR)

## Symptom

The amber "Live data is unavailable right now" banner appears on the home page
even though the API is healthy (all `/library/full` pages return 200, `/trends/report`
200, `/gaps` 200, CORS preflight 200 from both origins, 0 rate-limit errors).

## Root Cause — Stale `degraded` flag in module-level singleton

`HomePageClient.tsx` line 36 instantiates `ApiDataProvider` at **module scope**:

```ts
const provider = createDataProvider();   // line 36 — module-level singleton
```

Next.js keeps JS modules alive across client-side navigations within the same tab
session. `ApiDataProvider` has two fields that govern the banner:

| Field | Set where | Cleared where |
|---|---|---|
| `degraded` | `_fetchLibrary` catch block | `_fetchLibrary` try block (line 284) |
| `libraryCache` | `_fetchLibrary` try block | Never |

**The bug:** When `_fetchLibrary` fails (e.g. a transient timeout on page 2-4 of
the paginated fetch), the catch block sets `this.degraded = true` but does NOT
populate `this.libraryCache` (it returns the fallback result without caching it).
On the next call to `getLibrary()`, `libraryCache` is still null so `_fetchLibrary`
runs again, resets `degraded = false` at the top of the try block, and then
succeeds — correctly showing `degraded = false`.

However, there is a subtler path: if the first successful API call populates
`libraryCache`, subsequent navigations back to `/` return from cache immediately
(line 273: `if (this.libraryCache) return this.libraryCache`) — `_fetchLibrary`
is never called again, `degraded` retains whatever value it had from the last
`_fetchLibrary` invocation. If that invocation partially failed on an earlier
page load within the same browser session, `degraded` stays `true` forever.

## Fix Applied

Added a `libraryFromFallback` flag (separate from `degraded`) that is set only
inside `_fetchLibrary` and reflects whether the **current cache** was populated
from the live API (`false`) or the JSON fallback (`true`). `getDegradedState()`
now returns `libraryFromFallback` when a cache exists, rather than the potentially
stale `degraded` field.

Files changed:
- `src/lib/dataProvider.ts` — new `libraryFromFallback` field, updated
  `getDegradedState()`, `_fetchLibrary` success/catch paths

## Verification

1. Hard-reload the page (Ctrl+Shift+R) to clear the module cache.
2. If banner persists: check Cloud Run cold-start logs for timeout on pages 2-4
   of `/library/full`. The paginated `Promise.all` will fail if any individual
   page times out.
3. If banner is gone after hard-reload: the prior banner was caused by this
   stale-flag bug and the fix prevents recurrence.

## Alternative (if not a code bug)

If the fix does not eliminate the banner, the fallback may have legitimately
been triggered (real API failure during the session). User should hard-reload
(Ctrl+Shift+R) to force a fresh module load and API fetch.
