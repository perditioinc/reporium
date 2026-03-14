import { buildIntersectionMetrics } from '@/lib/buildTagMetrics';
import { EnrichedRepo } from '@/types/repo';

const now = new Date().toISOString();
const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10d
const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();   // 200d

function makeRepo(overrides: Partial<EnrichedRepo>): EnrichedRepo {
  return {
    id: Math.random(),
    name: 'repo',
    fullName: 'user/repo',
    description: null,
    isFork: false,
    forkedFrom: null,
    language: 'Python',
    topics: [],
    enrichedTags: [],
    stars: 0,
    forks: 0,
    lastUpdated: now,
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

describe('buildIntersectionMetrics', () => {
  it('returns all repos when no tags selected', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents'] }),
      makeRepo({ name: 'b', enrichedTags: ['Python'] }),
    ];
    const result = buildIntersectionMetrics([], repos);
    expect(result.repoCount).toBe(2);
    expect(result.matchingRepos).toHaveLength(2);
  });

  it('returns only repos with ALL selected tags', () => {
    const repos = [
      makeRepo({ name: 'all', enrichedTags: ['AI Agents', 'RAG', 'Python'] }),
      makeRepo({ name: 'partial', enrichedTags: ['AI Agents', 'Python'] }),
      makeRepo({ name: 'none', enrichedTags: ['TypeScript'] }),
    ];
    const result = buildIntersectionMetrics(['AI Agents', 'RAG'], repos);
    expect(result.repoCount).toBe(1);
    expect(result.matchingRepos[0].name).toBe('all');
  });

  it('returns empty when no repos match all tags', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents'] }),
      makeRepo({ name: 'b', enrichedTags: ['RAG'] }),
    ];
    const result = buildIntersectionMetrics(['AI Agents', 'RAG'], repos);
    expect(result.repoCount).toBe(0);
    expect(result.matchingRepos).toHaveLength(0);
  });

  it('calculates percentage correctly', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents', 'RAG'] }),
      makeRepo({ name: 'b', enrichedTags: ['AI Agents', 'RAG'] }),
      makeRepo({ name: 'c', enrichedTags: ['Python'] }),
      makeRepo({ name: 'd', enrichedTags: ['Python'] }),
    ];
    const result = buildIntersectionMetrics(['AI Agents', 'RAG'], repos);
    expect(result.percentage).toBe(50);
  });

  it('computes suggested tags excluding selected tags and system tags', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents', 'RAG', 'Python', 'Active', 'Forked'] }),
      makeRepo({ name: 'b', enrichedTags: ['AI Agents', 'RAG', 'TypeScript'] }),
    ];
    const result = buildIntersectionMetrics(['AI Agents', 'RAG'], repos);
    // Python appears once, TypeScript once — both should be suggested
    expect(result.suggestedTags).toContain('Python');
    expect(result.suggestedTags).toContain('TypeScript');
    // System tags must be excluded
    expect(result.suggestedTags).not.toContain('Active');
    expect(result.suggestedTags).not.toContain('Forked');
    // Selected tags must not appear as suggestions
    expect(result.suggestedTags).not.toContain('AI Agents');
    expect(result.suggestedTags).not.toContain('RAG');
  });

  it('limits suggested tags to 5', () => {
    const tags = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['Base', ...tags] }),
    ];
    const result = buildIntersectionMetrics(['Base'], repos);
    expect(result.suggestedTags.length).toBeLessThanOrEqual(5);
  });

  it('calculates avg parent stars from repos with parentStats', () => {
    const repos = [
      makeRepo({
        name: 'a',
        enrichedTags: ['AI Agents'],
        isFork: true,
        parentStats: { owner: 'o', repo: 'r', stars: 1000, forks: 10, openIssues: 0, lastCommitDate: now, isArchived: false, description: null, url: 'https://github.com/o/r' },
      }),
      makeRepo({
        name: 'b',
        enrichedTags: ['AI Agents'],
        isFork: true,
        parentStats: { owner: 'o', repo: 'r2', stars: 3000, forks: 20, openIssues: 0, lastCommitDate: now, isArchived: false, description: null, url: 'https://github.com/o/r2' },
      }),
      makeRepo({ name: 'c', enrichedTags: ['AI Agents'], parentStats: null }),
    ];
    const result = buildIntersectionMetrics(['AI Agents'], repos);
    expect(result.avgParentStars).toBe(2000); // (1000 + 3000) / 2
  });

  it('returns null for mostStarredRepo when no parentStats present', () => {
    const repos = [makeRepo({ name: 'a', enrichedTags: ['T'], parentStats: null })];
    const result = buildIntersectionMetrics(['T'], repos);
    expect(result.mostStarredRepo).toBeNull();
  });

  it('identifies the most starred repo correctly', () => {
    const repos = [
      makeRepo({
        name: 'small',
        enrichedTags: ['AI Agents'],
        parentStats: { owner: 'o', repo: 'r', stars: 100, forks: 0, openIssues: 0, lastCommitDate: now, isArchived: false, description: null, url: 'u' },
      }),
      makeRepo({
        name: 'big',
        enrichedTags: ['AI Agents'],
        parentStats: { owner: 'o', repo: 'r2', stars: 50000, forks: 0, openIssues: 0, lastCommitDate: now, isArchived: false, description: null, url: 'u' },
      }),
    ];
    const result = buildIntersectionMetrics(['AI Agents'], repos);
    expect(result.mostStarredRepo).toBe('big');
  });

  it('calculates activity score correctly', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['T'], lastUpdated: recent }), // 3pts
      makeRepo({ name: 'b', enrichedTags: ['T'], lastUpdated: old }),    // 0pts
    ];
    const result = buildIntersectionMetrics(['T'], repos);
    // 3 pts / max 6 pts = 50
    expect(result.activityScore).toBe(50);
    expect(result.updatedLast30Days).toBe(1);
  });

  it('collects top languages from matching repos', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['T'], language: 'Python' }),
      makeRepo({ name: 'b', enrichedTags: ['T'], language: 'Python' }),
      makeRepo({ name: 'c', enrichedTags: ['T'], language: 'Go' }),
    ];
    const result = buildIntersectionMetrics(['T'], repos);
    expect(result.topLanguages['Python']).toBe(2);
    expect(result.topLanguages['Go']).toBe(1);
  });
});
