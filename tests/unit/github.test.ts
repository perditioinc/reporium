import { mapGitHubRepo, fetchParentRepoStats, ForkInfo } from '@/lib/github';

/** Minimal shape matching the internal GitHubRepo interface used by mapGitHubRepo */
interface RawGitHubRepo {
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

describe('mapGitHubRepo', () => {
  const rawRepo: RawGitHubRepo = {
    id: 123,
    name: 'test-repo',
    full_name: 'user/test-repo',
    description: 'A test repo',
    fork: false,
    parent: undefined,
    language: 'TypeScript',
    topics: ['nextjs', 'react'],
    stargazers_count: 42,
    forks_count: 7,
    updated_at: '2024-01-01T00:00:00Z',
    created_at: '2023-01-01T00:00:00Z',
    pushed_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/user/test-repo',
    archived: false,
  };

  it('maps all required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = mapGitHubRepo(rawRepo as any);
    expect(mapped.id).toBe(123);
    expect(mapped.name).toBe('test-repo');
    expect(mapped.fullName).toBe('user/test-repo');
    expect(mapped.isFork).toBe(false);
    expect(mapped.forkedFrom).toBeNull();
    expect(mapped.language).toBe('TypeScript');
    expect(mapped.topics).toEqual(['nextjs', 'react']);
    expect(mapped.stars).toBe(42);
    expect(mapped.forks).toBe(7);
    expect(mapped.url).toBe('https://github.com/user/test-repo');
    expect(mapped.isArchived).toBe(false);
  });

  it('sets forkedFrom from forkInfoMap (list endpoint omits parent object)', () => {
    const forkedRepo: RawGitHubRepo = { ...rawRepo, fork: true };
    const forkInfoMap = new Map<string, ForkInfo>([
      ['user/test-repo', { language: 'TypeScript', parentFullName: 'original/repo', parentStats: null, upstreamCreatedAt: null, upstreamLastPushAt: null, upstreamDefaultBranch: null }],
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = mapGitHubRepo(forkedRepo as any, forkInfoMap);
    expect(mapped.isFork).toBe(true);
    expect(mapped.forkedFrom).toBe('original/repo');
  });

  it('response shape matches TypeScript types (all required fields present)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = mapGitHubRepo(rawRepo as any);
    expect(mapped).toHaveProperty('id');
    expect(mapped).toHaveProperty('name');
    expect(mapped).toHaveProperty('fullName');
    expect(mapped).toHaveProperty('description');
    expect(mapped).toHaveProperty('isFork');
    expect(mapped).toHaveProperty('forkedFrom');
    expect(mapped).toHaveProperty('language');
    expect(mapped).toHaveProperty('topics');
    expect(mapped).toHaveProperty('stars');
    expect(mapped).toHaveProperty('forks');
    expect(mapped).toHaveProperty('lastUpdated');
    expect(mapped).toHaveProperty('url');
    expect(mapped).toHaveProperty('isArchived');
  });
});

describe('fetchParentRepoStats', () => {
  const mockResponse = {
    stargazers_count: 5000,
    forks_count: 300,
    open_issues_count: 42,
    pushed_at: '2024-06-01T12:00:00Z',
    archived: false,
    description: 'A test library',
    html_url: 'https://github.com/owner/repo',
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('parses owner and repo correctly from forkedFrom string', async () => {
    await fetchParentRepoStats('some-owner/some-repo');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/some-owner/some-repo',
      expect.any(Object)
    );
  });

  it('returns correct ParentRepoStats shape', async () => {
    const result = await fetchParentRepoStats('owner/repo');
    expect(result).not.toBeNull();
    expect(result!.owner).toBe('owner');
    expect(result!.repo).toBe('repo');
    expect(result!.stars).toBe(5000);
    expect(result!.forks).toBe(300);
    expect(result!.openIssues).toBe(42);
    expect(result!.isArchived).toBe(false);
    expect(result!.description).toBe('A test library');
    expect(result!.lastCommitDate).toBe('2024-06-01T12:00:00Z');
  });

  it('returns null for malformed forkedFrom with no slash', async () => {
    const result = await fetchParentRepoStats('noslash');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null for forkedFrom with leading slash', async () => {
    const result = await fetchParentRepoStats('/repo');
    expect(result).toBeNull();
  });

  it('returns null when fetch returns non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);
    const result = await fetchParentRepoStats('owner/repo');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const result = await fetchParentRepoStats('owner/repo');
    expect(result).toBeNull();
  });

  it('sends Authorization header when token provided', async () => {
    await fetchParentRepoStats('owner/repo', 'mytoken');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mytoken' }),
      })
    );
  });
});
