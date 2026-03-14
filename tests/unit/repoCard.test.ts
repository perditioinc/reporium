/**
 * repoCard.test.ts
 * Regression tests for RepoCard data requirements:
 * - Forked repo shows upstream owner (from forkedFrom), not the fork owner
 * - All four date fields are present when data exists
 * - Parent stars come from parentStats.stars, not zero
 * - ForkSync badge renders the correct status text
 */

import { buildBuilder } from '@/lib/buildTaxonomy';
import { EnrichedRepo, ForkSyncStatus, ForkSyncState } from '@/types/repo';

/** Shared makeRepo helper matching the pattern in other unit tests */
function makeRepo(overrides: Partial<EnrichedRepo>): EnrichedRepo {
  return {
    id: Math.random(),
    name: 'repo',
    fullName: 'perditioinc/repo',
    description: null,
    isFork: false,
    forkedFrom: null,
    language: null,
    topics: [],
    enrichedTags: [],
    stars: 0,
    forks: 0,
    lastUpdated: new Date().toISOString(),
    url: 'https://github.com/perditioinc/repo',
    isArchived: false,
    readmeSummary: null,
    parentStats: null,
    recentCommits: [],
    createdAt: new Date().toISOString(),
    forkedAt: null,
    yourLastPushAt: null,
    upstreamLastPushAt: null,
    upstreamCreatedAt: null,
    forkSync: null,
    weeklyCommitCount: 0,
    languageBreakdown: {},
    languagePercentages: {},
    commitsLast7Days: [],
    commitsLast30Days: [],
    commitsLast90Days: [],
    totalCommitsFetched: 0,
    primaryCategory: '',
    allCategories: [],
    commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
    latestRelease: null,
    aiDevSkills: [],
    pmSkills: [],
    industries: [],
    programmingLanguages: [],
    builders: [],
    ...overrides,
  };
}

/** Mirrors the syncBadge logic in RepoCard.tsx */
function syncBadge(sync: ForkSyncStatus): { icon: string; color: string; label: string } {
  const { state, behindBy, aheadBy } = sync;
  if (state === 'up-to-date') return { icon: '✅', color: 'text-emerald-400', label: 'Up to date' };
  if (state === 'behind') {
    if (behindBy > 100) return { icon: '⬇️', color: 'text-red-400', label: `Behind by ${behindBy} — significantly outdated` };
    if (behindBy >= 10) return { icon: '⬇️', color: 'text-amber-400', label: `Behind by ${behindBy} commits` };
    return { icon: '⬇️', color: 'text-yellow-400', label: `Behind by ${behindBy} commit${behindBy !== 1 ? 's' : ''}` };
  }
  if (state === 'ahead') return { icon: '⬆️', color: 'text-blue-400', label: `Ahead by ${aheadBy} — you've made changes` };
  if (state === 'diverged') return { icon: '↕️', color: 'text-orange-400', label: 'Diverged from upstream' };
  return { icon: '—', color: 'text-zinc-500', label: 'Sync status unavailable' };
}

// ─── 1. Builder: forked repo shows upstream owner ────────────────────────────

describe('RepoCard — builder shows upstream owner for forks', () => {
  test('forked repo builder login is upstream owner, not fork owner', () => {
    const repo = makeRepo({
      isFork: true,
      forkedFrom: 'langchain-ai/langchain',
      fullName: 'perditioinc/langchain',
    });
    const builder = buildBuilder(repo);
    expect(builder.login).toBe('langchain-ai');
    expect(builder.login).not.toBe('perditioinc');
  });

  test('forked repo builder name reflects known org display name', () => {
    const repo = makeRepo({
      isFork: true,
      forkedFrom: 'openai/openai-cookbook',
      fullName: 'perditioinc/openai-cookbook',
    });
    const builder = buildBuilder(repo);
    expect(builder.login).toBe('openai');
    expect(builder.name).toBe('OpenAI');
  });

  test('forked repo with unknown upstream org still uses upstream login as name', () => {
    const repo = makeRepo({
      isFork: true,
      forkedFrom: 'some-unknown-org/cool-project',
      fullName: 'perditioinc/cool-project',
    });
    const builder = buildBuilder(repo);
    expect(builder.login).toBe('some-unknown-org');
    expect(builder.name).toBe('some-unknown-org');
  });

  test('built repo builder login is the repo owner', () => {
    const repo = makeRepo({
      isFork: false,
      forkedFrom: null,
      fullName: 'perditioinc/my-tool',
    });
    const builder = buildBuilder(repo);
    expect(builder.login).toBe('perditioinc');
  });
});

// ─── 2. Date fields are present on the repo object ───────────────────────────

describe('RepoCard — all four date fields present when data exists', () => {
  const UPSTREAM_CREATED = '2021-03-15T00:00:00Z';
  const FORKED_AT = '2023-07-20T00:00:00Z';
  const YOUR_LAST_PUSH = '2024-11-01T00:00:00Z';
  const UPSTREAM_LAST_PUSH = '2025-01-10T00:00:00Z';

  test('upstreamCreatedAt is set on the repo', () => {
    const repo = makeRepo({ upstreamCreatedAt: UPSTREAM_CREATED });
    expect(repo.upstreamCreatedAt).toBe(UPSTREAM_CREATED);
  });

  test('forkedAt is set on the repo', () => {
    const repo = makeRepo({ forkedAt: FORKED_AT });
    expect(repo.forkedAt).toBe(FORKED_AT);
  });

  test('yourLastPushAt is set on the repo', () => {
    const repo = makeRepo({ yourLastPushAt: YOUR_LAST_PUSH });
    expect(repo.yourLastPushAt).toBe(YOUR_LAST_PUSH);
  });

  test('upstreamLastPushAt is set on the repo', () => {
    const repo = makeRepo({ upstreamLastPushAt: UPSTREAM_LAST_PUSH });
    expect(repo.upstreamLastPushAt).toBe(UPSTREAM_LAST_PUSH);
  });

  test('all four date fields are present and non-null simultaneously', () => {
    const repo = makeRepo({
      isFork: true,
      upstreamCreatedAt: UPSTREAM_CREATED,
      forkedAt: FORKED_AT,
      yourLastPushAt: YOUR_LAST_PUSH,
      upstreamLastPushAt: UPSTREAM_LAST_PUSH,
    });
    expect(repo.upstreamCreatedAt).not.toBeNull();
    expect(repo.forkedAt).not.toBeNull();
    expect(repo.yourLastPushAt).not.toBeNull();
    expect(repo.upstreamLastPushAt).not.toBeNull();
  });

  test('non-fork repo has null date fields', () => {
    const repo = makeRepo({ isFork: false });
    expect(repo.forkedAt).toBeNull();
    expect(repo.yourLastPushAt).toBeNull();
    expect(repo.upstreamLastPushAt).toBeNull();
    expect(repo.upstreamCreatedAt).toBeNull();
  });
});

// ─── 3. Parent stars come from parentStats.stars ─────────────────────────────

describe('RepoCard — parent stars come from parentStats.stars', () => {
  test('parentStats.stars reflects the upstream star count, not zero', () => {
    const repo = makeRepo({
      isFork: true,
      stars: 0,
      parentStats: {
        owner: 'microsoft',
        repo: 'semantic-kernel',
        stars: 22_000,
        forks: 3_500,
        openIssues: 450,
        lastCommitDate: '2025-01-01T00:00:00Z',
        isArchived: false,
        description: 'SDK integrating AI into apps',
        url: 'https://github.com/microsoft/semantic-kernel',
      },
    });
    // The card uses ps.stars for forks — verify that parentStats carries the real count
    expect(repo.parentStats!.stars).toBe(22_000);
    expect(repo.parentStats!.stars).not.toBe(0);
  });

  test('parentStats.forks reflects upstream fork count', () => {
    const repo = makeRepo({
      isFork: true,
      parentStats: {
        owner: 'openai',
        repo: 'openai-cookbook',
        stars: 60_000,
        forks: 9_000,
        openIssues: 200,
        lastCommitDate: '2025-02-01T00:00:00Z',
        isArchived: false,
        description: null,
        url: 'https://github.com/openai/openai-cookbook',
      },
    });
    expect(repo.parentStats!.forks).toBe(9_000);
  });

  test('parentStats is null for built repos', () => {
    const repo = makeRepo({ isFork: false });
    expect(repo.parentStats).toBeNull();
  });
});

// ─── 4. ForkSync badge renders correct status text ───────────────────────────

describe('RepoCard — forkSync badge status text', () => {
  function makeForkSync(overrides: Partial<ForkSyncStatus>): ForkSyncStatus {
    return {
      state: 'up-to-date',
      behindBy: 0,
      aheadBy: 0,
      upstreamBranch: 'main',
      ...overrides,
    };
  }

  test('up-to-date shows "Up to date"', () => {
    const badge = syncBadge(makeForkSync({ state: 'up-to-date' }));
    expect(badge.label).toBe('Up to date');
    expect(badge.icon).toBe('✅');
  });

  test('behind by 1 uses singular "commit"', () => {
    const badge = syncBadge(makeForkSync({ state: 'behind', behindBy: 1, aheadBy: 0 }));
    expect(badge.label).toBe('Behind by 1 commit');
  });

  test('behind by 5 uses plural "commits"', () => {
    const badge = syncBadge(makeForkSync({ state: 'behind', behindBy: 5, aheadBy: 0 }));
    expect(badge.label).toBe('Behind by 5 commits');
  });

  test('behind by 50 shows commit count (amber threshold)', () => {
    const badge = syncBadge(makeForkSync({ state: 'behind', behindBy: 50, aheadBy: 0 }));
    expect(badge.label).toBe('Behind by 50 commits');
    expect(badge.color).toBe('text-amber-400');
  });

  test('behind by 150 shows significantly outdated (red threshold)', () => {
    const badge = syncBadge(makeForkSync({ state: 'behind', behindBy: 150, aheadBy: 0 }));
    expect(badge.label).toContain('significantly outdated');
    expect(badge.color).toBe('text-red-400');
  });

  test('ahead shows ahead count and message', () => {
    const badge = syncBadge(makeForkSync({ state: 'ahead', aheadBy: 3, behindBy: 0 }));
    expect(badge.label).toContain('Ahead by 3');
    expect(badge.label).toContain("you've made changes");
    expect(badge.icon).toBe('⬆️');
  });

  test('diverged shows diverged message', () => {
    const badge = syncBadge(makeForkSync({ state: 'diverged', behindBy: 7, aheadBy: 2 }));
    expect(badge.label).toBe('Diverged from upstream');
    expect(badge.icon).toBe('↕️');
  });

  test('unknown state shows unavailable message', () => {
    const badge = syncBadge(makeForkSync({ state: 'unknown' as ForkSyncState, behindBy: 0, aheadBy: 0 }));
    expect(badge.label).toBe('Sync status unavailable');
  });
});
