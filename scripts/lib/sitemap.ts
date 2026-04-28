/**
 * sitemap.ts — pure helpers for sitemap generation.
 *
 * Extracted into a separate module so the privacy-filter integration is
 * unit-testable without spawning the full ``generate-sitemap.ts`` script.
 *
 * Contract: ``publicRepoNamesFromLibrary`` is the single point that decides
 * which repo names land in the public sitemap. It re-runs the centralized
 * privacy filter as defense-in-depth so that even if ``fetch-library.ts`` is
 * bypassed (e.g., an operator restores library.json from an old snapshot),
 * a private row cannot reach sitemap.xml.
 */
import {
  filterPrivateRepos,
  type PrivacyEvaluable,
} from './privacy-filter';

export interface SitemapRepoEntry extends PrivacyEvaluable {
  name?: string;
}

/**
 * Filter a repos[] array into the names safe to publish in sitemap.xml.
 *
 * - Re-runs ``filterPrivateRepos`` so the sitemap fails closed independently
 *   of the upstream generator. Throws ``MissingPrivacyFieldError`` (from
 *   privacy-filter) if any repo lacks a privacy signal — never guesses.
 * - Drops repos whose ``name`` is missing/empty (a sitemap entry with no
 *   target path is a 404 by definition; emit a warning rather than failing
 *   the whole build).
 */
export function publicRepoNamesFromLibrary(
  repos: SitemapRepoEntry[],
  warn: (msg: string) => void = console.warn,
): string[] {
  const { kept } = filterPrivateRepos(repos);
  const names: string[] = [];
  for (const repo of kept) {
    if (typeof repo.name === 'string' && repo.name.length > 0) {
      names.push(repo.name);
    } else {
      warn(
        `[generate-sitemap] dropping repo with missing/empty name field: ${
          JSON.stringify(repo).slice(0, 120)
        }`,
      );
    }
  }
  return names;
}
