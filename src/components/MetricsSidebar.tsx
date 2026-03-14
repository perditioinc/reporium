'use client';

import { useState } from 'react';
import { LibraryData, TagMetrics, IntersectionMetrics, EnrichedRepo, CommitSummary, TrendData } from '@/types/repo';
import { CATEGORIES } from '@/lib/buildCategories';

interface MetricsSidebarProps {
  data: LibraryData;
  selectedTags: string[];
  tagMetrics: TagMetrics[];
  intersectionMetrics: IntersectionMetrics | null;
  onTagClick: (tag: string) => void;
  onTagRemove: (tag: string) => void;
  onRepoClick: (name: string) => void;
  onViewArchived?: () => void;
  onViewStale?: () => void;
  onViewOutdated?: () => void;
  onSyncFilter?: (status: 'up-to-date' | 'behind' | 'behind-100' | 'ahead' | 'diverged') => void;
  onCategoryFilter?: (categoryId: string) => void;
  selectedCategory?: string;
  trends?: TrendData | null;
}

const SYSTEM_TAGS = new Set(['Forked', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

function relativeTime(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}

/** Horizontal mini bar showing fraction of max */
function LangBar({ lang, count, max }: { lang: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 truncate text-xs text-zinc-300">{lang}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-xs text-zinc-500">{count}</span>
    </div>
  );
}

/** Activity score progress bar */
function ActivityBar({ score }: { score: number }) {
  const color = score > 60 ? 'bg-emerald-500' : score > 30 ? 'bg-amber-500' : 'bg-zinc-500';
  return (
    <div className="h-2 w-full rounded-full bg-zinc-800">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

/** Repo row with parent stars and relative time */
function RepoRow({
  repo,
  onClick,
}: {
  repo: EnrichedRepo;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <button
        onClick={onClick}
        className="flex-1 truncate text-left text-xs text-zinc-300 hover:text-blue-400 transition-colors"
      >
        {repo.name}
      </button>
      {repo.parentStats && (
        <span className="shrink-0 text-xs text-zinc-500">
          ⭐ {formatStars(repo.parentStats.stars)}
        </span>
      )}
      <span className="shrink-0 text-xs text-zinc-600">{relativeTime(repo.lastUpdated)}</span>
    </div>
  );
}

/** Section header */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{children}</p>
  );
}

// ─── Activity Feed ─────────────────────────────────────────────────────────────

interface FeedEntry {
  repoName: string;
  commit: CommitSummary;
}

/**
 * Filters feed entries by a date range.
 * @param entries - All feed entries
 * @param fromMs - Start of range in milliseconds (inclusive)
 * @param toMs - End of range in milliseconds (inclusive)
 * @returns Filtered entries within the range, sorted by date descending
 */
export function filterFeedEntries(
  entries: FeedEntry[],
  fromMs: number,
  toMs: number
): FeedEntry[] {
  return entries
    .filter((e) => {
      const t = new Date(e.commit.date).getTime();
      return t >= fromMs && t <= toMs;
    })
    .sort((a, b) => new Date(b.commit.date).getTime() - new Date(a.commit.date).getTime());
}

/** Compute feed time range given current filter state */
function computeFeedRange(
  feedDays: number,
  isCustom: boolean,
  customFrom: string,
  customTo: string
): { fromMs: number; toMs: number } {
  const nowMs = Date.now();
  if (isCustom) {
    return {
      fromMs: customFrom ? new Date(customFrom).getTime() : 0,
      toMs: customTo ? new Date(customTo).getTime() + 86400000 - 1 : nowMs,
    };
  }
  return { fromMs: nowMs - feedDays * 86400000, toMs: nowMs };
}

/** Get text color class for a commit age in days */
function commitAgeTextColor(days: number): string {
  return days < 7 ? 'text-emerald-400' : days < 30 ? 'text-amber-400' : 'text-zinc-500';
}

/** Get short label for a commit age in days */
function commitAgeLabel(days: number): string {
  return days === 0 ? 'today' : days === 1 ? '1d' : `${days}d`;
}

/** Get days elapsed since a date string */
function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

type ActivityTab = 'today' | '7days' | '30days' | '90days';

interface ActivityFeedProps {
  repos: EnrichedRepo[];
  onRepoClick: (name: string) => void;
}

/**
 * Activity feed showing commits across all repos, with Today/7d/30d/90d tabs.
 */
function ActivityFeed({ repos, onRepoClick }: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>('7days');

  const tabs: { key: ActivityTab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7days', label: '7 Days' },
    { key: '30days', label: '30 Days' },
    { key: '90days', label: '90 Days' },
  ];

  // Compute aggregate stats from commitStats
  const totalCommits = repos.reduce((sum, r) => {
    if (!r.commitStats) return sum;
    if (activeTab === 'today') return sum + r.commitStats.today;
    if (activeTab === '7days') return sum + r.commitStats.last7Days;
    if (activeTab === '30days') return sum + r.commitStats.last30Days;
    return sum + r.commitStats.last90Days;
  }, 0);

  const activeRepos = repos.filter((r) => {
    if (!r.commitStats) return false;
    if (activeTab === 'today') return r.commitStats.today > 0;
    if (activeTab === '7days') return r.commitStats.last7Days > 0;
    if (activeTab === '30days') return r.commitStats.last30Days > 0;
    return r.commitStats.last90Days > 0;
  });

  const mostActive = [...activeRepos]
    .sort((a, b) => {
      const aCount = a.commitStats ? (activeTab === 'today' ? a.commitStats.today : activeTab === '7days' ? a.commitStats.last7Days : activeTab === '30days' ? a.commitStats.last30Days : a.commitStats.last90Days) : 0;
      const bCount = b.commitStats ? (activeTab === 'today' ? b.commitStats.today : activeTab === '7days' ? b.commitStats.last7Days : activeTab === '30days' ? b.commitStats.last30Days : b.commitStats.last90Days) : 0;
      return bCount - aCount;
    })
    .slice(0, 5);

  // Build feed entries from recentCommits
  const allEntries: FeedEntry[] = repos.flatMap((repo) => {
    const commits = repo.commitStats?.recentCommits ?? repo.recentCommits;
    return commits.map((commit) => ({ repoName: repo.name, commit }));
  });

  const now = Date.now();
  const tabMs: Record<ActivityTab, number> = {
    today: new Date().setHours(0, 0, 0, 0),
    '7days': now - 7 * 86400000,
    '30days': now - 30 * 86400000,
    '90days': now - 90 * 86400000,
  };
  const filtered = filterFeedEntries(allEntries, tabMs[activeTab], now);

  return (
    <div className="mt-5 pt-5 border-t border-zinc-800">
      <SectionLabel>Activity Feed</SectionLabel>

      {/* Tab buttons */}
      <div className="flex gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <p className="text-xs text-zinc-500 mb-2">
        {totalCommits} commit{totalCommits !== 1 ? 's' : ''} across {activeRepos.length} repo{activeRepos.length !== 1 ? 's' : ''}
      </p>

      {/* Most active repos */}
      {mostActive.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-zinc-600 mb-1">Most active:</p>
          <div className="space-y-0.5">
            {mostActive.map((r) => {
              const count = r.commitStats ? (activeTab === 'today' ? r.commitStats.today : activeTab === '7days' ? r.commitStats.last7Days : activeTab === '30days' ? r.commitStats.last30Days : r.commitStats.last90Days) : 0;
              return (
                <div key={r.name} className="flex items-center gap-2">
                  <button
                    onClick={() => onRepoClick(r.name)}
                    className="flex-1 truncate text-left text-xs text-zinc-300 hover:text-blue-400 transition-colors"
                  >
                    {r.name}
                  </button>
                  <span className="shrink-0 text-xs text-zinc-500">{count} commit{count !== 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent commit feed */}
      {filtered.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {filtered.map((entry, idx) => (
            <FeedEntryRow
              key={`${entry.commit.sha}-${idx}`}
              entry={entry}
              onRepoClick={onRepoClick}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600">No commits in this range.</p>
      )}
    </div>
  );
}

/** Single row in the activity feed */
function FeedEntryRow({ entry, onRepoClick }: { entry: FeedEntry; onRepoClick: (name: string) => void }) {
  const days = daysSince(entry.commit.date);
  const textColor = commitAgeTextColor(days);
  const label = commitAgeLabel(days);
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onRepoClick(entry.repoName)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
        >
          {entry.repoName}
        </button>
        <p className="text-xs text-zinc-500 truncate">{entry.commit.message}</p>
      </div>
      <span className={`shrink-0 text-xs ${textColor}`}>{label}</span>
    </div>
  );
}

// ─── Rankings & Recommendations Panel ────────────────────────────────────────

/**
 * Shows top repos by stars, most active this month, recommended to explore,
 * and forks needing attention. Scoped to a subset of repos when provided.
 */
function RankingsPanel({ repos, onRepoClick }: {
  repos: EnrichedRepo[];
  onRepoClick: (name: string) => void;
}) {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  // Top 5 by parent stars
  const top5Starred = [...repos]
    .filter(r => r.parentStats !== null)
    .sort((a, b) => (b.parentStats?.stars ?? 0) - (a.parentStats?.stars ?? 0))
    .slice(0, 5);

  // Most active this month (by commitsLast30Days count)
  const mostActive = [...repos]
    .filter(r => (r.commitStats?.last30Days ?? r.commitsLast30Days?.length ?? 0) > 0)
    .sort((a, b) => {
      const bCount = b.commitStats?.last30Days ?? b.commitsLast30Days?.length ?? 0;
      const aCount = a.commitStats?.last30Days ?? a.commitsLast30Days?.length ?? 0;
      return bCount - aCount;
    })
    .slice(0, 5);

  // Recommended: high-value forks the user never engaged with
  const recommended = repos.filter(r =>
    r.isFork &&
    (r.parentStats?.stars ?? 0) > 1000 &&
    r.forkedAt !== null &&
    new Date(r.forkedAt).getTime() < ninetyDaysAgo &&
    (r.yourLastPushAt === null || r.forkSync?.behindBy === 0)
  ).sort((a, b) => (b.parentStats?.stars ?? 0) - (a.parentStats?.stars ?? 0)).slice(0, 5);

  // Needs attention: behind by 100+ commits
  const needsAttention = [...repos]
    .filter(r => r.forkSync?.state === 'behind' && (r.forkSync?.behindBy ?? 0) >= 100)
    .sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0))
    .slice(0, 5);

  if (top5Starred.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Top by stars */}
      <div>
        <SectionLabel>🏆 Top by Parent Stars</SectionLabel>
        <div className="space-y-1">
          {top5Starred.map((repo, i) => {
            const stars = repo.parentStats?.stars ?? 0;
            const catIcon = repo.primaryCategory
              ? (repo.primaryCategory.split(' ')[0]) : '';
            return (
              <div key={repo.id} className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-zinc-600 w-4 shrink-0">{i + 1}.</span>
                <button
                  onClick={() => onRepoClick(repo.name)}
                  className="flex-1 truncate text-left text-xs text-zinc-300 hover:text-blue-400 transition-colors"
                >
                  {repo.name}
                </button>
                <span className="text-xs text-zinc-500 shrink-0">⭐ {formatStars(stars)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Most active this month */}
      {mostActive.length > 0 && (
        <div>
          <SectionLabel>🔥 Most Active This Month</SectionLabel>
          <div className="space-y-1">
            {mostActive.map((repo, i) => {
              const count = repo.commitStats?.last30Days ?? repo.commitsLast30Days?.length ?? 0;
              return (
                <div key={repo.id} className="flex items-center gap-2 py-0.5">
                  <span className="text-xs text-zinc-600 w-4 shrink-0">{i + 1}.</span>
                  <button
                    onClick={() => onRepoClick(repo.name)}
                    className="flex-1 truncate text-left text-xs text-zinc-300 hover:text-blue-400 transition-colors"
                  >
                    {repo.name}
                  </button>
                  <span className="text-xs text-emerald-500 shrink-0">{count} commits</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommended to explore */}
      {recommended.length > 0 && (
        <div>
          <SectionLabel>📈 Recommended to Explore</SectionLabel>
          <p className="text-xs text-zinc-600 mb-1.5">High-value forks you haven't engaged with</p>
          <div className="space-y-1">
            {recommended.map(repo => {
              const stars = repo.parentStats?.stars ?? 0;
              const forkedDaysAgo = repo.forkedAt
                ? Math.floor((now - new Date(repo.forkedAt).getTime()) / 86400000)
                : null;
              const neverPushed = repo.yourLastPushAt === null;
              return (
                <div key={repo.id} className="flex items-start gap-2 py-0.5">
                  <span className="text-zinc-600 text-xs mt-0.5">•</span>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onRepoClick(repo.name)}
                      className="truncate text-left text-xs text-zinc-300 hover:text-blue-400 transition-colors block w-full"
                    >
                      {repo.name}
                    </button>
                    <span className="text-xs text-zinc-600">
                      ⭐ {formatStars(stars)}
                      {forkedDaysAgo !== null && ` · forked ${Math.round(forkedDaysAgo / 30)}mo ago`}
                      {neverPushed && ' · never pushed'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div>
          <SectionLabel>🔄 Needs Attention</SectionLabel>
          <p className="text-xs text-zinc-600 mb-1.5">Forks behind by 100+ commits</p>
          <div className="space-y-1">
            {needsAttention.map(repo => (
              <div key={repo.id} className="flex items-center gap-2 py-0.5">
                <button
                  onClick={() => onRepoClick(repo.name)}
                  className="flex-1 truncate text-left text-xs text-zinc-300 hover:text-blue-400 transition-colors"
                >
                  {repo.name}
                </button>
                <span className="text-xs text-red-400 shrink-0">⬇️ {repo.forkSync?.behindBy}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STATE 1: Library overview ────────────────────────────────────────────────

function LibraryOverview({ data, tagMetrics, onRepoClick, onViewArchived, onViewStale, onViewOutdated, onSyncFilter, onCategoryFilter, trends }: {
  data: LibraryData;
  tagMetrics: TagMetrics[];
  onRepoClick: (name: string) => void;
  onViewArchived?: () => void;
  onViewStale?: () => void;
  onViewOutdated?: () => void;
  onSyncFilter?: (status: 'up-to-date' | 'behind' | 'behind-100' | 'ahead' | 'diverged') => void;
  onCategoryFilter?: (categoryId: string) => void;
  trends?: TrendData | null;
}) {
  const { repos } = data;
  const nowMs = new Date(data.generatedAt).getTime();

  // Overall activity
  let actPts = 0, last30 = 0, last90 = 0, older = 0;
  for (const r of repos) {
    const d = (nowMs - new Date(r.lastUpdated).getTime()) / 86400000;
    if (d < 30) { last30++; actPts += 3; }
    else if (d < 90) { last90++; actPts += 1; }
    else older++;
  }
  const actScore = repos.length > 0 ? Math.round((actPts / (repos.length * 3)) * 100) : 0;

  // Top languages
  const langCounts = new Map<string, number>();
  for (const r of repos) {
    if (r.language) langCounts.set(r.language, (langCounts.get(r.language) ?? 0) + 1);
  }
  const topLangs = [...langCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxLang = topLangs[0]?.[1] ?? 1;

  // Most active tag
  const mostActiveTag = tagMetrics
    .filter((m) => !SYSTEM_TAGS.has(m.tag))
    .reduce<TagMetrics | null>((best, m) => (!best || m.activityScore > best.activityScore ? m : best), null);

  // Most starred parent repo
  const reposWithStars = repos.filter((r) => r.parentStats !== null);
  const topStarred = reposWithStars.length > 0
    ? reposWithStars.reduce((best, r) =>
        (r.parentStats?.stars ?? 0) > (best.parentStats?.stars ?? 0) ? r : best
      )
    : null;

  // Recently forked
  const recentForks = [...repos]
    .filter((r) => r.isFork)
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 3);

  // Library health
  const archivedParents = repos.filter((r) => r.parentStats?.isArchived).length;
  const inactiveRepos = repos.filter((r) => {
    const d = (nowMs - new Date(r.lastUpdated).getTime()) / 86400000;
    return d > 180;
  }).length;
  const richlyTagged = repos.filter((r) => r.enrichedTags.length >= 8).length;
  const poorlyTagged = repos.filter((r) => r.enrichedTags.length < 3).length;
  const reposWithParent = repos.filter((r) => r.parentStats !== null);
  const totalParentStars = reposWithParent.reduce((s, r) => s + (r.parentStats?.stars ?? 0), 0);
  const avgParentStars = reposWithParent.length > 0
    ? Math.round(totalParentStars / reposWithParent.length)
    : 0;

  // All unique non-system tags
  const allTagCount = new Set(
    repos.flatMap((r) => r.enrichedTags.filter((t) => !SYSTEM_TAGS.has(t)))
  ).size;

  // This Week commit stats
  const reposWithWeeklyCommits = repos
    .map((r) => ({ name: r.name, count: r.weeklyCommitCount }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const totalWeeklyCommits = reposWithWeeklyCommits.reduce((sum, r) => sum + r.count, 0);

  // Needs Attention
  const archivedParentRepos = repos.filter((r) => r.parentStats?.isArchived);
  const staleRepos = repos.filter((r) => {
    const d = (nowMs - new Date(r.lastUpdated).getTime()) / 86400000;
    return d > 180;
  });

  // Fork sync health
  const forkRepos = repos.filter((r) => r.isFork && r.forkSync);
  const syncUpToDate = forkRepos.filter((r) => r.forkSync?.state === 'up-to-date').length;
  const syncBehindAny = forkRepos.filter((r) => r.forkSync?.state === 'behind').length;
  const syncBehindLt10 = forkRepos.filter((r) => r.forkSync?.state === 'behind' && (r.forkSync.behindBy) < 10).length;
  const syncBehind10to100 = forkRepos.filter((r) => r.forkSync?.state === 'behind' && (r.forkSync.behindBy) >= 10 && (r.forkSync.behindBy) <= 100).length;
  const syncBehindGt100 = forkRepos.filter((r) => r.forkSync?.state === 'behind' && (r.forkSync.behindBy) > 100).length;
  const syncAhead = forkRepos.filter((r) => r.forkSync?.state === 'ahead').length;
  const syncDiverged = forkRepos.filter((r) => r.forkSync?.state === 'diverged').length;
  const syncUnknown = forkRepos.filter((r) => r.forkSync?.state === 'unknown').length;

  const mostOutdated = [...forkRepos]
    .filter((r) => r.forkSync?.state === 'behind')
    .sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0))
    .slice(0, 3);

  // Star & fork analytics
  const reposWithParentData = repos.filter((r) => r.parentStats !== null);
  const allParentStars = reposWithParentData.map((r) => r.parentStats!.stars).sort((a, b) => a - b);
  const totalStars = allParentStars.reduce((s, n) => s + n, 0);
  const avgStars = allParentStars.length > 0 ? Math.round(totalStars / allParentStars.length) : 0;
  const medianStars = allParentStars.length > 0
    ? allParentStars[Math.floor(allParentStars.length / 2)]
    : 0;
  const top10Starred = [...reposWithParentData]
    .sort((a, b) => (b.parentStats?.stars ?? 0) - (a.parentStats?.stars ?? 0))
    .slice(0, 10);
  const dist0to100 = allParentStars.filter((s) => s < 100).length;
  const dist100to1k = allParentStars.filter((s) => s >= 100 && s < 1000).length;
  const dist1kto10k = allParentStars.filter((s) => s >= 1000 && s < 10000).length;
  const dist10kPlus = allParentStars.filter((s) => s >= 10000).length;
  const totalForks = reposWithParentData.reduce((s, r) => s + (r.parentStats?.forks ?? 0), 0);
  const top5Forked = [...reposWithParentData]
    .sort((a, b) => (b.parentStats?.forks ?? 0) - (a.parentStats?.forks ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div>
        <p className="text-base font-bold text-zinc-100">{data.username}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {data.stats.total} repos · {allTagCount} unique tags
        </p>
      </div>

      {/* ── Intelligence Section ── */}
      {trends && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <SectionLabel>⚡ Intelligence</SectionLabel>

          {trends.period.snapshots < 3 ? (
            <p className="text-xs text-zinc-500 italic">
              Trend data builds up over time. Check back in a few days as daily snapshots accumulate.
            </p>
          ) : (
            <>
              {/* Trending */}
              {trends.trending.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-1">📈 Trending</p>
                  <div className="space-y-1">
                    {trends.trending.slice(0, 3).map(s => (
                      <div key={s.name} className="flex items-center justify-between">
                        <span className="text-xs text-zinc-300 truncate">{s.name}</span>
                        <span className="text-xs text-emerald-400 shrink-0 ml-2">+{s.changePercent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Emerging */}
              {trends.emerging.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-1">🆕 Emerging</p>
                  <div className="flex flex-wrap gap-1">
                    {trends.emerging.slice(0, 3).map(s => (
                      <span key={s.name} className="rounded-full bg-blue-900/40 border border-blue-800/50 px-2 py-0.5 text-xs text-blue-300">{s.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* New releases */}
              {trends.newReleases.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-1">🚀 New Releases</p>
                  <div className="space-y-1">
                    {trends.newReleases.slice(0, 3).map(r => (
                      <div key={r.repoName + r.version} className="flex items-center justify-between">
                        <a href={r.releaseUrl} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-zinc-300 hover:text-blue-400 transition-colors truncate">
                          {r.repoName} <span className="text-zinc-500">{r.version}</span>
                        </a>
                        <span className="text-xs text-zinc-600 shrink-0 ml-2">{relativeTime(r.releasedAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Insights */}
              {trends.insights.length > 0 && trends.insights[0] !== 'Trend data builds up over time. Check back in a few days.' && (
                <div className="rounded-lg bg-zinc-800/50 p-2.5">
                  <p className="text-xs text-zinc-400 italic">{trends.insights[0]}</p>
                </div>
              )}
            </>
          )}

          {/* Gap Analysis — always show if gaps exist */}
          {data.gapAnalysis && data.gapAnalysis.gaps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1.5">🕳️ Library Gaps</p>
              <div className="space-y-2">
                {data.gapAnalysis.gaps.slice(0, 3).map(gap => (
                  <div key={gap.category} className="rounded-lg border border-zinc-800 p-2.5">
                    <p className="text-xs font-medium text-zinc-300">{gap.category}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{gap.description}</p>
                    {gap.popularMissingRepos.length > 0 && (
                      <p className="text-xs text-zinc-600 mt-1">
                        Missing: {gap.popularMissingRepos.slice(0, 2).map(r => r.name).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Digest link */}
          <a href="/wiki/digest" className="block text-xs text-blue-400 hover:text-blue-300 transition-colors">
            📋 View daily digest →
          </a>
        </div>
      )}

      {/* ── Rankings & Recommendations ── */}
      <RankingsPanel repos={repos} onRepoClick={onRepoClick} />

      {/* Category breakdown */}
      {data.categories.length > 0 && (
        <div>
          <SectionLabel>Library by Category</SectionLabel>
          <div className="space-y-1.5">
            {data.categories.slice(0, 8).map((cat) => {
              const pct = Math.round((cat.repoCount / data.stats.total) * 100);
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryFilter?.(cat.id)}
                  className="w-full flex items-center gap-2 group hover:opacity-80 transition-opacity text-left"
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span className="flex-1 truncate text-xs text-zinc-300">{cat.name}</span>
                  <span className="text-xs text-zinc-500">{cat.repoCount}</span>
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel>Activity</SectionLabel>
          <span className="text-xs font-semibold text-zinc-300">{actScore}/100</span>
        </div>
        <ActivityBar score={actScore} />
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-emerald-400">{last30} active</span>
          <span className="text-amber-400">{last90} recent</span>
          <span className="text-zinc-500">{older} older</span>
        </div>
      </div>

      {/* Top languages */}
      {topLangs.length > 0 && (
        <div>
          <SectionLabel>Top Languages</SectionLabel>
          <div className="space-y-1.5">
            {topLangs.map(([lang, count]) => (
              <LangBar key={lang} lang={lang} count={count} max={maxLang} />
            ))}
          </div>
        </div>
      )}

      {/* Most active tag */}
      {mostActiveTag && (
        <div>
          <SectionLabel>Most Active Tag</SectionLabel>
          <p className="text-sm text-zinc-200">{mostActiveTag.tag}</p>
          <p className="text-xs text-zinc-500">activity score {mostActiveTag.activityScore}</p>
        </div>
      )}

      {/* Most starred parent */}
      {topStarred && topStarred.parentStats && (
        <div>
          <SectionLabel>Most Starred (via parent)</SectionLabel>
          <button
            onClick={() => onRepoClick(topStarred.name)}
            className="text-sm text-zinc-200 hover:text-blue-400 transition-colors"
          >
            {topStarred.name}
          </button>
          <span className="ml-2 text-xs text-zinc-500">
            ⭐ {formatStars(topStarred.parentStats.stars)}
          </span>
        </div>
      )}

      {/* Recently forked */}
      {recentForks.length > 0 && (
        <div>
          <SectionLabel>Recently Forked</SectionLabel>
          <div className="space-y-0.5">
            {recentForks.map((r) => (
              <RepoRow key={r.id} repo={r} onClick={() => onRepoClick(r.name)} />
            ))}
          </div>
        </div>
      )}

      {/* This Week */}
      {totalWeeklyCommits > 0 && (
        <div>
          <SectionLabel>This Week</SectionLabel>
          <p className="text-xs text-zinc-400 mb-1">
            {totalWeeklyCommits} commit{totalWeeklyCommits !== 1 ? 's' : ''} across {reposWithWeeklyCommits.length} repo{reposWithWeeklyCommits.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-zinc-600 mb-1">Most active:</p>
          <div className="space-y-0.5">
            {reposWithWeeklyCommits.slice(0, 5).map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <button
                  onClick={() => onRepoClick(r.name)}
                  className="flex-1 truncate text-left text-xs text-zinc-300 hover:text-blue-400 transition-colors"
                >
                  {r.name}
                </button>
                <span className="shrink-0 text-xs text-zinc-500">{r.count} commit{r.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Library health */}
      <div>
        <SectionLabel>Library Health</SectionLabel>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <p className="text-zinc-400">{archivedParents}</p>
            <p className="text-zinc-600">archived parents</p>
          </div>
          <div>
            <p className="text-zinc-400">{inactiveRepos}</p>
            <p className="text-zinc-600">inactive 6mo+</p>
          </div>
          <div>
            <p className="text-emerald-400">{richlyTagged}</p>
            <p className="text-zinc-600">richly tagged (8+)</p>
          </div>
          <div>
            <p className="text-amber-400">{poorlyTagged}</p>
            <p className="text-zinc-600">few tags (&lt;3)</p>
          </div>
          {avgParentStars > 0 && (
            <div className="col-span-2">
              <p className="text-zinc-400">⭐ {formatStars(avgParentStars)} avg parent stars</p>
            </div>
          )}
        </div>
      </div>

      {/* Needs Attention */}
      {(archivedParentRepos.length > 0 || staleRepos.length > 0) && (
        <div>
          <SectionLabel>⚠️ Needs Attention</SectionLabel>
          {archivedParentRepos.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-red-400 mb-1">{archivedParentRepos.length} repos with archived parents</p>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {archivedParentRepos.slice(0, 3).map((r) => (
                  <p key={r.name} className="text-xs text-zinc-500">• {r.name}</p>
                ))}
              </div>
              {onViewArchived && (
                <button onClick={onViewArchived} className="mt-1 text-xs text-blue-400 hover:text-blue-300">
                  View all →
                </button>
              )}
            </div>
          )}
          {staleRepos.length > 0 && (
            <div>
              <p className="text-xs text-amber-400 mb-1">{staleRepos.length} repos inactive 6+ months</p>
              {onViewStale && (
                <button onClick={onViewStale} className="mt-1 text-xs text-blue-400 hover:text-blue-300">
                  View all →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fork Sync Health */}
      {forkRepos.length > 0 && (
        <div>
          <SectionLabel>🔄 Fork Sync Health</SectionLabel>
          <div className="space-y-1 text-xs">
            <button
              onClick={() => onSyncFilter?.('up-to-date')}
              className="w-full flex justify-between hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
            >
              <span className="text-emerald-400">✅ Up to date</span>
              <span className="text-zinc-400">{syncUpToDate} repos</span>
            </button>
            {syncBehindAny > 0 && (
              <div>
                <button
                  onClick={() => onSyncFilter?.('behind')}
                  className="w-full flex justify-between hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
                >
                  <span className="text-amber-400">⬇️ Behind</span>
                  <span className="text-zinc-400">{syncBehindAny} repos</span>
                </button>
                <div className="ml-3 space-y-0.5 text-zinc-500 mt-0.5">
                  {syncBehindLt10 > 0 && (
                    <button
                      onClick={() => onSyncFilter?.('behind')}
                      className="w-full flex justify-between hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
                    >
                      <span>· &lt;10 commits</span><span>{syncBehindLt10}</span>
                    </button>
                  )}
                  {syncBehind10to100 > 0 && (
                    <button
                      onClick={() => onSyncFilter?.('behind')}
                      className="w-full flex justify-between hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
                    >
                      <span>· 10–100</span><span>{syncBehind10to100}</span>
                    </button>
                  )}
                  {syncBehindGt100 > 0 && (
                    <button
                      onClick={() => onSyncFilter?.('behind-100')}
                      className="w-full flex justify-between hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
                    >
                      <span>· 100+</span><span className="text-red-400">{syncBehindGt100}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            {syncAhead > 0 && (
              <button
                onClick={() => onSyncFilter?.('ahead')}
                className="w-full flex justify-between hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
              >
                <span className="text-blue-400">⬆️ Ahead</span>
                <span className="text-zinc-400">{syncAhead} repos (you made changes)</span>
              </button>
            )}
            {syncDiverged > 0 && (
              <button
                onClick={() => onSyncFilter?.('diverged')}
                className="w-full flex justify-between hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
              >
                <span className="text-orange-400">↕️ Diverged</span>
                <span className="text-zinc-400">{syncDiverged} repos</span>
              </button>
            )}
            {syncUnknown > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">❓ Unknown</span>
                <span className="text-zinc-500">{syncUnknown} repos</span>
              </div>
            )}
          </div>
          {mostOutdated.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-zinc-600 mb-1">Most outdated forks:</p>
              <div className="space-y-0.5">
                {mostOutdated.map((r) => (
                  <div key={r.id} className="flex justify-between text-xs">
                    <button
                      onClick={() => onRepoClick(r.name)}
                      className="text-zinc-400 hover:text-blue-400 transition-colors truncate"
                    >
                      • {r.name}
                    </button>
                    <span className="shrink-0 text-red-400 ml-2">⬇️ {r.forkSync?.behindBy}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {onViewOutdated && syncBehindAny > 0 && (
            <button
              onClick={onViewOutdated}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Show only outdated repos →
            </button>
          )}
        </div>
      )}

      {/* Star & Fork Stats */}
      {reposWithParentData.length > 0 && (
        <div>
          <SectionLabel>⭐ Star & Fork Stats</SectionLabel>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-zinc-300 font-medium">{formatStars(totalStars)}</p>
                <p className="text-zinc-600">total stars</p>
              </div>
              <div>
                <p className="text-zinc-300 font-medium">{formatStars(avgStars)}</p>
                <p className="text-zinc-600">avg stars</p>
              </div>
              <div>
                <p className="text-zinc-300 font-medium">{formatStars(medianStars)}</p>
                <p className="text-zinc-600">median</p>
              </div>
            </div>
            <div>
              <p className="text-zinc-600 mb-1">Distribution:</p>
              <div className="space-y-0.5 text-zinc-500">
                <div className="flex justify-between"><span>0–100 ⭐</span><span>{dist0to100}</span></div>
                <div className="flex justify-between"><span>100–1k ⭐</span><span>{dist100to1k}</span></div>
                <div className="flex justify-between"><span>1k–10k ⭐</span><span>{dist1kto10k}</span></div>
                <div className="flex justify-between"><span className="text-amber-400">10k+ ⭐</span><span className="text-amber-400">{dist10kPlus}</span></div>
              </div>
            </div>
            <div>
              <p className="text-zinc-600 mb-1">Top starred:</p>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {top10Starred.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onRepoClick(r.name)}
                      className="flex-1 truncate text-left text-zinc-300 hover:text-blue-400 transition-colors"
                    >
                      {r.name}
                    </button>
                    <span className="shrink-0 text-zinc-500">⭐ {formatStars(r.parentStats!.stars)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-1 border-t border-zinc-800">
              <p className="text-zinc-600 mb-1">Total forks (parent): {formatStars(totalForks)}</p>
              <div className="space-y-0.5">
                {top5Forked.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onRepoClick(r.name)}
                      className="flex-1 truncate text-left text-zinc-300 hover:text-blue-400 transition-colors"
                    >
                      {r.name}
                    </button>
                    <span className="shrink-0 text-zinc-500">🍴 {formatStars(r.parentStats!.forks)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STATE 2: Single tag detail ───────────────────────────────────────────────

function SingleTagDetail({ metrics, allRepos, onTagClick, onTagRemove, onRepoClick }: {
  metrics: TagMetrics;
  allRepos: EnrichedRepo[];
  onTagClick: (tag: string) => void;
  onTagRemove: (tag: string) => void;
  onRepoClick: (name: string) => void;
}) {
  const reposForTag = allRepos
    .filter((r) => r.enrichedTags.includes(metrics.tag))
    .sort((a, b) => (b.parentStats?.stars ?? b.stars) - (a.parentStats?.stars ?? a.stars));

  const reposWithParent = reposForTag.filter((r) => r.parentStats !== null);
  const avgParentStars = reposWithParent.length > 0
    ? Math.round(reposWithParent.reduce((s, r) => s + (r.parentStats?.stars ?? 0), 0) / reposWithParent.length)
    : 0;
  const topStarred = reposWithParent[0] ?? null;

  const topLangs = Object.entries(metrics.languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxLang = topLangs[0]?.[1] ?? 1;

  const actColor = metrics.activityScore > 60 ? 'bg-emerald-500' : metrics.activityScore > 30 ? 'bg-amber-500' : 'bg-zinc-500';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-zinc-100">{metrics.tag}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {metrics.repoCount} repos · {metrics.percentage}% of library
          </p>
        </div>
        <button
          onClick={() => onTagRemove(metrics.tag)}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-xs"
          aria-label="Deselect tag"
        >
          ✕
        </button>
      </div>

      {/* Activity */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel>Activity Score</SectionLabel>
          <span className="text-xs font-semibold text-zinc-300">{metrics.activityScore}/100</span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-800">
          <div className={`h-2 rounded-full transition-all ${actColor}`} style={{ width: `${metrics.activityScore}%` }} />
        </div>
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-emerald-400">{metrics.updatedLast30Days} active</span>
          <span className="text-amber-400">{metrics.updatedLast90Days} recent</span>
          <span className="text-zinc-500">{metrics.olderThan90Days} older</span>
        </div>
      </div>

      {/* Languages */}
      {topLangs.length > 0 && (
        <div>
          <SectionLabel>Languages</SectionLabel>
          <div className="space-y-1.5">
            {topLangs.map(([lang, count]) => (
              <LangBar key={lang} lang={lang} count={count} max={maxLang} />
            ))}
          </div>
        </div>
      )}

      {/* Parent star stats */}
      {avgParentStars > 0 && (
        <div>
          <SectionLabel>Parent Repo Stars</SectionLabel>
          <p className="text-xs text-zinc-400">Avg: ⭐ {formatStars(avgParentStars)}</p>
          {topStarred && topStarred.parentStats && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Top:{' '}
              <button
                onClick={() => onRepoClick(topStarred.name)}
                className="text-zinc-300 hover:text-blue-400 transition-colors"
              >
                {topStarred.name}
              </button>{' '}
              ⭐ {formatStars(topStarred.parentStats.stars)}
            </p>
          )}
        </div>
      )}

      {/* Related tags */}
      {metrics.relatedTags.length > 0 && (
        <div>
          <SectionLabel>Often Paired With</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {metrics.relatedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-blue-400 hover:bg-zinc-700 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Repo list sorted by parent stars */}
      <div>
        <SectionLabel>Repos (by parent ⭐)</SectionLabel>
        <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
          {reposForTag.slice(0, 20).map((repo) => (
            <RepoRow key={repo.id} repo={repo} onClick={() => onRepoClick(repo.name)} />
          ))}
          {reposForTag.length > 20 && (
            <p className="text-xs text-zinc-600 pt-1">+{reposForTag.length - 20} more</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STATE 3: Multi-tag intersection ─────────────────────────────────────────

function IntersectionView({ metrics, onTagClick, onTagRemove, onRepoClick }: {
  metrics: IntersectionMetrics;
  onTagClick: (tag: string) => void;
  onTagRemove: (tag: string) => void;
  onRepoClick: (name: string) => void;
}) {
  const sortedRepos = [...metrics.matchingRepos].sort(
    (a, b) => (b.parentStats?.stars ?? b.stars) - (a.parentStats?.stars ?? a.stars)
  );

  const topLangs = Object.entries(metrics.topLanguages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxLang = topLangs[0]?.[1] ?? 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex flex-wrap gap-1.5 mb-1">
          {metrics.selectedTags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-900/50 px-2 py-0.5 text-xs text-blue-300">
              {tag}
              <button
                onClick={() => onTagRemove(tag)}
                className="text-blue-400 hover:text-blue-200 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {metrics.repoCount} repos match all {metrics.selectedTags.length} tags · {metrics.percentage}% of library
        </p>
      </div>

      {/* Activity */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel>Activity Score</SectionLabel>
          <span className="text-xs font-semibold text-zinc-300">{metrics.activityScore}/100</span>
        </div>
        <ActivityBar score={metrics.activityScore} />
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-emerald-400">{metrics.updatedLast30Days} active</span>
          <span className="text-amber-400">{metrics.updatedLast90Days} recent</span>
        </div>
      </div>

      {/* Parent stars */}
      {metrics.avgParentStars > 0 && (
        <div>
          <SectionLabel>Parent Repo Stars</SectionLabel>
          <p className="text-xs text-zinc-400">Avg: ⭐ {formatStars(metrics.avgParentStars)}</p>
          {metrics.mostStarredRepo && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Top:{' '}
              <button
                onClick={() => onRepoClick(metrics.mostStarredRepo!)}
                className="text-zinc-300 hover:text-blue-400 transition-colors"
              >
                {metrics.mostStarredRepo}
              </button>
            </p>
          )}
        </div>
      )}

      {/* Languages */}
      {topLangs.length > 0 && (
        <div>
          <SectionLabel>Languages</SectionLabel>
          <div className="space-y-1.5">
            {topLangs.map(([lang, count]) => (
              <LangBar key={lang} lang={lang} count={count} max={maxLang} />
            ))}
          </div>
        </div>
      )}

      {/* Suggested tags */}
      {metrics.suggestedTags.length > 0 && (
        <div>
          <SectionLabel>You Might Also Want</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {metrics.suggestedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-blue-400 hover:bg-zinc-700 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matching repos */}
      <div>
        <SectionLabel>Matching Repos</SectionLabel>
        {sortedRepos.length === 0 ? (
          <p className="text-xs text-zinc-600">No repos match all selected tags.</p>
        ) : (
          <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
            {sortedRepos.slice(0, 20).map((repo) => (
              <RepoRow key={repo.id} repo={repo} onClick={() => onRepoClick(repo.name)} />
            ))}
            {sortedRepos.length > 20 && (
              <p className="text-xs text-zinc-600 pt-1">+{sortedRepos.length - 20} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STATE 4: Category detail ─────────────────────────────────────────────────

function CategoryDetailView({ categoryId, data, tagMetrics, onTagClick, onRepoClick, onCategoryFilter }: {
  categoryId: string;
  data: LibraryData;
  tagMetrics: TagMetrics[];
  onTagClick: (tag: string) => void;
  onRepoClick: (name: string) => void;
  onCategoryFilter?: (id: string) => void;
}) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return null;

  const { repos } = data;
  const catRepos = repos.filter(r => r.allCategories.includes(cat.name));

  // Tags in this category that appear in any repo
  const tagMetricsMap = new Map(tagMetrics.map(m => [m.tag, m]));
  const catTagsWithCounts = cat.tags
    .map(tag => ({ tag, m: tagMetricsMap.get(tag) }))
    .filter(({ m }) => m && m.repoCount > 0)
    .sort((a, b) => (b.m?.repoCount ?? 0) - (a.m?.repoCount ?? 0));

  // Top repos by parent stars
  const topByStars = [...catRepos]
    .sort((a, b) => (b.parentStats?.stars ?? b.stars) - (a.parentStats?.stars ?? a.stars))
    .slice(0, 5);

  // Most recently updated
  const mostRecent = [...catRepos]
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{cat.icon}</span>
            <h2 className="text-base font-bold text-zinc-100">{cat.name}</h2>
          </div>
          <p className="text-xs text-zinc-500">{cat.description}</p>
          <p className="text-xs text-zinc-400 mt-1">{catRepos.length} repos in this category</p>
        </div>
        <button
          onClick={() => onCategoryFilter?.('')}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors text-xs shrink-0"
          aria-label="Back to overview"
        >
          ← Back
        </button>
      </div>

      {/* Tags in this category */}
      {catTagsWithCounts.length > 0 && (
        <div>
          <SectionLabel>Tags in this Category</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {catTagsWithCounts.map(({ tag, m }) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="flex items-center rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
              >
                {tag}
                <span className="ml-1.5 text-zinc-500">{m?.repoCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top repos by stars */}
      {topByStars.length > 0 && (
        <div>
          <SectionLabel>Top Repos (by parent ⭐)</SectionLabel>
          <div className="space-y-0.5">
            {topByStars.map(repo => (
              <RepoRow key={repo.id} repo={repo} onClick={() => onRepoClick(repo.name)} />
            ))}
          </div>
        </div>
      )}

      {/* Most recently updated */}
      {mostRecent && (
        <div>
          <SectionLabel>Most Recently Updated</SectionLabel>
          <RepoRow repo={mostRecent} onClick={() => onRepoClick(mostRecent.name)} />
        </div>
      )}

      {/* Rankings scoped to this category */}
      <RankingsPanel repos={catRepos} onRepoClick={onRepoClick} />
    </div>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

/** Persistent right sidebar showing library overview, single-tag detail, or intersection metrics */
export function MetricsSidebar({
  data,
  selectedTags,
  tagMetrics,
  intersectionMetrics,
  onTagClick,
  onTagRemove,
  onRepoClick,
  onViewArchived,
  onViewStale,
  onViewOutdated,
  onSyncFilter,
  onCategoryFilter,
  selectedCategory,
  trends,
}: MetricsSidebarProps) {
  const state = selectedTags.length === 0 ? 'overview' : selectedTags.length === 1 ? 'single' : 'multi';
  const singleTagMetrics = state === 'single'
    ? tagMetrics.find((m) => m.tag === selectedTags[0]) ?? null
    : null;

  // Show category detail when a category is selected and no tags are active
  const showCategoryDetail = state === 'overview' && !!selectedCategory;

  return (
    <div className="h-full overflow-y-auto p-5">
      {showCategoryDetail && (
        <CategoryDetailView
          categoryId={selectedCategory!}
          data={data}
          tagMetrics={tagMetrics}
          onTagClick={onTagClick}
          onRepoClick={onRepoClick}
          onCategoryFilter={onCategoryFilter}
        />
      )}
      {!showCategoryDetail && state === 'overview' && (
        <LibraryOverview
          data={data}
          tagMetrics={tagMetrics}
          onRepoClick={onRepoClick}
          onViewArchived={onViewArchived}
          onViewStale={onViewStale}
          onViewOutdated={onViewOutdated}
          onSyncFilter={onSyncFilter}
          onCategoryFilter={onCategoryFilter}
          trends={trends}
        />
      )}
      {state === 'single' && singleTagMetrics && (
        <SingleTagDetail
          metrics={singleTagMetrics}
          allRepos={data.repos}
          onTagClick={onTagClick}
          onTagRemove={onTagRemove}
          onRepoClick={onRepoClick}
        />
      )}
      {state === 'multi' && intersectionMetrics && (
        <IntersectionView
          metrics={intersectionMetrics}
          onTagClick={onTagClick}
          onTagRemove={onTagRemove}
          onRepoClick={onRepoClick}
        />
      )}
      {/* Activity feed — shown in all states */}
      <ActivityFeed repos={data.repos} onRepoClick={onRepoClick} />
    </div>
  );
}
