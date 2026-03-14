#!/usr/bin/env npx tsx
/**
 * generate-library.ts
 *
 * Build-time data pipeline for Reporium.
 * Fetches all GitHub data, enriches repos, and writes public/data/library.json.
 *
 * Run: npx tsx scripts/generate-library.ts
 * Or via npm: npm run generate
 *
 * Required env vars:
 *   GH_USERNAME - whose repos to fetch (default: perditioinc)
 *   GH_TOKEN    - GitHub PAT for 5000 req/hour rate limit
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local if it exists (for local development)
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  // Parse .env.local manually (no dotenv dependency required)
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

import {
  fetchAllRepos,
  fetchAllForkInfo,
  mapGitHubRepo,
  fetchReadme,
  fetchCommitsSince,
  fetchForkSyncStatus,
  fetchLanguageBreakdown,
  fetchLatestRelease,
  ForkInfo,
} from '../src/lib/github';
import { enrichRepo } from '../src/lib/enrichRepo';
import { buildTagMetrics } from '../src/lib/buildTagMetrics';
import { buildCategories } from '../src/lib/buildCategories';
import { buildGapAnalysis } from '../src/lib/buildGapAnalysis';
import { buildBuilder, assignDimension, buildBuilderStats, buildSkillStats, AI_DEV_SKILLS, PM_SKILLS, INDUSTRIES } from '../src/lib/buildTaxonomy';
import { batchFetch } from '../src/lib/rateLimit';
import { LibraryData, LibraryStats, EnrichedRepo } from '../src/types/repo';

const username = process.env.GH_USERNAME || 'perditioinc';
const token = process.env.GH_TOKEN || undefined;

/** Calculate percentage breakdown from bytes map */
function computePercentages(breakdown: Record<string, number>): Record<string, number> {
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  if (total === 0) return {};
  const result: Record<string, number> = {};
  for (const [lang, bytes] of Object.entries(breakdown)) {
    result[lang] = Math.round((bytes / total) * 100);
  }
  return result;
}

async function generateLibrary(): Promise<void> {
  const startTime = Date.now();
  console.log(`🔍 Fetching repos for ${username}...`);

  // ── Step 1: Fetch all public repos ──────────────────────────────────────────
  const rawRepos = await fetchAllRepos(username, token);
  console.log(`📦 Found ${rawRepos.length} repos`);

  // ── Step 2: Fetch fork info (language, parent stats, dates) ────────────────
  console.log('🔗 Fetching fork info...');
  const allForkFullNames = rawRepos.filter((r) => r.fork).map((r) => r.full_name);
  const forkInfoMap = allForkFullNames.length > 0
    ? await fetchAllForkInfo(allForkFullNames, token, 8)
    : new Map<string, ForkInfo>();
  console.log(`   ↳ ${allForkFullNames.length} forks enriched`);

  // ── Step 3: Fetch READMEs ────────────────────────────────────────────────────
  console.log('📖 Fetching READMEs...');
  const readmeTargets = rawRepos.map((raw) => {
    if (raw.fork) {
      const parentFullName = forkInfoMap.get(raw.full_name)?.parentFullName ?? null;
      if (parentFullName) {
        const [parentOwner, parentRepo] = parentFullName.split('/');
        return { owner: parentOwner, repo: parentRepo };
      }
    }
    return { owner: username, repo: raw.name };
  });
  const readmes = await batchFetch(readmeTargets, ({ owner, repo }) => fetchReadme(owner, repo), 8, 100);
  const readmeFetched = readmes.filter((r) => r !== null).length;
  console.log(`   ↳ ${readmeFetched}/${rawRepos.length} READMEs fetched`);

  // ── Step 4: Build initial enriched repos ────────────────────────────────────
  let repos: EnrichedRepo[] = rawRepos.map((raw, i) => {
    const readmeText = readmes[i] ?? null;
    const enriched = enrichRepo(mapGitHubRepo(raw, forkInfoMap), readmeText);
    const forkInfo = raw.fork ? (forkInfoMap.get(raw.full_name) ?? null) : null;
    return { ...enriched, parentStats: forkInfo?.parentStats ?? null };
  });

  // ── Step 5: Fetch language breakdowns ───────────────────────────────────────
  console.log('💻 Fetching language breakdowns...');
  const langTargets = repos.map((repo) => {
    if (repo.isFork && repo.forkedFrom) {
      const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
      return { owner: parentOwner, repo: parentRepo };
    }
    return { owner: username, repo: repo.name };
  });
  const langResults = await batchFetch(
    langTargets,
    ({ owner, repo }) => fetchLanguageBreakdown(owner, repo, token),
    8, 100
  );
  repos = repos.map((repo, i) => {
    const breakdown = langResults[i] ?? {};
    return { ...repo, languageBreakdown: breakdown, languagePercentages: computePercentages(breakdown) };
  });
  console.log(`   ↳ Language breakdowns fetched`);

  // ── Step 6: Fetch fork sync status ──────────────────────────────────────────
  console.log('🔄 Fetching fork sync status...');
  const syncTargets = repos
    .filter((repo) => repo.isFork && repo.forkedFrom)
    .map((repo) => {
      const forkInfo = forkInfoMap.get(repo.fullName);
      const upstreamOwner = repo.forkedFrom!.split('/')[0];
      const upstreamBranch = forkInfo?.upstreamDefaultBranch ?? 'main';
      return { repo, upstreamOwner, upstreamBranch };
    });

  const syncResults = await batchFetch(
    syncTargets,
    ({ repo, upstreamOwner, upstreamBranch }) =>
      fetchForkSyncStatus(username, repo.name, upstreamOwner, upstreamBranch, token),
    5, 100
  );

  const syncMap = new Map<string, typeof syncResults[0]>();
  syncTargets.forEach((t, i) => syncMap.set(t.repo.fullName, syncResults[i]));
  repos = repos.map((repo) => ({
    ...repo,
    forkSync: repo.isFork ? (syncMap.get(repo.fullName) ?? null) : null,
  }));
  console.log(`   ↳ Sync status fetched for ${syncTargets.length} forks`);

  // ── Step 7: Fetch commit history (7d, 30d, 90d) ─────────────────────────────
  console.log('📝 Fetching commit history...');
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const commitTargets = repos.map((repo) => {
    if (repo.isFork && repo.forkedFrom) {
      const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
      return { owner: parentOwner, repo: parentRepo };
    }
    return { owner: username, repo: repo.name };
  });

  // Fetch 90-day commits (superset — filter for shorter windows)
  const commits90 = await batchFetch(
    commitTargets,
    ({ owner, repo }) => fetchCommitsSince(owner, repo, d90, token, 100),
    5, 100
  );

  repos = repos.map((repo, i) => {
    const all90 = commits90[i] ?? [];
    const all30 = all90.filter((c) => new Date(c.date) >= d30);
    const all7 = all90.filter((c) => new Date(c.date) >= d7);
    const allToday = all90.filter((c) => new Date(c.date) >= startOfToday);
    return {
      ...repo,
      recentCommits: all90.slice(0, 3),        // top 3 for card display (keep backward compat)
      commitsLast7Days: all7,
      commitsLast30Days: all30,
      commitsLast90Days: all90,
      totalCommitsFetched: all90.length,
      weeklyCommitCount: all7.length,
      commitStats: {
        today: allToday.length,
        last7Days: all7.length,
        last30Days: all30.length,
        last90Days: all90.length,
        recentCommits: all90.slice(0, 5),
      },
    };
  });
  const activeToday = repos.filter((r) => r.commitStats.today > 0).length;
  const activeThisWeek = repos.filter((r) => r.commitStats.last7Days > 0).length;
  console.log(`   ↳ ${activeToday} repos active today, ${activeThisWeek} this week`);

  // ── Step 7.5: Fetch latest releases ─────────────────────────────────────────
  console.log('🏷️  Fetching latest releases...');
  const releaseTargets = repos.map((repo) => {
    if (repo.isFork && repo.forkedFrom) {
      const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
      return { owner: parentOwner, repo: parentRepo };
    }
    return { owner: username, repo: repo.name };
  });
  const releaseResults = await batchFetch(
    releaseTargets,
    ({ owner, repo }) => fetchLatestRelease(owner, repo, token),
    5, 100
  );
  repos = repos.map((repo, i) => ({
    ...repo,
    latestRelease: releaseResults[i] ?? null,
  }));
  const withReleases = repos.filter(r => r.latestRelease !== null).length;
  console.log(`   ↳ ${withReleases} repos have releases`);

  // ── Step 8: Build tag metrics and categories ─────────────────────────────────
  console.log('🏷️  Building metrics and categories...');
  const tagMetrics = buildTagMetrics(repos);
  const categories = buildCategories(repos);  // mutates primaryCategory on each repo

  // Sanity check — categories must always be the hardcoded 21 buckets (filtered to non-empty)
  if (categories.length > 21) {
    throw new Error(`BUG: buildCategories returned ${categories.length} categories — must be ≤21. Dynamic category creation detected.`);
  }
  console.log(`   ↳ ${categories.length}/21 categories populated`);

  const gapAnalysis = buildGapAnalysis(repos);
  console.log(`   ↳ ${gapAnalysis.gaps.length} gaps detected`);

  // ── Step 8.5: Assign taxonomy dimensions ────────────────────────────────────
  console.log('🏗️  Assigning taxonomy dimensions...');
  repos = repos.map((repo) => {
    return {
      ...repo,
      builders: [buildBuilder(repo)],
      aiDevSkills: assignDimension(repo.enrichedTags, AI_DEV_SKILLS),
      pmSkills: assignDimension(repo.enrichedTags, PM_SKILLS),
      industries: assignDimension(repo.enrichedTags, INDUSTRIES),
      programmingLanguages: Object.keys(repo.languageBreakdown ?? {})
        .sort((a, b) => ((repo.languageBreakdown ?? {})[b] ?? 0) - ((repo.languageBreakdown ?? {})[a] ?? 0))
        .slice(0, 5),
    };
  });

  const builderStats = buildBuilderStats(repos);
  const aiDevSkillStats = buildSkillStats(repos, 'aiDevSkills');
  const pmSkillStats = buildSkillStats(repos, 'pmSkills');
  console.log(`   ↳ ${builderStats.length} unique builders`);
  console.log(`   ↳ ${aiDevSkillStats.length} AI dev skill areas covered`);

  // ── Step 9: Build library stats ──────────────────────────────────────────────
  const built = repos.filter((r) => !r.isFork).length;
  const forked = repos.filter((r) => r.isFork).length;

  const langCounts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.language) langCounts.set(repo.language, (langCounts.get(repo.language) ?? 0) + 1);
  }
  const languages = [...langCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([l]) => l);

  const tagCounts = new Map<string, number>();
  for (const repo of repos) {
    for (const tag of repo.enrichedTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);

  const stats: LibraryStats = { total: repos.length, built, forked, languages, topTags };

  // ── Step 10: Write output ────────────────────────────────────────────────────
  const output: LibraryData = {
    username,
    generatedAt: new Date().toISOString(),
    stats,
    repos,
    tagMetrics,
    categories,
    gapAnalysis,
    builderStats,
    aiDevSkillStats,
    pmSkillStats,
  };

  const outDir = path.join(process.cwd(), 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'library.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Library generated in ${elapsed}s`);
  console.log(`📊 ${repos.length} repos · ${tagMetrics.length} tags · ${categories.length} categories`);
  console.log(`📁 Output: ${outPath}`);
  console.log(`📈 Most active this week:`);
  repos
    .filter((r) => r.commitsLast7Days.length > 0)
    .sort((a, b) => b.commitsLast7Days.length - a.commitsLast7Days.length)
    .slice(0, 5)
    .forEach((r) => console.log(`   • ${r.name}: ${r.commitsLast7Days.length} commits`));
}

generateLibrary().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
