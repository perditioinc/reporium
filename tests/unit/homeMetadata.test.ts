/**
 * @jest-environment node
 *
 * Server-component metadata test. Runs in the Node environment because the
 * page module imports server-only Next types and our Metadata object is
 * computed at module load.
 */
import { metadata } from '@/app/page';
import { CORPUS_STATS, REPOS_INDEXED_LABEL } from '@/lib/corpusConstants.generated';
import { MARKETING_REPOS_LABEL } from '@/lib/corpusLabels';

describe('home page metadata', () => {
  it('description references the marketing-rounded corpus label', () => {
    expect(metadata.description).toContain(`${MARKETING_REPOS_LABEL}+ AI development tools`);
  });

  it('does not contain stale "1,400+" copy when corpus is past 1,400', () => {
    // Audit S3 (2026-04-27): meta description was hardcoded "1,400+" while
    // corpus had grown to 1,856. Guard against the regression.
    if (CORPUS_STATS.reposIndexed >= 1500) {
      expect(metadata.description).not.toMatch(/\b1,400\+/);
    }
  });

  it('marketing label is rounded down to a multiple of 100', () => {
    const n = parseInt(MARKETING_REPOS_LABEL.replace(/,/g, ''), 10);
    expect(n % 100).toBe(0);
    expect(n).toBeLessThanOrEqual(parseInt(REPOS_INDEXED_LABEL.replace(/,/g, ''), 10));
  });

  it('openGraph and twitter descriptions match the meta description', () => {
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.description).toBe(metadata.description);
  });
});
