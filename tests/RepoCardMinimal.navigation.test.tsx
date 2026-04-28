/** @jest-environment jsdom */

/**
 * Regression: home-page repo cards must be navigable to /repo/[name].
 *
 * Background: each card on the home library grid is a `RepoCardMinimal`.
 * Sibling list UIs (TrendingThisWeekWidget, RecommendationsWidget,
 * SimilarReposPanel, /insights, /trends, KnowledgeGraph3D popup) all wrap
 * their card surface in a Next.js <Link href="/repo/${encodeURIComponent(name)}">.
 * If RepoCardMinimal stops rendering a navigable anchor for a real fixture
 * repo, this test fails and the home grid silently regresses.
 */

import React from 'react';
import { render } from '@testing-library/react';
import type { EnrichedRepo } from '@/types/repo';
import { RepoCardMinimal } from '@/components/RepoCardMinimal';

function fixtureRepo(overrides: Partial<EnrichedRepo> = {}): EnrichedRepo {
  return {
    id: 1,
    name: 'awesome-cli',
    fullName: 'perditioinc/awesome-cli',
    description: 'A test fixture repo.',
    isFork: false,
    forkedFrom: null,
    language: 'TypeScript',
    topics: [],
    enrichedTags: ['cli'],
    stars: 42,
    forks: 3,
    lastUpdated: '2026-04-01T00:00:00Z',
    url: 'https://github.com/perditioinc/awesome-cli',
    isArchived: false,
    readmeSummary: null,
    parentStats: null,
    recentCommits: [],
    createdAt: null,
    forkedAt: null,
    yourLastPushAt: null,
    upstreamLastPushAt: null,
    upstreamCreatedAt: null,
    forkSync: null,
    weeklyCommitCount: 0,
    languageBreakdown: {},
    languagePercentages: {},
    commitsLast7Days: [],
    commitsLast30Days: [],
    commitsLast90Days: [],
    totalCommitsFetched: 0,
    primaryCategory: 'CLI',
    allCategories: ['CLI'],
    dbCategory: 'cli',
    commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
    latestRelease: null,
    aiDevSkills: [],
    pmSkills: [],
    industries: [],
    programmingLanguages: [],
    builders: [],
    ...overrides,
  } as EnrichedRepo;
}

function renderCard(repo: EnrichedRepo) {
  return render(
    <RepoCardMinimal
      repo={repo}
      onSelect={() => {}}
      isSelected={false}
      isRelated={false}
      anySelected={false}
    />,
  );
}

describe('RepoCardMinimal — navigability', () => {
  test('renders an anchor pointing at /repo/[name] for a normal repo', () => {
    const repo = fixtureRepo();
    const { container } = renderCard(repo);

    const anchor = container.querySelector('a[href]');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe(`/repo/${encodeURIComponent(repo.name)}`);
  });

  test('renders the card name inside the navigable surface', () => {
    const repo = fixtureRepo();
    const { container } = renderCard(repo);

    const anchor = container.querySelector('a[href]');
    expect(anchor?.textContent).toContain(repo.name);
  });

  test('encodes repo names that contain a dot (real-fixture: design.md)', () => {
    const repo = fixtureRepo({ name: 'design.md', fullName: 'perditioinc/design.md' });
    const { container } = renderCard(repo);

    const anchor = container.querySelector('a[href]');
    // encodeURIComponent leaves "." unescaped — the live route is /repo/design.md
    expect(anchor?.getAttribute('href')).toBe('/repo/design.md');
  });

  test('the navigable surface is keyboard-focusable (anchor with href)', () => {
    const repo = fixtureRepo();
    const { container } = renderCard(repo);

    const anchor = container.querySelector('a[href]') as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    // Anchors with href are in the tab order by default; tabIndex < 0 disables that.
    expect(anchor!.tabIndex).toBeGreaterThanOrEqual(0);
  });
});
