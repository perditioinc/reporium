/**
 * Tests for tag filter logic as applied in the main page filteredRepos memo.
 * The filter uses strict enrichedTags.includes() and is independent of text search.
 */

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

/** Replicates the filteredRepos logic from page.tsx */
function filterRepos(
  repos: EnrichedRepo[],
  {
    search = '',
    selectedTags = [] as string[],
  } = {}
): EnrichedRepo[] {
  return repos.filter((repo) => {
    if (search) {
      const q = search.toLowerCase();
      const matchesSearch =
        repo.name.toLowerCase().includes(q) ||
        (repo.description ?? '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (selectedTags.length > 0) {
      const hasAllTags = selectedTags.every((tag) => repo.enrichedTags.includes(tag));
      if (!hasAllTags) return false;
    }
    return true;
  });
}

describe('tag filter — strict enrichedTags.includes()', () => {
  const repos = [
    makeRepo({ name: 'alpha', enrichedTags: ['AI Agents', 'Python'] }),
    makeRepo({ name: 'beta', enrichedTags: ['AI Agents', 'TypeScript'] }),
    makeRepo({ name: 'gamma', enrichedTags: ['Python', 'RAG'] }),
  ];

  it('returns only repos that have the selected tag', () => {
    const result = filterRepos(repos, { selectedTags: ['RAG'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('gamma');
  });

  it('requires ALL selected tags to be present (AND logic)', () => {
    const result = filterRepos(repos, { selectedTags: ['AI Agents', 'Python'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('alpha');
  });

  it('does not perform partial/substring tag matching', () => {
    // 'Python' should not match a tag called 'Python Web Framework'
    const reposWithSimilar = [
      makeRepo({ name: 'a', enrichedTags: ['Python Web Framework'] }),
      makeRepo({ name: 'b', enrichedTags: ['Python'] }),
    ];
    const result = filterRepos(reposWithSimilar, { selectedTags: ['Python'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('b');
  });

  it('returns all repos when no tags are selected', () => {
    const result = filterRepos(repos, { selectedTags: [] });
    expect(result).toHaveLength(repos.length);
  });

  it('returns empty when no repo matches selected tag', () => {
    const result = filterRepos(repos, { selectedTags: ['Game Dev'] });
    expect(result).toHaveLength(0);
  });
});

describe('tag filter — independent from text search', () => {
  const repos = [
    makeRepo({ name: 'agent-orchestrator', description: 'An agent framework', enrichedTags: ['AI Agents'] }),
    makeRepo({ name: 'vector-store', description: 'Stores vectors', enrichedTags: ['RAG'] }),
    makeRepo({ name: 'agent-rag', description: 'Agent with RAG', enrichedTags: ['AI Agents', 'RAG'] }),
  ];

  it('text search does not affect tag filter results', () => {
    // Text search on 'agent' should NOT match repos by tag 'AI Agents'
    const textOnly = filterRepos(repos, { search: 'agent' });
    expect(textOnly.every((r) => r.name.toLowerCase().includes('agent') || (r.description ?? '').toLowerCase().includes('agent'))).toBe(true);
    // Tag filter on RAG should NOT match repos by name containing 'rag'
    const tagOnly = filterRepos(repos, { selectedTags: ['RAG'] });
    expect(tagOnly.every((r) => r.enrichedTags.includes('RAG'))).toBe(true);
  });

  it('combining text search and tag filter works as AND', () => {
    // text: 'agent', tag: 'RAG' → only agent-rag matches both
    const result = filterRepos(repos, { search: 'agent', selectedTags: ['RAG'] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('agent-rag');
  });

  it('text search matches name but not tag names', () => {
    // Searching for 'RAG' as text should NOT return repos just because they have the RAG tag
    const result = filterRepos(repos, { search: 'rag' });
    // only 'agent-rag' has 'rag' in its name
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('agent-rag');
  });

  it('text search matches description but not tag names', () => {
    const result = filterRepos(repos, { search: 'vectors' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('vector-store');
  });
});
