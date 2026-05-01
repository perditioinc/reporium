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
 * The page hits two endpoints in parallel:
 *   GET ${API_URL}/library/full?... -> { generatedAt, repos: [...] }
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
  // The component fires both fetches in parallel via Promise.all and matches by URL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchMock = jest.fn((url: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/library/full')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => library,
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
  beforeEach(() => {
    jest.clearAllMocks();
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
