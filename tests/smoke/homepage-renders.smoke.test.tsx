/** @jest-environment jsdom */

// Smoke: the homepage shell renders meaningful content (search affordance +
// stats hero) once the data provider resolves. Guards the "blank page"
// regression class.

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { LibraryData } from '@/types/repo';
import { loadLibraryFixture } from './_fixtures';

var mockProvider: {
  mode: 'production';
  getOwnedLibrary: jest.Mock;
  getPreview: jest.Mock;
  getLibrary: jest.Mock;
  getDegradedState: jest.Mock;
  clearDegradedState: jest.Mock;
  getTrends: jest.Mock;
  getGaps: jest.Mock;
  getRepo: jest.Mock;
  searchRepos: jest.Mock;
  getTaxonomyValues: jest.Mock;
  getPortfolioInsights: jest.Mock;
  getCrossDimensionAnalytics: jest.Mock;
  getSimilarRepos: jest.Mock;
};

jest.mock('@/lib/dataProvider', () => ({
  createDataProvider: () => mockProvider,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Heavy widgets are not the surface under test; the smoke goal is "shell
// renders + stats are visible". Stub them out so the test does not depend on
// graph rendering, framer-motion timing, or three.js.
jest.mock('@/components/HomeGraphWidget', () => ({ HomeGraphWidget: () => <div data-testid="graph-widget-stub" /> }));
jest.mock('@/components/CrossDimensionWidget', () => ({ CrossDimensionWidget: () => null }));
jest.mock('@/components/LibraryInsightsWidget', () => ({ LibraryInsightsWidget: () => null }));
jest.mock('@/components/RecommendationsWidget', () => ({ RecommendationsWidget: () => null }));
jest.mock('@/components/MetricsSidebar', () => ({ MetricsSidebar: () => null }));

mockProvider = {
  mode: 'production',
  getOwnedLibrary: jest.fn(),
  getPreview: jest.fn(),
  getLibrary: jest.fn(),
  getDegradedState: jest.fn(),
  clearDegradedState: jest.fn(),
  getTrends: jest.fn(),
  getGaps: jest.fn(),
  getRepo: jest.fn(),
  searchRepos: jest.fn(),
  getTaxonomyValues: jest.fn(),
  getPortfolioInsights: jest.fn(),
  getCrossDimensionAnalytics: jest.fn(),
  getSimilarRepos: jest.fn(),
};

describe('smoke: homepage renders meaningful content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const real = loadLibraryFixture();
    // Slim down the fixture so the grid does not render thousands of cards
    // — but keep the structure (stats, categories, repos) intact so the
    // hero/widgets have real shapes to render.
    const trimmed: LibraryData = {
      ...real,
      repos: real.repos.slice(0, 5),
      tagMetrics: real.tagMetrics?.slice(0, 5) ?? [],
      categories: real.categories?.slice(0, 5) ?? [],
    };
    mockProvider.getOwnedLibrary.mockResolvedValue(null);
    // KAN-152: preview is now the first-paint payload. Project the trimmed
    // fixture into a minimal PreviewData so the grid renders before any
    // lazy `/library/full` upgrade.
    mockProvider.getPreview.mockResolvedValue({
      generatedAt: trimmed.generatedAt,
      totalRepos: trimmed.repos.length,
      limit: 300,
      sort: 'stars',
      category: null,
      repos: trimmed.repos.map((r) => ({
        id: String(r.id),
        name: r.name,
        fullName: r.fullName,
        description: r.description,
        isFork: r.isFork,
        forkedFrom: r.forkedFrom,
        language: r.language,
        stars: r.parentStats?.stars ?? r.stars ?? 0,
        forks: r.parentStats?.forks ?? r.forks ?? 0,
        lastUpdated: r.lastUpdated,
        primaryCategory: r.primaryCategory ?? null,
        dbCategory: r.dbCategory ?? null,
        enrichedTags: r.enrichedTags ?? [],
        isArchived: r.isArchived,
        url: r.url,
      })),
    });
    mockProvider.getLibrary.mockResolvedValue(trimmed);
    mockProvider.getDegradedState.mockReturnValue(false);
    mockProvider.getTrends.mockResolvedValue(null);
    mockProvider.getGaps.mockResolvedValue(null);
    mockProvider.getPortfolioInsights.mockResolvedValue(null);
    mockProvider.getCrossDimensionAnalytics.mockResolvedValue(null);
    mockProvider.getTaxonomyValues.mockResolvedValue([]);
  });

  test('renders the page shell with widget tabs once data resolves', async () => {
    const { HomePageClient } = require('@/components/HomePageClient');

    render(<HomePageClient />);

    // The widget tabs (Overview / Stats / Insights / Analytics / Dashboard)
    // are the load-bearing chrome of the home page — if NONE of them
    // render, the shell is broken. Picking the most distinctive label
    // ("Analytics") avoids collision with content elsewhere.
    await waitFor(() => {
      expect(screen.queryByText('Analytics')).not.toBeNull();
    }, { timeout: 5000 });
  });

  test('renders library data once provider resolves', async () => {
    const real = loadLibraryFixture();
    const sampleRepoName = real.repos[0].name;
    const { HomePageClient } = require('@/components/HomePageClient');

    render(<HomePageClient />);

    // The first repo's name should appear in the rendered tree once the
    // grid mounts — proves the data path connects to the DOM.
    await waitFor(() => {
      const matches = screen.queryAllByText(sampleRepoName);
      expect(matches.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});
