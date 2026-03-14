import { mapGitHubRepo } from '@/lib/github';
import type { ForkInfo } from '@/lib/github';

// Minimal raw repo shape for mapGitHubRepo tests
function makeRaw(overrides: Record<string, unknown> = {}): Parameters<typeof mapGitHubRepo>[0] {
  return {
    id: 1,
    name: 'repo',
    full_name: 'user/repo',
    description: null,
    fork: false,
    language: 'TypeScript',
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2024-01-01T00:00:00Z',
    created_at: '2023-01-01T00:00:00Z',
    pushed_at: '2024-06-01T00:00:00Z',
    html_url: 'https://github.com/user/repo',
    archived: false,
    ...overrides,
  } as Parameters<typeof mapGitHubRepo>[0];
}

describe('mapGitHubRepo — date metadata', () => {
  it('sets createdAt to created_at for built repos', () => {
    const result = mapGitHubRepo(makeRaw());
    expect(result.createdAt).toBe('2023-01-01T00:00:00Z');
  });

  it('sets forkedAt to null for built repos', () => {
    const result = mapGitHubRepo(makeRaw());
    expect(result.forkedAt).toBeNull();
  });

  it('sets yourLastPushAt to null for built repos', () => {
    const result = mapGitHubRepo(makeRaw());
    expect(result.yourLastPushAt).toBeNull();
  });

  it('sets forkedAt to created_at for forks', () => {
    const forkInfoMap = new Map<string, ForkInfo>([
      ['user/repo', {
        language: 'Python',
        parentFullName: 'upstream/repo',
        parentStats: null,
        upstreamCreatedAt: '2021-06-01T00:00:00Z',
        upstreamLastPushAt: '2024-12-01T00:00:00Z',
        upstreamDefaultBranch: 'main',
      }],
    ]);
    const raw = makeRaw({ fork: true, full_name: 'user/repo' });
    const result = mapGitHubRepo(raw, forkInfoMap);
    expect(result.forkedAt).toBe('2023-01-01T00:00:00Z');
  });

  it('sets yourLastPushAt to pushed_at for forks', () => {
    const forkInfoMap = new Map<string, ForkInfo>([
      ['user/repo', {
        language: 'Python',
        parentFullName: 'upstream/repo',
        parentStats: null,
        upstreamCreatedAt: null,
        upstreamLastPushAt: null,
        upstreamDefaultBranch: null,
      }],
    ]);
    const raw = makeRaw({ fork: true, full_name: 'user/repo' });
    const result = mapGitHubRepo(raw, forkInfoMap);
    expect(result.yourLastPushAt).toBe('2024-06-01T00:00:00Z');
  });

  it('sets createdAt to upstreamCreatedAt for forks when available', () => {
    const forkInfoMap = new Map<string, ForkInfo>([
      ['user/repo', {
        language: 'Python',
        parentFullName: 'upstream/repo',
        parentStats: null,
        upstreamCreatedAt: '2021-06-01T00:00:00Z',
        upstreamLastPushAt: null,
        upstreamDefaultBranch: 'main',
      }],
    ]);
    const raw = makeRaw({ fork: true, full_name: 'user/repo' });
    const result = mapGitHubRepo(raw, forkInfoMap);
    expect(result.createdAt).toBe('2021-06-01T00:00:00Z');
  });

  it('falls back to created_at for createdAt if no upstreamCreatedAt', () => {
    const forkInfoMap = new Map<string, ForkInfo>([
      ['user/repo', {
        language: 'Python',
        parentFullName: 'upstream/repo',
        parentStats: null,
        upstreamCreatedAt: null,
        upstreamLastPushAt: null,
        upstreamDefaultBranch: null,
      }],
    ]);
    const raw = makeRaw({ fork: true, full_name: 'user/repo' });
    const result = mapGitHubRepo(raw, forkInfoMap);
    expect(result.createdAt).toBe('2023-01-01T00:00:00Z');
  });
});

describe('"X mo later" month calculation', () => {
  it('calculates months correctly', () => {
    // Jan 2021 to Nov 2024 = 1401 days / 30 ≈ 46.7 → rounds to 47
    const from = '2021-01-01T00:00:00Z';
    const to = '2024-11-01T00:00:00Z';
    const diffMs = new Date(to).getTime() - new Date(from).getTime();
    const months = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
    expect(months).toBe(47);
  });

  it('returns 0 for same date', () => {
    const d = '2023-01-01T00:00:00Z';
    const diffMs = new Date(d).getTime() - new Date(d).getTime();
    const months = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
    expect(months).toBe(0);
  });
});
