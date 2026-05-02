/** @jest-environment node */

// Smoke: login route/link behavior is deterministic.
//
// Reporium has no auth surface today — there is no /login, /signin, /sign-in,
// or /auth route, and no nav link points at one. "Deterministic" here means:
// (a) the absence is consistent (no half-built /login route appears that
// would 404 in production), and (b) if someone wires up auth in the future,
// they have to update both the route and the nav simultaneously, which this
// test makes them confront.
//
// If real login is added later, replace this test with one that asserts the
// link/route are CONSISTENT (link present iff route present), instead of
// asserting both are absent.

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const APP_DIR = join(process.cwd(), 'src', 'app');
const NAV_FILE = join(process.cwd(), 'src', 'components', 'StickyNavBar.tsx');

const AUTH_ROUTE_PATTERN = /^(login|signin|sign-in|signup|sign-up|auth|logout|sign-out|signout)$/i;
const AUTH_HREF_PATTERN = /href\s*=\s*['"`]\/(login|signin|sign-in|signup|sign-up|auth|logout|sign-out|signout)\b/i;
const AUTH_NAV_LABEL_PATTERN = /label:\s*['"`](Sign\s*[Ii]n|Sign\s*[Uu]p|Log\s*[Ii]n|Logout|Log\s*[Oo]ut)/;

describe('smoke: login route/link is deterministic', () => {
  test('src/app/ contains no auth-related route directory', () => {
    expect(existsSync(APP_DIR)).toBe(true);
    const entries = readdirSync(APP_DIR, { withFileTypes: true });
    const authDirs = entries
      .filter((e) => e.isDirectory())
      .filter((e) => AUTH_ROUTE_PATTERN.test(e.name));
    // If auth is being added, this assertion will fail and force the
    // accompanying nav-link assertion to be updated in lockstep.
    expect(authDirs.map((d) => d.name)).toEqual([]);
  });

  test('StickyNavBar exposes no auth-route link', () => {
    expect(existsSync(NAV_FILE)).toBe(true);
    const source = readFileSync(NAV_FILE, 'utf-8');

    // Either an explicit href to an auth route, or a NAV_LINKS entry whose
    // label is a sign-in / sign-up / log-out word, would mean the nav has
    // grown an auth affordance — both halves of the contract must move
    // together with the route directory.
    expect(source).not.toMatch(AUTH_HREF_PATTERN);
    expect(source).not.toMatch(AUTH_NAV_LABEL_PATTERN);
  });

  test('no client component renders an auth-route href today', () => {
    // This walks the most user-visible surfaces and checks for /login etc.
    // hrefs. It is a containment test — if we ever add a real auth flow, we
    // can update this list to reflect the canonical surface.
    const filesToCheck = [
      join(process.cwd(), 'src', 'app', 'page.tsx'),
      join(process.cwd(), 'src', 'app', 'layout.tsx'),
      join(process.cwd(), 'src', 'components', 'LayoutShell.tsx'),
      join(process.cwd(), 'src', 'components', 'StickyAskBar.tsx'),
      join(process.cwd(), 'src', 'components', 'StickyNavBar.tsx'),
      join(process.cwd(), 'src', 'components', 'WikiNavBar.tsx'),
    ];
    for (const file of filesToCheck) {
      if (!existsSync(file)) continue;
      const source = readFileSync(file, 'utf-8');
      expect({ file, leak: AUTH_HREF_PATTERN.test(source) }).toEqual({ file, leak: false });
    }
  });
});
