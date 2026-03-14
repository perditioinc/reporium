import { NextRequest, NextResponse } from 'next/server';
import { fetchAllRepos, fetchAllForkInfo, mapGitHubRepo, fetchReadme, fetchRecentCommits, fetchForkSyncStatus, fetchWeeklyCommitCount, fetchLanguageBreakdown, GitHubUserNotFoundError, GitHubRateLimitError } from '@/lib/github';
import { enrichRepo } from '@/lib/enrichRepo';
import { checkRateLimit, batchFetch } from '@/lib/rateLimit';
import { cacheGet, cacheSet } from '@/lib/cache';
import { buildTagMetrics } from '@/lib/buildTagMetrics';
import { LibraryData, LibraryStats, EnrichedRepo, CommitSummary, ForkSyncStatus } from '@/types/repo';
import { config } from '@/config';

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

/**
 * GET /api/repos/[username]
 *
 * Returns enriched JSON with all public repos, tags, stats, and metadata
 * for any GitHub username. Cached for 2 hours.
 *
 * This is the AI-agent entry point — it returns structured LibraryData JSON
 * that can be consumed by LLMs, bots, and other automated tools.
 *
 * @param request - Incoming Next.js request
 * @param params - Route params containing the GitHub username
 *
 * Response shape: LibraryData (see src/types/repo.ts)
 *
 * Error responses:
 * - 400: Missing or invalid username
 * - 404: GitHub user not found
 * - 429: GitHub API rate limit exceeded (includes retryAfterSeconds)
 * - 500: Unexpected server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
  }

  // Apply per-IP rate limiting
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const cacheKey = `repos:${username.toLowerCase()}`;
    const cached = cacheGet<LibraryData>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': `public, s-maxage=7200, stale-while-revalidate`, 'X-Cache': 'HIT' },
      });
    }

    const rawRepos = await fetchAllRepos(username, config.githubToken || undefined);

    // The list-repos endpoint omits the parent object entirely for forks.
    // Call GET /repos/{fork_full_name} for every fork — one call yields:
    //   • resolved language (parent.language ?? fork's own language)
    //   • parentFullName ("owner/repo" of the original)
    //   • full parentStats (stars, forks, open issues, last commit, archived status)
    const allForkFullNames = rawRepos.filter((r) => r.fork).map((r) => r.full_name);
    const forkInfoMap = allForkFullNames.length > 0
      ? await fetchAllForkInfo(allForkFullNames, config.githubToken || undefined)
      : new Map<string, import('@/lib/github').ForkInfo>();

    // Build README fetch targets: forks use the original owner's repo, built repos use username.
    // parentFullName is now reliably available via forkInfoMap.
    const repoReadmeTargets = rawRepos.map((raw) => {
      if (raw.fork) {
        const parentFullName = forkInfoMap.get(raw.full_name)?.parentFullName ?? null;
        if (parentFullName) {
          const [parentOwner, parentRepo] = parentFullName.split('/');
          return { owner: parentOwner, repo: parentRepo };
        }
      }
      return { owner: username, repo: raw.name };
    });

    // Fetch all READMEs with a 30-second total timeout
    const timeoutMs = 30_000;
    const timeoutResult = new Array(repoReadmeTargets.length).fill(null);
    const readmes = await Promise.race([
      batchFetch(repoReadmeTargets, ({ owner, repo }) => fetchReadme(owner, repo), 8, 500),
      new Promise<(string | null)[]>((resolve) => setTimeout(() => resolve(timeoutResult), timeoutMs)),
    ]);

    const repos: EnrichedRepo[] = rawRepos.map((raw, i) => {
      const readmeText = readmes[i] ?? null;
      const enriched = enrichRepo(mapGitHubRepo(raw, forkInfoMap), readmeText);
      const forkInfo = raw.fork ? (forkInfoMap.get(raw.full_name) ?? null) : null;
      const parentStats = forkInfo?.parentStats ?? null;
      return { ...enriched, parentStats };
    });

    // Batch-fetch recent commits for all repos (15-second timeout)
    // For forks: use the parent repo. For built repos: use username/repoName.
    const commitTargets = repos.map((repo) => {
      if (repo.isFork && repo.forkedFrom) {
        const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
        return { owner: parentOwner, repo: parentRepo };
      }
      return { owner: username, repo: repo.name };
    });

    const commitResults = await Promise.race([
      batchFetch(
        commitTargets,
        ({ owner, repo }) => fetchRecentCommits(owner, repo, config.githubToken || undefined),
        8,
        50
      ),
      new Promise<CommitSummary[][]>((resolve) =>
        setTimeout(() => resolve(new Array(commitTargets.length).fill([])), 30_000)
      ),
    ]);

    const reposWithCommits: EnrichedRepo[] = repos.map((repo, i) => ({
      ...repo,
      recentCommits: commitResults[i] ?? [],
    }));

    // Batch-fetch fork sync status for all forked repos (20-second timeout)
    // Uses forkInfoMap to get upstreamDefaultBranch for each fork.
    // Never blocks the response if it times out.
    const forkSyncTargets = reposWithCommits
      .filter((repo) => repo.isFork && repo.forkedFrom)
      .map((repo) => {
        const forkInfo = forkInfoMap.get(repo.fullName);
        const upstreamOwner = repo.forkedFrom!.split('/')[0];
        const upstreamBranch = forkInfo?.upstreamDefaultBranch ?? 'main';
        return { repo, upstreamOwner, upstreamBranch };
      });

    // Debug: log first 3 sync targets so failures are visible in server console
    console.log('[ForkSync] Fetching sync status for', forkSyncTargets.length, 'forks. First 3 targets:',
      forkSyncTargets.slice(0, 3).map(t => `${username}/${t.repo.name} vs ${t.upstreamOwner}:${t.upstreamBranch}`)
    );

    const forkSyncResultsRaw = await Promise.race([
      batchFetch(
        forkSyncTargets,
        ({ repo, upstreamOwner, upstreamBranch }) =>
          fetchForkSyncStatus(username, repo.name, upstreamOwner, upstreamBranch, config.githubToken || undefined),
        8,
        50
      ),
      new Promise<ForkSyncStatus[]>((resolve) =>
        setTimeout(() => resolve(new Array(forkSyncTargets.length).fill({ state: 'unknown', behindBy: 0, aheadBy: 0, upstreamBranch: 'main' })), 30_000)
      ),
    ]);

    // Map sync results back to repos by fullName
    const forkSyncMap = new Map<string, ForkSyncStatus>();
    forkSyncTargets.forEach((target, i) => {
      if (forkSyncResultsRaw[i]) {
        forkSyncMap.set(target.repo.fullName, forkSyncResultsRaw[i]);
      }
    });

    const reposWithSync: EnrichedRepo[] = reposWithCommits.map((repo) => ({
      ...repo,
      forkSync: repo.isFork ? (forkSyncMap.get(repo.fullName) ?? null) : null,
    }));

    // ── Weekly commit counts (using since= parameter for accuracy) ──────────────
    // For forks: use parent repo. For built repos: use username/repoName.
    const weeklyTargets = reposWithSync.map((repo) => {
      if (repo.isFork && repo.forkedFrom) {
        const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
        return { owner: parentOwner, repo: parentRepo };
      }
      return { owner: username, repo: repo.name };
    });

    const weeklyResults = await Promise.race([
      batchFetch(
        weeklyTargets,
        ({ owner, repo }) => fetchWeeklyCommitCount(owner, repo, config.githubToken || undefined),
        8,
        50
      ),
      new Promise<number[]>((resolve) =>
        setTimeout(() => resolve(new Array(weeklyTargets.length).fill(0)), 30_000)
      ),
    ]);

    // ── Language breakdown (bytes per language) ─────────────────────────────────
    // For forks: use parent repo. For built repos: use username/repoName.
    const langTargets = reposWithSync.map((repo) => {
      if (repo.isFork && repo.forkedFrom) {
        const [parentOwner, parentRepo] = repo.forkedFrom.split('/');
        return { owner: parentOwner, repo: parentRepo };
      }
      return { owner: username, repo: repo.name };
    });

    const langResults = await Promise.race([
      batchFetch(
        langTargets,
        ({ owner, repo }) => fetchLanguageBreakdown(owner, repo, config.githubToken || undefined),
        8,
        50
      ),
      new Promise<Record<string, number>[]>((resolve) =>
        setTimeout(() => resolve(new Array(langTargets.length).fill({})), 30_000)
      ),
    ]);

    const reposWithLanguages: EnrichedRepo[] = reposWithSync.map((repo, i) => {
      const breakdown = langResults[i] ?? {};
      const now = new Date();
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
      const d7 = new Date(now.getTime() - 7*24*60*60*1000);
      const d30 = new Date(now.getTime() - 30*24*60*60*1000);
      return {
        ...repo,
        weeklyCommitCount: weeklyResults[i] ?? 0,
        languageBreakdown: breakdown,
        languagePercentages: computePercentages(breakdown),
        commitStats: {
          today: repo.recentCommits.filter(c => new Date(c.date) >= startOfToday).length,
          last7Days: weeklyResults[i] ?? 0,
          last30Days: repo.recentCommits.filter(c => new Date(c.date) >= d30).length,
          last90Days: repo.recentCommits.length,
          recentCommits: repo.recentCommits.slice(0, 5),
        },
        allCategories: [],
        latestRelease: null,
        aiDevSkills: [],
        pmSkills: [],
        industries: [],
        programmingLanguages: [],
        builders: [],
      };
    });

    const readmeFetchedCount = readmes.filter((r) => r !== null).length;

    // Compute stats
    const built = reposWithLanguages.filter((r) => !r.isFork).length;
    const forked = reposWithLanguages.filter((r) => r.isFork).length;

    const languageCounts = new Map<string, number>();
    for (const repo of reposWithLanguages) {
      if (repo.language) {
        languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
      }
    }
    const languages = [...languageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([lang]) => lang);

    const tagCounts = new Map<string, number>();
    for (const repo of reposWithLanguages) {
      for (const tag of repo.enrichedTags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    const stats: LibraryStats = {
      total: reposWithLanguages.length,
      built,
      forked,
      languages,
      topTags,
    };

    const tagMetrics = buildTagMetrics(reposWithLanguages);

    const data: LibraryData = {
      username,
      generatedAt: new Date().toISOString(),
      stats,
      repos: reposWithLanguages,
      tagMetrics,
      categories: [],
      gapAnalysis: { generatedAt: new Date().toISOString(), gaps: [] },
      builderStats: [],
      aiDevSkillStats: [],
      pmSkillStats: [],
    };

    cacheSet(cacheKey, data, 7200 * 1000);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, s-maxage=7200, stale-while-revalidate`,
        'X-Cache': 'MISS',
        'X-Readme-Fetched': String(readmeFetchedCount),
      },
    });
  } catch (err) {
    if (err instanceof GitHubUserNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: err.message, retryAfterSeconds: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error('Unexpected error in /api/repos/[username]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
