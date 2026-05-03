/**
 * KAN-172: tests for the /repo/[name] 404 middleware.
 *
 * Verifies the middleware:
 *  - lets known public slugs through (NextResponse.next)
 *  - returns HTTP 404 for unknown slugs (rewrite + status: 404)
 *  - returns HTTP 404 for malformed URI sequences
 *  - never echoes the slug into the response body (KAN-131 spirit)
 *
 * The allowlist (data/repo-slugs.json) is statically imported by the
 * middleware module. Tests use a small set of fixture slugs known to be
 * present in the build-time allowlist.
 *
 * @jest-environment node
 */

// Mock the slug list BEFORE importing the middleware so the Set inside the
// module under test is built from the fixture, not the real 1867-entry file.
jest.mock(
  '../../data/repo-slugs.json',
  () => ['build-your-own-x', 'awesome', 'freeCodeCamp', 'agno'],
  { virtual: true }
);

import middleware from '../../middleware';
import type { NextRequest } from 'next/server';

function makeRequest(pathname: string): NextRequest {
  // The middleware only reads `request.nextUrl` (pathname + URL ctor compat).
  // We synthesize the minimum shape Next.js's runtime gives us.
  const url = new URL(`https://www.reporium.com${pathname}`);
  return {
    nextUrl: url,
  } as unknown as NextRequest;
}

describe('KAN-172 middleware: /repo/[name] 404', () => {
  it('lets a known public slug pass through with x-middleware-next', () => {
    const res = middleware(makeRequest('/repo/build-your-own-x/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('lets a known slug pass through without trailing slash', () => {
    const res = middleware(makeRequest('/repo/awesome'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('returns 404 for an unknown slug', () => {
    const res = middleware(makeRequest('/repo/zzz-not-real-totally-fake/'));
    expect(res.status).toBe(404);
    expect(res.headers.get('x-middleware-rewrite')).toBeTruthy();
  });

  it('returns 404 for an empty-ish slug after URL decode', () => {
    // %20 → space → not in allowlist
    const res = middleware(makeRequest('/repo/%20%20/'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for malformed URI sequence', () => {
    // Lone %FF is malformed → decodeURIComponent throws
    const res = middleware(makeRequest('/repo/%FF/'));
    expect(res.status).toBe(404);
    expect(res.headers.get('x-middleware-rewrite')).toBeTruthy();
  });

  it('passes a deeper path under a known slug through', () => {
    // Even though the matcher includes /repo/:slug/:path*, the page route
    // currently only renders /repo/[name]/ — but middleware should still
    // not block valid slug prefixes for forward compatibility.
    const res = middleware(makeRequest('/repo/freeCodeCamp/anything'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('handles URL-encoded slugs that match the allowlist after decode', () => {
    // 'agno' encoded → still in allowlist
    const encoded = encodeURIComponent('agno');
    const res = middleware(makeRequest(`/repo/${encoded}/`));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not leak the unknown slug into the response body', () => {
    // KAN-131 spirit: the rewrite has a null body — the rendered HTML comes
    // from the route's not-found.tsx, not from middleware.
    const res = middleware(makeRequest('/repo/<script>alert(1)</script>/'));
    expect(res.status).toBe(404);
    // NextResponse.rewrite always builds the response with `body: null`.
    expect(res.body).toBeNull();
  });
});
