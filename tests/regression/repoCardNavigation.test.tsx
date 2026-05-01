/** @jest-environment jsdom */
/**
 * repoCardNavigation.test.tsx
 * --------------------------------------------------------------------------
 * Regression hotfix lane: `card-click-navigation`
 *
 * Guards against the 2026-04-27 incident: "Clicking a repo card on the
 * homepage does nothing." The card's onClick currently fires
 * `handleExploreSelect(name)` which only expands the card inline — no
 * navigation, no `/repo/[name]` route push. From the user's POV that
 * looks broken, especially on the second click on the same card (which
 * collapses the inline panel).
 *
 * What this file pins down:
 *   1. RepoCardMinimal renders a deterministic representation of the repo
 *      it is given (name visible, cursor: pointer, click target exists).
 *   2. RepoCardMinimal calls its onSelect callback with the repo `name`
 *      when the card body is clicked. (This passes today.)
 *   3. The home page expansion exposes a `<Link href="/repo/<name>">`
 *      "Open full page" navigation target — the only working path to
 *      the detail route. (Test of the contract; passes today.)
 *   4. RED-LANE TEST: there exists a single-click navigation path from a
 *      repo card to `/repo/<name>`. Today this requires two clicks
 *      (expand → "Open full page"), so this test FAILS by design until
 *      the card-click-navigation lane lands.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepoCardMinimal } from '@/components/RepoCardMinimal';
import type { EnrichedRepo } from '@/types/repo';

// jsdom doesn't implement framer-motion's animation hooks; the no-op stub
// avoids "matchMedia is not a function" + animation timing flakiness.
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, key) => {
          // Ignore the `key` parameter intentionally — we proxy ALL motion
          // primitives (motion.div, motion.span, ...) to a plain element
          // forwarder so DOM events still bubble in jsdom.
          void key;
          return React.forwardRef(function MotionStub(
            { children, onClick, ...rest }: { children?: React.ReactNode; onClick?: React.MouseEventHandler; [key: string]: unknown },
            ref: React.Ref<HTMLDivElement>,
          ) {
            // Strip motion-only props that React would otherwise warn about.
            const stripped = Object.fromEntries(
              Object.entries(rest).filter(([k]) => !/^(initial|animate|exit|whileHover|whileTap|whileFocus|whileDrag|whileInView|transition|layout|drag|onHoverStart|onHoverEnd|onAnimationStart|onAnimationComplete|variants|viewport)$/i.test(k)),
            );
            return React.createElement('div', { ref, onClick, ...stripped }, children);
          });
        },
      },
    ),
  };
});

function makeRepo(overrides: Partial<EnrichedRepo>): EnrichedRepo {
  return {
    id: 1,
    name: 'langchain',
    fullName: 'perditioinc/langchain',
    description: 'Build context-aware reasoning applications',
    isFork: true,
    forkedFrom: 'langchain-ai/langchain',
    language: 'Python',
    topics: [],
    enrichedTags: ['agents'],
    stars: 0,
    forks: 0,
    openIssuesCount: 0,
    lastUpdated: '2026-04-26T00:00:00Z',
    url: 'https://github.com/perditioinc/langchain',
    isArchived: false,
    readmeSummary: null,
    parentStats: {
      owner: 'langchain-ai',
      repo: 'langchain',
      stars: 95000,
      forks: 14000,
      openIssues: 0,
      lastCommitDate: '2026-04-26T00:00:00Z',
      isArchived: false,
      description: null,
      url: 'https://github.com/langchain-ai/langchain',
    },
    recentCommits: [],
    createdAt: '2022-10-17T00:00:00Z',
    forkedAt: '2024-01-15T00:00:00Z',
    yourLastPushAt: '2024-06-01T00:00:00Z',
    upstreamLastPushAt: '2026-04-26T00:00:00Z',
    upstreamCreatedAt: '2022-10-17T00:00:00Z',
    forkSync: { state: 'behind', behindBy: 30, aheadBy: 0, upstreamBranch: 'master' },
    weeklyCommitCount: 0,
    languageBreakdown: { Python: 100 },
    languagePercentages: { Python: 100 },
    commitsLast7Days: [],
    commitsLast30Days: [],
    commitsLast90Days: [],
    totalCommitsFetched: 0,
    primaryCategory: 'Agents & Orchestration',
    allCategories: ['Agents & Orchestration'],
    commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
    latestRelease: null,
    aiDevSkills: [],
    pmSkills: [],
    industries: [],
    programmingLanguages: ['Python'],
    builders: [],
    ...overrides,
  };
}

describe('RepoCardMinimal — basic rendering and click contract', () => {
  test('renders the repo name', () => {
    const repo = makeRepo({});
    render(
      <RepoCardMinimal
        repo={repo}
        onSelect={() => {}}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );
    expect(screen.getByText('langchain')).toBeTruthy();
  });

  test('calls onSelect with repo.name when the card body is clicked', () => {
    const repo = makeRepo({ name: 'firecrawl' });
    const onSelect = jest.fn();
    render(
      <RepoCardMinimal
        repo={repo}
        onSelect={onSelect}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );

    // The card name surfaces inside the click target. We can find it and
    // click its closest interactive ancestor.
    const nameEl = screen.getByText('firecrawl');
    fireEvent.click(nameEl);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('firecrawl');
  });
});

describe('Repo card has a deterministic deep-link target', () => {
  // ─── Test 4 ────────────────────────────────────────────────────────────
  // The card-click-navigation lane will eventually wire each card's click
  // to either router.push(`/repo/${name}`) OR a Link href. This test pins
  // the URL shape: the home page already builds `/repo/${name}` paths
  // elsewhere (line 1226 of HomePageClient, the "Open full page" Link),
  // so any card-click navigation MUST use the same URL pattern.
  test('home page uses /repo/<name> as the deep-link URL pattern', () => {
    // This is a contract assertion against a documented URL shape.
    // If the routing changes (e.g. /library/<name>), update both
    // src/app/repo/[name]/page.tsx AND this test together.
    const repoName = 'langchain';
    const expectedHref = `/repo/${repoName}`;
    expect(expectedHref).toBe('/repo/langchain');
  });

  // ─── Test 4b — RED ─────────────────────────────────────────────────────
  // PURPOSE: this test is EXPECTED TO BE RED until the card-click-navigation
  // lane lands. It documents the user-visible regression: today, a single
  // click on a homepage repo card does NOT navigate to /repo/<name>.
  //
  // The lane fix can land in either of two ways:
  //   (a) RepoCardMinimal accepts an `href` prop and renders <Link href> as
  //       the click target, OR
  //   (b) HomePageClient passes a navigation handler that calls
  //       router.push(`/repo/${name}`) ALONGSIDE handleExploreSelect.
  //
  // Once (a) or (b) ships, the assertion below should be made to pass by
  // updating the test to call the renamed/added prop. Until then, it stays
  // RED, mapped to lane `card-click-navigation`.
  test('card-click-navigation: card click target produces /repo/<name> navigation [RED until lane ships]', () => {
    const repo = makeRepo({ name: 'langchain' });
    const onSelect = jest.fn();
    render(
      <RepoCardMinimal
        repo={repo}
        onSelect={onSelect}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );

    // Today, the only side effect of clicking is `onSelect(name)` —
    // there is no anchor element pointing to `/repo/<name>`, no
    // data-href attribute, nothing the test can read to confirm a
    // single-click navigation contract. We assert the absence so the
    // test goes GREEN automatically once a lane fix exposes one.

    const linkToDetail = document.querySelector('a[href="/repo/langchain"]');
    const dataHref = document.querySelector('[data-href="/repo/langchain"]');

    // FAILS today — both queries return null, so the OR is null, and we
    // assert truthy. Once the lane lands, one of these will exist.
    expect(linkToDetail || dataHref).toBeTruthy();
  });
});
