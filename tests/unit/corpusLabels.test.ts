import { reposIndexedLabel, marketingCount, MARKETING_REPOS_LABEL } from '@/lib/corpusLabels';
import { REPOS_INDEXED_LABEL, CORPUS_STATS } from '@/lib/corpusConstants.generated';

describe('reposIndexedLabel', () => {
  it('falls back to REPOS_INDEXED_LABEL when live count is null', () => {
    expect(reposIndexedLabel(null)).toBe(REPOS_INDEXED_LABEL);
  });

  it('falls back to REPOS_INDEXED_LABEL when live count is undefined', () => {
    expect(reposIndexedLabel(undefined)).toBe(REPOS_INDEXED_LABEL);
  });

  it('never returns "0" while corpus is non-zero (audit S2 fix)', () => {
    // The fallback path: data?.repos.length === undefined → must not render "0"
    // unless CORPUS_STATS.reposIndexed is genuinely 0.
    expect(CORPUS_STATS.reposIndexed).toBeGreaterThan(0);
    expect(reposIndexedLabel(null)).not.toBe('0');
    expect(reposIndexedLabel(undefined)).not.toBe('0');
  });

  it('formats live count with thousands separator', () => {
    expect(reposIndexedLabel(1856)).toBe('1,856');
    expect(reposIndexedLabel(42)).toBe('42');
  });

  it('passes through 0 when corpus is genuinely zero', () => {
    // The label is allowed to read "0" only when the live count is explicitly 0,
    // not when it's null/undefined. This protects against the fallback masking
    // a real "no data" state if it ever becomes accurate.
    expect(reposIndexedLabel(0)).toBe('0');
  });
});

describe('marketingCount', () => {
  it('rounds down to the nearest 100', () => {
    expect(marketingCount('1,856')).toBe('1,800');
    expect(marketingCount('1,825')).toBe('1,800');
    expect(marketingCount('1,400')).toBe('1,400');
    expect(marketingCount('999')).toBe('900');
  });

  it('handles labels with commas', () => {
    expect(marketingCount('12,345')).toBe('12,300');
  });

  it('returns the label unchanged when not parseable', () => {
    expect(marketingCount('not-a-number')).toBe('not-a-number');
  });
});

describe('MARKETING_REPOS_LABEL', () => {
  it('is derived from the generated REPOS_INDEXED_LABEL', () => {
    expect(MARKETING_REPOS_LABEL).toBe(marketingCount(REPOS_INDEXED_LABEL));
  });

  it('does not contain stale "1,400" when corpus has grown past it (audit S3 fix)', () => {
    // The site previously hardcoded "1,400+" in the meta description while
    // the corpus had grown to 1,856. The marketing label must always be at
    // least as fresh as the generated corpus constant.
    if (CORPUS_STATS.reposIndexed >= 1500) {
      expect(MARKETING_REPOS_LABEL).not.toBe('1,400');
    }
  });

  it('rounds-down to a multiple of 100', () => {
    const n = parseInt(MARKETING_REPOS_LABEL.replace(/,/g, ''), 10);
    expect(n % 100).toBe(0);
  });
});
