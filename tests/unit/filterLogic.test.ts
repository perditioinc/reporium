import { EnrichedRepo } from '@/types/repo';

function makeRepo(overrides: Partial<EnrichedRepo>): EnrichedRepo {
  return {
    id: Math.random(), name: 'repo', fullName: 'user/repo', description: null,
    isFork: false, forkedFrom: null, language: null, topics: [], enrichedTags: [],
    stars: 0, forks: 0, lastUpdated: new Date().toISOString(), url: 'https://github.com/user/repo',
    isArchived: false, readmeSummary: null, parentStats: null, recentCommits: [],
    createdAt: new Date().toISOString(), forkedAt: null, yourLastPushAt: null,
    upstreamLastPushAt: null, upstreamCreatedAt: null, forkSync: null, weeklyCommitCount: 0,
    languageBreakdown: {}, languagePercentages: {}, commitsLast7Days: [], commitsLast30Days: [],
    commitsLast90Days: [], totalCommitsFetched: 0, primaryCategory: '', allCategories: [],
    commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
    latestRelease: null, aiDevSkills: [], pmSkills: [], industries: [], programmingLanguages: [], builders: [],
    ...overrides,
  };
}

describe('filter logic', () => {
  describe('tag filter', () => {
    it('matches exact tag', () => {
      const repo = makeRepo({ enrichedTags: ['Tutorial', 'Python'] });
      expect(repo.enrichedTags.includes('Tutorial')).toBe(true);
    });

    it('does not match partial tag name', () => {
      const repo = makeRepo({ enrichedTags: ['Tutorial', 'Python'] });
      expect(repo.enrichedTags.includes('Robotics')).toBe(false);
    });

    it('tag filter uses strict includes not text search', () => {
      const repo = makeRepo({ name: 'robotics-tutorial', enrichedTags: ['Tutorial', 'Python'] });
      expect(repo.enrichedTags.includes('Robotics')).toBe(false);
      expect(repo.enrichedTags.includes('Tutorial')).toBe(true);
    });
  });

  describe('multi-dimension AND logic', () => {
    function applyFilters(
      repos: EnrichedRepo[],
      filters: { tags?: string[]; builders?: string[]; aiDevSkills?: string[] }
    ): EnrichedRepo[] {
      return repos.filter(repo => {
        if (filters.tags?.length) {
          if (!filters.tags.every(t => repo.enrichedTags.includes(t))) return false;
        }
        if (filters.builders?.length) {
          if (!(repo.builders ?? []).some(b => filters.builders!.includes(b.login))) return false;
        }
        if (filters.aiDevSkills?.length) {
          if (!filters.aiDevSkills.every(s => (repo.aiDevSkills ?? []).includes(s))) return false;
        }
        return true;
      });
    }

    it('AND logic — both conditions must match', () => {
      const repos = [
        makeRepo({ enrichedTags: ['RAG'], builders: [{ login: 'google', name: 'Google', type: 'organization', avatarUrl: '', isKnownOrg: true, orgCategory: 'big-tech' }] }),
        makeRepo({ enrichedTags: ['RAG'], builders: [{ login: 'microsoft', name: 'Microsoft', type: 'organization', avatarUrl: '', isKnownOrg: true, orgCategory: 'big-tech' }] }),
      ];
      const filtered = applyFilters(repos, { tags: ['RAG'], builders: ['google'] });
      expect(filtered).toHaveLength(1);
    });

    it('no filters returns all repos', () => {
      const repos = [makeRepo({}), makeRepo({}), makeRepo({})];
      expect(applyFilters(repos, {})).toHaveLength(3);
    });
  });
});
