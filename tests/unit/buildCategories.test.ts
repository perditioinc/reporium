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
  it('assigns primaryCategory based on tag matches (Memory Systems)', () => {
    const repos = [
      makeRepo({ name: 'llm-app', enrichedTags: ['transformer', 'agent', 'rag-pipeline'] }),
    ];
    buildCategories(repos);
    // transformer -> Transformer Architecture, Attention Mechanisms, etc. (1 match each)
    // agent -> Agent Frameworks, Multi-Agent Systems, Memory Systems, etc. (1 match each)
    // rag-pipeline -> RAG Pipelines, Memory Systems, Chunking & Embedding (1 match each)
    // Memory Systems has agent + rag-pipeline = 2 matches, which wins
    expect(repos[0].primaryCategory).toBe('Memory Systems');
  });

  it('assigns primaryCategory to category with most tag matches', () => {
    const repos = [
      makeRepo({ name: 'llm-app', enrichedTags: ['transformer', 'llm', 'gpt', 'attention'] }),
    ];
    buildCategories(repos);
    // transformer, llm, gpt, attention -> Transformer Architecture has all 4 tags
    // Attention Mechanisms has transformer, attention, llm (3 matches)
    // Transformer Architecture wins with 4 matches
    expect(repos[0].primaryCategory).toBe('Transformer Architecture');
  });

  it('assigns primaryCategory for MLOps repo', () => {
    const repos = [
      makeRepo({ name: 'ml-pipeline', enrichedTags: ['mlops', 'mlflow', 'dvc'] }),
    ];
    buildCategories(repos);
    // mlops, mlflow, dvc -> multiple MLOps categories match
    // Experiment Tracking has mlflow, wandb, dvc, mlops (3 matches)
    // ML CI/CD has mlops, dvc, mlflow (3 matches)
    // Model Registry has mlflow, mlops, dvc (3 matches)
    // Cost & Latency Monitoring has mlflow, wandb, mlops (2 matches)
    // First category in CATEGORIES list with 3 matches wins the tie
    expect(repos[0].primaryCategory).toMatch(/Experiment Tracking|ML CI\/CD|Model Registry/);
  });

  it('returns categories sorted by repoCount descending', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['transformer'] }),
      makeRepo({ name: 'b', enrichedTags: ['transformer'] }),
      makeRepo({ name: 'c', enrichedTags: ['mlops'] }),
    ];
    const categories = buildCategories(repos);
    // Transformer Architecture has 2 repos, mlops-related categories have 1
    expect(categories[0].repoCount).toBeGreaterThanOrEqual(categories[1].repoCount);
  });

  it('excludes categories with zero repos', () => {
    const repos = [makeRepo({ enrichedTags: ['transformer'] })];
    const categories = buildCategories(repos);
    expect(categories.every((c) => c.repoCount > 0)).toBe(true);
  });

  it('returns categories from CATEGORIES list', () => {
    const repos = [makeRepo({ enrichedTags: ['transformer'] })];
    const categories = buildCategories(repos);
    expect(categories.length).toBeLessThanOrEqual(CATEGORIES.length);
  });

  it('assigns empty string for repos with no matching category', () => {
    const repos = [makeRepo({ enrichedTags: ['python', 'api'] })];
    buildCategories(repos);
    expect(repos[0].primaryCategory).toBe('');
  });

  it('returns category with correct shape including id and icon', () => {
    const repos = [makeRepo({ enrichedTags: ['evals'] })];
    const categories = buildCategories(repos);
    const evalCat = categories.find((c) => c.name === 'Eval Frameworks');
    expect(evalCat).toBeDefined();
    expect(evalCat?.id).toBe('eval-frameworks');
    expect(evalCat?.icon).toBeDefined();
    expect(evalCat?.color).toBeDefined();
    expect(Array.isArray(evalCat?.tags)).toBe(true);
  });

  it('assigns allCategories with all matching categories', () => {
    const repos = [
      makeRepo({ name: 'ai-rag', enrichedTags: ['llm', 'rag-pipeline', 'vector-search'] }),
    ];
    buildCategories(repos);
    // llm -> Transformer Architecture (and others)
    // rag-pipeline, vector-search -> RAG Pipelines
    // vector-search -> Vector Databases
    expect(repos[0].allCategories).toContain('Transformer Architecture');
    expect(repos[0].allCategories).toContain('RAG Pipelines');
  });

  it('allCategories is populated on repos', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['llm', 'agent'] }),
    ];
    buildCategories(repos);
    expect(Array.isArray(repos[0].allCategories)).toBe(true);
  });

  it('counts repos in allCategories for repoCount', () => {
    const repos = [
      makeRepo({ name: 'a', enrichedTags: ['llm', 'rag-pipeline'] }),
      makeRepo({ name: 'b', enrichedTags: ['rag-pipeline'] }),
    ];
    const categories = buildCategories(repos);
    const ragCat = categories.find(c => c.name === 'RAG Pipelines');
    expect(ragCat?.repoCount).toBe(2);
  });
});
