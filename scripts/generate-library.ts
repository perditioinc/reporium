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
 * Flags:
 *   --quick  Skip fork sync for all repos; only fetch commits for repos updated
 *            in last 7 days; skip README fetch for unchanged repos.
 *   --full   Full run (default behaviour when no flag is supplied).
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
  GitHubRateLimitError,
} from '../src/lib/github';

/** Wrap a fetch call with a single retry on 429 — waits 10s before retrying. */
async function withRetryOn429<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      console.warn('   ⚠️  Rate limited (429) — waiting 10s before retry...');
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      return await fn();
    }
    throw err;
  }
}
import { enrichRepo } from '../src/lib/enrichRepo';
import { buildTagMetrics } from '../src/lib/buildTagMetrics';
import { buildCategories } from '../src/lib/buildCategories';
import { buildGapAnalysis } from '../src/lib/buildGapAnalysis';
import { buildBuilder, assignDimension, buildBuilderStats, buildSkillStats, AI_DEV_SKILLS, PM_SKILLS, INDUSTRIES } from '../src/lib/buildTaxonomy';
import { batchFetch } from '../src/lib/rateLimit';
import { LibraryData, LibraryStats, EnrichedRepo } from '../src/types/repo';

const username = process.env.GH_USERNAME || 'perditioinc';
const token = process.env.GH_TOKEN || undefined;

// ── Flag detection ───────────────────────────────────────────────────────────
const isQuickRun = process.argv.includes('--quick');
const isFullRun = process.argv.includes('--full') || !isQuickRun;

// ── Cache types ──────────────────────────────────────────────────────────────
interface RepoCacheEntry {
  cachedAt: string;
  updatedAt: string;
  forkSync: object | null;
  languageBreakdown: Record<string, number>;
  parentStats: object | null;
  readmeSummary: string | null;
}

interface RepoCache {
  [fullName: string]: RepoCacheEntry;
}

interface Meta {
  lastFullRun: string | null;
  lastQuickRun: string | null;
  rateLimitRemaining: number | null;
}

const OUT_DIR = path.join(process.cwd(), 'public', 'data');
const CACHE_PATH = path.join(OUT_DIR, 'cache.json');
const META_PATH = path.join(OUT_DIR, 'meta.json');

const CACHE_MAX_AGE_DAYS = 7;
const FORK_SYNC_ACTIVE_DAYS = 30;

/** Load the on-disk repo cache, returning an empty object if not found. */
function loadCache(): RepoCache {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as RepoCache;
  } catch {
    console.warn('   ⚠️  Could not parse cache.json — starting fresh');
    return {};
  }
}

/** Load the on-disk meta file. */
function loadMeta(): Meta {
  if (!fs.existsSync(META_PATH)) return { lastFullRun: null, lastQuickRun: null, rateLimitRemaining: null };
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as Meta;
  } catch {
    return { lastFullRun: null, lastQuickRun: null, rateLimitRemaining: null };
  }
}

/** Return true if a cache entry is fresh (less than CACHE_MAX_AGE_DAYS old). */
function isCacheFresh(entry: RepoCacheEntry): boolean {
  const cachedAt = new Date(entry.cachedAt).getTime();
  const ageMs = Date.now() - cachedAt;
  return ageMs < CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/** Return true if a raw updated_at timestamp is within the last N days. */
function isRecentlyUpdated(updatedAt: string, days: number): boolean {
  return new Date(updatedAt).getTime() > Date.now() - days * 24 * 60 * 60 * 1000;
}

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

  const runMode = isQuickRun ? 'QUICK' : 'FULL';
  console.log(`🔍 Fetching repos for ${username}... [${runMode} run]`);

  // ── Load cache & meta ────────────────────────────────────────────────────
  const cache = loadCache();
  const meta = loadMeta();
  const cacheEntries = Object.keys(cache).length;
  if (cacheEntries > 0) {
    console.log(`📂 Loaded cache with ${cacheEntries} entries`);
  }

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

  // Determine which repos need a fresh README fetch.
  // In quick mode: skip if cache is fresh and updatedAt matches.
  // In full mode: always fetch fresh.
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

  // Build a set of indices where we can use the cached README summary.
  const readmeCachedIndices = new Set<number>();
  if (isQuickRun) {
    rawRepos.forEach((raw, i) => {
      const entry = cache[raw.full_name];
      if (entry && isCacheFresh(entry) && entry.updatedAt === raw.updated_at) {
        readmeCachedIndices.add(i);
      }
    });
  }

  // Only fetch for repos that need fresh data.
  const readmeFetchTargets = readmeTargets.map((t, i) =>
    readmeCachedIndices.has(i) ? null : t
  );

  const readmes: (string | null)[] = new Array(rawRepos.length).fill(null);

  // Restore cached summaries for skipped repos.
  rawRepos.forEach((raw, i) => {
    if (readmeCachedIndices.has(i)) {
      readmes[i] = cache[raw.full_name].readmeSummary ?? null;
    }
  });

  // Batch-fetch the ones that need it.
  const activeFetchTargets = readmeFetchTargets.filter((t): t is { owner: string; repo: string } => t !== null);
  const activeIndices = readmeFetchTargets
    .map((t, i) => (t !== null ? i : -1))
    .filter((i) => i !== -1);

  if (activeFetchTargets.length > 0) {
    const freshReadmes = await batchFetch(activeFetchTargets, ({ owner, repo }) => fetchReadme(owner, repo), 8, 100);
    activeIndices.forEach((repoIdx, fetchIdx) => {
      readmes[repoIdx] = freshReadmes[fetchIdx] ?? null;
    });
  }

  const readmeFetched = activeIndices.length;
  const readmeCached = readmeCachedIndices.size;
  console.log(`   ↳ ${readmeFetched} fetched, ${readmeCached} from cache (${rawRepos.length} total)`);

  // ── Step 4: Build initial enriched repos ────────────────────────────────────
  let repos: EnrichedRepo[] = rawRepos.map((raw, i) => {
    const readmeText = readmes[i] ?? null;
    const enriched = enrichRepo(mapGitHubRepo(raw, forkInfoMap), readmeText);
    const forkInfo = raw.fork ? (forkInfoMap.get(raw.full_name) ?? null) : null;
    return { ...enriched, parentStats: forkInfo?.parentStats ?? null };
  });

  // ── Step 5: Fetch language breakdowns ───────────────────────────────────────
  console.log('💻 Fetching language breakdowns...');

  // Determine which repos need fresh language data.
  const langCacheIndices = new Set<number>();
  rawRepos.forEach((raw, i) => {
    const entry = cache[raw.full_name];
    if (entry && isCacheFresh(entry) && entry.updatedAt === raw.updated_at) {
      langCacheIndices.add(i);
    }
  });

  const langTargets = repos.map((repo, i) => {
    if (langCacheIndices.has(i)) return null;
    if (repo.isFork && repo.forkedFrom) {
      const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
      return { owner: parentOwner, repo: parentRepo };
    }
    return { owner: username, repo: repo.name };
  });

  const activeLangTargets = langTargets.filter((t): t is { owner: string; repo: string } => t !== null);
  const activeLangIndices = langTargets.map((t, i) => (t !== null ? i : -1)).filter((i) => i !== -1);

  const freshLangResults = activeLangTargets.length > 0
    ? await batchFetch(activeLangTargets, ({ owner, repo }) => fetchLanguageBreakdown(owner, repo, token), 8, 100)
    : [];

  repos = repos.map((repo, i) => {
    let breakdown: Record<string, number>;
    if (langCacheIndices.has(i)) {
      breakdown = cache[rawRepos[i].full_name].languageBreakdown ?? {};
    } else {
      const fetchIdx = activeLangIndices.indexOf(i);
      breakdown = (fetchIdx >= 0 ? freshLangResults[fetchIdx] : null) ?? {};
    }
    return { ...repo, languageBreakdown: breakdown, languagePercentages: computePercentages(breakdown) };
  });

  const langFetched = activeLangIndices.length;
  const langCached = langCacheIndices.size;
  console.log(`   ↳ ${langFetched} fetched, ${langCached} from cache`);

  // ── Step 6: Fetch fork sync status ──────────────────────────────────────────
  console.log('🔄 Fetching fork sync status...');

  // In quick mode, skip fork sync entirely.
  // In full mode, skip if repo is inactive AND cached forkSync state was not 'behind'.
  const syncTargets: Array<{ repo: EnrichedRepo; upstreamOwner: string; upstreamBranch: string }> = [];
  const syncCacheMap = new Map<string, object | null>(); // fullName -> cached value to reuse

  repos
    .filter((repo) => repo.isFork && repo.forkedFrom)
    .forEach((repo) => {
      const raw = rawRepos.find((r) => r.full_name === repo.fullName)!;
      const entry = cache[repo.fullName];
      const cachedForkSync = entry?.forkSync as { state?: string } | null | undefined;
      const cachedState = cachedForkSync?.state;

      const shouldFetch = (() => {
        if (isQuickRun) return false;
        if (isRecentlyUpdated(raw.updated_at, FORK_SYNC_ACTIVE_DAYS)) return true;
        if (cachedState === 'behind') return true;
        return false;
      })();

      if (shouldFetch) {
        const forkInfo = forkInfoMap.get(repo.fullName);
        const upstreamOwner = repo.forkedFrom!.split('/')[0];
        const upstreamBranch = forkInfo?.upstreamDefaultBranch ?? 'main';
        syncTargets.push({ repo, upstreamOwner, upstreamBranch });
      } else {
        // Reuse cached value (null if no cache)
        syncCacheMap.set(repo.fullName, entry?.forkSync ?? null);
      }
    });

  const syncResults = syncTargets.length > 0
    ? await batchFetch(
        syncTargets,
        ({ repo, upstreamOwner, upstreamBranch }) =>
          withRetryOn429(() => fetchForkSyncStatus(username, repo.name, upstreamOwner, upstreamBranch, token)),
        2, 500
      )
    : [];

  const syncFetchMap = new Map<string, typeof syncResults[0]>();
  syncTargets.forEach((t, i) => syncFetchMap.set(t.repo.fullName, syncResults[i]));

  repos = repos.map((repo) => {
    if (!repo.isFork) return { ...repo, forkSync: null };
    const fresh = syncFetchMap.get(repo.fullName);
    if (fresh !== undefined) return { ...repo, forkSync: fresh };
    return { ...repo, forkSync: (syncCacheMap.get(repo.fullName) as EnrichedRepo['forkSync']) ?? null };
  });

  const syncFetched = syncTargets.length;
  const syncSkipped = repos.filter((r) => r.isFork).length - syncFetched;
  console.log(`   ↳ ${syncFetched} fetched, ${syncSkipped} from cache/skipped`);

  // ── Step 7: Fetch commit history (7d, 30d, 90d) ─────────────────────────────
  console.log('📝 Fetching commit history...');
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // In quick mode, only fetch commits for repos updated in last 7 days.
  const commitTargets = repos.map((repo, i) => {
    const raw = rawRepos[i];
    if (isQuickRun && !isRecentlyUpdated(raw.updated_at, 7)) {
      return null; // skip
    }
    if (repo.isFork && repo.forkedFrom) {
      const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
      return { owner: parentOwner, repo: parentRepo };
    }
    return { owner: username, repo: repo.name };
  });

  const activeCommitTargets = commitTargets.filter((t): t is { owner: string; repo: string } => t !== null);
  const activeCommitIndices = commitTargets.map((t, i) => (t !== null ? i : -1)).filter((i) => i !== -1);

  // Fetch 90-day commits (superset — filter for shorter windows)
  const freshCommits90 = activeCommitTargets.length > 0
    ? await batchFetch(
        activeCommitTargets,
        ({ owner, repo }) => withRetryOn429(() => fetchCommitsSince(owner, repo, d90, token, 100)),
        2, 300
      )
    : [];

  repos = repos.map((repo, i) => {
    let all90: import('../src/types/repo').CommitSummary[];
    if (activeCommitIndices.includes(i)) {
      const fetchIdx = activeCommitIndices.indexOf(i);
      all90 = freshCommits90[fetchIdx] ?? [];
    } else {
      // Skipped in quick mode — produce empty arrays (no commit data this run)
      all90 = [];
    }
    const all30 = all90.filter((c) => new Date(c.date) >= d30);
    const all7 = all90.filter((c) => new Date(c.date) >= d7);
    const allToday = all90.filter((c) => new Date(c.date) >= startOfToday);
    return {
      ...repo,
      recentCommits: all90.slice(0, 3),
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

  const commitsFetched = activeCommitIndices.length;
  const commitsSkipped = repos.length - commitsFetched;
  const activeToday = repos.filter((r) => r.commitStats.today > 0).length;
  const activeThisWeek = repos.filter((r) => r.commitStats.last7Days > 0).length;
  console.log(`   ↳ ${commitsFetched} fetched, ${commitsSkipped} skipped — ${activeToday} active today, ${activeThisWeek} this week`);

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

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'library.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // ── Step 11: Write cache ─────────────────────────────────────────────────────
  const now2 = new Date().toISOString();

  // Update cache entries for repos that were freshly fetched this run.
  // For repos we pulled from cache (unchanged + fresh), preserve the existing entry.
  const updatedCache: RepoCache = { ...cache };

  rawRepos.forEach((raw, i) => {
    const repo = repos[i];
    const existingEntry = cache[raw.full_name];
    const wasCachedAndUnchanged =
      existingEntry &&
      isCacheFresh(existingEntry) &&
      existingEntry.updatedAt === raw.updated_at;

    if (wasCachedAndUnchanged && isQuickRun) {
      // Keep existing entry unchanged — nothing was re-fetched for this repo
      return;
    }

    // Write a fresh entry for repos that were fully (or partially) re-fetched
    updatedCache[raw.full_name] = {
      cachedAt: now2,
      updatedAt: raw.updated_at,
      forkSync: repo.forkSync as object | null ?? null,
      languageBreakdown: repo.languageBreakdown ?? {},
      parentStats: repo.parentStats as object | null ?? null,
      readmeSummary: repo.readmeSummary ?? null,
    };
  });

  fs.writeFileSync(CACHE_PATH, JSON.stringify(updatedCache, null, 2));

  // ── Step 12: Write meta ──────────────────────────────────────────────────────
  const updatedMeta: Meta = {
    ...meta,
    rateLimitRemaining: null, // Could be wired up from response headers in future
  };
  if (isQuickRun) {
    updatedMeta.lastQuickRun = now2;
  } else {
    updatedMeta.lastFullRun = now2;
  }
  fs.writeFileSync(META_PATH, JSON.stringify(updatedMeta, null, 2));

  // ── Summary ──────────────────────────────────────────────────────────────────
  const cacheHits = Object.keys(updatedCache).length - Object.keys(cache).length;
  const cachedCount = rawRepos.filter((raw) => {
    const entry = cache[raw.full_name];
    return isQuickRun && entry && isCacheFresh(entry) && entry.updatedAt === raw.updated_at;
  }).length;
  const freshCount = rawRepos.length - cachedCount;
  console.log(`\n   ↳ ${cachedCount} repos from cache, ${freshCount} re-fetched`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Library generated in ${elapsed}s [${runMode}]`);
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
