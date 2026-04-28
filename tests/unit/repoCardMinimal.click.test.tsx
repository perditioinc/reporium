/** @jest-environment jsdom */

/**
 * Regression test for repo-card click navigation hotfix (2026-04-28).
 *
 * Bug: clicking a repo card on the homepage did nothing per operator report.
 *
 * Fix on disk: RepoCardMinimal wraps its visual content in a Next.js
 * `<Link href="/repo/[name]">` so the card is a real anchor with native
 * mouse + keyboard navigation. The anchor href tests live next door in
 * `tests/RepoCardMinimal.navigation.test.tsx` (regression-guard agent).
 *
 * This file covers what the navigation suite does NOT:
 *  - the optional `onSelect` callback still fires on click (analytics /
 *    graph-sync hook used by HomePageClient)
 *  - the anchor exposes the right aria-label for assistive tech
 *  - `data-testid` and `data-repo-name` are stable for downstream selectors
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { RepoCardMinimal } from '@/components/RepoCardMinimal';
import type { EnrichedRepo } from '@/types/repo';

// Cast through `unknown` — RepoCardMinimal only reads a small subset
// of EnrichedRepo, and a fully-typed fixture obscures the test intent.
const fixtureRepo = {
  id: 1,
  name: 'reporium-api',
  fullName: 'perditioinc/reporium-api',
  description: 'Backend API for Reporium.',
  isFork: false,
  forkedFrom: null,
  language: 'Python',
  topics: [],
  enrichedTags: ['API Development'],
  stars: 1,
  forks: 0,
  lastUpdated: '2026-04-27T00:00:00Z',
  url: 'https://github.com/perditioinc/reporium-api',
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
  primaryCategory: 'Dev Tools & Automation',
  allCategories: ['Dev Tools & Automation'],
  dbCategory: 'Dev Tools & Automation',
  commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
  latestRelease: null,
  aiDevSkills: [],
  pmSkills: [],
  industries: [],
  programmingLanguages: [],
  builders: [],
} as unknown as EnrichedRepo;

describe('RepoCardMinimal — click side-effects beyond navigation', () => {
  test('fires onSelect with the repo name when the card is clicked', () => {
    const onSelect = jest.fn();
    const { container } = render(
      <RepoCardMinimal
        repo={fixtureRepo}
        onSelect={onSelect}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );

    const anchor = container.querySelector('a[href]')!;
    fireEvent.click(anchor);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('reporium-api');
  });

  test('does not throw when onSelect is omitted (now optional)', () => {
    const { container } = render(
      <RepoCardMinimal
        repo={fixtureRepo}
        onSelect={undefined}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );

    const anchor = container.querySelector('a[href]')!;
    // Click must not throw even though there is no listener
    expect(() => fireEvent.click(anchor)).not.toThrow();
  });

  test('exposes a screen-reader-friendly aria-label and stable test hooks', () => {
    const { container } = render(
      <RepoCardMinimal
        repo={fixtureRepo}
        onSelect={() => {}}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );

    const anchor = container.querySelector('a[href]')!;
    expect(anchor.getAttribute('aria-label')).toBe('Open reporium-api repository page');
    expect(anchor.getAttribute('data-testid')).toBe('repo-card-minimal');
    expect(anchor.getAttribute('data-repo-name')).toBe('reporium-api');
  });
});
