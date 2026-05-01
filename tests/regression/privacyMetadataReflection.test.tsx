/**
 * privacyMetadataReflection.test.tsx
 * --------------------------------------------------------------------------
 * KAN-131 regression: /repo/[name] generateMetadata used to echo the URL
 * `name` parameter into <title>${slug} | Reporium</title> when the repo
 * lookup returned null. notFound() rendered the 404 body, but the metadata
 * block (with the leaked / attacker-controlled slug) was already committed.
 *
 * This test pins the fix:
 *   - generateMetadata({ params }) with a non-existent slug must NOT include
 *     the slug anywhere in the returned Metadata object.
 *   - It must mark robots noindex/nofollow.
 *   - It must return a generic, non-reflective title.
 *
 * Filed for: KAN-131 ("Privacy status-code regression on /repo/[name] —
 * HTTP 200 with reflected slug in title").
 */

// We mock the data provider so getRepoDetail() falls through to "null" without
// hitting the local data/library.json. The page also imports filesystem code
// at module top — that's fine, the readFileSync only fires inside the catch
// path of getRepoDetail when the API path returned null.
jest.mock('@/lib/dataProvider', () => ({
  createDataProvider: () => ({
    mode: 'production',
    // Always return null — simulates "repo not in our index", which is what
    // happens for any garbage slug a crawler / attacker probes.
    getRepo: jest.fn().mockResolvedValue(null),
  }),
}));

// Avoid hitting the real library.json in the local-fallback branch.
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    readFileSync: jest.fn(() => JSON.stringify({ repos: [] })),
  };
});

describe('repo/[name] generateMetadata — KAN-131 regression', () => {
  test('does NOT echo the URL slug into title when repo is missing', async () => {
    const { generateMetadata } = await import('@/app/repo/[name]/page');

    const slug = 'totally-bogus-xyz-attacker-controlled-99';
    const meta = await generateMetadata({
      params: Promise.resolve({ name: slug }),
    });

    // Title must be the generic not-found copy, not the reflected slug.
    expect(typeof meta.title).toBe('string');
    expect(meta.title).not.toContain(slug);
    expect(meta.title).toBe('Repository not found | Reporium');
  });

  test('marks robots noindex/nofollow for missing repos', async () => {
    const { generateMetadata } = await import('@/app/repo/[name]/page');

    const meta = await generateMetadata({
      params: Promise.resolve({ name: 'nonexistent-zzz999' }),
    });

    // robots can be a string or an object — assert the typed-object shape we set.
    expect(meta.robots).toBeDefined();
    expect(typeof meta.robots).toBe('object');
    const robots = meta.robots as { index?: boolean; follow?: boolean };
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(false);
  });

  test('does not leak slug in description / openGraph / twitter for missing repos', async () => {
    const { generateMetadata } = await import('@/app/repo/[name]/page');

    const slug = 'leak-probe-xyz';
    const meta = await generateMetadata({
      params: Promise.resolve({ name: slug }),
    });

    const blob = JSON.stringify(meta);
    expect(blob).not.toContain(slug);
  });
});
