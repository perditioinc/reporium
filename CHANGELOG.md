# Changelog
Follows [Keep a Changelog](https://keepachangelog.com) and [Semantic Versioning](https://semver.org).

## [3.1.0] - 2026-03-21

### Fixed
- Removed "Running in lite mode" banner — no longer visible to users
- Commit stats populated for 395 repos from GitHub API commit_activity endpoint

### Changed
- Redis cache enabled on Cloud Run via VPC connector to Memorystore — 2.4x faster /library/full responses
- ROADMAP.md updated to reflect all outstanding items resolved

## [3.0.0] - 2026-03-21

### Added
- Live API data source: frontend now reads from reporium-api `/library/full` instead of static JSON
- `scripts/fetch-library.ts` — single API call replaces 800+ GitHub API calls (0.7s vs minutes)
- API fallback: `ApiDataProvider` falls back to static JSON if API is unreachable
- 826 repos with enriched data at the time of the 2026-03-21 migration: AI-generated summaries, integration tags, knowledge graph edges
- Semantic search via sentence-transformers embeddings (384-dim, all-MiniLM-L6-v2)
- Intelligence query endpoint: POST `/intelligence/query` for natural language repo questions

### Changed
- `dataProvider.ts` `getLibrary()` now calls `/library/full` API endpoint
- `generate` npm script now runs `fetch-library.ts` (old script preserved as `generate:legacy`)
- `tsconfig.json` excludes `scripts/` from Next.js build
- Deploy workflow passes `NEXT_PUBLIC_REPORIUM_API_URL` to generate and build steps

### Removed
- Lite mode nudge banner — no longer visible to users

### Fixed
- library.json data restored after API migration exposed missing DB fields
- Database backfilled with rich tags, pmSkills, builders, industries, categories from library.json

## [2.0.0] - 2026-03-14

### Added
- Dual-mode data provider architecture (Lite / Production)
- `src/lib/dataProvider.ts` — unified data access layer
- `JsonDataProvider` — reads from static JSON files (default, Lite mode)
- `ApiDataProvider` — reads from reporium-api with JSON fallback (Production mode)
- `.env.local.example` with mode documentation
- "API connected" badge in production mode
- Lite mode upgrade nudge for libraries > 50 repos

### Changed
- `page.tsx` now uses `DataProvider` instead of direct fetch calls
- All data fetching centralized through `createDataProvider()`

### Removed
- Hardcoded JSON fetch paths from page.tsx
- Unused `UsernameInput` component
- Unused `RateLimitBanner` component

## [1.3.0] - 2026-03-13
### Added
- Gap Analysis v2: `ESSENTIAL_TOOLKIT_2026` with 10 skill areas and severity tiers (`missing` / `weak` / `moderate` / `strong`) replacing the old tool-count approach
- `GapSeverity`, `GapEssentialRepo` types in `src/types/repo.ts`; `Gap` interface extended with `skill`, `severity`, `repoCount`, `strongThreshold`, `why`, `trend`, `essentialRepos`, `yourRepos` fields (legacy fields retained for backwards compat)
- `getCoverageLevel(repoCount, strongThreshold, moderateThreshold)` pure function exported from `buildGapAnalysis.ts`
- Wiki skill pages (`/wiki/skills/[skill]`) rewritten with teaching-focused static content: What is it, Why for AI PMs, The 2026 landscape, What strong coverage looks like, Key concepts to know
- `WikiNavBar` component (`src/components/WikiNavBar.tsx`) — sticky top nav bar on all wiki pages with back-to-library link
- `WikiRepoCard` component (`src/components/WikiRepoCard.tsx`) — clickable mini-cards linking back to main library via `/?repo=name`
- `WikiNavBar` added to all wiki pages: overview, categories, builders, digest, roadmap
- `WikiRepoCard` used in categories and builders wiki pages replacing plain divs
- `?repo=name` and `?tag=name` URL params handled in `page.tsx` via `useEffect` on mount — enables direct linking from wiki pages to filtered library view
- New unit tests: `filterLogic.test.ts` (AND filter logic, tag strictness), `dateHelpers.test.ts` (relative time formatting), `getCoverageLevel` describe block, `gap severity` describe block
- `test:watch` and `test:coverage` npm scripts
- GitHub Actions CI workflow updated: triggers on `main`/`dev` branches, runs type-check, tests, and coverage

## [1.2.0] - 2026-03-13
### Added
- Multi-dimensional taxonomy: AI Dev Skills (12 areas), PM Skills (8 areas), Industries (8 verticals), Builders — each repo now carries `aiDevSkills`, `pmSkills`, `industries`, `programmingLanguages`, `builders` fields
- `src/lib/buildTaxonomy.ts` — taxonomy mappings, `assignDimension`, `buildBuilder`, `buildBuilderStats`, `buildSkillStats` functions
- `BuilderStats`, `SkillStats`, `Builder` interfaces in `src/types/repo.ts`
- `builderStats`, `aiDevSkillStats`, `pmSkillStats` fields on `LibraryData`
- Expanded tag dictionary: 300+ keyword entries with whole-word boundary matching (`matchesKeyword()`) replacing simple `.includes()` — eliminates false positives
- Wiki section with 40+ auto-generated pages: `/wiki`, `/wiki/skills/[skill]`, `/wiki/categories/[category]`, `/wiki/builders/[builder]`, `/wiki/digest`, `/wiki/roadmap`
- `src/app/wiki/layout.tsx` with collapsible `WikiSidebar` component (client-side, localStorage-persisted open state)
- 6-tab filter bar (Categories, AI Dev Skills, PM Skills, Industries, Builders, Languages) — builders grouped by category, skills with coverage indicators
- Builder profiles on repo cards: avatar (16px circle) + display name with org-specific color coding
- AI Dev Skills row on repo cards: up to 3 skill pills per card
- Updated `StatsBar` with language badges, builder org badges, and AI Dev Coverage matrix (✅/⚠️/❌)
- New filter state in `page.tsx`: `selectedAiDevSkills`, `selectedPmSkills`, `selectedIndustries`, `selectedBuilders`
- All new filters wired to `filteredAndSortedRepos` useMemo and `clearFilters()`
- Step 8.5 in `generate-library.ts` pipeline assigns taxonomy dimensions to all repos and computes aggregate stats

## [1.1.0] - 2026-03-12
### Added
- `LatestRelease` type and `latestRelease: LatestRelease | null` field on `EnrichedRepo`; fetched for every repo during generate pipeline via `fetchLatestRelease` (Step 7.5)
- `TrendSignal`, `ReleaseSignal`, `TrendData`, `Gap`, `GapAnalysis` types in `src/types/repo.ts`
- `gapAnalysis: GapAnalysis` required field on `LibraryData`; embedded in `library.json` by generate script, empty stub in API route
- `src/lib/buildGapAnalysis.ts` — pure function analyzing user's library against 12 important tools across 5 categories (Observability, Evals, Inference, Model Training, AI Agents)
- `src/lib/detectTrends.ts` — extracted, testable trend computation functions (`computeTrendSignals`, `tagActivity`)
- `scripts/detect-trends.ts` — reads git history of `library.json`, detects trending/emerging/cooling/stable tags and notable new releases, writes `public/data/trends.json`
- `scripts/build-gap-analysis.ts` — standalone script for manual gap analysis inspection
- `scripts/generate-digest.ts` — generates `DIGEST.md`, a daily Markdown intelligence briefing (activity, trends, releases, gaps, health)
- `npm run detect-trends`, `npm run gap-analysis`, `npm run digest`, `npm run refresh` scripts
- Intelligence section in `MetricsSidebar`: trending tags, emerging tags, new releases, and insight text (shown when `trends` data is available)
- Library Gaps section in `MetricsSidebar`: shows top 3 gap categories with missing tool names
- `trends?: TrendData | null` prop on `MetricsSidebar` and `LibraryOverview`
- Trends loaded non-blocking in `page.tsx` from `/data/trends.json` after library loads
- Two new MCP tools: `get_library_intelligence` and `get_daily_digest` (with `full`/`brief` format)
- Updated GitHub Actions workflow to run all 4 scripts and commit `library.json`, `trends.json`, and `DIGEST.md`
- 2 new test files: `buildGapAnalysis.test.ts` (8 tests), `detectTrends.test.ts` (11 tests)
### Changed
- `enrichRepo` Omit type extended to include `'latestRelease'`; default `latestRelease: null` added to return value
- `mapGitHubRepo` Omit type extended to include `'latestRelease'`
- All 6 `makeRepo` test helpers updated to include `latestRelease: null`
- `pipeline.test.ts` `LibraryData` fixture updated to include `gapAnalysis` field
- API route `reposWithLanguages` map adds `latestRelease: null`; `LibraryData` output includes `gapAnalysis: { generatedAt, gaps: [] }`

## [1.0.0] - 2026-03-12
### Fixed
- Categories overhauled — exactly 21 hardcoded buckets, never derived dynamically from tags; repos now assigned to `allCategories` (all matching) and `primaryCategory` (best match)
- Tag dictionary massively expanded with ~80 new keyword entries covering inference tools, evals frameworks, observability platforms, training libraries, RAG components, computer vision models, robotics systems, generative media tools, MLOps platforms, security/safety research, XR platforms, and data science libraries
### Added
- Active filter bar: sticky strip above FilterBar showing all active filters as removable pills with × buttons; shows matching repo count
- Category-colored left border on repo cards: 4px left border and subtle background tint derived from the repo's primary category color
- Multi-category badges on repo cards: up to 2 category badges displayed (primary + 1 additional), with overflow count shown
- Tag limit on repo cards: enrichedTags capped at 8 displayed tags to reduce visual clutter
- Category detail view in sidebar: when a category is selected and no tags are active, the sidebar shows category description, tags with counts, top repos by parent stars, and most recently updated repo; includes a Back button
- Tags sub-row in FilterBar: when a category is selected, the tags row filters to show only tags belonging to that category; otherwise shows top 20 tags by repo count

## [0.8.0] - 2026-03-12
### Added
- Build-time data pipeline: `scripts/generate-library.ts` — all GitHub API calls moved to build time, runs once/daily
- Static JSON output: `public/data/library.json` — page loads from `/data/library.json` with zero runtime API calls
- GitHub Actions: `.github/workflows/refresh-data.yml` — daily cron at 6am UTC, manual trigger supported
- Accurate commit history: `commitsLast7Days`, `commitsLast30Days`, `commitsLast90Days`, `totalCommitsFetched` fields on `EnrichedRepo`
- `fetchCommitsSince` in `github.ts` — fetches commits using GitHub `since` parameter for accurate date windowing
- Category system: `buildCategories.ts` with 10 top-level categories (AI & Machine Learning, Generative AI, Robotics & Spatial, Infrastructure & DevOps, Languages & Frameworks, Cloud & Data, Learning & Reference, Web & Mobile, Audio & Music, Healthcare & Science)
- `primaryCategory` field on `EnrichedRepo` — assigned by `buildCategories` based on enriched tag matches
- `Category` interface and `categories: Category[]` field on `LibraryData`
- New framework tags: LangChain, LangGraph, LlamaIndex, CrewAI, AutoGen, HuggingFace, Ollama, LLM Serving, Model Optimization, LoRA / PEFT, ComfyUI, Whisper, No-Code Automation, Multi-Agent, Tool Use, Structured Output, Evals, Synthetic Data, Quantization, Inference, Long Context, Agent Memory, Planning / CoT, Simulation, SLAM, Humanoid Robotics, Robot Learning
- `npm run generate` and `npm run generate:build` scripts in package.json
### Changed
- `page.tsx`: fetches from `/data/library.json` instead of `/api/repos/[username]`; removed `UsernameInput`, `RateLimitBanner`, `retryKey`, `rateLimit` state, and `DEFAULT_USERNAME` constant; username displayed from `data.username`

## [0.7.0] - 2026-03-12
### Added
- `weeklyCommitCount`, `languageBreakdown`, `languagePercentages` fields on `EnrichedRepo`
- `fetchWeeklyCommitCount` in `github.ts` — accurate 7-day commit count using GitHub `since` parameter
- `fetchLanguageBreakdown` in `github.ts` — per-repo language bytes from `/languages` endpoint
- Weekly commit count: sidebar "This Week" section now uses `weeklyCommitCount` field (fetched via `since=` API parameter) instead of filtering `recentCommits` (which was capped at 3 per repo)
- Sync health rows: each Fork Sync Health category (up-to-date, behind, behind-100, ahead, diverged) is now a clickable button that filters the main repo grid
- `onSyncFilter` prop on `MetricsSidebar` and `LibraryOverview` for sidebar → sync status filter integration
- Star & Fork Stats section in sidebar overview: total/avg/median parent stars, star distribution (0–100, 100–1k, 1k–10k, 10k+), top 10 starred repos, top 5 most-forked repos
- Language breakdown bar on repo cards: shows top 3 languages (plus Other) as percentages when more than 1 language is present
- Language breakdown batch-fetched per repo in API route (30s timeout); stored in `languageBreakdown` and `languagePercentages` on `EnrichedRepo`

## [0.6.0] - 2026-03-12
### Added
- `ForkSyncState` and `ForkSyncStatus` types in `types/repo.ts`
- `fetchForkSyncStatus` in `github.ts` — GitHub Compare API integration, maps identical/ahead/behind/diverged states, safe unknown fallback on any error
- Rich date metadata fields on `EnrichedRepo`: `createdAt`, `forkedAt`, `yourLastPushAt`, `upstreamLastPushAt`, `upstreamCreatedAt`
- `upstreamCreatedAt`, `upstreamLastPushAt`, `upstreamDefaultBranch` on `ForkInfo` interface; `fetchForkInfo` now reads `parent.created_at`, `parent.pushed_at`, `parent.default_branch`
- `GitHubRepo` interface now includes `created_at` and `pushed_at` fields
- Fork sync status batch-fetched per fork in the API route (20s timeout); results stored in `forkSync` field on `EnrichedRepo`
- Timeline section on repo cards: Project created / You forked (with "X mo later") / Your last push / Upstream last push
- Sync Status badge on repo cards: color-coded icon and label for up-to-date, behind (tiered: <10 / 10-100 / 100+), ahead, diverged, unknown
- Fork Sync Health dashboard in sidebar: breakdown by state with sub-buckets for behind severity, most outdated forks list, "Show only outdated repos →" button
- `onViewOutdated` prop on `MetricsSidebar` and `LibraryOverview` for sidebar → filter integration
- New sort options: Most Outdated (behindBy), Upstream Recently Updated, Forked: Oldest First, Forked: Newest First
- Sync status filter in FilterBar: All / Up to date / Behind (any) / Behind 100+ / Ahead / Diverged
- `showOutdatedOnly` state in page.tsx for outdated-fork-only filtering
- Date intelligence fields on `TagMetrics`: `avgUpstreamAge`, `avgTimeSinceForked`, `mostOutdatedRepo`, `avgBehindBy`
- 3 new test files: `forkSyncStatus.test.ts`, `dateMetadata.test.ts`, `syncFilter.test.ts` (~40 new tests)

## [0.5.0] - 2026-03-12
### Added
- Recent commit history: fetch last 3 commits per repo from parent (or own) repo
- `CommitSummary` type; `recentCommits` field on `EnrichedRepo`
- `fetchRecentCommits` in `github.ts` — bot/empty message filtering, 60-char truncation
- Collapsible "Recent Updates" section on repo cards with color-coded recency dots
- `calculateActivityScore` — per-repo 0-100 score using update date, commit recency, parent stars, archived penalty
- Activity feed in sidebar: time-filtered (Today/7d/30d/60d/90d/Custom) commit log across all repos
- "This Week" section in sidebar overview: commit count and most active repos
- "Needs Attention" section: repos with archived parents or inactive 6+ months, with "View all →" filter
- `attentionFilter` state in page.tsx for attention-based repo filtering

## [0.4.0] - 2026-03-12
### Added
- Parent repo stats: `fetchParentRepoStats` fetches stars, forks, open issues, last commit date, archived status from original repos
- `parentStats` field on `EnrichedRepo` — populated for all forks in the API route via batched fetch with 30s timeout
- Persistent `MetricsSidebar` — 380px right panel always visible on desktop (≥1024px), toggled on mobile
  - State 1 (no tags): library overview with activity score, top languages, most active tag, most starred fork, recently forked list, library health metrics
  - State 2 (single tag): tag detail with language bars, avg parent stars, repos sorted by parent stars, related tags
  - State 3 (multi-tag): intersection view with matching repos, suggested tags, avg parent stars
- `buildIntersectionMetrics` — client-side multi-tag intersection analytics: matching repos, activity score, suggested tags, avg/top parent stars
- `IntersectionMetrics` and `ParentRepoStats` types in `types/repo.ts`
- Sort controls in FilterBar: Recently Updated (default), Parent Stars, Most Tags, A→Z, Oldest First
- `SortOption` type exported from `types/repo.ts`
- Similarity count on repo cards: number of library repos sharing ≥2 meaningful tags
- Archived parent badge on repo cards where the original repo is archived
- Parent stars/forks display on forked repo cards (replacing useless fork-copy zeros)
- Library health summary in sidebar overview (archived parents, inactive repos, richly/poorly tagged counts, avg parent stars)
### Changed
- `TagExplorerPanel` popup replaced by persistent `MetricsSidebar` — no content obstruction
- RepoGrid grid columns adjusted for sidebar layout (2-col on large, 3-col on xl)
- FilterBar receives `sortBy` and `onSortChange` props

## [0.3.0] - 2026-03-12
### Added
- Tag metrics system: per-tag analytics (activity score, language breakdown, related tags, repo list)
- TagExplorerPanel: slide-in detail panel for any tag with full metrics
- Enhanced FilterBar: tag counts, activity dots, "show all" toggle
- Tag cloud in StatsBar: font-size and opacity scale with count and activity
- Rebuilt StatsBar: data-rich layout with active count, category count, top tag, most recent repo
### Fixed
- Game Dev false matches: removed generic 'game' keyword
- Robotics false matches: removed generic 'robot' keyword
- Removed additional broad keywords: standalone 'api', 'cli', 'cache', 'navigation', 'localization', 'manipulation'
- Tag filter strictly uses enrichedTags.includes() — completely separate from text search

## [0.2.0] - 2026-03-12
### Added
- README-based tag enrichment: fetch each repo's README and extract 70+ tag patterns
- `extractTagsFromReadme` pure function with comprehensive keyword map
- `batchFetch` utility with configurable concurrency and inter-batch delay
- `fetchReadme` GitHub client function (tries main then master branch)
- `/api/debug/tags` diagnostic endpoint for tag quality inspection
- 2-hour response cache (up from 1 hour)
- `X-Readme-Fetched` response header with README fetch count

## [0.1.0] - 2026-03-12
### Added
- Initial release
- GitHub API integration with pagination and rate limit handling
- Repo enrichment with 50+ tag mappings
- Built vs Forked labeling
- Interactive library UI: search, filter, stats
- GitHub Actions CI pipeline
- GitHub Pages auto-deploy for forked instances
- AI agent accessibility via /api/repos/[username] and llms.txt
