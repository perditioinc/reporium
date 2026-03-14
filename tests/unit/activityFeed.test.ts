import { filterFeedEntries } from '@/components/MetricsSidebar';
import { CommitSummary } from '@/types/repo';

function makeCommit(date: string, overrides: Partial<CommitSummary> = {}): CommitSummary {
  return {
    sha: `sha-${date}`,
    message: 'test commit',
    date,
    author: 'Alice',
    url: `https://github.com/owner/repo/commit/sha-${date}`,
    ...overrides,
  };
}

const makeEntry = (repoName: string, date: string) => ({
  repoName,
  commit: makeCommit(date),
});

describe('filterFeedEntries', () => {
  const now = new Date('2026-03-12T12:00:00Z').getTime();

  it('filters commits within the given date range', () => {
    const entries = [
      makeEntry('repo-a', '2026-03-10T00:00:00Z'), // 2 days ago
      makeEntry('repo-b', '2026-02-10T00:00:00Z'), // ~30 days ago
      makeEntry('repo-c', '2025-01-01T00:00:00Z'), // way old
    ];

    const sevenDaysAgo = now - 7 * 86400000;
    const result = filterFeedEntries(entries, sevenDaysAgo, now);

    expect(result).toHaveLength(1);
    expect(result[0].repoName).toBe('repo-a');
  });

  it('returns entries sorted by most recent first', () => {
    const entries = [
      makeEntry('repo-a', '2026-03-08T00:00:00Z'), // older
      makeEntry('repo-b', '2026-03-11T00:00:00Z'), // most recent
      makeEntry('repo-c', '2026-03-09T00:00:00Z'), // middle
    ];

    const thirtyDaysAgo = now - 30 * 86400000;
    const result = filterFeedEntries(entries, thirtyDaysAgo, now);

    expect(result).toHaveLength(3);
    expect(result[0].repoName).toBe('repo-b');
    expect(result[1].repoName).toBe('repo-c');
    expect(result[2].repoName).toBe('repo-a');
  });

  it('excludes repos with no commits in range', () => {
    const entries = [
      makeEntry('repo-a', '2025-01-01T00:00:00Z'), // very old
      makeEntry('repo-b', '2025-06-01T00:00:00Z'), // also old
    ];

    const sevenDaysAgo = now - 7 * 86400000;
    const result = filterFeedEntries(entries, sevenDaysAgo, now);

    expect(result).toHaveLength(0);
  });

  it('returns empty array when no entries provided', () => {
    const result = filterFeedEntries([], now - 86400000, now);
    expect(result).toEqual([]);
  });

  it('includes commits at exactly the boundary (inclusive)', () => {
    const fromMs = now - 7 * 86400000;
    const entries = [
      makeEntry('repo-a', new Date(fromMs).toISOString()), // exactly at boundary
    ];

    const result = filterFeedEntries(entries, fromMs, now);
    expect(result).toHaveLength(1);
  });

  it('handles multiple repos with commits, returning all in range sorted desc', () => {
    const entries = [
      makeEntry('repo-a', '2026-03-11T00:00:00Z'),
      makeEntry('repo-a', '2026-03-10T00:00:00Z'),
      makeEntry('repo-b', '2026-03-09T00:00:00Z'),
      makeEntry('repo-b', '2025-01-01T00:00:00Z'), // out of range
    ];

    const thirtyDaysAgo = now - 30 * 86400000;
    const result = filterFeedEntries(entries, thirtyDaysAgo, now);

    expect(result).toHaveLength(3);
    expect(result[0].commit.date).toBe('2026-03-11T00:00:00Z');
    expect(result[1].commit.date).toBe('2026-03-10T00:00:00Z');
    expect(result[2].commit.date).toBe('2026-03-09T00:00:00Z');
  });
});
