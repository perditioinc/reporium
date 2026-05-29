import { computeTrendSignals, tagActivity } from '@/lib/detectTrends';
import { LibraryData, EnrichedRepo } from '@/types/repo';

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

function makeSnapshot(repos: EnrichedRepo[]): LibraryData {
  return {
    username: 'testuser',
    generatedAt: new Date().toISOString(),
    stats: { total: repos.length, built: 0, forked: 0, languages: [], topTags: [] },
    repos,
    tagMetrics: [],
    categories: [],
    gapAnalysis: { generatedAt: new Date().toISOString(), gaps: [] },
    builderStats: [],
    aiDevSkillStats: [],
    pmSkillStats: [],
  };
}

describe('tagActivity', () => {
  it('returns zero count and empty repos for tags not in snapshot', () => {
    const snapshot = makeSnapshot([makeRepo({ enrichedTags: ['RAG'] })]);
    const result = tagActivity(snapshot, 'NonExistentTag');
    expect(result.count).toBe(0);
    expect(result.repos).toHaveLength(0);
  });

  it('sums commitStats.last7Days for matching repos', () => {
    const snapshot = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 10, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'b', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 5, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'c', enrichedTags: ['LLM'], commitStats: { today: 0, last7Days: 20, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = tagActivity(snapshot, 'RAG');
    expect(result.count).toBe(15);
    expect(result.repos).toContain('a');
    expect(result.repos).toContain('b');
    expect(result.repos).not.toContain('c');
  });

  it('excludes repos with 0 commits from representative repos', () => {
    const snapshot = makeSnapshot([
      makeRepo({ name: 'active', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 5, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'inactive', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = tagActivity(snapshot, 'RAG');
    expect(result.repos).toContain('active');
    expect(result.repos).not.toContain('inactive');
  });

  it('limits representative repos to 3', () => {
    const snapshot = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 1, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'b', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 1, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'c', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 1, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'd', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 1, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = tagActivity(snapshot, 'RAG');
    expect(result.repos.length).toBeLessThanOrEqual(3);
  });
});

describe('computeTrendSignals', () => {
  it('returns all four signal arrays', () => {
    const snap = makeSnapshot([]);
    const result = computeTrendSignals(snap, snap);
    expect(Array.isArray(result.trending)).toBe(true);
    expect(Array.isArray(result.emerging)).toBe(true);
    expect(Array.isArray(result.cooling)).toBe(true);
    expect(Array.isArray(result.stable)).toBe(true);
  });

  it('correctly identifies a trending tag (>50% increase, >5 current activity)', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 20, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 10, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    // 100% increase, 20 current activity > 5 → should be trending
    const ragSignal = result.trending.find(s => s.name === 'RAG');
    expect(ragSignal).toBeDefined();
    expect(ragSignal?.changePercent).toBe(100);
  });

  it('identifies an emerging tag (previous activity below baseline, current > 5)', () => {
    // A tag absent from the previous snapshot (count = 0 < TREND_BASELINE) with
    // activity now. It must land in `emerging` — NOT `trending` — so its
    // meaningless growth-off-zero percent never surfaces as a trend.
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['NewTech'], commitStats: { today: 0, last7Days: 10, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['OtherTag'], commitStats: { today: 0, last7Days: 1, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    const signal = result.emerging.find(s => s.name === 'NewTech');
    expect(signal).toBeDefined();
    expect(signal?.currentActivity).toBe(10);
    expect(result.trending.find(s => s.name === 'NewTech')).toBeUndefined();
  });

  it('identifies a cooling tag (>30% decrease, previous > 5)', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['OldTech'], commitStats: { today: 0, last7Days: 3, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['OldTech'], commitStats: { today: 0, last7Days: 10, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    const signal = result.cooling.find(s => s.name === 'OldTech');
    expect(signal).toBeDefined();
    expect(signal?.changePercent).toBeLessThan(0);
  });

  it('returns empty buckets when the current snapshot has zero total commit activity (frozen commit-stat input)', () => {
    // Regression guard: when commit-stat collection freezes upstream, every
    // repo's last7Days reads 0. Previously this produced a wall of false
    // "-100% cooling" signals (and a public "everything slowed 100%" insight)
    // because cooling only requires previous>5 + a >30% drop. With no current
    // activity at all, there is nothing real to report — emit empty buckets.
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'b', enrichedTags: ['LLM'], commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 40, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'b', enrichedTags: ['LLM'], commitStats: { today: 0, last7Days: 70, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    expect(result.trending).toHaveLength(0);
    expect(result.emerging).toHaveLength(0);
    expect(result.cooling).toHaveLength(0);
    expect(result.stable).toHaveLength(0);
  });

  it('still reports cooling when current activity is present but reduced', () => {
    // Sanity: the zero-activity guard must NOT suppress genuine cooling.
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['OldTech'], commitStats: { today: 0, last7Days: 3, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['OldTech'], commitStats: { today: 0, last7Days: 10, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    expect(result.cooling.find(s => s.name === 'OldTech')).toBeDefined();
  });

  it('routes a near-zero-baseline tag to emerging, not trending with an absurd percent', () => {
    // Post-thaw shape: current snapshot has real activity, previous is ~0.
    // Must NOT explode into trending at +4000%.
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['Postthaw'], commitStats: { today: 0, last7Days: 40, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['OtherTag'], commitStats: { today: 0, last7Days: 8, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    expect(result.trending.find(s => s.name === 'Postthaw')).toBeUndefined();
    const emerging = result.emerging.find(s => s.name === 'Postthaw');
    expect(emerging).toBeDefined();
    expect(emerging!.changePercent).toBeLessThanOrEqual(999);
  });

  it('requires a previous baseline >= 5 to trend (low baseline => emerging)', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['LowBase'], commitStats: { today: 0, last7Days: 50, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['LowBase'], commitStats: { today: 0, last7Days: 4, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    expect(result.trending.find(s => s.name === 'LowBase')).toBeUndefined();
    expect(result.emerging.find(s => s.name === 'LowBase')).toBeDefined();
  });

  it('clamps the displayed changePercent to <= 999 even for a real-baseline explosion', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['Boom'], commitStats: { today: 0, last7Days: 600, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['Boom'], commitStats: { today: 0, last7Days: 5, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    const sig = result.trending.find(s => s.name === 'Boom');
    expect(sig).toBeDefined();           // prev=5 meets baseline -> trends
    expect(sig!.changePercent).toBe(999); // raw ~11900% clamped
  });

  it('still trends a tag with a real baseline and moderate growth', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RealTrend'], commitStats: { today: 0, last7Days: 30, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RealTrend'], commitStats: { today: 0, last7Days: 10, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    const sig = result.trending.find(s => s.name === 'RealTrend');
    expect(sig).toBeDefined();
    expect(sig!.changePercent).toBe(200);
  });

  it('filters out system tags (Forked, Active, etc.)', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['Active', 'Forked'], commitStats: { today: 0, last7Days: 20, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['Active', 'Forked'], commitStats: { today: 0, last7Days: 5, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    const allSignals = [...result.trending, ...result.emerging, ...result.cooling, ...result.stable];
    expect(allSignals.every(s => s.name !== 'Active')).toBe(true);
    expect(allSignals.every(s => s.name !== 'Forked')).toBe(true);
  });

  it('trending signals are sorted by changePercent descending', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['TagA'], commitStats: { today: 0, last7Days: 15, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'b', enrichedTags: ['TagB'], commitStats: { today: 0, last7Days: 30, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['TagA'], commitStats: { today: 0, last7Days: 5, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'b', enrichedTags: ['TagB'], commitStats: { today: 0, last7Days: 5, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    for (let i = 1; i < result.trending.length; i++) {
      expect(result.trending[i].changePercent).toBeLessThanOrEqual(result.trending[i - 1].changePercent);
    }
  });

  it('signals include correct repoCount from current snapshot', () => {
    const current = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 20, last30Days: 0, last90Days: 0, recentCommits: [] } }),
      makeRepo({ name: 'b', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 10, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const previous = makeSnapshot([
      makeRepo({ name: 'a', enrichedTags: ['RAG'], commitStats: { today: 0, last7Days: 5, last30Days: 0, last90Days: 0, recentCommits: [] } }),
    ]);
    const result = computeTrendSignals(current, previous);
    const ragSignal = [...result.trending, ...result.emerging, ...result.cooling, ...result.stable].find(s => s.name === 'RAG');
    if (ragSignal) {
      expect(ragSignal.repoCount).toBe(2);
    }
  });
});
