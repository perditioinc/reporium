import { LibraryData, TrendSignal } from '@/types/repo';

const SYSTEM_TAGS = new Set(['Forked', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

// Minimum previous-week activity for a tag to qualify as "trending" rather than
// "emerging". Below this, a growth percentage off the near-zero base is noise
// (e.g. 1→20 reads as +1900%), so the tag is treated as newly emerging instead.
const TREND_BASELINE = 5;

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

  // Guard against frozen commit-stat input: when the current snapshot has no
  // commit activity at all (upstream collection stalled), every previously
  // active tag would otherwise register as a false "-100% cooling" signal.
  // Treat this as "no data to report" rather than fabricating a cooldown.
  const currentTotalActivity = [...allTags].reduce(
    (sum, tag) => (SYSTEM_TAGS.has(tag) ? sum : sum + tagActivity(currentSnapshot, tag).count),
    0
  );
  if (currentTotalActivity === 0) {
    return { trending, emerging, cooling, stable };
  }

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
      // Clamp the DISPLAYED percent to a sane band. Growth off a tiny base
      // produces nonsense numbers (a 0→20 jump is "+2000%"); even with the
      // baseline gate below, clamp so the UI never shows "+22800%".
      changePercent: Math.max(-100, Math.min(Math.round(changePercent), 999)),
      repoCount,
      representativeRepos: current.repos,
    };

    // A tag can only "trend" if it had a real previous baseline — otherwise the
    // growth percent is meaningless (a tag going 0→20 isn't trending +2000%,
    // it's newly active). This matters most right after a commit-stat thaw,
    // when the prior ~7 days of snapshots are still all-zero: every active tag
    // would otherwise explode into the trending bucket with absurd percentages.
    // Low-baseline tags are routed to "emerging" instead. (checked FIRST.)
    if (previous.count < TREND_BASELINE && current.count > 5) emerging.push(signal);
    else if (changePercent > 50 && current.count > 5) trending.push(signal);
    else if (changePercent < -30 && previous.count > 5) cooling.push(signal);
    else if (Math.abs(changePercent) < 20 && current.count > 3) stable.push(signal);
  }

  // Sort by impact
  trending.sort((a, b) => b.changePercent - a.changePercent);
  emerging.sort((a, b) => b.currentActivity - a.currentActivity);
  cooling.sort((a, b) => a.changePercent - b.changePercent);

  return { trending, emerging, cooling, stable };
}
