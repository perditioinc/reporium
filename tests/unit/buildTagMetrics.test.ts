import { buildTagMetrics } from '@/lib/buildTagMetrics';
import { EnrichedRepo } from '@/types/repo';

const now = new Date().toISOString();
const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(); // 200 days ago

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

describe('buildTagMetrics', () => {
  it('returns empty array for empty repos', () => {
    expect(buildTagMetrics([])).toEqual([]);
  });

  it('counts repos per tag correctly', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents', 'Python'] }),
      makeRepo({ name: 'b', enrichedTags: ['AI Agents', 'TypeScript'] }),
      makeRepo({ name: 'c', enrichedTags: ['Python'] }),
    ];
    const metrics = buildTagMetrics(repos);
    const aiAgents = metrics.find((m) => m.tag === 'AI Agents')!;
    const python = metrics.find((m) => m.tag === 'Python')!;
    expect(aiAgents.repoCount).toBe(2);
    expect(python.repoCount).toBe(2);
  });

  it('calculates percentage correctly', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents'] }),
      makeRepo({ name: 'b', enrichedTags: ['AI Agents'] }),
      makeRepo({ name: 'c', enrichedTags: ['Python'] }),
      makeRepo({ name: 'd', enrichedTags: ['Python'] }),
    ];
    const metrics = buildTagMetrics(repos);
    const aiAgents = metrics.find((m) => m.tag === 'AI Agents')!;
    expect(aiAgents.percentage).toBe(50);
  });

  it('calculates language breakdown correctly', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents'], language: 'Python' }),
      makeRepo({ name: 'b', enrichedTags: ['AI Agents'], language: 'Python' }),
      makeRepo({ name: 'c', enrichedTags: ['AI Agents'], language: 'TypeScript' }),
    ];
    const metrics = buildTagMetrics(repos);
    const aiAgents = metrics.find((m) => m.tag === 'AI Agents')!;
    expect(aiAgents.topLanguage).toBe('Python');
    expect(aiAgents.languageBreakdown['Python']).toBe(2);
    expect(aiAgents.languageBreakdown['TypeScript']).toBe(1);
  });

  it('calculates activity score correctly', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['tag'], lastUpdated: recent }), // 3 pts
      makeRepo({ name: 'b', enrichedTags: ['tag'], lastUpdated: old }),     // 0 pts
    ];
    const metrics = buildTagMetrics(repos);
    const tag = metrics.find((m) => m.tag === 'tag')!;
    // 3 pts out of max 6 pts = 50
    expect(tag.activityScore).toBe(50);
    expect(tag.updatedLast30Days).toBe(1);
    expect(tag.olderThan90Days).toBe(1);
  });

  it('calculates related tags excluding system tags', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['AI Agents', 'Python', 'Forked', 'Active'] }),
      makeRepo({ name: 'b', enrichedTags: ['AI Agents', 'Python', 'RAG'] }),
    ];
    const metrics = buildTagMetrics(repos);
    const aiAgents = metrics.find((m) => m.tag === 'AI Agents')!;
    expect(aiAgents.relatedTags).toContain('Python');
    expect(aiAgents.relatedTags).not.toContain('Forked');
    expect(aiAgents.relatedTags).not.toContain('Active');
  });

  it('sorts results by repoCount descending', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['Rare'] }),
      makeRepo({ name: 'b', enrichedTags: ['Common'] }),
      makeRepo({ name: 'c', enrichedTags: ['Common'] }),
      makeRepo({ name: 'd', enrichedTags: ['Common'] }),
    ];
    const metrics = buildTagMetrics(repos);
    expect(metrics[0].tag).toBe('Common');
  });

  it('repos list is sorted by most recently updated', () => {
    const repos = [
      makeRepo({ name: 'old-repo', enrichedTags: ['tag'], lastUpdated: old }),
      makeRepo({ name: 'new-repo', enrichedTags: ['tag'], lastUpdated: recent }),
    ];
    const metrics = buildTagMetrics(repos);
    const tag = metrics.find((m) => m.tag === 'tag')!;
    expect(tag.repos[0]).toBe('new-repo');
    expect(tag.repos[1]).toBe('old-repo');
  });
});
