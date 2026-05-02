import { readFileSync } from 'fs';
import { join } from 'path';
import { CORPUS_STATS, REPOS_INDEXED_LABEL } from '@/lib/corpusConstants.generated';

describe('public/llms.txt freshness', () => {
  const llmsPath = join(process.cwd(), 'public', 'llms.txt');
  const text = readFileSync(llmsPath, 'utf-8');

  it('embeds the current REPOS_INDEXED_LABEL', () => {
    // Catches the same drift the audit flagged on 2026-04-27 — llms.txt
    // hardcoded "1,825 AI development tools" while the corpus had grown to 1,856.
    expect(text).toContain(REPOS_INDEXED_LABEL);
  });

  it('embeds the current categories count', () => {
    expect(text).toMatch(new RegExp(`across ${CORPUS_STATS.categories} categories`));
    expect(text).toMatch(new RegExp(`AI taxonomy \\(${CORPUS_STATS.categories} categories\\)`));
  });

  it('does not contain unsubstituted template placeholders', () => {
    // If the template was not run through write-corpus-constants.cjs, we'd
    // see literal {{REPOS_INDEXED_LABEL}} etc. — guard against that.
    expect(text).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('does not contain stale "1,825" if corpus has moved past it', () => {
    if (CORPUS_STATS.reposIndexed > 1825) {
      expect(text).not.toMatch(/\b1,825 AI/);
    }
  });
});
