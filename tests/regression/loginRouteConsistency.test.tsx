/** @jest-environment jsdom */
/**
 * loginRouteConsistency.test.tsx
 * --------------------------------------------------------------------------
 * Regression hotfix lane: cross-cutting (login lane is not in scope today,
 * but R1 in .audit/2026-04-28/regression-root-cause-map.md says login
 * never reached production — we want the test in place so the day login
 * DOES ship, navigation and route are wired together atomically).
 *
 * What this file pins down:
 *   1. The header/nav (StickyNavBar) does NOT advertise a /login route
 *      today — there is no orphan link pointing nowhere. (PASSES today.)
 *   2. If a /login link is added to StickyNavBar in the future, the
 *      `src/app/login/` route must exist alongside it. (Conditional —
 *      passes today by virtue of (1).)
 *   3. The header DOES contain the documented links from NAV_LINKS.
 *      Used as a smoke-test of header rendering integrity.
 */

import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render } from '@testing-library/react';

const REPO_ROOT = path.join(__dirname, '..', '..');

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// next/link is mocked to a plain anchor so href reading is trivial.
jest.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function MockLink({ href, children, ...rest }: { href: string; children?: React.ReactNode }) {
      return React.createElement('a', { href, ...rest }, children);
    },
  };
});

describe('header navigation — no orphan login link', () => {
  test('StickyNavBar does NOT render a /login link today', () => {
    const { StickyNavBar } = require('@/components/StickyNavBar');
    const { container } = render(<StickyNavBar />);

    const allHrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    // No /login, no /signin, no /sign-in. If a future PR adds one, it
    // should also add the matching app/login/ route — see test below.
    expect(allHrefs).not.toContain('/login');
    expect(allHrefs).not.toContain('/signin');
    expect(allHrefs).not.toContain('/sign-in');
  });

  test('when a /login link is rendered anywhere in the header, src/app/login/ MUST exist', () => {
    const { StickyNavBar } = require('@/components/StickyNavBar');
    const { container } = render(<StickyNavBar />);

    const hasLoginLink = Array.from(container.querySelectorAll('a')).some((a) => {
      const href = a.getAttribute('href');
      return href === '/login' || href === '/signin' || href === '/sign-in';
    });

    if (hasLoginLink) {
      const loginRoutePath = path.join(REPO_ROOT, 'src', 'app', 'login', 'page.tsx');
      const signinRoutePath = path.join(REPO_ROOT, 'src', 'app', 'signin', 'page.tsx');
      const signInDashRoutePath = path.join(REPO_ROOT, 'src', 'app', 'sign-in', 'page.tsx');
      const routeExists =
        fs.existsSync(loginRoutePath) ||
        fs.existsSync(signinRoutePath) ||
        fs.existsSync(signInDashRoutePath);
      expect(routeExists).toBe(true);
    } else {
      // Nothing to enforce when there's no login link — pass trivially.
      expect(hasLoginLink).toBe(false);
    }
  });

  test('StickyNavBar surfaces the documented top-level routes (smoke)', () => {
    const { StickyNavBar } = require('@/components/StickyNavBar');
    const { container } = render(<StickyNavBar />);

    const allHrefs = new Set(
      Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? ''),
    );

    // Subset of NAV_LINKS — keep tight. If these routes disappear from
    // the nav, the homepage is genuinely broken.
    const requiredHrefs = ['/', '/graph', '/wiki', '/taxonomy', '/faq'];
    for (const href of requiredHrefs) {
      expect(allHrefs.has(href)).toBe(true);
    }
  });
});
