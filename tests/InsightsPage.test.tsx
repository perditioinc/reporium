/** @jest-environment jsdom */

/**
 * KAN-185: /insights migration to `/library/preview?include=stats,parent,quality`.
 *
 * Pins the contract that the page no longer fetches `/library/full` on initial
 * load. The previous flow shipped 1.46 MB to mobile every visit; this test
 * fails if a future regression re-introduces the heavy endpoint.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { PreviewData } from '@/lib/dataProvider';

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockLink = ({ children, href }: any) => <a href={href}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

const mockGetPreview = jest.fn();

jest.mock('@/lib/dataProvider', () => ({
  createDataProvider: () => ({ mode: 'production', getPreview: mockGetPreview }),
}));

function buildPreview(): PreviewData {
  return {
    generatedAt: new Date().toISOString(),
    totalRepos: 2,
    limit: 300,
    sort: 'stars',
    category: null,
    repos: [
      {
        id: 'r1',
        name: 'rising-star',
        fullName: 'p/rising-star',
        description: 'A rising-fast repo',
        isFork: false,
        forkedFrom: null,
        language: 'Python',
        stars: 5000,
        forks: 100,
        lastUpdated: new Date().toISOString(),
        primaryCategory: 'agents',
        dbCategory: 'agents',
        enrichedTags: ['agents', 'llm'],
        isArchived: false,
        url: 'https://github.com/p/rising-star',
        commitStats: { last7Days: 10, last30Days: 40, last90Days: 100 },
        parentStats: {
          owner: 'upstream',
          repo: 'rising-star',
          stars: 5000,
          forks: 100,
          isArchived: false,
          lastCommitDate: new Date().toISOString(),
          description: 'A rising-fast repo',
          url: 'https://github.com/upstream/rising-star',
        },
        upstreamCreatedAt: '2024-01-01T00:00:00Z',
        qualitySignals: { activity_score: 60, overall_score: 80 },
      },
      {
        id: 'r2',
        name: 'archived-repo',
        fullName: 'p/archived-repo',
        description: 'An archived repo',
        isFork: false,
        forkedFrom: null,
        language: 'Go',
        stars: 200,
        forks: 5,
        lastUpdated: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        primaryCategory: 'orchestration',
        dbCategory: 'orchestration',
        enrichedTags: [],
        isArchived: false,
        url: 'https://github.com/p/archived-repo',
        commitStats: { last7Days: 0, last30Days: 0, last90Days: 0 },
        parentStats: {
          owner: 'upstream',
          repo: 'archived-repo',
          stars: 200,
          forks: 5,
          isArchived: true,
          lastCommitDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'An archived repo',
          url: 'https://github.com/upstream/archived-repo',
        },
        upstreamCreatedAt: '2018-01-01T00:00:00Z',
        qualitySignals: { activity_score: 1, overall_score: 1 },
      },
    ],
  };
}

describe('InsightsPage KAN-185 preview migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPreview.mockReset();
  });

  test('fetches /library/preview with include=stats,parent,quality and never /library/full', async () => {
    mockGetPreview.mockResolvedValueOnce(buildPreview());
    // Trends report fetch is `fetch()` directly; mock it as a 503.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    const InsightsPage = (await import('@/app/insights/page')).default;
    render(<InsightsPage />);

    // Provider was called exactly once with the include= triplet.
    await waitFor(() => {
      expect(mockGetPreview).toHaveBeenCalledTimes(1);
    });
    expect(mockGetPreview).toHaveBeenCalledWith(300, {
      include: ['stats', 'parent', 'quality'],
    });

    // Critically: NO direct fetch to /library/full on initial paint.
    const directLibraryFullCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/library/full')
    );
    expect(directLibraryFullCalls).toHaveLength(0);
  });

  test('renders Rising Fast and Health Alerts sections from preview data alone', async () => {
    mockGetPreview.mockResolvedValueOnce(buildPreview());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as any);

    const InsightsPage = (await import('@/app/insights/page')).default;
    render(<InsightsPage />);

    await waitFor(() => {
      expect(screen.getByText('Rising Fast')).toBeTruthy();
    });
    // Health Alerts should appear because archived-repo has parentStats.isArchived=true
    // (only possible because `?include=parent` lifted the real flag).
    expect(screen.getByText('Health Alerts')).toBeTruthy();
  });
});
