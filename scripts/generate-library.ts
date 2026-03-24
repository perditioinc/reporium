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
 *   --quick   Skip fork sync for all repos; only fetch commits for repos updated
 *             in last 7 days; skip README fetch for unchanged repos.
 *   --weekly  Refresh tier 2 (weekly) + tier 3 (daily) data; skip tier 1 (permanent).
 *   --full    Full run (default behaviour when no flag is supplied).
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
import { isStale, makeCacheEntry, LibraryCache, RepoCache } from '../src/lib/cacheManager';

const username = process.env.GH_USERNAME || 'perditioinc';
const token = process.env.GH_TOKEN || undefined;

// ── Flag detection ───────────────────────────────────────────────────────────
const isQuickRun = process.argv.includes('--quick');
const isWeeklyRun = process.argv.includes('--weekly');
const isFullRun = process.argv.includes('--full') || (!isQuickRun && !isWeeklyRun);

// ── Cache paths ──────────────────────────────────────────────────────────────
interface Meta {
  lastFullRun: string | null;
  lastQuickRun: string | null;
  lastWeeklyRun: string | null;
  rateLimitRemaining: number | null;
}

const OUT_DIR = path.join(process.cwd(), 'public', 'data');
// Legacy cache path — kept for backward compat reads; new writes go to REPO_CACHE_PATH
const CACHE_PATH = path.join(OUT_DIR, 'cache.json');
const REPO_CACHE_PATH = path.join(OUT_DIR, 'repo-cache.json');
const META_PATH = path.join(OUT_DIR, 'meta.json');

const FORK_SYNC_ACTIVE_DAYS = 30;

/** Load the four-tier repo cache. Falls back to legacy cache.json shape if repo-cache.json is absent. */
function loadLibraryCache(): LibraryCache {
  // Prefer new repo-cache.json
  if (fs.existsSync(REPO_CACHE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(REPO_CACHE_PATH, 'utf-8')) as LibraryCache;
    } catch {
      console.warn('   ⚠️  Could not parse repo-cache.json — starting fresh');
    }
  }
  return {};
}

/** Load the on-disk meta file. */
function loadMeta(): Meta {
  if (!fs.existsSync(META_PATH)) return { lastFullRun: null, lastQuickRun: null, lastWeeklyRun: null, rateLimitRemaining: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as Partial<Meta>;
    return {
      lastFullRun: null,
      lastQuickRun: null,
      lastWeeklyRun: null,
      rateLimitRemaining: null,
      ...parsed,
    };
  } catch {
    return { lastFullRun: null, lastQuickRun: null, lastWeeklyRun: null, rateLimitRemaining: null };
  }
}

/** Return true if a raw updated_at timestamp is within the last N days. */
function isRecentlyUpdated(updatedAt: string, days: number): boolean {
  return new Date(updatedAt).getTime() > Date.now() - days * 24 * 60 * 60 * 1000;
}

// ── Legacy cache helpers (kept for backward compat during transition) ─────────
interface LegacyRepoCacheEntry {
  cachedAt: string;
  updatedAt: string;
  forkSync: object | null;
  languageBreakdown: Record<string, number>;
  parentStats: object | null;
  readmeSummary: string | null;
}
interface LegacyRepoCache { [fullName: string]: LegacyRepoCacheEntry; }

function loadLegacyCache(): LegacyRepoCache {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as LegacyRepoCache;
  } catch {
    return {};
  }
}
function isLegacyCacheFresh(entry: LegacyRepoCacheEntry): boolean {
  const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
  return ageMs < 7 * 24 * 60 * 60 * 1000;
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

  const runMode = isQuickRun ? 'QUICK' : isWeeklyRun ? 'WEEKLY' : 'FULL';
  console.log(`🔍 Fetching repos for ${username}... [${runMode} run]`);

  // ── Load cache & meta ────────────────────────────────────────────────────
  const libraryCache = loadLibraryCache();
  const legacyCache = loadLegacyCache();
  const meta = loadMeta();
  const cacheEntries = Object.keys(libraryCache).length;
  if (cacheEntries > 0) {
    console.log(`📂 Loaded four-tier cache with ${cacheEntries} entries`);
  }

  // Cache hit/miss counters for summary
  let fullyCachedCount = 0;
  let partiallyUpdatedCount = 0;
  let fullyRefetchedCount = 0;

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
  // Use four-tier cache (daily tier for readme), fall back to legacy cache.
  const readmeCachedIndices = new Set<number>();
  if (isQuickRun || isWeeklyRun) {
    rawRepos.forEach((raw, i) => {
      const tierEntry = libraryCache[raw.full_name]?.readme;
      if (tierEntry && !isStale(tierEntry, 'daily') && tierEntry.repoUpdatedAt === raw.updated_at) {
        readmeCachedIndices.add(i);
        return;
      }
      // Fall back to legacy cache on quick runs
      if (isQuickRun) {
        const legacy = legacyCache[raw.full_name];
        if (legacy && isLegacyCacheFresh(legacy) && legacy.updatedAt === raw.updated_at) {
          readmeCachedIndices.add(i);
        }
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
      // Prefer four-tier cache, fall back to legacy
      const tierReadme = libraryCache[raw.full_name]?.readme?.data;
      if (tierReadme !== undefined) {
        readmes[i] = tierReadme;
      } else {
        readmes[i] = legacyCache[raw.full_name]?.readmeSummary ?? null;
      }
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
  // Language breakdown is weekly tier — skip if fresh and repo unchanged.
  const langCacheIndices = new Set<number>();
  rawRepos.forEach((raw, i) => {
    // In full run, always re-fetch
    if (isFullRun) return;
    // Check four-tier cache (weekly tier)
    const tierEntry = libraryCache[raw.full_name]?.languageBreakdown;
    if (tierEntry && !isStale(tierEntry, 'weekly') && tierEntry.repoUpdatedAt === raw.updated_at) {
      langCacheIndices.add(i);
      return;
    }
    // On quick run only: also accept legacy cache
    if (isQuickRun) {
      const legacy = legacyCache[raw.full_name];
      if (legacy && isLegacyCacheFresh(legacy) && legacy.updatedAt === raw.updated_at) {
        langCacheIndices.add(i);
      }
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
      // Prefer four-tier cache, fall back to legacy
      const tierData = libraryCache[rawRepos[i].full_name]?.languageBreakdown?.data;
      if (tierData !== undefined) {
        breakdown = tierData;
      } else {
        breakdown = legacyCache[rawRepos[i].full_name]?.languageBreakdown ?? {};
      }
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
      const legacyEntry = legacyCache[repo.fullName];
      const cachedForkSync = legacyEntry?.forkSync as { state?: string } | null | undefined;
      const cachedState = cachedForkSync?.state;

      const shouldFetch = (() => {
        if (isQuickRun) return false;
        // Weekly run: re-fetch fork sync for recently active repos (daily tier)
        if (isWeeklyRun) {
          const tierEntry = libraryCache[repo.fullName]?.forkSyncStatus;
          if (tierEntry && !isStale(tierEntry, 'daily') && tierEntry.repoUpdatedAt === raw.updated_at) return false;
          return isRecentlyUpdated(raw.updated_at, FORK_SYNC_ACTIVE_DAYS);
        }
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
        // Reuse cached value — prefer four-tier cache, fall back to legacy
        const tierSync = libraryCache[repo.fullName]?.forkSyncStatus?.data;
        if (tierSync !== undefined) {
          syncCacheMap.set(repo.fullName, tierSync as object | null);
        } else {
          syncCacheMap.set(repo.fullName, legacyEntry?.forkSync ?? null);
        }
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
  // In weekly mode, only fetch commits for repos where the daily cache is stale.
  const commitTargets = repos.map((repo, i) => {
    const raw = rawRepos[i];
    if (isQuickRun && !isRecentlyUpdated(raw.updated_at, 7)) {
      return null; // skip
    }
    if (isWeeklyRun) {
      const tierEntry = libraryCache[repo.fullName]?.recentCommits;
      if (tierEntry && !isStale(tierEntry, 'daily') && tierEntry.repoUpdatedAt === raw.updated_at) {
        return null; // skip — daily cache still fresh
      }
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

  // Sanity check — categories must always be the hardcoded 28 buckets (filtered to non-empty)
  if (categories.length > 28) {
    throw new Error(`BUG: buildCategories returned ${categories.length} categories — must be ≤28. Dynamic category creation detected.`);
  }
  console.log(`   ↳ ${categories.length}/28 categories populated`);

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

  // ── Step 11: Write four-tier cache ──────────────────────────────────────────
  const now2 = new Date().toISOString();

  // Merge updates into the four-tier library cache
  const updatedLibraryCache: LibraryCache = { ...libraryCache };

  rawRepos.forEach((raw, i) => {
    const repo = repos[i];
    const repoUpdatedAt = raw.updated_at;
    const existing = libraryCache[raw.full_name] ?? {} as Partial<RepoCache>;

    // Determine what was cached vs re-fetched for stats
    const wasReadmeCached = readmeCachedIndices.has(i);
    const wasLangCached = langCacheIndices.has(i);
    const wasCommitSkipped = !activeCommitIndices.includes(i);

    const isFullyCached = wasReadmeCached && wasLangCached && wasCommitSkipped;
    const isPartiallyUpdated = !isFullyCached && (wasReadmeCached || wasLangCached || wasCommitSkipped);

    if (isFullyCached) {
      fullyCachedCount++;
    } else if (isPartiallyUpdated) {
      partiallyUpdatedCount++;
    } else {
      fullyRefetchedCount++;
    }

    // Build updated RepoCache entry — preserve tiers that weren't re-fetched
    const updatedEntry: RepoCache = {
      lastFullFetch: isFullRun ? now2 : (existing.lastFullFetch ?? now2),
      repoUpdatedAt,

      // Tier 1 — permanent: only overwrite on full run or if missing
      upstreamCreatedAt: (isFullRun || !existing.upstreamCreatedAt)
        ? makeCacheEntry(repo.upstreamCreatedAt ?? null, 'permanent', repoUpdatedAt)
        : existing.upstreamCreatedAt,

      forkedFrom: (isFullRun || !existing.forkedFrom)
        ? makeCacheEntry(repo.forkedFrom ?? null, 'permanent', repoUpdatedAt)
        : existing.forkedFrom,

      // Tier 2 — weekly: overwrite on full or weekly run, or if stale
      languageBreakdown: wasLangCached
        ? (existing.languageBreakdown ?? makeCacheEntry(repo.languageBreakdown ?? {}, 'weekly', repoUpdatedAt))
        : makeCacheEntry(repo.languageBreakdown ?? {}, 'weekly', repoUpdatedAt),

      parentStats: (isFullRun || isWeeklyRun || !existing.parentStats)
        ? makeCacheEntry(repo.parentStats ?? null, 'weekly', repoUpdatedAt)
        : existing.parentStats,

      forkInfo: existing.forkInfo,

      // Tier 3 — daily
      readme: wasReadmeCached
        ? (existing.readme ?? makeCacheEntry(repo.readmeSummary ?? null, 'daily', repoUpdatedAt))
        : makeCacheEntry(repo.readmeSummary ?? null, 'daily', repoUpdatedAt),

      forkSyncStatus: repo.isFork
        ? makeCacheEntry(repo.forkSync ?? null, 'daily', repoUpdatedAt)
        : existing.forkSyncStatus,

      recentCommits: wasCommitSkipped
        ? (existing.recentCommits ?? makeCacheEntry(repo.recentCommits ?? [], 'daily', repoUpdatedAt))
        : makeCacheEntry(repo.recentCommits ?? [], 'daily', repoUpdatedAt),

      latestRelease: makeCacheEntry(
        repo.latestRelease ? { tagName: repo.latestRelease.version, publishedAt: repo.latestRelease.releasedAt, url: repo.latestRelease.url } : null,
        'daily',
        repoUpdatedAt
      ),
    };

    updatedLibraryCache[raw.full_name] = updatedEntry;
  });

  fs.writeFileSync(REPO_CACHE_PATH, JSON.stringify(updatedLibraryCache, null, 2));

  // ── Step 12: Write meta ──────────────────────────────────────────────────────
  const updatedMeta: Meta = {
    ...meta,
    rateLimitRemaining: null, // Could be wired up from response headers in future
  };
  if (isQuickRun) {
    updatedMeta.lastQuickRun = now2;
  } else if (isWeeklyRun) {
    updatedMeta.lastWeeklyRun = now2;
  } else {
    updatedMeta.lastFullRun = now2;
  }
  fs.writeFileSync(META_PATH, JSON.stringify(updatedMeta, null, 2));

  // ── Summary ──────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Library generated in ${elapsed}s [${runMode}]`);
  console.log(`📊 ${repos.length} repos · API calls saved with cache:`);
  console.log(`   · ${fullyCachedCount} repos fully cached`);
  console.log(`   · ${partiallyUpdatedCount} repos partially updated (tier 3 only)`);
  console.log(`   · ${fullyRefetchedCount} repos fully re-fetched`);
  console.log(`📊 ${tagMetrics.length} tags · ${categories.length} categories`);
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
