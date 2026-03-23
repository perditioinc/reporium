import { buildCategories, CATEGORIES } from '@/lib/buildCategories';
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

describe('CATEGORIES constant', () => {
  it('has at least 21 categories', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(21);
  });

  it('each category has required fields', () => {
    for (const cat of CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toBeTruthy();
      expect(cat.description).toBeTruthy();
      expect(Array.isArray(cat.tags)).toBe(true);
      if (cat.id !== 'uncategorized') expect(cat.tags.length).toBeGreaterThan(0);
    }
  });

  it('all category ids are unique', () => {
    const ids = CATEGORIES.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(CATEGORIES.length);
  });
});

describe('buildCategories', () => {
  it('assigns primaryCategory based on tag matches (Foundation Models)', () => {
    const repos = [
      makeRepo({ name: 'llm-app', enrichedTags: ['Large Language Models', 'AI Agents', 'RAG'] }),
    ];
    buildCategories(repos);
    // Large Language Models -> Foundation Models (1 match)
    // AI Agents -> AI Agents (1 match)
    // RAG -> RAG & Retrieval (1 match)
    // Foundation Models is first in CATEGORIES so it wins ties
    expect(['Foundation Models', 'AI Agents', 'RAG & Retrieval']).toContain(repos[0].primaryCategory);
  });

  it('assigns primaryCategory to category with most tag matches', () => {
    const repos = [
      makeRepo({ name: 'llm-app', enrichedTags: ['Large Language Models', 'Transformers', 'HuggingFace', 'Long Context'] }),
    ];
    buildCategories(repos);
    // All 4 tags are in Foundation Models -> clear winner
    expect(repos[0].primaryCategory).toBe('Foundation Models');
  });

  it('assigns primaryCategory for MLOps repo', () => {
    const repos = [
      makeRepo({ name: 'docker-stuff', enrichedTags: ['Docker', 'Kubernetes', 'MLOps'] }),
    ];
    buildCategories(repos);
    // Docker, Kubernetes, MLOps all in MLOps & Infrastructure
    expect(repos[0].primaryCategory).toBe('MLOps & Infrastructure');
  });

  it('returns categories sorted by repoCount descending', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['Large Language Models'] }),
      makeRepo({ name: 'b', enrichedTags: ['Large Language Models'] }),
      makeRepo({ name: 'c', enrichedTags: ['Docker'] }),
    ];
    const categories = buildCategories(repos);
    // Foundation Models has 2 repos, MLOps & Infrastructure has 1
    expect(categories[0].repoCount).toBeGreaterThanOrEqual(categories[1].repoCount);
  });

  it('excludes categories with zero repos', () => {
    const repos = [makeRepo({ enrichedTags: ['Large Language Models'] })];
    const categories = buildCategories(repos);
    expect(categories.every((c) => c.repoCount > 0)).toBe(true);
  });

  it('returns categories from CATEGORIES list', () => {
    const repos = [makeRepo({ enrichedTags: ['Large Language Models'] })];
    const categories = buildCategories(repos);
    expect(categories.length).toBeLessThanOrEqual(CATEGORIES.length);
  });

  it('assigns empty string for repos with no matching category', () => {
    const repos = [makeRepo({ enrichedTags: ['Some Unknown Tag'] })];
    buildCategories(repos);
    expect(repos[0].primaryCategory).toBe('');
  });

  it('returns category with correct shape including id and icon', () => {
    const repos = [makeRepo({ enrichedTags: ['Tutorial'] })];
    const categories = buildCategories(repos);
    const learningCat = categories.find((c) => c.name === 'Learning Resources');
    expect(learningCat).toBeDefined();
    expect(learningCat?.id).toBe('learning-resources');
    expect(learningCat?.icon).toBeDefined();
    expect(learningCat?.color).toBeDefined();
    expect(Array.isArray(learningCat?.tags)).toBe(true);
  });

  it('assigns allCategories with all matching categories', () => {
    const repos = [
      makeRepo({ name: 'ai-rag', enrichedTags: ['Large Language Models', 'RAG', 'Vector Database'] }),
    ];
    buildCategories(repos);
    // Large Language Models -> Foundation Models
    // RAG, Vector Database -> RAG & Retrieval
    expect(repos[0].allCategories).toContain('Foundation Models');
    expect(repos[0].allCategories).toContain('RAG & Retrieval');
  });

  it('allCategories is populated on repos', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['Large Language Models', 'AI Agents'] }),
    ];
    buildCategories(repos);
    expect(Array.isArray(repos[0].allCategories)).toBe(true);
  });

  it('counts repos in allCategories for repoCount', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['Large Language Models', 'RAG'] }),
      makeRepo({ name: 'b', enrichedTags: ['RAG'] }),
    ];
    const categories = buildCategories(repos);
    const ragCat = categories.find(c => c.name === 'RAG & Retrieval');
    expect(ragCat?.repoCount).toBe(2);
  });
});
