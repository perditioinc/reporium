import { calculateActivityScore } from '@/lib/activityScore';
import { EnrichedRepo } from '@/types/repo';

/** Build a minimal EnrichedRepo with sensible defaults */
function makeRepo(overrides: Partial<EnrichedRepo> = {}): EnrichedRepo {
  return {
    id: 1,
    name: 'test-repo',
    fullName: 'user/test-repo',
    description: null,
    isFork: false,
    forkedFrom: null,
    language: null,
    topics: [],
    enrichedTags: [],
    stars: 0,
    forks: 0,
    lastUpdated: new Date().toISOString(),
    url: 'https://github.com/user/test-repo',
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

describe('calculateActivityScore', () => {
  it('returns base score only when no commits and no parentStats — updated today', () => {
    const repo = makeRepo({ lastUpdated: new Date().toISOString() });
    const score = calculateActivityScore(repo);
    // Updated < 7 days => base 50, no bonuses
    expect(score).toBe(50);
  });

  it('returns 0 score for very old repo with no commits and no parentStats', () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 3);
    const repo = makeRepo({ lastUpdated: oldDate.toISOString() });
    const score = calculateActivityScore(repo);
    // Updated > 365 days => base 0, no bonuses
    expect(score).toBe(0);
  });

  it('adds +30 bonus for recent commit (< 7 days)', () => {
    const recentCommitDate = new Date();
    recentCommitDate.setDate(recentCommitDate.getDate() - 2);

    const repo = makeRepo({
      lastUpdated: new Date().toISOString(), // base 50
      recentCommits: [
        {
          sha: 'abc123',
          message: 'fix: something',
          date: recentCommitDate.toISOString(),
          author: 'user',
          url: 'https://github.com/user/repo/commit/abc123',
        },
      ],
    });
    const score = calculateActivityScore(repo);
    // base 50 + commit bonus 30 = 80
    expect(score).toBe(80);
  });

  it('adds +15 bonus for commit between 7 and 30 days', () => {
    const commitDate = new Date();
    commitDate.setDate(commitDate.getDate() - 15);

    const repo = makeRepo({
      lastUpdated: new Date().toISOString(), // base 50
      recentCommits: [
        {
          sha: 'abc123',
          message: 'feat: something',
          date: commitDate.toISOString(),
          author: 'user',
          url: 'https://github.com/user/repo/commit/abc123',
        },
      ],
    });
    const score = calculateActivityScore(repo);
    // base 50 + commit bonus 15 = 65
    expect(score).toBe(65);
  });

  it('adds +20 bonus for high star count (> 10000)', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200); // base 10 (< 365, > 90)

    const repo = makeRepo({
      lastUpdated: oldDate.toISOString(),
      parentStats: {
        owner: 'owner',
        repo: 'repo',
        stars: 15000,
        forks: 500,
        openIssues: 10,
        lastCommitDate: new Date().toISOString(),
        isArchived: false,
        description: null,
        url: 'https://github.com/owner/repo',
      },
    });
    const score = calculateActivityScore(repo);
    // base 10 + stars bonus 20 = 30
    expect(score).toBe(30);
  });

  it('adds +10 bonus for stars between 1000 and 10000', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200);

    const repo = makeRepo({
      lastUpdated: oldDate.toISOString(),
      parentStats: {
        owner: 'owner',
        repo: 'repo',
        stars: 5000,
        forks: 200,
        openIssues: 5,
        lastCommitDate: new Date().toISOString(),
        isArchived: false,
        description: null,
        url: 'https://github.com/owner/repo',
      },
    });
    const score = calculateActivityScore(repo);
    // base 10 + stars bonus 10 = 20
    expect(score).toBe(20);
  });

  it('applies -50 penalty for archived parent (clamped to 0)', () => {
    const repo = makeRepo({
      lastUpdated: new Date().toISOString(), // base 50
      parentStats: {
        owner: 'owner',
        repo: 'repo',
        stars: 100,
        forks: 5,
        openIssues: 0,
        lastCommitDate: new Date().toISOString(),
        isArchived: true,
        description: null,
        url: 'https://github.com/owner/repo',
      },
    });
    const score = calculateActivityScore(repo);
    // base 50 - archived penalty 50 = 0
    expect(score).toBe(0);
  });

  it('penalty outweighs bonus for archived parent with high stars', () => {
    const repo = makeRepo({
      lastUpdated: new Date().toISOString(), // base 50
      parentStats: {
        owner: 'owner',
        repo: 'repo',
        stars: 15000,
        forks: 1000,
        openIssues: 0,
        lastCommitDate: new Date().toISOString(),
        isArchived: true,
        description: null,
        url: 'https://github.com/owner/repo',
      },
    });
    const score = calculateActivityScore(repo);
    // base 50 + stars 20 - archived 50 = 20
    expect(score).toBe(20);
  });

  it('score is always clamped between 0 and 100', () => {
    // Try to get score above 100: base 50 + recent commit 30 + 10k stars 20 = 100
    const recentCommitDate = new Date();
    recentCommitDate.setDate(recentCommitDate.getDate() - 1);

    const repo = makeRepo({
      lastUpdated: new Date().toISOString(),
      recentCommits: [
        {
          sha: 'abc',
          message: 'test',
          date: recentCommitDate.toISOString(),
          author: 'user',
          url: 'https://github.com/user/repo/commit/abc',
        },
      ],
      parentStats: {
        owner: 'owner',
        repo: 'repo',
        stars: 15000,
        forks: 1000,
        openIssues: 0,
        lastCommitDate: new Date().toISOString(),
        isArchived: false,
        description: null,
        url: 'https://github.com/owner/repo',
      },
    });
    const score = calculateActivityScore(repo);
    // base 50 + commit 30 + stars 20 = 100, clamped to 100
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
