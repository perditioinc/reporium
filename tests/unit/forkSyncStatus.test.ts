import { fetchForkSyncStatus } from '@/lib/github';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

describe('fetchForkSyncStatus', () => {
  it('maps identical status to up-to-date', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'identical', ahead_by: 0, behind_by: 0 }),
    });
    const result = await fetchForkSyncStatus('user', 'repo', 'upstream', 'main');
    expect(result.state).toBe('up-to-date');
    expect(result.behindBy).toBe(0);
    expect(result.aheadBy).toBe(0);
    expect(result.upstreamBranch).toBe('main');
  });

  it('maps behind status with count', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'behind', ahead_by: 0, behind_by: 134 }),
    });
    const result = await fetchForkSyncStatus('user', 'repo', 'upstream', 'main');
    expect(result.state).toBe('behind');
    expect(result.behindBy).toBe(134);
  });

  it('maps ahead status with count', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ahead', ahead_by: 5, behind_by: 0 }),
    });
    const result = await fetchForkSyncStatus('user', 'repo', 'upstream', 'main');
    expect(result.state).toBe('ahead');
    expect(result.aheadBy).toBe(5);
  });

  it('maps diverged status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'diverged', ahead_by: 3, behind_by: 7 }),
    });
    const result = await fetchForkSyncStatus('user', 'repo', 'upstream', 'main');
    expect(result.state).toBe('diverged');
    expect(result.behindBy).toBe(7);
    expect(result.aheadBy).toBe(3);
  });

  it('returns unknown on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchForkSyncStatus('user', 'repo', 'upstream', 'main');
    expect(result.state).toBe('unknown');
    expect(result.behindBy).toBe(0);
  });

  it('returns unknown on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const result = await fetchForkSyncStatus('user', 'repo', 'upstream', 'main');
    expect(result.state).toBe('unknown');
  });

  it('uses the provided branch in the response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'identical', ahead_by: 0, behind_by: 0 }),
    });
    const result = await fetchForkSyncStatus('user', 'repo', 'upstream', 'master');
    expect(result.upstreamBranch).toBe('master');
  });
});
