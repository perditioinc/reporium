/**
 * privacyFilter.test.ts — P0 hotfix 2026-04-28.
 *
 * Regression test for the static-private-leak hotfix. Fixture mixes one
 * public repo with one private repo and one repo that lacks any privacy
 * signal. The filter MUST:
 *   1. drop the private repo
 *   2. throw MissingPrivacyFieldError for the unknown one (no guessing)
 *   3. keep only the public repo when given a clean fixture
 *
 * Run: npm test -- privacyFilter
 */

import {
  classifyPrivacy,
  filterPrivateRepos,
  LEGACY_PRIVATE_BLOCKLIST,
  MissingPrivacyFieldError,
  type PrivacyEvaluable,
} from '../../scripts/lib/privacy-filter';

// Minimum fields the filter actually inspects, plus a couple of carry-through
// fields so we can prove it doesn't mutate or strip non-privacy data.
function repoFixture(overrides: Partial<PrivacyEvaluable> = {}): PrivacyEvaluable {
  return {
    name: 'sample',
    fullName: 'someone/sample',
    description: 'placeholder',
    isFork: false,
    ...overrides,
  };
}

describe('classifyPrivacy', () => {
  it('returns "private" when isPrivate === true', () => {
    expect(classifyPrivacy(repoFixture({ isPrivate: true }))).toBe('private');
  });

  it('returns "private" when private === true (GitHub REST shape)', () => {
    expect(classifyPrivacy(repoFixture({ private: true }))).toBe('private');
  });

  it('returns "private" when visibility === "private"', () => {
    expect(classifyPrivacy(repoFixture({ visibility: 'private' }))).toBe('private');
  });

  it('returns "private" when visibility === "internal" (conservative)', () => {
    expect(classifyPrivacy(repoFixture({ visibility: 'internal' }))).toBe('private');
  });

  it('returns "public" when isPrivate === false', () => {
    expect(classifyPrivacy(repoFixture({ isPrivate: false }))).toBe('public');
  });

  it('returns "public" when visibility === "public"', () => {
    expect(classifyPrivacy(repoFixture({ visibility: 'public' }))).toBe('public');
  });

  it('returns "unknown" when no privacy field is present', () => {
    // Note: matches today's reporium-api /library/full payload exactly —
    // this is the bug that lets hippo-harvest-assignment leak.
    const live = repoFixture({});
    expect(classifyPrivacy(live)).toBe('unknown');
  });

  it('returns "unknown" when isPrivate is null and no other signal', () => {
    expect(classifyPrivacy(repoFixture({ isPrivate: null }))).toBe('unknown');
  });

  it('does not infer privacy from name patterns or other fields', () => {
    // The fix is field-driven; we must not silently classify things on
    // heuristics like "name contains 'private'" or "fullName matches blocklist".
    expect(classifyPrivacy(repoFixture({ fullName: 'perditioinc/secret-stuff' }))).toBe('unknown');
  });
});

describe('filterPrivateRepos', () => {
  it('drops a private repo and keeps the public repo (1 public + 1 private fixture)', () => {
    const fixture: PrivacyEvaluable[] = [
      repoFixture({
        name: 'public-tool',
        fullName: 'someone/public-tool',
        isPrivate: false,
      }),
      repoFixture({
        name: 'private-tool',
        fullName: 'someone/private-tool',
        isPrivate: true,
      }),
    ];

    const { kept, dropped, legacyDropped } = filterPrivateRepos(fixture);

    expect(kept).toHaveLength(1);
    expect(kept[0].fullName).toBe('someone/public-tool');
    expect(dropped).toHaveLength(1);
    expect(dropped[0].fullName).toBe('someone/private-tool');
    expect(legacyDropped).toHaveLength(0);
  });

  it('throws MissingPrivacyFieldError if any repo has no privacy field', () => {
    // Mirror today's live API shape: one explicit-public repo plus one with
    // no privacy field at all (== current reporium-api behavior).
    const fixture: PrivacyEvaluable[] = [
      repoFixture({ fullName: 'someone/ok', isPrivate: false }),
      repoFixture({ fullName: 'perditioinc/hippo-harvest-assignment' }),
    ];

    expect(() => filterPrivateRepos(fixture)).toThrow(MissingPrivacyFieldError);
  });

  it('lists the missing-field offenders on the error', () => {
    const fixture: PrivacyEvaluable[] = [
      repoFixture({ fullName: 'a/one' }),
      repoFixture({ fullName: 'a/two' }),
    ];

    try {
      filterPrivateRepos(fixture);
      throw new Error('expected MissingPrivacyFieldError');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingPrivacyFieldError);
      const e = err as MissingPrivacyFieldError;
      expect(e.culprits).toEqual(expect.arrayContaining(['a/one', 'a/two']));
      expect(e.message).toMatch(/isPrivate.*private.*visibility/);
    }
  });

  it('catches a known-private repo via legacy blocklist even if API mislabels it public', () => {
    // Pick a name that is in the static blocklist; the filter should still drop it.
    const knownPrivate = Array.from(LEGACY_PRIVATE_BLOCKLIST)[0];
    expect(knownPrivate).toBeTruthy();

    const fixture: PrivacyEvaluable[] = [
      repoFixture({
        name: 'should-be-clean',
        fullName: 'someone/should-be-clean',
        isPrivate: false,
      }),
      repoFixture({
        name: 'mislabelled',
        fullName: knownPrivate,
        isPrivate: false, // API erroneously reports public — defense-in-depth must catch.
      }),
    ];

    const { kept, dropped, legacyDropped } = filterPrivateRepos(fixture);

    expect(kept).toHaveLength(1);
    expect(kept[0].fullName).toBe('someone/should-be-clean');
    expect(dropped).toHaveLength(0);
    expect(legacyDropped).toHaveLength(1);
    expect(legacyDropped[0].fullName).toBe(knownPrivate);
  });

  it('preserves carry-through fields on kept repos (no mutation)', () => {
    const fixture: PrivacyEvaluable[] = [
      repoFixture({
        fullName: 'someone/public',
        isPrivate: false,
        description: 'unchanged',
        isFork: true,
      }),
    ];
    const { kept } = filterPrivateRepos(fixture);
    expect(kept[0].description).toBe('unchanged');
    expect(kept[0].isFork).toBe(true);
  });

  it('hippo-harvest-assignment regression — name is in the static blocklist', () => {
    // The 2026-04-27 incident. The name MUST be in the legacy blocklist so
    // even if the API never gains a privacy field, the build fails closed.
    expect(LEGACY_PRIVATE_BLOCKLIST.has('perditioinc/hippo-harvest-assignment')).toBe(true);
  });
});
