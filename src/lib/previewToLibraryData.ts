/**
 * KAN-152: adapter from `PreviewData` (lean home-page payload) to a
 * `LibraryData`-shaped object the existing UI can render without changes.
 *
 * The home grid (`RepoCardMinimal`) only consumes a subset of `EnrichedRepo`
 * fields — name/fullName/description/stars/forks/enrichedTags/dbCategory/
 * isFork/parentStats?.owner/lastUpdated/isArchived/language/primaryCategory.
 * Aggregate consumers (`StatsBar`, `MetricsSidebar`, `LibraryInsightsWidget`,
 * `CrossDimensionWidget`, `RecommendationsWidget`, search, NL filter) all
 * sit behind tab/filter toggles that trigger a lazy `getLibrary()` upgrade.
 *
 * Until the full library lands, this adapter fills the `LibraryData` shape
 * with safe empty defaults so the component tree renders without blowing up
 * on missing aggregates. Once full lands, callers replace the entire `data`
 * state — there is no merge step.
 *
 * Critical: server-side preview already coalesces `parent_stars` into
 * `repo.stars`, so cards show the upstream count without needing a
 * synthesised `parentStats`. We DO synthesise a minimal `parentStats` for
 * forks (only owner + url, derived from `forkedFrom`) so the builder line
 * reads "by ggml-org" rather than "by perditioinc".
 */

import type {
  EnrichedRepo,
  LibraryData,
  ParentRepoStats,
} from '@/types/repo'
import type { PreviewData, PreviewRepo } from '@/lib/dataProvider'

/**
 * Promote the preview's optional `parentStats` block (when KAN-179
 * `?include=parent` was requested) to a full `ParentRepoStats`. The preview
 * shape omits `openIssues`, so we default it to 0; nothing on the card
 * surface reads it.
 */
function liftParentStats(p: PreviewRepo): ParentRepoStats | null {
  if (!p.parentStats) return null
  return {
    owner: p.parentStats.owner,
    repo: p.parentStats.repo,
    stars: p.parentStats.stars,
    forks: p.parentStats.forks,
    openIssues: 0,
    lastCommitDate: p.parentStats.lastCommitDate ?? '',
    isArchived: p.parentStats.isArchived,
    description: p.parentStats.description,
    url: p.parentStats.url,
  }
}

/**
 * For a forked preview repo, synthesise the minimum `parentStats` fields the
 * card surface reads. The preview's `stars`/`forks` values are already
 * pre-coalesced server-side (`COALESCE(parent_stars, ...)`) so we mirror
 * those into the synth `parentStats` to keep the card's
 * `parentStats?.stars ?? stars` lookup behaving identically.
 *
 * KAN-185: prefer the real `parentStats` block from `?include=parent` when
 * present, since it carries the genuine `isArchived` flag /insights/ Health
 * Alerts depends on. Falls back to the fork-only synth otherwise.
 */
function synthParentStatsForFork(p: PreviewRepo): ParentRepoStats | null {
  const lifted = liftParentStats(p)
  if (lifted) return lifted
  if (!p.isFork || !p.forkedFrom) return null
  const [owner, repo] = p.forkedFrom.split('/')
  if (!owner || !repo) return null
  return {
    owner,
    repo,
    stars: p.stars,
    forks: p.forks,
    openIssues: 0,
    lastCommitDate: p.lastUpdated ?? '',
    isArchived: false,
    description: p.description,
    url: `https://github.com/${owner}/${repo}`,
  }
}

/** Numeric `id` for `EnrichedRepo` — preview returns string UUIDs. */
function idHash(s: string): number {
  // FNV-1a 32-bit. Stable, collision-rare for ~2 K rows. We only need a
  // unique React key + numeric id; nothing maps back to the DB id this way.
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/** Promote a `PreviewRepo` to an `EnrichedRepo` with empty aggregates. */
export function previewToEnrichedRepo(p: PreviewRepo): EnrichedRepo {
  // KAN-185: surface optional include blocks when present. Empty-default
  // shapes match the previous behaviour for the home-page baseline (no
  // include tokens) so downstream consumers continue to see safe zeros.
  const commitStats = p.commitStats
    ? {
        today: 0,
        last7Days: p.commitStats.last7Days,
        last30Days: p.commitStats.last30Days,
        last90Days: p.commitStats.last90Days,
        recentCommits: [],
      }
    : { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] }

  return {
    id: idHash(p.id),
    name: p.name,
    fullName: p.fullName,
    description: p.description,
    isFork: p.isFork,
    forkedFrom: p.forkedFrom,
    language: p.language,
    topics: [],
    enrichedTags: p.enrichedTags ?? [],
    stars: p.stars,
    forks: p.forks,
    openIssuesCount: 0,
    licenseSpdx: null,
    lastUpdated: p.lastUpdated ?? '',
    url: p.url,
    isArchived: p.isArchived,
    readmeSummary: null,
    parentStats: synthParentStatsForFork(p),
    recentCommits: [],
    createdAt: null,
    forkedAt: null,
    yourLastPushAt: null,
    upstreamLastPushAt: null,
    upstreamCreatedAt: p.upstreamCreatedAt ?? null,
    forkSync: null,
    weeklyCommitCount: 0,
    languageBreakdown: {},
    languagePercentages: {},
    commitsLast7Days: [],
    commitsLast30Days: [],
    commitsLast90Days: [],
    totalCommitsFetched: 0,
    primaryCategory: p.primaryCategory ?? '',
    allCategories: p.primaryCategory ? [p.primaryCategory] : [],
    dbCategory: p.dbCategory,
    commitStats,
    latestRelease: null,
    aiDevSkills: [],
    pmSkills: [],
    industries: [],
    programmingLanguages: p.language ? [p.language] : [],
    builders: [],
    taxonomy: [],
    qualitySignals: (p.qualitySignals as EnrichedRepo['qualitySignals']) ?? null,
  }
}

/**
 * Build a partial `LibraryData` from a `PreviewData` for first paint.
 * Aggregates (categories, tagMetrics, builderStats, aiDevSkillStats,
 * pmSkillStats, gapAnalysis) are intentionally empty — consumers that need
 * them sit behind UI toggles that trigger a lazy full-library upgrade.
 */
export function previewToLibraryData(preview: PreviewData): LibraryData {
  const repos = preview.repos.map(previewToEnrichedRepo)

  // Languages list — derive from the preview repos (top languages will appear
  // in the filter dropdown after full library loads, but the languages bar in
  // FilterBar is gated behind the filters panel, so this only matters for the
  // KPI hero counts which read `data.stats.languages`).
  const langSet = new Set<string>()
  for (const r of repos) if (r.language) langSet.add(r.language)

  return {
    username: '',
    generatedAt: preview.generatedAt,
    stats: {
      total: preview.totalRepos,
      built: repos.filter((r) => !r.isFork).length,
      forked: repos.filter((r) => r.isFork).length,
      languages: [...langSet].sort(),
      topTags: [],
    },
    repos,
    tagMetrics: [],
    categories: [],
    gapAnalysis: { generatedAt: preview.generatedAt, gaps: [] },
    builderStats: [],
    aiDevSkillStats: [],
    pmSkillStats: [],
    totalRepos: preview.totalRepos,
  }
}
