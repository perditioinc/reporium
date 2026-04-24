/**
 * askCitations.ts — PR7 (Ask UX inline citations)
 *
 * Pure-function helpers for turning bare repo-name mentions in a synthesized
 * answer into in-document anchor links pointing at the matching source card.
 *
 * Lives outside StickyAskBar.tsx so unit tests can import it without dragging
 * in react-markdown (ESM-only) and the full component dependency graph.
 */

/** Stable DOM id for a source card. owner+name disambiguates forks. */
export function sourceAnchorId(repo: { owner: string; name: string }): string {
  const slug = `${repo.owner}-${repo.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `ask-source-${slug}`;
}

/** Internal anchor href prefix used by injected citations. */
export const CITATION_HREF_PREFIX = '#ask-source-';

/** Repo names this short or this generic are skipped — too risky for false matches. */
export const CITATION_NAME_MIN_LEN = 4;
export const CITATION_NAME_BLOCKLIST: ReadonlySet<string> = new Set([
  'node', 'next', 'tools', 'core', 'docs', 'main', 'data', 'apis',
  'agent', 'agents', 'chat', 'demo', 'demos', 'test', 'tests', 'utils',
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pattern matching anything we should skip when looking for repo-name mentions. */
const SKIP_TOKEN_RE = /(```[\s\S]*?```|`[^`]*`|!?\[[^\]]*\]\([^)]*\))/g;

/**
 * Find the first word-boundary, case-insensitive occurrence of `needle` in `s`
 * that is NOT inside a fenced code block, inline code span, or markdown link/image.
 * Returns the match start index and the actually-matched substring (preserving
 * the visible casing), or null if no safe occurrence exists.
 */
function findSafeMatch(s: string, needle: string): { start: number; text: string } | null {
  // Build a per-character mask: 1 = skip (inside code/link), 0 = scan.
  const skip = new Uint8Array(s.length);
  for (const m of s.matchAll(SKIP_TOKEN_RE)) {
    const start = m.index ?? 0;
    for (let i = start; i < start + m[0].length; i++) skip[i] = 1;
  }
  const re = new RegExp(`\\b(${escapeRegExp(needle)})\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (!skip[m.index]) return { start: m.index, text: m[1] };
  }
  return null;
}

/**
 * Pre-process the answer text to wrap repo-name mentions in markdown links.
 *
 * - Skips matches inside fenced code, inline code, link text, link href, and
 *   image syntax. Re-tokenises after each injection so the next candidate
 *   correctly skips the just-injected link.
 * - Word-boundary, case-insensitive match; preserves the user-visible casing.
 * - Each (owner+name) repo is linked at most once per answer to avoid
 *   visual noise on long lists.
 * - Longer repo names are matched first so `langchain-community` wins over
 *   `langchain` on overlapping text.
 */
export function injectCitations(
  text: string,
  sources: ReadonlyArray<{ owner: string; name: string }>,
): string {
  if (!text || sources.length === 0) return text;

  const candidates = sources
    .filter((s) => s.name.length >= CITATION_NAME_MIN_LEN
                && !CITATION_NAME_BLOCKLIST.has(s.name.toLowerCase()))
    .slice()
    .sort((a, b) => b.name.length - a.name.length);
  if (candidates.length === 0) return text;

  let out = text;
  const linked = new Set<string>();
  for (const repo of candidates) {
    const key = `${repo.owner}/${repo.name}`.toLowerCase();
    if (linked.has(key)) continue;
    const match = findSafeMatch(out, repo.name);
    if (!match) continue;
    linked.add(key);
    out =
      out.slice(0, match.start) +
      `[${match.text}](#${sourceAnchorId(repo)})` +
      out.slice(match.start + match.text.length);
  }
  return out;
}

/**
 * PR9: O(1) lookup map from citation anchor id to its source repo. Used by
 * the citation hover preview to render a small floating card with stars +
 * description on hover, without re-scanning the source list per hover.
 *
 * Key shape: the result of `sourceAnchorId(repo)`. Two forks of the same
 * name produce two distinct keys, so the map is fork-safe.
 */
export function buildSourceAnchorMap<T extends { owner: string; name: string }>(
  sources: ReadonlyArray<T>,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const s of sources) {
    map.set(sourceAnchorId(s), s);
  }
  return map;
}

/**
 * PR9: extract the source for a citation `href` such as
 * `#ask-source-langchain-ai-langchain` from a precomputed anchor map.
 * Returns null on any non-citation href or unknown anchor.
 */
export function findSourceByCitationHref<T extends { owner: string; name: string }>(
  href: string | undefined | null,
  anchorMap: ReadonlyMap<string, T>,
): T | null {
  if (!href || !href.startsWith(CITATION_HREF_PREFIX)) return null;
  const id = href.slice(1); // drop leading '#'
  return anchorMap.get(id) ?? null;
}

/**
 * Click handler for in-document citation links. Scrolls the matching source
 * card into view and applies a brief ring-flash highlight.
 */
export function handleCitationClick(href: string): void {
  if (typeof document === 'undefined') return;
  const id = href.slice(1); // drop leading '#'
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const prevTransition = target.style.transition;
  const prevBoxShadow = target.style.boxShadow;
  target.style.transition = 'box-shadow 200ms ease-out';
  target.style.boxShadow = '0 0 0 2px rgb(167 139 250 / 0.7)'; // violet-400 @70%
  window.setTimeout(() => {
    target.style.boxShadow = prevBoxShadow;
    window.setTimeout(() => {
      target.style.transition = prevTransition;
    }, 220);
  }, 1000);
}
