/** @jest-environment jsdom */

/**
 * KAN-DRAFT-trends-staleness-ui: surface staleness on /trends.
 *
 * The /trends page can silently render empty sections for days/weeks when
 * the upstream ingestion freezes (silent-green CI). These tests pin the UX
 * contract:
 *   - render an "as of <relative time>" stamp from the API freshness signal
 *   - render an amber "older than 48h" banner when the data has gone stale
 *
 * Freshness source preference (see implementation):
 *   1. trendData.generatedAt
 *   2. libraryData.generatedAt
 *   3. trendData.period.to
 *
 * The page hits two endpoints in parallel (KAN-185 migration):
 *   provider.getPreview(...)        -> { generatedAt, repos: [...] }
 *   GET ${API_URL}/trends/report    -> { generatedAt, period: {...}, ... }
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { LibraryData, TrendData } from '@/types/repo';

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockLink = ({ children, href }: any) => <a href={href}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

const emptyLibrary = (generatedAt: string): LibraryData => ({
  username: 'perditioinc',
  generatedAt,
  stats: { total: 0, built: 0, forked: 0, languages: [], topTags: [] },
  repos: [],
  tagMetrics: [],
  categories: [],
  gapAnalysis: { generatedAt, gaps: [] },
  builderStats: [],
  aiDevSkillStats: [],
  pmSkillStats: [],
});

const emptyTrends = (generatedAt: string): TrendData => ({
  generatedAt,
  period: { from: '', to: '', snapshots: 0 },
  trending: [],
  emerging: [],
  cooling: [],
  stable: [],
  newReleases: [],
  insights: [],
});

function mockFetchSequence(library: LibraryData, trends: TrendData | null) {
  // KAN-185: /library/full has been replaced with `dataProvider.getPreview()`.
  // The provider still calls `fetch()` internally with /library/preview; we
  // match on either path so the test is resilient to that refactor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchMock = jest.fn((url: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/library/preview') || urlStr.includes('/library/full')) {
      // Translate the LibraryData fixture into a PreviewData-shaped response
      // so dataProvider.getPreview() returns the same `generatedAt` the
      // freshness logic compares against.
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          generatedAt: library.generatedAt,
          totalRepos: library.repos.length,
          limit: 300,
          sort: 'stars',
          category: null,
          repos: [],
        }),
      } as Response);
    }
    if (urlStr.includes('/trends/report')) {
      if (!trends) {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => trends,
      } as Response);
    }
    return Promise.reject(new Error(`unexpected fetch: ${urlStr}`));
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchMock;
  return fetchMock;
}

describe('TrendsPage staleness UI', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // KAN-185: TrendsPage uses createDataProvider() now; we need the API
    // provider so /library/preview is fetched (and intercepted) instead of
    // the JsonDataProvider's /data/library.json fallback.
    process.env = { ...originalEnv, NEXT_PUBLIC_REPORIUM_API_URL: 'https://api.example.com' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('fresh data: renders an "as of" stamp and NO stale banner', async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    mockFetchSequence(emptyLibrary(thirtyMinAgo), emptyTrends(thirtyMinAgo));

    const TrendsPage = (await import('@/app/trends/page')).default;
    render(<TrendsPage />);

    // "as of" stamp present
    await waitFor(() => {
      expect(screen.getByTestId('trends-freshness-stamp')).toBeTruthy();
    });
    expect(screen.getByTestId('trends-freshness-stamp').textContent).toMatch(/as of/i);

    // No amber stale banner
    expect(screen.queryByTestId('trends-stale-banner')).toBeNull();
  });

  test('stale data: renders the "as of" stamp AND an amber 48h+ stale banner', async () => {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    mockFetchSequence(emptyLibrary(seventyTwoHoursAgo), emptyTrends(seventyTwoHoursAgo));

    const TrendsPage = (await import('@/app/trends/page')).default;
    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('trends-freshness-stamp')).toBeTruthy();
    });

    const banner = await screen.findByTestId('trends-stale-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toMatch(/older than 48h/i);
  });
});
