#!/usr/bin/env npx tsx
/**
 * detect-trends.ts
 *
 * Reads git history of library.json to detect trending, emerging,
 * and cooling signals across tags and categories.
 * Writes results to public/data/trends.json
 *
 * Run: npx tsx scripts/detect-trends.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LibraryData, TrendData, TrendSignal, ReleaseSignal } from '../src/types/repo';
import { computeTrendSignals } from '../src/lib/detectTrends';

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'data', 'trends.json');
const LIBRARY_REL_PATH = 'public/data/library.json';

/**
 * Get git commit hashes for library.json changes, newest first.
 * Returns array of { hash, date } objects.
 */
function getLibraryGitHistory(): { hash: string; date: string }[] {
  try {
    const output = execSync(
      `git log --pretty=format:"%H %ai" -- ${LIBRARY_REL_PATH}`,
      { encoding: 'utf-8', cwd: process.cwd() }
    ).trim();
    if (!output) return [];
    return output.split('\n').map(line => {
      const parts = line.trim().split(' ');
      return { hash: parts[0], date: parts.slice(1).join(' ').trim() };
    });
  } catch {
    return [];
  }
}

/**
 * Read a specific version of library.json from git history.
 * Returns null if the file cannot be read from that commit.
 */
function readLibraryAtCommit(hash: string): LibraryData | null {
  try {
    const content = execSync(
      `git show ${hash}:${LIBRARY_REL_PATH}`,
      { encoding: 'utf-8', cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024 }
    );
    return JSON.parse(content) as LibraryData;
  } catch {
    return null;
  }
}

/**
 * Generate plain-English insight sentences from trend signals.
 */
function generateInsights(
  trending: TrendSignal[],
  emerging: TrendSignal[],
  cooling: TrendSignal[],
  newReleases: ReleaseSignal[]
): string[] {
  const insights: string[] = [];
  if (trending.length > 0) {
    const top = trending[0];
    insights.push(`${top.name} is the fastest-growing area this week with +${Math.round(top.changePercent)}% commit velocity.`);
  }
  if (emerging.length > 0) {
    insights.push(`${emerging.map(e => e.name).slice(0, 3).join(', ')} ${emerging.length === 1 ? 'is' : 'are'} newly active in your library.`);
  }
  if (cooling.length > 0) {
    insights.push(`Activity in ${cooling[0].name} has slowed by ${Math.abs(Math.round(cooling[0].changePercent))}% this week.`);
  }
  if (newReleases.length > 0) {
    const major = newReleases.filter(r => r.isMajor);
    if (major.length > 0) {
      insights.push(`Major release: ${major[0].repoName} ${major[0].version} was just released.`);
    } else {
      insights.push(`${newReleases[0].repoName} ${newReleases[0].version} was released this week.`);
    }
  }
  if (insights.length === 0) {
    insights.push('Trend data is building up. Check back after a few daily refreshes.');
  }
  return insights;
}

async function detectTrends(): Promise<void> {
  console.log('🔍 Reading git history of library.json...');
  const history = getLibraryGitHistory();
  console.log(`   ↳ Found ${history.length} snapshots`);

  if (history.length < 3) {
    const empty: TrendData = {
      generatedAt: new Date().toISOString(),
      period: { from: new Date().toISOString(), to: new Date().toISOString(), snapshots: history.length },
      trending: [], emerging: [], cooling: [], stable: [],
      newReleases: [],
      insights: ['Trend data builds up over time. Check back in a few days.'],
    };
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(empty, null, 2));
    console.log('⚠️  Fewer than 3 snapshots — skipping trend detection');
    return;
  }

  // Load current snapshot and one from ~7 days ago
  const recent = history.slice(0, 7);
  const older = history.slice(7, 14);

  console.log('📖 Loading snapshots...');
  const currentSnapshot = readLibraryAtCommit(recent[0].hash);
  // Try to find a snapshot from ~7 days ago
  const previousSnapshot = older.length > 0 ? readLibraryAtCommit(older[0].hash) : readLibraryAtCommit(recent[recent.length - 1].hash);

  if (!currentSnapshot || !previousSnapshot) {
    console.log('⚠️  Could not read snapshots from git history');
    return;
  }

  console.log('📊 Computing trend signals...');

  const { trending, emerging, cooling, stable } = computeTrendSignals(currentSnapshot, previousSnapshot);

  // Detect new releases from the last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newReleases: ReleaseSignal[] = [];

  for (const repo of currentSnapshot.repos) {
    const release = repo.latestRelease;
    if (!release) continue;
    const releaseMs = new Date(release.releasedAt).getTime();
    if (releaseMs < sevenDaysAgo) continue;
    const stars = repo.parentStats?.stars ?? repo.stars;
    // Filter: major always, minor if 1k+ stars, patch if 10k+ stars
    const notable = release.isMajor || (release.isMinor && stars >= 1000) || (!release.isMajor && !release.isMinor && stars >= 10000);
    if (!notable) continue;
    newReleases.push({
      repoName: repo.name,
      version: release.version,
      releasedAt: release.releasedAt,
      parentOwner: repo.forkedFrom?.split('/')[0] ?? '',
      releaseUrl: release.url,
      isMajor: release.isMajor,
      isMinor: release.isMinor,
      parentStars: stars,
    });
  }
  newReleases.sort((a, b) => b.parentStars - a.parentStars);

  const insights = generateInsights(trending, emerging, cooling, newReleases);

  const trendData: TrendData = {
    generatedAt: new Date().toISOString(),
    period: {
      from: history[history.length - 1]?.date ?? new Date().toISOString(),
      to: history[0]?.date ?? new Date().toISOString(),
      snapshots: history.length,
    },
    trending: trending.slice(0, 10),
    emerging: emerging.slice(0, 5),
    cooling: cooling.slice(0, 5),
    stable: stable.slice(0, 10),
    newReleases: newReleases.slice(0, 10),
    insights,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(trendData, null, 2));

  console.log(`\n✅ Trends detected`);
  console.log(`📈 Trending: ${trendData.trending.length} signals`);
  console.log(`🆕 Emerging: ${trendData.emerging.length} signals`);
  console.log(`📉 Cooling: ${trendData.cooling.length} signals`);
  console.log(`🚀 New releases: ${trendData.newReleases.length}`);
  console.log(`💡 Insights: ${trendData.insights.join(' | ')}`);
}

detectTrends().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
