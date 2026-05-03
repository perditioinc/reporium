/** @jest-environment jsdom */

/**
 * KAN-185: /trends migration to `/library/preview?include=stats,parent`.
 *
 * Pins the contract that the page no longer fetches `/library/full` on initial
 * load. The previous flow shipped 1.46 MB to mobile every visit. This sits
 * alongside `TrendsPage.staleness.test.tsx` (which still uses raw fetch mocks)
 * because that suite predates the dataProvider migration.
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
    totalRepos: 1,
    limit: 300,
    sort: 'stars',
    category: null,
    repos: [
      {
        id: 't1',
        name: 'busy-bee',
        fullName: 'p/busy-bee',
        description: 'Active recently',
        isFork: false,
        forkedFrom: null,
        language: 'TypeScript',
        stars: 800,
        forks: 30,
        lastUpdated: new Date().toISOString(),
        primaryCategory: 'agents',
        dbCategory: 'agents',
        enrichedTags: ['agents'],
        isArchived: false,
        url: 'https://github.com/p/busy-bee',
        commitStats: { last7Days: 7, last30Days: 25, last90Days: 70 },
        parentStats: {
          owner: 'upstream',
          repo: 'busy-bee',
          stars: 800,
          forks: 30,
          isArchived: false,
          lastCommitDate: new Date().toISOString(),
          description: 'Active recently',
          url: 'https://github.com/upstream/busy-bee',
        },
        upstreamCreatedAt: '2024-06-01T00:00:00Z',
      },
    ],
  };
}

describe('TrendsPage KAN-185 preview migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPreview.mockReset();
  });

  test('fetches /library/preview with include=stats,parent and never /library/full', async () => {
    mockGetPreview.mockResolvedValueOnce(buildPreview());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    const TrendsPage = (await import('@/app/trends/page')).default;
    render(<TrendsPage />);

    await waitFor(() => {
      expect(mockGetPreview).toHaveBeenCalledTimes(1);
    });
    expect(mockGetPreview).toHaveBeenCalledWith(300, {
      include: ['stats', 'parent'],
    });

    const directLibraryFullCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/library/full')
    );
    expect(directLibraryFullCalls).toHaveLength(0);
  });

  test('renders Category Momentum section using commitStats from preview', async () => {
    mockGetPreview.mockResolvedValueOnce(buildPreview());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as any);

    const TrendsPage = (await import('@/app/trends/page')).default;
    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getByText('Category Momentum')).toBeTruthy();
    });
    // The Most Active section also derives from commitStats.last7Days which
    // only exists because `?include=stats` is requested.
    expect(screen.getByText('Most Active This Week')).toBeTruthy();
  });
});
