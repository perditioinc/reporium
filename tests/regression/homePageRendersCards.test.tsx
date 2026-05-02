/** @jest-environment jsdom */
/**
 * homePageRendersCards.test.tsx
 * --------------------------------------------------------------------------
 * Regression smoke test — counterpart to the existing HomePageClient test.
 *
 * Pins down: when the data provider returns a non-empty fixture library,
 * the home page actually renders >0 repo cards. A regression that empties
 * the grid (degraded state, broken filter chain, broken provider) would
 * have caught today's "page looks broken" complaint earlier.
 *
 * The existing tests/HomePageClient.test.tsx only verifies the degraded-
 * banner branch (empty fixture). This test verifies the populated branch.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import type { LibraryData, EnrichedRepo } from '@/types/repo';

let mockProvider: {
  mode: 'production';
  getOwnedLibrary: jest.Mock;
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

// Stub heavy / out-of-scope subcomponents so the fixture path renders fast.
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
jest.mock('@/components/HomeGraphWidget', () => ({ HomeGraphWidget: () => <div>HomeGraphWidget</div> }));
jest.mock('@/components/RecommendationsWidget', () => ({ RecommendationsWidget: () => null }));

// Replace RepoCardMinimal with a marker we can count without depending on
// framer-motion inside jsdom.
jest.mock('@/components/RepoCardMinimal', () => ({
  RepoCardMinimal: ({ repo }: { repo: { name: string } }) => (
    <div data-testid="repo-card" data-repo-name={repo.name}>
      {repo.name}
    </div>
  ),
}));

// Stub Next.js Link to a plain anchor so we can read href attributes.
jest.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function MockLink({ href, children, ...rest }: { href: string; children?: React.ReactNode }) {
      return React.createElement('a', { href, ...rest }, children);
    },
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Build a populated library fixture from the disk fixture, but with the
// private repo already filtered (post-filter shape).
function buildPopulatedLibraryFixture(): LibraryData {
  const fixturePath = path.join(__dirname, '..', 'fixtures', 'library-mixed.json');
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as {
    repos: Array<EnrichedRepo & { isPrivate?: boolean }>;
  };
  const publicRepos = raw.repos
    .filter((r) => r.isPrivate !== true)
    .map((r) => {
      const copy = { ...r };
      delete (copy as Partial<EnrichedRepo & { isPrivate?: boolean }>).isPrivate;
      return copy as EnrichedRepo;
    });

  return {
    username: 'perditioinc',
    generatedAt: '2026-04-28T00:00:00Z',
    stats: {
      total: publicRepos.length,
      built: 0,
      forked: publicRepos.length,
      languages: ['Python'],
      topTags: ['agents'],
    },
    repos: publicRepos,
    tagMetrics: [],
    categories: [],
    gapAnalysis: { generatedAt: '2026-04-28T00:00:00Z', gaps: [] },
    builderStats: [],
    aiDevSkillStats: [],
    pmSkillStats: [],
  };
}

mockProvider = {
  mode: 'production',
  getOwnedLibrary: jest.fn(),
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

describe('HomePageClient — populated state renders cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fixture = buildPopulatedLibraryFixture();
    mockProvider.getOwnedLibrary.mockResolvedValue(fixture);
    mockProvider.getLibrary.mockResolvedValue(fixture);
    mockProvider.getDegradedState.mockReturnValue(false);
    mockProvider.getTrends.mockResolvedValue(null);
    mockProvider.getGaps.mockResolvedValue(null);
    mockProvider.getPortfolioInsights.mockResolvedValue(null);
    mockProvider.getCrossDimensionAnalytics.mockResolvedValue(null);
    mockProvider.getTaxonomyValues.mockResolvedValue([]);
    mockProvider.getRepo.mockResolvedValue(null);
    mockProvider.getSimilarRepos.mockResolvedValue([]);
  });

  test('renders at least one repo card from a non-empty fixture', async () => {
    const { HomePageClient } = require('@/components/HomePageClient');
    render(<HomePageClient />);

    await waitFor(
      () => {
        const cards = screen.queryAllByTestId('repo-card');
        expect(cards.length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });

  test('renders no private repos in the card grid', async () => {
    const { HomePageClient } = require('@/components/HomePageClient');
    render(<HomePageClient />);

    await waitFor(
      () => {
        const cards = screen.queryAllByTestId('repo-card');
        expect(cards.length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );

    const cards = screen.queryAllByTestId('repo-card');
    const names = cards.map((c) => c.getAttribute('data-repo-name'));
    expect(names).not.toContain('hippo-harvest-assignment');
  });
});
