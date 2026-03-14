# Reporium Pipeline — Context for Claude Code

Read this file at the start of any session to understand the data pipeline without re-reading all source files.

---

## Architecture Summary

Reporium is a **Next.js 16 static-data app**. All GitHub data is fetched at build time by scripts and written to `public/data/`. The UI (`src/app/page.tsx`) reads these JSON files at runtime via `fetch('/data/...')`. No GitHub API calls happen at runtime.

---

## Data Pipeline

### 1. `npm run generate` → `public/data/library.json`

**Script:** `scripts/generate-library.ts`
**Runtime:** ~4–5 minutes (makes ~1500+ GitHub API calls)
**Reads:** GitHub API (repos, READMEs, fork info, language breakdowns, commit history, releases)
**Writes:** `public/data/library.json`

**What it produces:**
- `repos[]` — 234 repos, each with:
  - `enrichedTags[]` — 171 unique tags derived from README + repo name + description keywords
  - `allCategories[]` + `primaryCategory` — mapped to 21 hardcoded buckets
  - `aiDevSkills[]`, `pmSkills[]`, `industries[]` — multi-dimensional taxonomy
  - `builders[]` — original owner metadata (avatar, orgCategory)
  - `programmingLanguages[]` — from languageBreakdown, sorted by bytes
  - `commitStats` — `{ today, last7Days, last30Days, last90Days, recentCommits }`
  - `forkSync` — `{ state, behindBy, aheadBy }` vs upstream
  - `latestRelease` — `{ version, releasedAt, url, isMajor, isMinor } | null`
  - `languageBreakdown` — raw bytes per language
- `tagMetrics[]` — per-tag repo count + activity score
- `categories[]` — 21 hardcoded category objects with repoCount
- `gapAnalysis` — gaps vs IMPORTANT_TOOLS list (embedded)
- `builderStats[]` — aggregated per builder org
- `aiDevSkillStats[]`, `pmSkillStats[]` — per-skill repo counts

**Env vars required:**
- `GITHUB_TOKEN` — GitHub PAT (5000 req/hr rate limit; set in `.env.local`)
- `GITHUB_USERNAME` — defaults to `perditioinc`

---

### 2. `npm run detect-trends` → `public/data/trends.json`

**Script:** `scripts/detect-trends.ts`
**Runtime:** <5 seconds
**Reads:** `git log --pretty=format:"%H %ai" -- public/data/library.json` (git history of library.json)
**Writes:** `public/data/trends.json`

**What it produces:**
```typescript
{
  generatedAt: string,
  period: { from, to, snapshots: number },
  trending: TrendSignal[],   // changePercent > 50% AND current > 5 commits
  emerging: TrendSignal[],   // prev < 2 AND current > 5 commits
  cooling: TrendSignal[],    // changePercent < -30% AND prev > 5
  stable: TrendSignal[],     // |change| < 20% AND current > 3
  newReleases: ReleaseSignal[],
  insights: string[]
}
```

**Note:** Needs ≥3 git snapshots of library.json to produce real data. On a fresh install with no git history, writes empty arrays with message `"Trend data builds up over time. Check back in a few days."` — this is normal and expected.

---

### 3. `npm run gap-analysis` → `public/data/gaps.json` (console output)

**Script:** `scripts/build-gap-analysis.ts`
**Runtime:** <1 second
**Reads:** `public/data/library.json`
**Writes:** `public/data/gaps.json`

**What it produces:** Standalone gap analysis — compares library against 12 `IMPORTANT_TOOLS` (langfuse, phoenix, deepeval, ragas, vllm, ollama, unsloth, axolotl, instructor, dspy). A tool is "missing" only if no repo has its **primary tag** (first tag in the tool's tag list) in `enrichedTags`. Also embedded in `library.json` as `gapAnalysis`.

---

### 4. `npm run digest` → `DIGEST.md`

**Script:** `scripts/generate-digest.ts`
**Runtime:** <1 second
**Reads:** `public/data/library.json`, `public/data/trends.json` (optional)
**Writes:** `DIGEST.md` at repo root

**What it produces:** Markdown daily briefing with Today's Activity, Trending This Week, New Releases, Library Gaps, Health summary, 30-Day Summary.

---

## Rebuild Script

`scripts/rebuild.ps1` — smart rebuild that skips fresh files:
- `npm run rebuild` — skips any data file < 60 minutes old
- `npm run rebuild:full` — forces all 4 scripts to run regardless of age
- `npm run rebuild:dev` — rebuilds then starts `npm run dev`

---

## UI Data Flow

```
page.tsx
  ├── fetch('/data/library.json')  → setData(LibraryData)
  └── fetch('/data/trends.json')   → setTrends(TrendData)  [non-blocking, optional]

MetricsSidebar ← data + trends
FilterBar      ← data.stats, data.aiDevSkillStats, data.pmSkillStats, data.builderStats
StatsBar       ← data (shows coverage matrix, builder orgs, languages)
RepoCard       ← repo (shows builder badge, aiDevSkills, categories, forkSync, commits)
```

Gap analysis comes from `data.gapAnalysis` (embedded in library.json), not a separate fetch.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/types/repo.ts` | All TypeScript interfaces |
| `src/lib/enrichRepo.ts` | Tag enrichment from README/name/description; `matchesKeyword()` for whole-word matching |
| `src/lib/buildCategories.ts` | 21 hardcoded `CATEGORIES` array — never dynamic |
| `src/lib/buildTaxonomy.ts` | `AI_DEV_SKILLS`, `PM_SKILLS`, `INDUSTRIES`, `KNOWN_ORGS` maps; `assignDimension()`, `buildBuilder()` |
| `src/lib/buildGapAnalysis.ts` | Gap detection vs `IMPORTANT_TOOLS` |
| `src/lib/detectTrends.ts` | Pure functions: `tagActivity()`, `computeTrendSignals()` |
| `src/lib/github.ts` | All GitHub API calls; `fetchLatestRelease()`, paginated `fetchCommitsSince()` |
| `src/mcp/server.ts` | MCP tools — reads library.json only, returns `RepoSummary` (< 2000 tokens) |
| `src/app/wiki/` | Wiki pages — Next.js server components, read library.json via `fs.readFileSync` |
| `src/components/WikiSidebar.tsx` | Client component; hamburger nav; localStorage persistence |

---

## Invariants to Never Break

1. `CATEGORIES.length === 21` always — generate script asserts this
2. All keyword matching uses `matchesKeyword()` (whole-word regex) — never `.includes()`
3. MCP responses use `RepoSummary`, never full `EnrichedRepo`
4. Scripts use `../src/lib/...` relative imports (not `@/` aliases)
5. Scripts use `npx tsx` (not `ts-node`) — tsconfig uses `moduleResolution: "bundler"`
6. Wiki pages are server components — no `'use client'` except `WikiSidebar`
7. Gap analysis never makes GitHub API calls — library.json data only

---

## Common Pitfalls

- **`library.json` is stale**: Run `npm run generate`. Takes ~5 min.
- **Trends all empty**: Normal until GitHub Actions has committed 3+ daily snapshots.
- **Wiki 404 in dev**: Check that dynamic route page functions are `async` and `await params` (Next.js 16 requirement).
- **Type errors after adding fields**: Update the `Omit` type in `enrichRepo.ts` and `github.ts`, add defaults in `enrichRepo()` return, and add `latestRelease: null` etc. to test `makeRepo` helpers.
- **Categories > 21**: `buildCategories` is buggy — it must only return subsets of the hardcoded `CATEGORIES` array.
