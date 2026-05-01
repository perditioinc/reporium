/** @jest-environment jsdom */

// Smoke: clicking a repo card lands the user on /repo/<encoded-name>.
//
// CONTEXT
// The home grid renders RepoCardMinimal. Two contracts are at play:
//
//   - On origin/main TODAY: the card is a `<motion.div onClick={() => onSelect(name)}>`
//     that flips an internal "selected" state and surfaces a separate
//     "Open full page →" Link. A click does not navigate by itself — the
//     user has to click twice. That is the regression class the card-click
//     hotfix is fixing.
//
//   - In the card-click hotfix lane (`claude/hotfix/repo-card-click-2026-04-28`):
//     the card body is wrapped in `<Link href="/repo/<encoded-name>">`,
//     `onSelect` is optional, and the card carries `data-testid="repo-card-minimal"`
//     and `data-repo-name="<name>"`. A single click navigates.
//
// SMOKE SHAPE
// This file is split into two halves:
//
//   1. BASELINE (green today) — TrendingThisWeekWidget already renders an
//      explicit `<a href="/repo/<encoded>">` per repo. That is a stable
//      deep-link surface that recommendations / similarity / trends share.
//
//   2. PENDING — card-click hotfix contract (currently RED) — the card
//      itself MUST be the navigation target. Tests use `test.failing`
//      until the hotfix lands; at that point each turns green and the
//      `.failing` annotation must be removed.
//
// Owner / hotfix lane: claude/hotfix/repo-card-click-2026-04-28 (no PR yet
// at the time of writing — branch lives in
// `.worktrees/reporium-card-click-hotfix-2026-04-28`).

import React from 'react';
import { render, screen } from '@testing-library/react';
import { RepoCardMinimal } from '@/components/RepoCardMinimal';
import { TrendingThisWeekWidget } from '@/components/TrendingThisWeekWidget';
import { pickSmokeRepo } from './_fixtures';

// framer-motion's runtime mode introduces non-deterministic timers in jsdom;
// for click-contract assertions we don't care about the animation, so render
// the underlying tag directly. We strip motion-only props before forwarding
// to the DOM element so React doesn't warn about unknown attributes.
jest.mock('framer-motion', () => {
  const ReactMod = require('react');
  const MOTION_ONLY_PROPS = new Set([
    'layout', 'layoutId', 'animate', 'initial', 'exit', 'transition',
    'variants', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag',
    'whileInView', 'onHoverStart', 'onHoverEnd', 'onTap', 'onTapStart',
    'onTapCancel', 'onPan', 'onPanStart', 'onPanEnd', 'drag', 'dragConstraints',
    'dragElastic', 'dragMomentum', 'dragSnapToOrigin', 'viewport',
    'onAnimationStart', 'onAnimationComplete', 'onUpdate',
  ]);
  function stripMotionProps(props: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (!MOTION_ONLY_PROPS.has(k)) out[k] = v;
    }
    return out;
  }
  return {
    motion: new Proxy(
      {},
      {
        get: () => (props: any) =>
          ReactMod.createElement(
            props.as || 'div',
            stripMotionProps(props),
            props.children,
          ),
      },
    ),
  };
});

describe('smoke: repo card navigation — BASELINE', () => {
  test('TrendingThisWeekWidget renders an internal link to /repo/<encoded-name>', () => {
    const repo = pickSmokeRepo();

    const { container } = render(<TrendingThisWeekWidget repos={[repo]} />);

    const link = container.querySelector(
      `a[href="/repo/${encodeURIComponent(repo.name)}"]`,
    );
    expect(link).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PROMOTED — card-click hotfix has landed on main. RepoCardMinimal is now
// wrapped in `<Link href="/repo/<encoded>">` and exposes the
// data-testid/data-repo-name handles. The two assertions below were
// originally `test.failing` markers tied to that hotfix; promoted to
// BASELINE so any future regression flips them red.
// ---------------------------------------------------------------------------
describe('smoke: repo card navigation — PROMOTED (card-click hotfix)', () => {
  test('RepoCardMinimal exposes a single-click anchor to /repo/<encoded-name>', () => {
    const repo = pickSmokeRepo();

    const { container } = render(
      <RepoCardMinimal
        repo={repo}
        onSelect={() => {}}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );

    // The hotfix wraps the card in an <a> (Next's <Link> emits one) with
    // the encoded internal href.
    const link = container.querySelector(
      `a[href="/repo/${encodeURIComponent(repo.name)}"]`,
    );
    expect(link).not.toBeNull();
  });

  test('RepoCardMinimal exposes the data-testid + data-repo-name handles introduced by the hotfix', () => {
    const repo = pickSmokeRepo();

    render(
      <RepoCardMinimal
        repo={repo}
        onSelect={() => {}}
        isSelected={false}
        isRelated={false}
        anySelected={false}
      />,
    );

    // These attributes are part of the hotfix contract — they exist so
    // E2E / preview verification can target the card without depending
    // on visible text (which can change with i18n / status-tag rules).
    const card = screen.queryByTestId('repo-card-minimal');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('data-repo-name')).toBe(repo.name);
  });
});
