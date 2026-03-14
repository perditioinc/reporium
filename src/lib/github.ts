import { EnrichedRepo, ParentRepoStats, CommitSummary, ForkSyncStatus, ForkSyncState } from '@/types/repo';

/**
 * All parent data derivable from GET /repos/{fork_full_name}.
 * The individual fork endpoint returns a `parent` object that the list endpoint omits entirely.
 */
export interface ForkInfo {
  /** Resolved language: parent language ?? fork's own language ?? null */
  language: string | null;
  /** Parent repo "owner/repo" string, null if response lacked parent */
  parentFullName: string | null;
  /** Full parent repo stats, null if response lacked parent */
  parentStats: ParentRepoStats | null;
  upstreamCreatedAt: string | null;      // parent.created_at
  upstreamLastPushAt: string | null;     // parent.pushed_at
  upstreamDefaultBranch: string | null;  // parent.default_branch
}

/** In-memory cache: fork "owner/repo" → ForkInfo */
const forkInfoCache = new Map<string, ForkInfo>();

/** Raw GitHub repo shape from REST API */
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  fork: boolean;
  parent?: { full_name: string };
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  created_at: string;   // ADD THIS
  pushed_at: string;    // ADD THIS
  html_url: string;
  archived: boolean;
}

/** GitHub rate limit info parsed from response headers */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

/** Error thrown when a GitHub user is not found (404) */
export class GitHubUserNotFoundError extends Error {
  constructor(username: string) {
    super(`GitHub user not found: ${username}`);
    this.name = 'GitHubUserNotFoundError';
  }
}

/** Error thrown when GitHub API rate limit is exceeded (429 / X-RateLimit-Remaining: 0) */
export class GitHubRateLimitError extends Error {
  /** Time in seconds until the rate limit resets */
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`GitHub API rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`);
    this.name = 'GitHubRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Parse rate limit info from GitHub response headers */
function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const limit = parseInt(headers.get('x-ratelimit-limit') || '60', 10);
  const remaining = parseInt(headers.get('x-ratelimit-remaining') || '60', 10);
  const reset = parseInt(headers.get('x-ratelimit-reset') || '0', 10);
  return {
    limit,
    remaining,
    resetAt: new Date(reset * 1000),
  };
}

/**
 * Fetch a single page of public repos for a GitHub user.
 * @throws {GitHubUserNotFoundError} if the user does not exist
 * @throws {GitHubRateLimitError} if the API rate limit is exceeded
 */
async function fetchReposPage(
  username: string,
  page: number,
  token?: string
): Promise<{ repos: GitHubRepo[]; rateLimitInfo: RateLimitInfo; hasMore: boolean }> {
  const perPage = 100;
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=public&per_page=${perPage}&page=${page}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  const rateLimitInfo = parseRateLimitHeaders(res.headers);

  if (res.status === 404) {
    throw new GitHubUserNotFoundError(username);
  }

  if (res.status === 403 || res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    const retryAfterSeconds = retryAfter
      ? parseInt(retryAfter, 10)
      : Math.max(0, Math.ceil((rateLimitInfo.resetAt.getTime() - Date.now()) / 1000));
    throw new GitHubRateLimitError(retryAfterSeconds);
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const repos: GitHubRepo[] = await res.json();
  const hasMore = repos.length === perPage;

  return { repos, rateLimitInfo, hasMore };
}

/**
 * Fetch all public repositories for a GitHub user, handling pagination automatically.
 * Supports both authenticated (5,000 req/hour) and unauthenticated (60 req/hour) modes.
 * @param username - GitHub username
 * @param token - Optional GitHub personal access token
 * @returns Array of raw GitHub repo objects
 * @throws {GitHubUserNotFoundError} if the user does not exist
 * @throws {GitHubRateLimitError} if the API rate limit is exceeded
 */
export async function fetchAllRepos(
  username: string,
  token?: string
): Promise<GitHubRepo[]> {
  const allRepos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const { repos, hasMore } = await fetchReposPage(username, page, token);
    allRepos.push(...repos);
    if (!hasMore) break;
    page++;
  }

  return allRepos;
}

/**
 * Fetch complete parent info for a single fork by calling GET /repos/{fork_full_name}.
 * The individual fork endpoint returns a `parent` object — the list-repos endpoint omits
 * this object entirely. From one call we derive: resolved language, parent full_name,
 * and all parent stats. Returns a safe default on any error.
 * @param forkFullName - "owner/repo" of the fork (NOT the parent)
 * @param token - Optional GitHub personal access token
 */
async function fetchForkInfo(forkFullName: string, token?: string): Promise<ForkInfo> {
  const url = `https://api.github.com/repos/${forkFullName}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const nullResult: ForkInfo = { language: null, parentFullName: null, parentStats: null, upstreamCreatedAt: null, upstreamLastPushAt: null, upstreamDefaultBranch: null };

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return nullResult;

    const data = await res.json() as {
      language: string | null;
      parent?: {
        full_name: string;
        owner: { login: string };
        name: string;
        language: string | null;
        stargazers_count: number;
        forks_count: number;
        open_issues_count: number;
        pushed_at: string;
        created_at: string;      // ADD
        default_branch: string;  // ADD
        archived: boolean;
        description: string | null;
        html_url: string;
      };
    };

    const parent = data.parent;
    if (!parent) {
      return { language: data.language, parentFullName: null, parentStats: null, upstreamCreatedAt: null, upstreamLastPushAt: null, upstreamDefaultBranch: null };
    }

    return {
      language: parent.language ?? data.language,
      parentFullName: parent.full_name,
      parentStats: {
        owner: parent.owner.login,
        repo: parent.name,
        stars: parent.stargazers_count,
        forks: parent.forks_count,
        openIssues: parent.open_issues_count,
        lastCommitDate: parent.pushed_at,
        isArchived: parent.archived,
        description: parent.description,
        url: parent.html_url,
      },
      upstreamCreatedAt: parent.created_at,
      upstreamLastPushAt: parent.pushed_at,
      upstreamDefaultBranch: parent.default_branch,
    };
  } catch {
    return nullResult;
  }
}

/**
 * Fetch parent info for ALL provided fork repos.
 * Calls GET /repos/{fork_full_name} for each, extracting language, parentFullName,
 * and parentStats from the `parent` object in one shot — the list-repos endpoint
 * omits the parent object entirely, so this individual call is required.
 * Results are cached in-process to avoid redundant calls.
 *
 * @param forkFullNames - Array of "owner/repo" strings for fork repos
 * @param token - Optional GitHub personal access token
 * @param concurrency - Max simultaneous requests (default 5)
 * @returns Map of fork "owner/repo" → ForkInfo
 */
export async function fetchAllForkInfo(
  forkFullNames: string[],
  token?: string,
  concurrency = 5
): Promise<Map<string, ForkInfo>> {
  const uncached = [...new Set(forkFullNames)].filter((n) => !forkInfoCache.has(n));

  for (let i = 0; i < uncached.length; i += concurrency) {
    const batch = uncached.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((name) => fetchForkInfo(name, token)));
    batch.forEach((name, idx) => forkInfoCache.set(name, results[idx]));
  }

  const result = new Map<string, ForkInfo>();
  for (const name of forkFullNames) {
    result.set(name, forkInfoCache.get(name) ?? { language: null, parentFullName: null, parentStats: null, upstreamCreatedAt: null, upstreamLastPushAt: null, upstreamDefaultBranch: null });
  }
  return result;
}

/**
 * Fetches the raw README content for a repository.
 * Tries main branch first, then master. Returns null if no README or fetch fails.
 * For forked repos, call with the ORIGINAL owner (from forkedFrom), not the fork owner.
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Raw README text or null
 */
export async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  for (const branch of ['main', 'master']) {
    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      // continue to next branch
    }
  }
  return null;
}

/**
 * Fetches the last N commits from a repository.
 * For forked repos, pass the original owner/repo. For built repos, pass username/repo.
 * Skips empty messages and bot commits. Returns empty array on any error.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param token - Optional GitHub personal access token
 * @param limit - Max commits to fetch (default 5, we filter bots so fetch more than needed)
 * @returns Array of CommitSummary, max 3 non-bot commits
 */
export async function fetchRecentCommits(
  owner: string,
  repo: string,
  token?: string,
  limit = 5
): Promise<CommitSummary[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json() as Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      html_url: string;
    }>;

    const commits: CommitSummary[] = [];
    for (const item of data) {
      const rawMessage = item.commit.message ?? '';
      const authorName = item.commit.author?.name ?? '';

      // Skip empty messages, bot commits, or dependabot commits
      if (!rawMessage) continue;
      if (authorName.includes('[bot]')) continue;
      if (rawMessage.startsWith('dependabot')) continue;

      // Take only first line
      let message = rawMessage.split('\n')[0];
      // Truncate to 60 chars
      if (message.length > 60) {
        message = message.slice(0, 57) + '...';
      }

      commits.push({
        sha: item.sha,
        message,
        date: item.commit.author?.date ?? '',
        author: authorName,
        url: item.html_url,
      });

      if (commits.length >= 3) break;
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * Fetches stats from the original/parent repository for a forked repo.
 * Uses GET /repos/{owner}/{repo} on the ORIGINAL owner, not the fork.
 * Returns null on any error — failures must never crash the main response.
 *
 * Note: In the API route, parent stats are obtained more efficiently via
 * fetchAllForkInfo (one call per fork yields language + parentFullName + parentStats).
 * This function remains available for direct use and testing.
 *
 * @param forkedFrom - "owner/repo" string from enriched repo data
 * @param token - Optional GitHub personal access token
 * @returns Parent repo stats or null if fetch fails or forkedFrom is malformed
 */
export async function fetchParentRepoStats(
  forkedFrom: string,
  token?: string
): Promise<ParentRepoStats | null> {
  const slashIdx = forkedFrom.indexOf('/');
  if (slashIdx < 1 || slashIdx === forkedFrom.length - 1) return null;
  const owner = forkedFrom.slice(0, slashIdx);
  const repo = forkedFrom.slice(slashIdx + 1);

  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json() as {
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      pushed_at: string;
      archived: boolean;
      description: string | null;
      html_url: string;
    };
    return {
      owner,
      repo,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      lastCommitDate: data.pushed_at,
      isArchived: data.archived,
      description: data.description,
      url: data.html_url,
    };
  } catch {
    return null;
  }
}

/**
 * Map a raw GitHubRepo to a partial EnrichedRepo (without enrichedTags).
 * Accepts a forkInfoMap to resolve language and parentFullName for forks —
 * the list-repos endpoint omits the parent object, so these must come from
 * individual fork fetches via fetchAllForkInfo.
 * @param repo - Raw GitHub repo from the API
 * @param forkInfoMap - Optional map of fork "owner/repo" → ForkInfo
 */
export function mapGitHubRepo(
  repo: GitHubRepo,
  forkInfoMap?: Map<string, ForkInfo>
): Omit<EnrichedRepo, 'enrichedTags' | 'readmeSummary' | 'parentStats' | 'recentCommits' | 'forkSync' | 'weeklyCommitCount' | 'languageBreakdown' | 'languagePercentages' | 'commitsLast7Days' | 'commitsLast30Days' | 'commitsLast90Days' | 'totalCommitsFetched' | 'primaryCategory' | 'allCategories' | 'commitStats' | 'latestRelease' | 'aiDevSkills' | 'pmSkills' | 'industries' | 'programmingLanguages' | 'builders'> {
  const forkInfo = repo.fork ? (forkInfoMap?.get(repo.full_name) ?? null) : null;
  const forkedFrom = forkInfo?.parentFullName ?? null;
  const language = repo.language ?? forkInfo?.language ?? null;

  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    isFork: repo.fork,
    forkedFrom,
    language,
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    lastUpdated: repo.updated_at,
    url: repo.html_url,
    isArchived: repo.archived,
    createdAt: repo.fork
      ? (forkInfo?.upstreamCreatedAt ?? repo.created_at)
      : repo.created_at,
    forkedAt: repo.fork ? repo.created_at : null,
    yourLastPushAt: repo.fork ? repo.pushed_at : null,
    upstreamLastPushAt: repo.fork ? (forkInfo?.upstreamLastPushAt ?? null) : null,
    upstreamCreatedAt: repo.fork ? (forkInfo?.upstreamCreatedAt ?? null) : null,
  };
}

/**
 * Fetches fork divergence data using the GitHub Compare API.
 * Compares the fork against upstream to get ahead/behind commit counts.
 * Returns a safe 'unknown' status on any error — failures must never crash the caller.
 *
 * Endpoint: GET /repos/{forkOwner}/{forkRepo}/compare/{upstreamOwner}:{branch}...{forkOwner}:{branch}
 *
 * @param forkOwner - Owner of the fork (e.g. perditioinc)
 * @param forkRepo - Repo name of the fork
 * @param upstreamOwner - Original repo owner
 * @param upstreamBranch - Default branch of upstream
 * @param token - Optional GitHub personal access token
 */
export async function fetchForkSyncStatus(
  forkOwner: string,
  forkRepo: string,
  upstreamOwner: string,
  upstreamBranch: string,
  token?: string
): Promise<ForkSyncStatus> {
  const unknownStatus: ForkSyncStatus = {
    state: 'unknown',
    behindBy: 0,
    aheadBy: 0,
    upstreamBranch,
  };

  try {
    const url = `https://api.github.com/repos/${forkOwner}/${forkRepo}/compare/${upstreamOwner}:${upstreamBranch}...${forkOwner}:${upstreamBranch}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      // Log failures to help diagnose why sync status is unavailable
      const errBody = await res.json().catch(() => null);
      console.error(
        `[ForkSync] ${res.status} for ${forkOwner}/${forkRepo} vs ${upstreamOwner}:${upstreamBranch}`,
        errBody ? JSON.stringify(errBody).slice(0, 300) : ''
      );
      return unknownStatus;
    }

    const data = await res.json() as {
      status: 'identical' | 'ahead' | 'behind' | 'diverged';
      ahead_by: number;
      behind_by: number;
    };

    const stateMap: Record<string, ForkSyncState> = {
      identical: 'up-to-date',
      ahead: 'ahead',
      behind: 'behind',
      diverged: 'diverged',
    };

    return {
      state: stateMap[data.status] ?? 'unknown',
      behindBy: data.behind_by ?? 0,
      aheadBy: data.ahead_by ?? 0,
      upstreamBranch,
    };
  } catch {
    return unknownStatus;
  }
}

/**
 * Fetches the number of commits made to a repository in the last 7 days.
 * Uses the GitHub commits API `since` parameter for accuracy.
 * Returns 0 on any error.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param token - Optional GitHub personal access token
 */
export async function fetchWeeklyCommitCount(
  owner: string,
  repo: string,
  token?: string
): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10&since=${sevenDaysAgo}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return 0;
    const data = await res.json() as unknown[];
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Fetches commits from a repository since a given date.
 * Uses the GitHub API `since` parameter for accurate date filtering.
 * Returns up to `limit` commits, skipping bots and empty messages.
 * Returns empty array on any error.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param since - Fetch commits after this date
 * @param token - Optional GitHub personal access token
 * @param limit - Max commits to fetch per page (default 30)
 */
export async function fetchCommitsSince(
  owner: string,
  repo: string,
  since: Date,
  token?: string,
  limit = 100
): Promise<CommitSummary[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const all: CommitSummary[] = [];
  let page = 1;

  try {
    while (true) {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}&since=${since.toISOString()}&page=${page}`;
      const res = await fetch(url, { headers });
      if (!res.ok) break;

      const data = await res.json() as Array<{
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
        html_url: string;
      }>;

      if (!Array.isArray(data) || data.length === 0) break;

      for (const item of data) {
        const rawMessage = item.commit?.message ?? '';
        const authorName = item.commit?.author?.name ?? '';
        if (!rawMessage) continue;
        if (authorName.includes('[bot]')) continue;
        if (rawMessage.startsWith('dependabot')) continue;

        let message = rawMessage.split('\n')[0];
        if (message.length > 60) message = message.slice(0, 57) + '...';

        all.push({
          sha: item.sha,
          message,
          date: item.commit?.author?.date ?? '',
          author: authorName,
          url: item.html_url,
        });
      }

      if (data.length < limit) break;
      page++;
    }
    return all;
  } catch {
    return all;
  }
}

/**
 * Fetches the language breakdown for a repository.
 * Returns a map of language name to bytes of code.
 * Returns empty object on any error.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param token - Optional GitHub personal access token
 */
export async function fetchLanguageBreakdown(
  owner: string,
  repo: string,
  token?: string
): Promise<Record<string, number>> {
  const url = `https://api.github.com/repos/${owner}/${repo}/languages`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return {};
    const data = await res.json() as Record<string, number>;
    return data;
  } catch {
    return {};
  }
}

/**
 * Fetches the latest release for a repo.
 * Returns null if no releases exist or on error.
 */
export async function fetchLatestRelease(
  owner: string,
  repo: string,
  token?: string
): Promise<import('@/types/repo').LatestRelease | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const version: string = data.tag_name ?? '';
    const parts = version.replace(/^v/, '').split('.');
    const isMajor = parts.length >= 3 && parts[1] === '0' && parts[2] === '0';
    const isMinor = parts.length >= 3 && parts[2] === '0' && !isMajor;
    return {
      version,
      releasedAt: data.published_at ?? data.created_at ?? new Date().toISOString(),
      url: data.html_url ?? `https://github.com/${owner}/${repo}/releases`,
      isMajor,
      isMinor,
    };
  } catch {
    return null;
  }
}
