/**
 * sitemap.test.ts — defense-in-depth privacy guard for sitemap generation.
 *
 * The 2026-04-27 hippo-harvest-assignment incident exposed three layers of
 * the static pipeline (library.json, llms.txt, sitemap.xml). The primary
 * fix lives in scripts/lib/privacy-filter.ts + scripts/fetch-library.ts —
 * those drop private rows BEFORE library.json is written.
 *
 * This test guards the next-most-likely failure mode: someone restores
 * library.json from an old snapshot, edits it manually, or runs sitemap
 * generation against a stale file. In all those cases sitemap.xml must
 * still fail closed.
 */

import {
  publicRepoNamesFromLibrary,
  type SitemapRepoEntry,
} from '../../scripts/lib/sitemap';
import {
  LEGACY_PRIVATE_BLOCKLIST,
  MissingPrivacyFieldError,
} from '../../scripts/lib/privacy-filter';

const PUBLIC = (overrides: Partial<SitemapRepoEntry> = {}): SitemapRepoEntry => ({
  name: 'public-tool',
  fullName: 'someone/public-tool',
  isPrivate: false,
  ...overrides,
});

const PRIVATE = (overrides: Partial<SitemapRepoEntry> = {}): SitemapRepoEntry => ({
  name: 'private-tool',
  fullName: 'someone/private-tool',
  isPrivate: true,
  ...overrides,
});

describe('publicRepoNamesFromLibrary', () => {
  it('keeps public repo names', () => {
    const names = publicRepoNamesFromLibrary([PUBLIC()]);
    expect(names).toEqual(['public-tool']);
  });

  it('drops private repos (isPrivate=true) from the sitemap', () => {
    const names = publicRepoNamesFromLibrary([
      PUBLIC({ name: 'a' }),
      PRIVATE({ name: 'b' }),
      PUBLIC({ name: 'c' }),
    ]);
    expect(names).toEqual(['a', 'c']);
  });

  it('drops repos flagged via the GitHub-REST `private` field', () => {
    const names = publicRepoNamesFromLibrary([
      PUBLIC({ name: 'a' }),
      { name: 'b', fullName: 'x/b', private: true },
    ]);
    expect(names).toEqual(['a']);
  });

  it('drops repos flagged via visibility="private" or "internal"', () => {
    const names = publicRepoNamesFromLibrary([
      { name: 'a', fullName: 'x/a', visibility: 'public' },
      { name: 'b', fullName: 'x/b', visibility: 'private' },
      { name: 'c', fullName: 'x/c', visibility: 'internal' },
    ]);
    expect(names).toEqual(['a']);
  });

  it('throws MissingPrivacyFieldError when a repo has no privacy signal', () => {
    // Mirror today's reporium-api /library/full payload: no isPrivate, no
    // private, no visibility. The helper must REFUSE rather than guess.
    expect(() =>
      publicRepoNamesFromLibrary([
        PUBLIC({ name: 'a' }),
        { name: 'unknown', fullName: 'x/unknown' },
      ]),
    ).toThrow(MissingPrivacyFieldError);
  });

  it('drops legacy-blocklisted repos even if API says public (defense-in-depth)', () => {
    // Pick a name that's in the static blocklist; the filter should still
    // drop it from the sitemap even when isPrivate=false.
    const knownPrivate = Array.from(LEGACY_PRIVATE_BLOCKLIST)[0];
    expect(knownPrivate).toBeTruthy();
    const names = publicRepoNamesFromLibrary([
      PUBLIC({ name: 'clean' }),
      { name: 'leaked', fullName: knownPrivate, isPrivate: false },
    ]);
    expect(names).toEqual(['clean']);
  });

  it('hippo-harvest-assignment regression — never appears in sitemap', () => {
    // The exact 2026-04-27 incident: a repo the API mislabels public but is
    // on our blocklist. Sitemap MUST drop it.
    const names = publicRepoNamesFromLibrary([
      PUBLIC({ name: 'clean' }),
      {
        name: 'hippo-harvest-assignment',
        fullName: 'perditioinc/hippo-harvest-assignment',
        isPrivate: false, // pretend the API mislabels it
      },
    ]);
    expect(names).not.toContain('hippo-harvest-assignment');
  });

  it('skips repo with missing/empty name (warns, does not crash)', () => {
    const warnings: string[] = [];
    const names = publicRepoNamesFromLibrary(
      [
        PUBLIC({ name: 'a' }),
        { fullName: 'x/no-name', isPrivate: false } as SitemapRepoEntry,
        PUBLIC({ name: '' }),
      ],
      (msg) => warnings.push(msg),
    );
    expect(names).toEqual(['a']);
    expect(warnings.length).toBe(2);
  });

  it('preserves repo order (stable filter)', () => {
    const names = publicRepoNamesFromLibrary([
      PUBLIC({ name: 'first' }),
      PRIVATE({ name: 'middle-dropped' }),
      PUBLIC({ name: 'last' }),
    ]);
    expect(names).toEqual(['first', 'last']);
  });
});
