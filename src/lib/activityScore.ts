import { EnrichedRepo } from '@/types/repo';

/**
 * Compute a 0-100 activity score for a single repo based on:
 * - Recency of last update (base score)
 * - Recency of most recent commit (bonus)
 * - Parent repo star count (bonus — popular = likely well maintained)
 * - Archived parent penalty
 */
export function calculateActivityScore(repo: EnrichedRepo): number {
  const now = Date.now();

  // Base score from last updated date
  const daysSinceUpdate = (now - new Date(repo.lastUpdated).getTime()) / 86400000;
  let score = 0;
  if (daysSinceUpdate < 7) score = 50;
  else if (daysSinceUpdate < 30) score = 40;
  else if (daysSinceUpdate < 90) score = 25;
  else if (daysSinceUpdate < 365) score = 10;

  // Bonus from most recent commit
  if (repo.recentCommits.length > 0) {
    const daysSinceCommit = (now - new Date(repo.recentCommits[0].date).getTime()) / 86400000;
    if (daysSinceCommit < 7) score += 30;
    else if (daysSinceCommit < 30) score += 15;
    else if (daysSinceCommit < 90) score += 5;
  }

  // Bonus from parent stars
  if (repo.parentStats) {
    if (repo.parentStats.stars > 10000) score += 20;
    else if (repo.parentStats.stars > 1000) score += 10;
    else if (repo.parentStats.stars > 100) score += 5;
  }

  // Penalty for archived parent
  if (repo.parentStats?.isArchived) score -= 50;

  return Math.max(0, Math.min(100, score));
}
