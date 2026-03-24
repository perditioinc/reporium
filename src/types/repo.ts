export interface Builder {
  login: string
  name: string | null
  type: 'organization' | 'user'
  avatarUrl: string
  isKnownOrg: boolean
  orgCategory: string | null
}

export interface TaxonomyEntry {
  dimension: string
  value: string
  similarityScore?: number | null
  assignedBy?: string
}

export interface TaxonomyValueOption {
  id: number
  dimension: string
  name: string
  description?: string | null
  repo_count: number
  trending_score?: number | null
  first_seen_at?: string | null
  last_active_at?: string | null
  created_at?: string | null
}

export interface BuilderStats {
  login: string
  displayName: string
  category: 'big-tech' | 'ai-lab' | 'startup' | 'individual' | 'research'
  repoCount: number
  totalParentStars: number
  topRepos: string[]
  avatarUrl: string
}

export interface SkillStats {
  skill: string
  repoCount: number
  coverage: 'strong' | 'moderate' | 'weak' | 'none'
  topRepos: string[]
}

/** Latest release info for a repo */
export interface LatestRelease {
  version: string;      // tag name e.g. "v2.1.0"
  releasedAt: string;   // ISO date
  url: string;          // release page URL
  isMajor: boolean;
  isMinor: boolean;
}

/** A trend signal for a tag or category */
export interface TrendSignal {
  name: string;
  type: 'tag' | 'category';
  currentActivity: number;
  previousActivity: number;
  changePercent: number;
  repoCount: number;
  representativeRepos: string[];
}

/** A notable release detected in trend analysis */
export interface ReleaseSignal {
  repoName: string;
  version: string;
  releasedAt: string;
  parentOwner: string;
  releaseUrl: string;
  isMajor: boolean;
  isMinor: boolean;
  parentStars: number;
}

/** Full trend analysis output */
export interface TrendData {
  generatedAt: string;
  period: {
    from: string;
    to: string;
    snapshots: number;
  };
  trending: TrendSignal[];
  emerging: TrendSignal[];
  cooling: TrendSignal[];
  stable: TrendSignal[];
  newReleases: ReleaseSignal[];
  insights: string[];
}

export interface TaxonomyGapInsight {
  dimension: string;
  value: string;
  repo_count: number;
  trending_score: number;
  description?: string | null;
}

export interface StaleRepoInsight {
  repo_name: string;
  owner: string;
  github_url: string;
  parent_stars?: number | null;
  activity_score: number;
  last_updated_at?: string | null;
  stale_days: number;
}

export interface VelocityLeaderInsight {
  repo_name: string;
  owner: string;
  github_url: string;
  commits_last_7_days: number;
  commits_last_30_days: number;
  activity_score: number;
}

export interface DuplicateClusterInsight {
  similarity: number;
  repos: string[];
}

export interface PortfolioInsights {
  generated_at: string;
  taxonomy_gaps: TaxonomyGapInsight[];
  stale_repos: StaleRepoInsight[];
  velocity_leaders: VelocityLeaderInsight[];
  near_duplicate_clusters: DuplicateClusterInsight[];
  summary: string[];
}

export interface CrossDimensionCell {
  dim1_value: string;
  dim2_value: string;
  repo_count: number;
}

export interface CrossDimensionAnalytics {
  dim1: string;
  dim2: string;
  limit: number;
  pairs: CrossDimensionCell[];
}

export type GapSeverity = 'missing' | 'weak' | 'moderate' | 'strong';

export interface GapEssentialRepo {
  owner: string;
  repo: string;
  reason: string;
}

export interface Gap {
  skill: string;
  severity: GapSeverity;
  repoCount: number;
  strongThreshold: number;
  why: string;
  trend: string;
  essentialRepos: GapEssentialRepo[];
  yourRepos: string[];      // names of repos in user's library covering this skill
  // legacy fields kept for backwards compat
  category: string;
  yourRepoCount: number;
  description: string;
  suggestedTags: string[];
  popularMissingRepos: { name: string; stars: number; url: string; description: string; }[];
}

/** Gap analysis output */
export interface GapAnalysis {
  generatedAt: string;
  gaps: Gap[];
}

/** A broad content category grouping multiple tags */
export interface Category {
  id: string;           // kebab-case identifier
  name: string;
  description: string;
  tags: string[];        // enrichedTags that belong to this category
  repoCount: number;
  color: string;         // hex color for visualization
  icon: string;         // emoji icon
  lifecycleGroup?: string; // one of the 6 lifecycle groups (e.g. "Foundation & Training")
}

/** Summary of a single git commit */
export interface CommitSummary {
  sha: string;
  message: string;       // first line of commit message only, max 60 chars
  date: string;          // ISO date
  author: string;        // commit author name
  url: string;           // link to commit on GitHub
}

/** Stats from the original/parent repository of a forked repo */
export interface ParentRepoStats {
  owner: string;
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
  lastCommitDate: string;
  isArchived: boolean;
  description: string | null;
  url: string;
}

export type ForkSyncState =
  | 'up-to-date'
  | 'behind'
  | 'ahead'
  | 'diverged'
  | 'unknown'

export interface ForkSyncStatus {
  state: ForkSyncState
  behindBy: number           // commits your fork is behind upstream
  aheadBy: number            // commits your fork is ahead of upstream
  upstreamBranch: string     // default branch of upstream (main/master)
}

/** A single enriched GitHub repository */
export interface EnrichedRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  isFork: boolean;
  forkedFrom: string | null;
  language: string | null;
  topics: string[];
  enrichedTags: string[];
  stars: number;
  forks: number;
  openIssuesCount?: number;
  lastUpdated: string;
  url: string;
  isArchived: boolean;
  readmeSummary: string | null;
  parentStats: ParentRepoStats | null;
  recentCommits: CommitSummary[];   // last N commits from parent (or own) repo

  // Date metadata
  createdAt: string;                    // when the original repo was created (parent's created_at for forks, repo.created_at for built)
  forkedAt: string | null;              // when THIS user forked it (null for built repos)
  yourLastPushAt: string | null;        // when perditioinc last pushed to their fork (null for built repos)
  upstreamLastPushAt: string | null;    // when upstream owner last pushed (null for built repos)
  upstreamCreatedAt: string | null;     // when the original project was first created (null for built repos)

  // Fork sync status
  forkSync: ForkSyncStatus | null;      // null for built repos

  weeklyCommitCount: number;   // commits in the last 7 days (fetched with since= parameter)
  languageBreakdown: Record<string, number>;    // bytes per language from /languages endpoint
  languagePercentages: Record<string, number>;  // percentage per language (calculated from bytes)

  // Accurate commit history fetched with since= parameter
  commitsLast7Days: CommitSummary[];    // commits in last 7 days
  commitsLast30Days: CommitSummary[];   // commits in last 30 days
  commitsLast90Days: CommitSummary[];   // commits in last 90 days
  totalCommitsFetched: number;          // total from the fetch window

  // Category assignment
  primaryCategory: string;              // top-level category (from buildCategories)
  allCategories: string[];              // all categories this repo belongs to

  // Accurate commit stats with true counts (paginated if needed)
  commitStats: {
    today: number;
    last7Days: number;
    last30Days: number;
    last90Days: number;
    recentCommits: CommitSummary[];  // last 5 commits for card display
  };

  latestRelease: LatestRelease | null;

  aiDevSkills: { skill: string; lifecycleGroup: string }[];
  pmSkills: string[];
  industries: string[];
  programmingLanguages: string[];
  builders: Builder[];
  similarity?: number;
  taxonomy?: TaxonomyEntry[];
}

/** Summary statistics for a user's library */
export interface LibraryStats {
  total: number;
  built: number;
  forked: number;
  languages: string[];
  topTags: string[];
}

/** Per-tag analytics computed across all repos in the library */
export interface TagMetrics {
  tag: string;
  repoCount: number;
  percentage: number;
  topLanguage: string | null;
  languageBreakdown: Record<string, number>;
  updatedLast30Days: number;
  updatedLast90Days: number;
  olderThan90Days: number;
  activityScore: number;
  relatedTags: string[];
  mostRecentRepo: string;
  mostRecentDate: string;
  repos: string[];
  avgUpstreamAge: number;          // avg age in months of upstream repos in this tag
  avgTimeSinceForked: number;      // avg months since user forked repos in this tag
  mostOutdatedRepo: string;        // name of repo with highest behindBy in this tag
  avgBehindBy: number;             // avg commits behind for repos with forkSync data in this tag
}

/** Analytics for the intersection of multiple selected tags (computed client-side) */
export interface IntersectionMetrics {
  selectedTags: string[];
  matchingRepos: EnrichedRepo[];
  repoCount: number;
  percentage: number;
  activityScore: number;
  updatedLast30Days: number;
  updatedLast90Days: number;
  topLanguages: Record<string, number>;
  suggestedTags: string[];
  avgParentStars: number;
  mostStarredRepo: string | null;
}

/** Sort options for the repo grid */
export type SortOption = 'updated' | 'stars' | 'tags' | 'alpha' | 'oldest' | 'most-outdated' | 'upstream-updated' | 'fork-oldest' | 'fork-newest';

/** Full API response shape */
export interface LibraryData {
  username: string;
  generatedAt: string;
  stats: LibraryStats;
  repos: EnrichedRepo[];
  tagMetrics: TagMetrics[];
  categories: Category[];
  gapAnalysis: GapAnalysis;
  builderStats: BuilderStats[];
  aiDevSkillStats: SkillStats[];
  pmSkillStats: SkillStats[];
  // Pagination fields (present when the API returns paginated results)
  page?: number;
  pageSize?: number;
  totalRepos?: number;
  totalPages?: number;
}
