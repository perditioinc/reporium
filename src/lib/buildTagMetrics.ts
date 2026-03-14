import { EnrichedRepo, IntersectionMetrics, TagMetrics } from '@/types/repo';

/** Tags that represent repo metadata, not content categories — excluded from relatedTags */
const SYSTEM_TAGS = new Set(['Forked', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

/**
 * Compute tag-level analytics across all repos in the library.
 * For each unique tag, calculates repo count, language breakdown, activity scores,
 * co-occurring related tags, and a sorted repo list.
 *
 * @param repos - All enriched repos in the library
 * @returns Array of TagMetrics sorted by repoCount descending
 */
export function buildTagMetrics(repos: EnrichedRepo[]): TagMetrics[] {
  const total = repos.length;
  if (total === 0) return [];

  const now = Date.now();

  // Group repos by tag
  const tagRepoMap = new Map<string, EnrichedRepo[]>();
  for (const repo of repos) {
    for (const tag of repo.enrichedTags) {
      if (!tagRepoMap.has(tag)) tagRepoMap.set(tag, []);
      tagRepoMap.get(tag)!.push(repo);
    }
  }

  const metrics: TagMetrics[] = [];

  for (const [tag, tagRepos] of tagRepoMap) {
    // Sort repos by most recently updated
    const sorted = [...tagRepos].sort(
      (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    // Activity buckets
    let updatedLast30Days = 0;
    let updatedLast90Days = 0;
    let olderThan90Days = 0;
    let activityPoints = 0;

    for (const repo of tagRepos) {
      const ageDays = (now - new Date(repo.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 30) {
        updatedLast30Days++;
        activityPoints += 3;
      } else if (ageDays < 90) {
        updatedLast90Days++;
        activityPoints += 1;
      } else {
        olderThan90Days++;
      }
    }

    // Normalize activity score to 0-100
    const maxPoints = tagRepos.length * 3;
    const activityScore = maxPoints > 0 ? Math.round((activityPoints / maxPoints) * 100) : 0;

    // Language breakdown
    const languageBreakdown: Record<string, number> = {};
    for (const repo of tagRepos) {
      if (repo.language) {
        languageBreakdown[repo.language] = (languageBreakdown[repo.language] ?? 0) + 1;
      }
    }
    const topLanguage =
      Object.entries(languageBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Related tags: count co-occurring tags (excluding system tags and self)
    const coTagCounts = new Map<string, number>();
    for (const repo of tagRepos) {
      for (const otherTag of repo.enrichedTags) {
        if (otherTag !== tag && !SYSTEM_TAGS.has(otherTag)) {
          coTagCounts.set(otherTag, (coTagCounts.get(otherTag) ?? 0) + 1);
        }
      }
    }
    const relatedTags = [...coTagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    const mostRecent = sorted[0];

    // Date intelligence
    const nowMs = now; // already defined at top of function
    const monthMs = 30 * 24 * 60 * 60 * 1000;

    // avgUpstreamAge: avg age of upstream repos in months
    const reposWithUpstreamCreated = tagRepos.filter((r) => r.upstreamCreatedAt);
    const avgUpstreamAge = reposWithUpstreamCreated.length > 0
      ? Math.round(
          reposWithUpstreamCreated.reduce((sum, r) => {
            const ageMs = nowMs - new Date(r.upstreamCreatedAt!).getTime();
            return sum + ageMs / monthMs;
          }, 0) / reposWithUpstreamCreated.length
        )
      : 0;

    // avgTimeSinceForked: avg months since user forked
    const reposWithForkedAt = tagRepos.filter((r) => r.forkedAt);
    const avgTimeSinceForked = reposWithForkedAt.length > 0
      ? Math.round(
          reposWithForkedAt.reduce((sum, r) => {
            const ageMs = nowMs - new Date(r.forkedAt!).getTime();
            return sum + ageMs / monthMs;
          }, 0) / reposWithForkedAt.length
        )
      : 0;

    // mostOutdatedRepo: repo with highest behindBy
    const reposWithSync = tagRepos.filter((r) => r.forkSync && r.forkSync.behindBy > 0);
    const mostOutdatedRepo = reposWithSync.length > 0
      ? reposWithSync.reduce((worst, r) =>
          (r.forkSync?.behindBy ?? 0) > (worst.forkSync?.behindBy ?? 0) ? r : worst
        ).name
      : '';

    // avgBehindBy: avg commits behind for repos with sync data
    const avgBehindBy = reposWithSync.length > 0
      ? Math.round(
          reposWithSync.reduce((sum, r) => sum + (r.forkSync?.behindBy ?? 0), 0) / reposWithSync.length
        )
      : 0;

    metrics.push({
      tag,
      repoCount: tagRepos.length,
      percentage: Math.round((tagRepos.length / total) * 100),
      topLanguage,
      languageBreakdown,
      updatedLast30Days,
      updatedLast90Days,
      olderThan90Days,
      activityScore,
      relatedTags,
      mostRecentRepo: mostRecent?.name ?? '',
      mostRecentDate: mostRecent?.lastUpdated ?? '',
      repos: sorted.map((r) => r.name),
      avgUpstreamAge,
      avgTimeSinceForked,
      mostOutdatedRepo,
      avgBehindBy,
    });
  }

  return metrics.sort((a, b) => b.repoCount - a.repoCount);
}

/**
 * Compute intersection analytics for the set of repos that have ALL of the selected tags.
 * Calculated client-side on every tag selection change — no API call needed.
 *
 * @param selectedTags - Tags that must ALL be present in a repo
 * @param allRepos - Full library repo list
 * @returns IntersectionMetrics for the matching subset
 */
export function buildIntersectionMetrics(
  selectedTags: string[],
  allRepos: EnrichedRepo[]
): IntersectionMetrics {
  const total = allRepos.length;

  // Repos matching ALL selected tags
  const matchingRepos =
    selectedTags.length === 0
      ? allRepos
      : allRepos.filter((r) => selectedTags.every((t) => r.enrichedTags.includes(t)));

  const now = Date.now();
  let updatedLast30Days = 0;
  let updatedLast90Days = 0;
  let activityPoints = 0;

  const topLanguages: Record<string, number> = {};

  for (const repo of matchingRepos) {
    const ageDays = (now - new Date(repo.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) {
      updatedLast30Days++;
      activityPoints += 3;
    } else if (ageDays < 90) {
      updatedLast90Days++;
      activityPoints += 1;
    }
    if (repo.language) {
      topLanguages[repo.language] = (topLanguages[repo.language] ?? 0) + 1;
    }
  }

  const maxPoints = matchingRepos.length * 3;
  const activityScore = maxPoints > 0 ? Math.round((activityPoints / maxPoints) * 100) : 0;

  // Suggested tags: tags co-occurring in matching repos, not in selectedTags, not system tags
  const coTagCounts = new Map<string, number>();
  for (const repo of matchingRepos) {
    for (const tag of repo.enrichedTags) {
      if (!SYSTEM_TAGS.has(tag) && !selectedTags.includes(tag)) {
        coTagCounts.set(tag, (coTagCounts.get(tag) ?? 0) + 1);
      }
    }
  }
  const suggestedTags = [...coTagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Parent star stats (forks only)
  const reposWithParentStars = matchingRepos.filter((r) => r.parentStats !== null);
  const avgParentStars =
    reposWithParentStars.length > 0
      ? Math.round(
          reposWithParentStars.reduce((sum, r) => sum + (r.parentStats?.stars ?? 0), 0) /
            reposWithParentStars.length
        )
      : 0;

  const mostStarredRepo =
    reposWithParentStars.length > 0
      ? reposWithParentStars.reduce((best, r) =>
          (r.parentStats?.stars ?? 0) > (best.parentStats?.stars ?? 0) ? r : best
        ).name
      : null;

  return {
    selectedTags,
    matchingRepos,
    repoCount: matchingRepos.length,
    percentage: total > 0 ? Math.round((matchingRepos.length / total) * 100) : 0,
    activityScore,
    updatedLast30Days,
    updatedLast90Days,
    topLanguages,
    suggestedTags,
    avgParentStars,
    mostStarredRepo,
  };
}
