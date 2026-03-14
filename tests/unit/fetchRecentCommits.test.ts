import { fetchRecentCommits } from '@/lib/github';

const makeCommit = (overrides: {
  sha?: string;
  message?: string;
  authorName?: string;
  date?: string;
  html_url?: string;
} = {}) => ({
  sha: overrides.sha ?? 'abc123',
  commit: {
    message: overrides.message ?? 'feat: add feature',
    author: {
      name: overrides.authorName ?? 'Alice',
      date: overrides.date ?? '2024-01-01T00:00:00Z',
    },
  },
  html_url: overrides.html_url ?? 'https://github.com/owner/repo/commit/abc123',
});

describe('fetchRecentCommits', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns correct CommitSummary shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        makeCommit({ sha: 'sha1', message: 'fix: bug\n\nDetails here', authorName: 'Alice', date: '2024-06-01T00:00:00Z' }),
      ],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe('sha1');
    expect(result[0].message).toBe('fix: bug'); // first line only
    expect(result[0].author).toBe('Alice');
    expect(result[0].date).toBe('2024-06-01T00:00:00Z');
    expect(result[0].url).toBe('https://github.com/owner/repo/commit/abc123');
  });

  it('returns at most 3 commits even if more are provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        makeCommit({ sha: 'sha1', message: 'commit 1' }),
        makeCommit({ sha: 'sha2', message: 'commit 2' }),
        makeCommit({ sha: 'sha3', message: 'commit 3' }),
        makeCommit({ sha: 'sha4', message: 'commit 4' }),
        makeCommit({ sha: 'sha5', message: 'commit 5' }),
      ],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toHaveLength(3);
  });

  it('skips commits where author name contains [bot]', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        makeCommit({ sha: 'bot1', message: 'chore: update deps', authorName: 'github-actions[bot]' }),
        makeCommit({ sha: 'human1', message: 'feat: real feature', authorName: 'Alice' }),
      ],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe('human1');
  });

  it('skips commits where message starts with dependabot', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        makeCommit({ sha: 'dep1', message: 'dependabot: bump package from 1.0 to 2.0', authorName: 'Alice' }),
        makeCommit({ sha: 'human1', message: 'feat: real feature', authorName: 'Alice' }),
      ],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe('human1');
  });

  it('skips commits with empty messages', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        makeCommit({ sha: 'empty1', message: '', authorName: 'Alice' }),
        makeCommit({ sha: 'real1', message: 'feat: valid', authorName: 'Alice' }),
      ],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe('real1');
  });

  it('truncates messages longer than 60 characters', async () => {
    const longMessage = 'a'.repeat(70);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [makeCommit({ message: longMessage })],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toHaveLength(1);
    expect(result[0].message).toHaveLength(60);
    expect(result[0].message.endsWith('...')).toBe(true);
  });

  it('does not truncate messages of exactly 60 characters', async () => {
    const exactMessage = 'b'.repeat(60);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [makeCommit({ message: exactMessage })],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result[0].message).toBe(exactMessage);
    expect(result[0].message).toHaveLength(60);
  });

  it('returns [] on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toEqual([]);
  });

  it('returns [] on fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result).toEqual([]);
  });

  it('calls the correct GitHub API URL with the limit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    await fetchRecentCommits('myowner', 'myrepo', undefined, 10);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/myowner/myrepo/commits?per_page=10',
      expect.any(Object)
    );
  });

  it('sends Authorization header when token provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    await fetchRecentCommits('owner', 'repo', 'mytoken');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mytoken' }),
      })
    );
  });

  it('takes only the first line of multi-line commit messages', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        makeCommit({ message: 'feat: add feature\n\nThis is a longer description\nthat spans multiple lines.' }),
      ],
    } as unknown as Response);

    const result = await fetchRecentCommits('owner', 'repo');
    expect(result[0].message).toBe('feat: add feature');
  });
});
