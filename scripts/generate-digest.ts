#!/usr/bin/env npx tsx
/**
 * generate-digest.ts
 *
 * Generates DIGEST.md — a daily intelligence briefing about your library.
 * Auto-committed to the repo root by GitHub Actions daily.
 * Visible on the GitHub repo page.
 *
 * Run: npx tsx scripts/generate-digest.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { LibraryData, TrendData } from '../src/types/repo';

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}

function relativeTime(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  return `${Math.floor(days / 7)} weeks ago`;
}

/**
 * Generate DIGEST.md from library.json and optionally trends.json.
 */
async function generateDigest(): Promise<void> {
  const libraryPath = path.join(process.cwd(), 'public', 'data', 'library.json');
  const trendsPath = path.join(process.cwd(), 'public', 'data', 'trends.json');

  if (!fs.existsSync(libraryPath)) {
    console.error('❌ library.json not found. Run: npm run generate');
    process.exit(1);
  }

  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8')) as LibraryData;
  const trends: TrendData | null = fs.existsSync(trendsPath)
    ? JSON.parse(fs.readFileSync(trendsPath, 'utf-8')) as TrendData
    : null;

  const now = new Date(library.generatedAt);
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Today's activity
  const activeToday = library.repos.filter(r => (r.commitStats?.today ?? 0) > 0);
  const totalTodayCommits = activeToday.reduce((s, r) => s + (r.commitStats?.today ?? 0), 0);
  const topToday = [...activeToday].sort((a, b) => (b.commitStats?.today ?? 0) - (a.commitStats?.today ?? 0)).slice(0, 6);

  // Fork sync health
  const forkRepos = library.repos.filter(r => r.isFork && r.forkSync);
  const upToDate = forkRepos.filter(r => r.forkSync?.state === 'up-to-date').length;
  const behind = forkRepos.filter(r => r.forkSync?.state === 'behind').length;
  const mostOutdated = [...forkRepos]
    .filter(r => r.forkSync?.state === 'behind')
    .sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0))[0];

  // All unique tags
  const allTags = new Set(library.repos.flatMap(r => r.enrichedTags));

  const lines: string[] = [];

  // Header
  lines.push(`# Reporium Daily Digest`);
  lines.push(`**${library.username}'s GitHub Knowledge Library** · Generated ${dateStr}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Today's activity
  if (topToday.length > 0) {
    lines.push('## Today\'s Activity');
    lines.push(`**${totalTodayCommits} commits** across **${activeToday.length} repos** in your library`);
    lines.push('');
    lines.push('| Repo | Commits | Category |');
    lines.push('|------|---------|----------|');
    for (const repo of topToday) {
      const commits = repo.commitStats?.today ?? 0;
      const cat = repo.primaryCategory || '—';
      lines.push(`| ${repo.name} | ${commits} | ${cat} |`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Trending this week
  if (trends && trends.trending.length > 0) {
    lines.push('## Trending This Week');
    lines.push('These areas in your library are seeing accelerating activity:');
    lines.push('');
    for (const signal of trends.trending.slice(0, 3)) {
      const pct = signal.changePercent > 0 ? `+${signal.changePercent}%` : `${signal.changePercent}%`;
      lines.push(`**${signal.name}** (${pct} vs last week)`);
      if (signal.representativeRepos.length > 0) {
        lines.push(`${signal.representativeRepos.join(', ')} are most active.`);
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // New releases
  if (trends && trends.newReleases.length > 0) {
    lines.push('## New Releases');
    lines.push('Notable releases from repos in your library this week:');
    lines.push('');
    for (const release of trends.newReleases.slice(0, 5)) {
      const stars = formatStars(release.parentStars);
      const age = relativeTime(release.releasedAt);
      lines.push(`- **${release.repoName} ${release.version}** — ${age} · ⭐ ${stars} · [Release notes →](${release.releaseUrl})`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Gap analysis
  if (library.gapAnalysis && library.gapAnalysis.gaps.length > 0) {
    lines.push('## Gaps in Your Library');
    lines.push('Based on your collection, you might want to explore:');
    lines.push('');
    for (const gap of library.gapAnalysis.gaps.slice(0, 3)) {
      lines.push(`**${gap.category}** — ${gap.description}`);
      if (gap.popularMissingRepos.length > 0) {
        const suggested = gap.popularMissingRepos.slice(0, 3).map(r =>
          `[${r.name}](${r.url}) ⭐ ${formatStars(r.stars)}`
        ).join(', ');
        lines.push(`Suggested: ${suggested}`);
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // Library health
  lines.push('## Library Health');
  lines.push(`- **${library.stats.total} repos** · **${library.categories.length} categories** · **${allTags.size} unique tags**`);
  if (forkRepos.length > 0) {
    lines.push(`- **${upToDate} forks** up to date · **${behind} forks** behind upstream`);
    if (mostOutdated) {
      lines.push(`- Most outdated: \`${mostOutdated.name}\` (behind ${mostOutdated.forkSync?.behindBy} commits)`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 30-day summary
  lines.push('## 30-Day Summary');
  const catActivity = library.categories.map(cat => {
    const catRepos = library.repos.filter(r => r.allCategories?.includes(cat.name));
    const commits = catRepos.reduce((s, r) => s + (r.commitStats?.last30Days ?? 0), 0);
    return { name: cat.name, icon: cat.icon, commits, count: cat.repoCount };
  }).filter(c => c.commits > 0).sort((a, b) => b.commits - a.commits);

  if (catActivity.length > 0) {
    lines.push(`- **${catActivity[0].icon} ${catActivity[0].name}** most active category (${catActivity[0].commits} commits across ${catActivity[0].count} repos)`);
  }
  if (trends && trends.trending.length > 0) {
    lines.push(`- **${trends.trending[0].name}** fastest growing (+${trends.trending[0].changePercent}% commit velocity)`);
  }
  if (trends && trends.cooling.length > 0) {
    lines.push(`- **${trends.cooling[0].name}** cooling (${trends.cooling[0].changePercent}% change in activity)`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Footer
  lines.push(`*Generated by [Reporium](https://github.com/${library.username}/reporium) · Fork it to get your own daily digest*`);

  const content = lines.join('\n');
  const digestPath = path.join(process.cwd(), 'DIGEST.md');
  fs.writeFileSync(digestPath, content);

  const wordCount = content.split(/\s+/).length;
  console.log(`✅ DIGEST.md generated (${wordCount} words)`);
  console.log(`📁 Output: ${digestPath}`);
}

generateDigest().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
