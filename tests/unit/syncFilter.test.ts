import { EnrichedRepo } from '@/types/repo';

function makeRepo(overrides: Partial<EnrichedRepo>): EnrichedRepo {
  return {
    id: Math.random(),
    name: 'repo',
    fullName: 'user/repo',
    description: null,
    isFork: false,
    forkedFrom: null,
    language: null,
    topics: [],
    enrichedTags: [],
    stars: 0,
    forks: 0,
    lastUpdated: new Date().toISOString(),
    url: 'https://github.com/user/repo',
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

function filterBySyncStatus(
  repos: EnrichedRepo[],
  syncStatus: 'all' | 'up-to-date' | 'behind' | 'behind-100' | 'ahead' | 'diverged'
): EnrichedRepo[] {
  return repos.filter((repo) => {
    if (syncStatus === 'all') return true;
    if (!repo.forkSync) return false;
    if (syncStatus === 'up-to-date') return repo.forkSync.state === 'up-to-date';
    if (syncStatus === 'behind') return repo.forkSync.state === 'behind';
    if (syncStatus === 'behind-100') return repo.forkSync.state === 'behind' && repo.forkSync.behindBy > 100;
    if (syncStatus === 'ahead') return repo.forkSync.state === 'ahead';
    if (syncStatus === 'diverged') return repo.forkSync.state === 'diverged';
    return true;
  });
}

function sortByBehindBy(repos: EnrichedRepo[]): EnrichedRepo[] {
  return [...repos].sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0));
}

describe('sync status filter', () => {
  const repos = [
    makeRepo({ name: 'current', isFork: true, forkSync: { state: 'up-to-date', behindBy: 0, aheadBy: 0, upstreamBranch: 'main' } }),
    makeRepo({ name: 'slightly-behind', isFork: true, forkSync: { state: 'behind', behindBy: 5, aheadBy: 0, upstreamBranch: 'main' } }),
    makeRepo({ name: 'very-behind', isFork: true, forkSync: { state: 'behind', behindBy: 200, aheadBy: 0, upstreamBranch: 'main' } }),
    makeRepo({ name: 'ahead', isFork: true, forkSync: { state: 'ahead', behindBy: 0, aheadBy: 3, upstreamBranch: 'main' } }),
    makeRepo({ name: 'diverged', isFork: true, forkSync: { state: 'diverged', behindBy: 2, aheadBy: 1, upstreamBranch: 'main' } }),
    makeRepo({ name: 'built', isFork: false, forkSync: null }),
  ];

  it('all returns every repo', () => {
    expect(filterBySyncStatus(repos, 'all')).toHaveLength(repos.length);
  });

  it('up-to-date returns only current repos', () => {
    const result = filterBySyncStatus(repos, 'up-to-date');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('current');
  });

  it('behind returns repos behind (any)', () => {
    const result = filterBySyncStatus(repos, 'behind');
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.forkSync?.state === 'behind')).toBe(true);
  });

  it('behind-100 returns only repos behind by more than 100', () => {
    const result = filterBySyncStatus(repos, 'behind-100');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('very-behind');
  });

  it('ahead returns only repos where user made changes', () => {
    const result = filterBySyncStatus(repos, 'ahead');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ahead');
  });

  it('diverged returns only diverged repos', () => {
    const result = filterBySyncStatus(repos, 'diverged');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('diverged');
  });

  it('filters out repos with null forkSync for any non-all filter', () => {
    const result = filterBySyncStatus(repos, 'up-to-date');
    expect(result.every((r) => r.forkSync !== null)).toBe(true);
  });
});

describe('sort by most outdated', () => {
  it('sorts repos by behindBy descending', () => {
    const repos = [
      makeRepo({ name: 'a', forkSync: { state: 'behind', behindBy: 10, aheadBy: 0, upstreamBranch: 'main' } }),
      makeRepo({ name: 'b', forkSync: { state: 'behind', behindBy: 847, aheadBy: 0, upstreamBranch: 'main' } }),
      makeRepo({ name: 'c', forkSync: { state: 'behind', behindBy: 234, aheadBy: 0, upstreamBranch: 'main' } }),
    ];
    const sorted = sortByBehindBy(repos);
    expect(sorted[0].name).toBe('b');
    expect(sorted[1].name).toBe('c');
    expect(sorted[2].name).toBe('a');
  });
});
