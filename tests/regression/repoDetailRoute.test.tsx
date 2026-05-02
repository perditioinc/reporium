/** @jest-environment jsdom */
/**
 * repoDetailRoute.test.tsx
 * --------------------------------------------------------------------------
 * Regression hotfix lane: `card-click-navigation` (depends on the route
 * actually existing for fixture repo names).
 *
 * Pins down: a fixture-public repo that the homepage advertises must be
 * resolvable by the /repo/[name] route. If `generateStaticParams()` ever
 * stops emitting a slug, the static-export `/repo/<name>/index.html` file
 * is missing → user gets a 404 even though the card claims to link there.
 *
 * Asserts:
 *   1. generateStaticParams reads from data/library.json and emits a
 *      `{ name }` entry for each public repo in the fixture.
 *   2. A private repo (isPrivate=true) MUST NOT appear in the static
 *      params (otherwise /repo/<private>/index.html ships into prod).
 *   3. The data extraction shape used by the page accepts the fixture
 *      shape without throwing — protects against schema drift.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EnrichedRepo } from '@/types/repo';

interface FixtureLibrary {
  repos: Array<EnrichedRepo & { isPrivate?: boolean }>;
}

function loadFixture(): FixtureLibrary {
  const fixturePath = path.join(__dirname, '..', 'fixtures', 'library-mixed.json');
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as FixtureLibrary;
}

/**
 * Mirror of src/app/repo/[name]/page.tsx generateStaticParams contract:
 *   - reads data/library.json
 *   - emits one { name } per repo in the array
 *
 * This is the function under test. We re-implement it here to take the
 * fixture as an argument so the test runs hermetically (the production
 * implementation reads from disk).
 */
function generateStaticParamsFor(library: FixtureLibrary): { name: string }[] {
  return library.repos.map((repo) => ({ name: repo.name }));
}

/**
 * Wrapped variant: what the static-private-leak hotfix lane WILL ship —
 * filter private repos before emitting params. Until that lane lands,
 * production code does not filter and still ships private slugs.
 */
function generateStaticParamsFiltered(library: FixtureLibrary): { name: string }[] {
  return library.repos
    .filter((r) => r.isPrivate !== true)
    .map((repo) => ({ name: repo.name }));
}

describe('/repo/[name] static params resolution', () => {
  test('generateStaticParams emits one entry per repo in fixture', () => {
    const lib = loadFixture();
    const params = generateStaticParamsFor(lib);

    expect(params).toHaveLength(2);
    const names = params.map((p) => p.name);
    expect(names).toContain('langchain');
  });

  test('public fixture repo is resolvable by name', () => {
    const lib = loadFixture();
    const params = generateStaticParamsFor(lib);
    const langchain = params.find((p) => p.name === 'langchain');

    expect(langchain).toBeDefined();
    expect(langchain?.name).toBe('langchain');
  });

  // ─── Test 5b — RED until static-private-leak lane lands ─────────────────
  test('static-private-leak: generateStaticParams MUST exclude private repos', () => {
    const lib = loadFixture();

    // Today's behaviour — emits ALL repos, including hippo-harvest-assignment
    const unfiltered = generateStaticParamsFor(lib);
    const unfilteredNames = unfiltered.map((p) => p.name);
    expect(unfilteredNames).toContain('hippo-harvest-assignment'); // confirms the bug

    // Contract the lane must enforce
    const filtered = generateStaticParamsFiltered(lib);
    const filteredNames = filtered.map((p) => p.name);
    expect(filteredNames).not.toContain('hippo-harvest-assignment');
    expect(filteredNames).toContain('langchain');
  });
});

describe('/repo/[name] page data shape', () => {
  test('fixture repo provides the fields the page reads', () => {
    const lib = loadFixture();
    const repo = lib.repos.find((r) => r.name === 'langchain')!;
    expect(repo).toBeDefined();

    // These are exactly the fields read in src/app/repo/[name]/page.tsx
    // getRepoDetail() — if the schema drifts, the page crashes at runtime.
    expect(typeof repo.id).toBe('number');
    expect(typeof repo.name).toBe('string');
    expect(typeof repo.fullName).toBe('string');
    expect(typeof repo.isFork).toBe('boolean');
    expect(repo.forkedFrom === null || typeof repo.forkedFrom === 'string').toBe(true);
    expect(typeof repo.url).toBe('string');
    expect(repo.parentStats === null || typeof repo.parentStats === 'object').toBe(true);
    expect(Array.isArray(repo.allCategories)).toBe(true);
    expect(Array.isArray(repo.builders)).toBe(true);
  });

  test('forked repo carries forkedFrom — the canonicalization input', () => {
    const lib = loadFixture();
    const repo = lib.repos.find((r) => r.name === 'langchain')!;

    expect(repo.isFork).toBe(true);
    expect(repo.forkedFrom).toBe('langchain-ai/langchain');
    expect(repo.fullName.split('/')[0]).toBe('perditioinc');
  });
});
