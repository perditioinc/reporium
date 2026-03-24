/** @jest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { LibraryData } from '@/types/repo';

var mockProvider: {
  mode: 'production';
  getOwnedLibrary: jest.Mock;
  getLibrary: jest.Mock;
  getDegradedState: jest.Mock;
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

jest.mock('@/components/StatsBar', () => ({ StatsBar: () => <div>StatsBar</div> }));
jest.mock('@/components/SearchBar', () => ({ SearchBar: () => <div>SearchBar</div> }));
jest.mock('@/components/FilterBar', () => ({ FilterBar: () => <div>FilterBar</div> }));
jest.mock('@/components/RepoGrid', () => ({ RepoGrid: () => <div>RepoGrid</div> }));
jest.mock('@/components/LoadingState', () => ({ LoadingState: () => <div>LoadingState</div> }));
jest.mock('@/components/LoadingBanner', () => ({ LoadingBanner: () => null }));
jest.mock('@/components/MetricsSidebar', () => ({ MetricsSidebar: () => <div>MetricsSidebar</div> }));
jest.mock('@/components/MiniAskBar', () => ({ MiniAskBar: () => <div>MiniAskBar</div> }));
jest.mock('@/components/PortfolioInsightsWidget', () => ({ PortfolioInsightsWidget: () => <div>PortfolioInsightsWidget</div> }));
jest.mock('@/components/CrossDimensionWidget', () => ({ CrossDimensionWidget: () => <div>CrossDimensionWidget</div> }));
jest.mock('@/components/TrendingThisWeekWidget', () => ({ TrendingThisWeekWidget: () => <div>TrendingThisWeekWidget</div> }));

mockProvider = {
  mode: 'production',
  getOwnedLibrary: jest.fn(),
  getLibrary: jest.fn(),
  getDegradedState: jest.fn(),
  getTrends: jest.fn(),
  getGaps: jest.fn(),
  getRepo: jest.fn(),
  searchRepos: jest.fn(),
  getTaxonomyValues: jest.fn(),
  getPortfolioInsights: jest.fn(),
  getCrossDimensionAnalytics: jest.fn(),
  getSimilarRepos: jest.fn(),
};

const libraryFixture: LibraryData = {
  username: 'perditioinc',
  generatedAt: '2026-03-24T00:00:00Z',
  stats: {
    total: 1,
    built: 1,
    forked: 0,
    languages: ['TypeScript'],
    topTags: ['agents'],
  },
  repos: [],
  tagMetrics: [],
  categories: [],
  gapAnalysis: {
    generatedAt: '2026-03-24T00:00:00Z',
    gaps: [],
  },
  builderStats: [],
  aiDevSkillStats: [],
  pmSkillStats: [],
};

describe('HomePageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider.getOwnedLibrary.mockResolvedValue(null);
    mockProvider.getLibrary.mockResolvedValue(libraryFixture);
    mockProvider.getDegradedState.mockReturnValue(true);
    mockProvider.getTrends.mockResolvedValue(null);
    mockProvider.getGaps.mockResolvedValue(null);
    mockProvider.getPortfolioInsights.mockResolvedValue(null);
    mockProvider.getCrossDimensionAnalytics.mockResolvedValue(null);
    mockProvider.getTaxonomyValues.mockResolvedValue([]);
  });

  test('shows a degraded-state banner when live data falls back to cached data', async () => {
    const { HomePageClient } = require('@/components/HomePageClient');

    render(<HomePageClient />);

    await waitFor(() => {
      expect(
        screen.getByText('Live data is unavailable right now — showing your last cached snapshot.'),
      ).toBeTruthy();
    });
  });
});
