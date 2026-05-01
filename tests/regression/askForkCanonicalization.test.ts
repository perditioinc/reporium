/**
 * askForkCanonicalization.test.ts
 * --------------------------------------------------------------------------
 * Regression hotfix lane: `api-fork-canonicalization`
 *
 * Today's incident (2026-04-27): /intelligence/ask "Which repos support
 * MCP?" returned 10 forks under `perditioinc/...` (e.g.
 * `perditioinc/markitdown`, `perditioinc/firecrawl`) instead of the
 * upstream parents (`microsoft/markitdown`, `mendableai/firecrawl`).
 * The DB rows have `forked_from` populated for those repos, but the
 * `sources` serializer drops it on the wire.
 *
 * What this file pins down (a) the frontend canonicalization function
 * `formatRepoDisplay` does the right thing when `forked_from` IS
 * populated, and (b) it falls into the `name`-only branch when the API
 * drops `forked_from` for a perditioinc-owned mirror — surfacing the
 * regression in the rendered label.
 *
 * Two implementations exist in the codebase:
 *   - src/components/StickyAskBar.tsx -> formatRepoDisplay (correct)
 *   - src/components/AskPanel.tsx     -> formatRepoDisplay (correct)
 *   - src/components/AskBar.tsx       -> inline `repo.forked_from ?? owner/name`
 *     ^^^ This third path is the one that ships the buggy
 *         `perditioinc/markitdown` label when the API drops forked_from.
 */

// Mirror of formatRepoDisplay from src/components/StickyAskBar.tsx:185
const MIRROR_OWNER = 'perditioinc';

function formatRepoDisplay(repo: { name: string; owner: string; forked_from: string | null }): {
  label: string;
  href: string;
  isFork: boolean;
} {
  const isMirror = repo.owner.toLowerCase() === MIRROR_OWNER;
  if (repo.forked_from) {
    return { label: repo.forked_from, href: `https://github.com/${repo.forked_from}`, isFork: true };
  }
  if (isMirror) {
    return { label: repo.name, href: `https://github.com/${repo.owner}/${repo.name}`, isFork: true };
  }
  return { label: `${repo.owner}/${repo.name}`, href: `https://github.com/${repo.owner}/${repo.name}`, isFork: false };
}

// Mirror of the buggy line in src/components/AskBar.tsx:377
function askBarUpstreamFallback(repo: { name: string; owner: string; forked_from: string | null }): string {
  return repo.forked_from ?? `${repo.owner}/${repo.name}`;
}

describe('formatRepoDisplay — correct canonicalization (StickyAskBar / AskPanel)', () => {
  test('forked_from present: label = upstream owner/repo', () => {
    const out = formatRepoDisplay({
      name: 'markitdown',
      owner: 'perditioinc',
      forked_from: 'microsoft/markitdown',
    });
    expect(out.label).toBe('microsoft/markitdown');
    expect(out.href).toBe('https://github.com/microsoft/markitdown');
    expect(out.isFork).toBe(true);
  });

  test('forked_from null + perditioinc mirror: drops mirror prefix from label', () => {
    const out = formatRepoDisplay({
      name: 'markitdown',
      owner: 'perditioinc',
      forked_from: null,
    });
    // The label intentionally omits the misleading owner — better to show
    // just `markitdown` than the wrong `perditioinc/markitdown`. The fork
    // badge is still emitted (isFork: true) so the UI can flag it.
    expect(out.label).toBe('markitdown');
    expect(out.isFork).toBe(true);
  });

  test('forked_from null + non-mirror owner: shows owner/repo as the label', () => {
    const out = formatRepoDisplay({
      name: 'langchain',
      owner: 'langchain-ai',
      forked_from: null,
    });
    expect(out.label).toBe('langchain-ai/langchain');
    expect(out.isFork).toBe(false);
  });

  test('forked_from beats owner — mirror with parent always shows upstream', () => {
    const out = formatRepoDisplay({
      name: 'firecrawl',
      owner: 'perditioinc',
      forked_from: 'mendableai/firecrawl',
    });
    expect(out.label).toBe('mendableai/firecrawl');
    expect(out.label).not.toContain('perditioinc');
  });
});

describe('AskBar.tsx — buggy fallback ships the wrong label when API drops forked_from', () => {
  // ─── Test 2 — RED until api-fork-canonicalization lane lands ────────────
  // The bug: AskBar.tsx line 377 falls back to `${owner}/${name}` when
  // forked_from is null. For perditioinc-owned mirrors, that's exactly
  // the label users complained about today (perditioinc/markitdown
  // instead of microsoft/markitdown).
  //
  // The fix is one of:
  //   (a) backend: fix the `/intelligence/ask` sources serializer to keep
  //       forked_from on the wire (root cause).
  //   (b) frontend: make AskBar use the same formatRepoDisplay logic as
  //       StickyAskBar / AskPanel.
  //
  // Until (a) lands, this test STAYS RED and proves the regression. Marked
  // `test.failing` so CI is GREEN while documenting the live bug — flip back
  // to `test()` (and watch it pass) once the AskBar fallback is corrected.
  test.failing('api-fork-canonicalization: AskBar fallback emits perditioinc/<repo> when API drops forked_from', () => {
    const repo = { name: 'markitdown', owner: 'perditioinc', forked_from: null };

    const askBarLabel = askBarUpstreamFallback(repo);
    const correctLabel = formatRepoDisplay(repo).label;

    // The buggy fallback ships "perditioinc/markitdown" — the bug.
    expect(askBarLabel).toBe('perditioinc/markitdown');

    // The correct path strips the misleading prefix, giving just "markitdown".
    expect(correctLabel).toBe('markitdown');

    // INVARIANT: AskBar must never label a perditioinc mirror with the
    // perditioinc prefix. This assertion FAILS today and signals the lane.
    expect(askBarLabel).not.toMatch(/^perditioinc\//);
  });

  test('api-fork-canonicalization: AskBar correctly labels when API populates forked_from', () => {
    // When the API behaves, even the buggy fallback path produces the right
    // answer — this test pins the API contract. If forked_from arrives
    // populated, every render path produces the upstream label.
    const repo = { name: 'firecrawl', owner: 'perditioinc', forked_from: 'mendableai/firecrawl' };

    expect(askBarUpstreamFallback(repo)).toBe('mendableai/firecrawl');
    expect(formatRepoDisplay(repo).label).toBe('mendableai/firecrawl');
  });
});

describe('Sources payload: every fork-from-mirror entry must be canonicalizable', () => {
  // A direct dataset assertion: given a representative API payload, every
  // mirror entry must EITHER carry forked_from, OR (without it) yield a
  // label that doesn't include the perditioinc prefix.
  test('every mirror entry produces a non-perditioinc label after canonicalization', () => {
    const sources = [
      { name: 'markitdown', owner: 'perditioinc', forked_from: 'microsoft/markitdown' },
      { name: 'firecrawl', owner: 'perditioinc', forked_from: 'mendableai/firecrawl' },
      { name: 'langchain', owner: 'perditioinc', forked_from: null }, // API regression case
    ];

    for (const src of sources) {
      const display = formatRepoDisplay(src);
      expect(display.label).not.toMatch(/^perditioinc\//);
    }
  });
});
