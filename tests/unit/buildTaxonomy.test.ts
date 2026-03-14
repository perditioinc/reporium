import { buildBuilder } from '@/lib/buildTaxonomy';
import { EnrichedRepo } from '@/types/repo';

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

describe('buildBuilder', () => {
  test('forked repo shows upstream owner not fork owner', () => {
    const repo = makeRepo({
      isFork: true,
      forkedFrom: 'microsoft/semantic-kernel',
      fullName: 'perditioinc/semantic-kernel',
    });
    const builder = buildBuilder(repo);
    expect(builder.login).toBe('microsoft');
    expect(builder.login).not.toBe('perditioinc');
  });

  test('built repo shows own owner', () => {
    const repo = makeRepo({
      isFork: false,
      forkedFrom: null,
      fullName: 'perditioinc/my-repo',
    });
    const builder = buildBuilder(repo);
    expect(builder.login).toBe('perditioinc');
  });
});
