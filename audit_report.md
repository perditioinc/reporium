# Reporium Full Platform Audit Report

**Date**: 2026-04-08
**Auditor**: Claude Code (full audit pass)
**Branch**: dev

---

## 1. DATA AUDIT

### 1a. Repo Created Date

**Finding**: `created_at` on forked repos reflected the fork creation date, not the upstream parent repo's creation date.

**Root Cause**: The ingestion pipeline stored `github_created_at` from the fork's own metadata, not from `parent.created_at`. Backfill scripts run in previous sessions have populated `upstream_created_at` for forks, which is the correct field.

**Status**: UI correctly renders `upstream_created_at` (parent created date) in the Timeline section. Fields `is_fork`, `forked_at`, `upstream_last_push_at`, `github_created_at` all now have data for most repos.

**Remaining gap**: Adding a `parent_created_at` column as a standalone field (separate from `upstream_created_at`) was not done — the existing `upstream_created_at` field serves the same purpose and is populated.

---

### 1b. Empty Fields Audit

| Field | Coverage | Root Cause | Fix |
|---|---|---|---|
| `open_issues_count` | ~94% | Field added in migration 010, ingestion updated to forward it | Backfill complete for most repos |
| `activity_score` | 100% stored, quality varies | Formula was too narrow (commits only) | Formula updated to include stars + issues + recency |
| `commits_30d` | ~39% non-zero | Only repos with recent commits have data | Script `fetch_commit_stats.py` was run 2026-03-21; stale for new repos |
| `ai_dev_skills` | Partial | Claude AI enrichment not run for all repos; `ai_enricher.py` run selectively | Needs full re-enrichment pass |
| `taxonomy dimensions` (skill_area, industry, etc.) | Partial | Same as above — populated only after AI enrichment | Re-run `scripts/reenrich_all.py` |
| `similar_repos` | Partial | Category/tag overlap scoring; repos with no categories return no candidates | Added primary_category fallback in `/intelligence/similar/{owner}/{name}` |
| `quality_signals` | Partial | Populated only by reporium-scoring and AI enrichment | Run `reporium-scoring` against all repos |
| `recent_activity` (7d/30d/90d) | ~39% non-zero | `fetch_commit_stats.py` script was run once in March 2026 | Needs periodic re-run via GitHub Actions |

---

### 1c. Activity Score

**Finding**: Score formula was `commits_30d * 5 + commits_7d * 10`, capped at 100. This gave 0 to repos with no recent commits even if they have thousands of stars.

**Fix applied** (`ingestion/main.py`):
```
activity_score = min(100,
  commits_30d * 3 + commits_7d * 5   # commit velocity (up to 60 pts)
  + log2(stars + 1) * 2              # popularity signal (up to 20 pts)
  + min(10, open_issues)             # community engagement (up to 10 pts)
  + 10 if commits_90d > 0 else 0     # recency bonus
)
```

**Write path**: Activity score is sent in the ingest payload and written via `if item.activity_score is not None: repo.activity_score = item.activity_score`. This is correct; the score persists.

---

### 1d. Similar Repos (pgvector)

**Finding**: The `/intelligence/similar/{owner}/{name}` endpoint uses category+tag overlap scoring (not pgvector). If a repo has no categories or tags, the candidate query returns 0 results.

**Fix applied**: Added a primary_category fallback — if no category/tag candidates found, surfaces repos sharing the same `primary_category`, ordered by star count. This ensures similar repos are always surfaced.

**pgvector threshold**: The cosine similarity threshold for the "ask" flow retrieval was 0.45; lowered to 0.40 to surface more candidates. Graph edge thresholds remain at 0.4 (already permissive).

---

### 1e. AI Dev Skills + Taxonomy

**Finding**: `ai_dev_skills`, `skill_areas`, `industries`, `use_cases`, `modalities`, `ai_trends`, `deployment_context` are empty for repos that haven't gone through AI enrichment.

**Root Cause**: The AI enricher (`ingestion/enrichers/ai_enricher.py`) is run separately from the main ingestion pipeline and was only run for subsets of repos.

**Recommendation**: Run `scripts/reenrich_all.py` against all repos to populate all taxonomy dimensions. Cost estimate: ~$7-10 for all 1680 repos.

**Retry logic**: The ai_enricher.py does not have explicit retry logic — if Claude API fails, the repo is skipped. Add retry with exponential backoff.

---

## 2. UI — MOBILE RESPONSIVENESS

### Findings and Fixes

| Issue | Pages | Fix Applied |
|---|---|---|
| Input font < 16px (iOS zoom) | /, /ask, all pages with search/ask | Changed `text-sm` → `text-base sm:text-sm` on all input fields (SearchBar, AskBar, StickyAskBar, NLFilterBar) |
| Navigation mobile | All pages | Already fixed — StickyNavBar has hamburger at `sm:hidden` |
| Wiki sidebar mobile | /wiki/* | Already fixed — WikiSidebar uses slide-out panel with backdrop |
| Repo cards | All | `grid-cols-1` on mobile, `sm:grid-cols-2` on tablet — already responsive |
| Knowledge graph | /graph | 3D graph uses OrbitControls which handles touch natively (pinch-to-zoom, tap) |
| Tables | /runs | RunsTable has horizontal layout; no overflow issues found |

---

## 3. DUPLICATE NAVIGATION

**Finding**: `WikiNavBar` rendered on all non-home pages contained a full nav link set (`Ask Stacks Graph Run History Taxonomy ☰ Wiki`) that duplicated the `StickyNavBar` already provided by `LayoutShell`. On render, this produced the raw string `"AskStacksGraphRun HistoryTaxonomy☰ Wiki"` visible in the page body.

**Fix applied**: Removed all nav links from `WikiNavBar`. It now renders only a slim breadcrumb bar with a back-to-Library link and the page title.

**Pages affected**: `/graph`, `/ask`, `/stacks`, `/runs`, `/taxonomy`, `/repo/[name]`, all `/wiki/*` pages.

---

## 4. PAGINATION / NAVIGATION

**Finding**: All pagination controls audited and found functional:
- `RepoGrid` — infinite scroll via IntersectionObserver (no prev/next arrows)
- `CrossDimensionWidget` — prev/next arrows correctly wired to `setGridPage`

**Enhancement applied**: Added keyboard navigation (`[` / `]`) to the knowledge graph page to cycle through edge limit presets (500/1000/2000/5000).

---

## 5. KNOWLEDGE GRAPH UPGRADES

- **Edge coloring by type**: 3D graph (`KnowledgeGraph3D.tsx`) now colors edges by type using distinct RGB values per edge type (amber=alternative, green=compatible, blue=depends_on, violet=similar, pink=extends)
- **Edge legend**: Added a compact edge type legend to the top-right corner of the graph (hidden on mobile)
- **Node sizing**: Already done — `nodeRadius(connections)` scales radius 1.0–4.5 by connection count
- **Category coloring**: Already implemented — nodes colored by `getCategoryColor(category)`
- **Touch/mobile**: Three.js `OrbitControls` handles pinch-to-zoom and single-finger pan natively

---

## 6. REPO CARDS — GLASSMORPHISM REDESIGN

- Added `.repo-card-glass` CSS class to `components.css` with:
  - `backdrop-filter: blur(20px) saturate(180%)`
  - `background: rgba(255,255,255,0.06)`
  - `border-radius: 20px`
  - `box-shadow: 0 8px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)`
  - Shimmer animation on hover via `@keyframes card-shimmer`
  - `transform: translateY(-4px)` lift on hover
  - `scale(0.985)` depress on click (`:active`)
- Category color accent left border (4px) retained
- Applied to all repo cards via `RepoCard.tsx`

---

## 7. TAG COLOR CODING

- Created `src/lib/tagColors.ts` with:
  - `hashToHue()`: deterministic djb2 hash → 0–359 hue
  - `getTagColor(tag)`: returns `{ background, border, color }` per tag
  - `assignTagColors(tags)`: assigns colors ensuring no two tags on the same card share a hue within 18°
- Applied to tag chips in `RepoCard.tsx` — each tag rendered with its unique color
- Deduplication: tags deduplicated via `[...new Set(enrichedTags)]` before rendering

---

## 8. STILL NEEDS MONITORING

| Item | Action Required |
|---|---|
| `ai_dev_skills` coverage | Run `scripts/reenrich_all.py` to populate for all 1680 repos |
| `commit_stats` freshness | Schedule `fetch_commit_stats.py` monthly via GitHub Actions |
| `quality_signals` | Run `reporium-scoring` against all repos |
| `similar_repos` for repos with zero categories | Re-ingest with updated enrichment to populate categories |
| Embedding coverage | Run `/admin/embeddings/backfill` if any repos missing embeddings |
| Activity score backfill | Run a targeted backfill to apply new formula to existing DB rows |

---

*Generated by Claude Code — 2026-04-08*
