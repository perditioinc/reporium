import { LibraryData, TrendSignal } from '@/types/repo';

const SYSTEM_TAGS = new Set(['Forked', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

/**
 * Compute total commit activity for a given tag across repos in a snapshot.
 * Uses commitStats.last7Days if available, falls back to commitsLast7Days length or weeklyCommitCount.
 */
export function tagActivity(snapshot: LibraryData, tag: string): { count: number; repos: string[] } {
  const matching = snapshot.repos.filter(r => r.enrichedTags.includes(tag));
  const repos: string[] = [];
  let count = 0;
  for (const repo of matching) {
    const c = repo.commitStats?.last7Days ?? repo.commitsLast7Days?.length ?? repo.weeklyCommitCount ?? 0;
    if (c > 0) { count += c; repos.push(repo.name); }
  }
  return { count, repos: repos.slice(0, 3) };
}

/**
 * Compute trend signals by comparing current and previous library snapshots.
 * Returns categorized signals: trending, emerging, cooling, stable.
 */
export function computeTrendSignals(
  currentSnapshot: LibraryData,
  previousSnapshot: LibraryData
): { trending: TrendSignal[]; emerging: TrendSignal[]; cooling: TrendSignal[]; stable: TrendSignal[] } {
  // Get all unique tags across both snapshots
  const allTags = new Set<string>([
    ...currentSnapshot.repos.flatMap(r => r.enrichedTags),
    ...previousSnapshot.repos.flatMap(r => r.enrichedTags),
  ]);

  const trending: TrendSignal[] = [];
  const emerging: TrendSignal[] = [];
  const cooling: TrendSignal[] = [];
  const stable: TrendSignal[] = [];

  for (const tag of allTags) {
    if (SYSTEM_TAGS.has(tag)) continue;
    const current = tagActivity(currentSnapshot, tag);
    const previous = tagActivity(previousSnapshot, tag);
    const changePercent = ((current.count - previous.count) / Math.max(previous.count, 1)) * 100;
    const repoCount = currentSnapshot.repos.filter(r => r.enrichedTags.includes(tag)).length;

    const signal: TrendSignal = {
      name: tag,
      type: 'tag',
      currentActivity: current.count,
      previousActivity: previous.count,
      changePercent: Math.round(changePercent),
      repoCount,
      representativeRepos: current.repos,
    };

    if (changePercent > 50 && current.count > 5) trending.push(signal);
    else if (previous.count < 2 && current.count > 5) emerging.push(signal);
    else if (changePercent < -30 && previous.count > 5) cooling.push(signal);
    else if (Math.abs(changePercent) < 20 && current.count > 3) stable.push(signal);
  }

  // Sort by impact
  trending.sort((a, b) => b.changePercent - a.changePercent);
  emerging.sort((a, b) => b.currentActivity - a.currentActivity);
  cooling.sort((a, b) => a.changePercent - b.changePercent);

  return { trending, emerging, cooling, stable };
}
