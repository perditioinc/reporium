import { mapGitHubRepo } from '@/lib/github';
import { enrichRepo } from '@/lib/enrichRepo';
import { LibraryData, LibraryStats, EnrichedRepo } from '@/types/repo';

/** Minimal shape matching the internal GitHubRepo interface */
interface MockGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  fork: boolean;
  parent?: { full_name: string };
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  created_at: string;
  pushed_at: string;
  html_url: string;
  archived: boolean;
}

const mockGitHubRepos: MockGitHubRepo[] = [
  {
    id: 1,
    name: 'my-python-ml-project',
    full_name: 'testuser/my-python-ml-project',
    description: 'A machine learning project',
    fork: false,
    language: 'Python',
    topics: ['machine-learning', 'pytorch'],
    stargazers_count: 1500,
    forks_count: 200,
    updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    pushed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    html_url: 'https://github.com/testuser/my-python-ml-project',
    archived: false,
  },
  {
    id: 2,
    name: 'forked-react-app',
    full_name: 'testuser/forked-react-app',
    description: 'A forked React app',
    fork: true,
    parent: { full_name: 'original/react-app' },
    language: 'TypeScript',
    topics: ['react', 'nextjs'],
    stargazers_count: 5,
    forks_count: 1,
    updated_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), // 400 days ago
    created_at: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
    pushed_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    html_url: 'https://github.com/testuser/forked-react-app',
    archived: false,
  },
];

describe('Full pipeline: fetch → enrich → format', () => {
  let repos: EnrichedRepo[];

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repos = mockGitHubRepos.map((raw) => enrichRepo(mapGitHubRepo(raw as any)));
  });

  it('produces the correct number of repos', () => {
    expect(repos).toHaveLength(2);
  });

  it('correctly identifies built vs forked repos', () => {
    const built = repos.filter((r) => !r.isFork);
    const forked = repos.filter((r) => r.isFork);
    expect(built).toHaveLength(1);
    expect(forked).toHaveLength(1);
  });

  it('enriches the Python ML repo with correct tags', () => {
    const mlRepo = repos.find((r) => r.name === 'my-python-ml-project')!;
    expect(mlRepo.enrichedTags).toContain('Python');
    expect(mlRepo.enrichedTags).toContain('Backend');
    expect(mlRepo.enrichedTags).toContain('Machine Learning');
    expect(mlRepo.enrichedTags).toContain('Popular');
    expect(mlRepo.enrichedTags).toContain('Active');
    expect(mlRepo.enrichedTags).toContain('Built by Me');
  });

  it('enriches the forked TypeScript repo with correct tags', () => {
    const forkedRepo = repos.find((r) => r.name === 'forked-react-app')!;
    expect(forkedRepo.enrichedTags).toContain('Forked');
    expect(forkedRepo.enrichedTags).toContain('Inactive');
    expect(forkedRepo.enrichedTags).toContain('TypeScript');
    expect(forkedRepo.enrichedTags).toContain('Frontend Framework');
  });

  it('output matches LibraryData interface structure', () => {
    const built = repos.filter((r) => !r.isFork).length;
    const forked = repos.filter((r) => r.isFork).length;

    const stats: LibraryStats = {
      total: repos.length,
      built,
      forked,
      languages: ['Python', 'TypeScript'],
      topTags: [],
    };

    const data: LibraryData = {
      username: 'testuser',
      generatedAt: new Date().toISOString(),
      stats,
      repos,
      tagMetrics: [],
      categories: [],
      gapAnalysis: { generatedAt: new Date().toISOString(), gaps: [] },
      builderStats: [],
      aiDevSkillStats: [],
      pmSkillStats: [],
    };

    expect(data.username).toBe('testuser');
    expect(data.stats.total).toBe(2);
    expect(data.stats.built).toBe(1);
    expect(data.stats.forked).toBe(1);
    expect(data.repos).toHaveLength(2);
    expect(typeof data.generatedAt).toBe('string');
  });

  it('stats calculated correctly', () => {
    const built = repos.filter((r) => !r.isFork).length;
    const forked = repos.filter((r) => r.isFork).length;
    expect(built + forked).toBe(repos.length);
  });
});
