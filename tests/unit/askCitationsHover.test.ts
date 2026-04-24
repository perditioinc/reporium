/**
 * PR9 — citation hover preview helpers (pure logic only).
 *
 * `buildSourceAnchorMap` + `findSourceByCitationHref` together replace the
 * O(n) per-hover scan over the source list with an O(1) anchor-id lookup.
 * Two forks of the same name must remain distinguishable (different owners
 * yield different anchor ids), so the map is fork-safe.
 *
 * `describeForHover` and `formatStars` (re-exported via the component file)
 * trim repo data into a one-line preview the floating card can render
 * without overflowing.
 */
import {
  buildSourceAnchorMap,
  findSourceByCitationHref,
  sourceAnchorId,
  CITATION_HREF_PREFIX,
} from '@/lib/askCitations';
import { describeForHover } from '@/components/CitationHoverCard';

interface TestRepo {
  owner: string;
  name: string;
  stars?: number | null;
  description?: string | null;
}

describe('buildSourceAnchorMap', () => {
  it('builds an empty map for an empty source list', () => {
    expect(buildSourceAnchorMap<TestRepo>([])).toEqual(new Map());
  });

  it('keys each source by its sourceAnchorId', () => {
    const sources: TestRepo[] = [
      { owner: 'langchain-ai', name: 'langchain' },
      { owner: 'jerryjliu', name: 'llama_index' },
    ];
    const map = buildSourceAnchorMap(sources);
    expect(map.size).toBe(2);
    expect(map.get(sourceAnchorId(sources[0]))).toBe(sources[0]);
    expect(map.get(sourceAnchorId(sources[1]))).toBe(sources[1]);
  });

  it('fork-safe: forks of the same name with different owners get distinct keys', () => {
    const upstream: TestRepo = { owner: 'pytorch', name: 'pytorch' };
    const fork: TestRepo = { owner: 'perditioinc', name: 'pytorch' };
    const map = buildSourceAnchorMap([upstream, fork]);
    expect(map.size).toBe(2);
    expect(sourceAnchorId(upstream)).not.toBe(sourceAnchorId(fork));
    expect(map.get(sourceAnchorId(upstream))).toBe(upstream);
    expect(map.get(sourceAnchorId(fork))).toBe(fork);
  });

  it('on duplicate ids the last write wins (defensive — should not occur in practice)', () => {
    // Two repos with identical owner+name yield identical anchor ids;
    // realistically the API dedupes upstream, but the map should not throw.
    const a: TestRepo = { owner: 'foo', name: 'bar' };
    const b: TestRepo = { owner: 'foo', name: 'bar' };
    const map = buildSourceAnchorMap([a, b]);
    expect(map.size).toBe(1);
    expect(map.get(sourceAnchorId(a))).toBe(b);
  });
});

describe('findSourceByCitationHref', () => {
  const sources: TestRepo[] = [
    { owner: 'langchain-ai', name: 'langchain' },
    { owner: 'jerryjliu', name: 'llama_index' },
  ];
  const map = buildSourceAnchorMap(sources);

  it('returns the source for a matching citation href', () => {
    const href = `#${sourceAnchorId(sources[0])}`;
    expect(findSourceByCitationHref(href, map)).toBe(sources[0]);
  });

  it('returns null for null/undefined hrefs', () => {
    expect(findSourceByCitationHref(null, map)).toBeNull();
    expect(findSourceByCitationHref(undefined, map)).toBeNull();
    expect(findSourceByCitationHref('', map)).toBeNull();
  });

  it('returns null for non-citation hrefs (external links, fragments)', () => {
    expect(findSourceByCitationHref('https://github.com/foo/bar', map)).toBeNull();
    expect(findSourceByCitationHref('#unrelated-anchor', map)).toBeNull();
    expect(findSourceByCitationHref('mailto:x@y.z', map)).toBeNull();
  });

  it('returns null for citation-prefix hrefs that do not match any anchor', () => {
    const href = `${CITATION_HREF_PREFIX}does-not-exist`;
    expect(findSourceByCitationHref(href, map)).toBeNull();
  });

  it('uses the precomputed map (no scan over sources)', () => {
    // Guard: the function reads from the passed-in map only. A map built
    // from an empty list must not match anything even if the href looks valid.
    const empty = buildSourceAnchorMap<TestRepo>([]);
    const href = `#${sourceAnchorId(sources[0])}`;
    expect(findSourceByCitationHref(href, empty)).toBeNull();
  });
});

describe('describeForHover', () => {
  it('returns empty string for null/undefined/blank inputs', () => {
    expect(describeForHover(null)).toBe('');
    expect(describeForHover(undefined)).toBe('');
    expect(describeForHover('')).toBe('');
    expect(describeForHover('   ')).toBe('');
  });

  it('prefers the first sentence when it fits inside the cap', () => {
    const desc = 'A retrieval framework. With many features and integrations.';
    expect(describeForHover(desc, 140)).toBe('A retrieval framework.');
  });

  it('handles ! and ? as sentence terminators', () => {
    expect(describeForHover('Wow! Amazing tool.')).toBe('Wow!');
    expect(describeForHover('What is RAG? It stands for retrieval augmented generation.')).toBe('What is RAG?');
  });

  it('returns the trimmed description when shorter than the cap and has no sentence end', () => {
    expect(describeForHover('short tagline')).toBe('short tagline');
  });

  it('truncates with an ellipsis when no sentence end is found and length exceeds the cap', () => {
    const long = 'a'.repeat(200);
    const out = describeForHover(long, 50);
    expect(out.endsWith('…')).toBe(true);
    // Cap is on the pre-ellipsis content, so total length is cap + 1.
    expect(out.length).toBeLessThanOrEqual(51);
  });

  it('falls back to the cap when the first sentence itself exceeds maxLen', () => {
    // First sentence is 200 chars but cap is 50 — must not return that whole sentence.
    const huge = 'x'.repeat(200) + '. short next.';
    const out = describeForHover(huge, 50);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
  });

  it('trims leading/trailing whitespace before processing', () => {
    expect(describeForHover('  hello world.  ')).toBe('hello world.');
  });
});
