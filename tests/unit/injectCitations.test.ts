/**
 * injectCitations.test.ts — PR7 (Ask UX inline citations).
 *
 * Pure-function tests for the markdown text pre-processor that turns
 * bare repo-name mentions into in-document anchor links pointing at
 * the matching source card.
 */

import { injectCitations } from '@/lib/askCitations';

const REPOS = {
  langchain: { owner: 'langchain-ai', name: 'langchain' },
  langgraph: { owner: 'langchain-ai', name: 'langgraph' },
  langchainCommunity: { owner: 'langchain-ai', name: 'langchain-community' },
  haystack: { owner: 'deepset-ai', name: 'haystack' },
  // forks of the same name living under different owners (collision case)
  langchainFork: { owner: 'perditioinc', name: 'langchain' },
};

describe('injectCitations', () => {
  it('returns input unchanged when sources is empty', () => {
    expect(injectCitations('hello langchain world', [])).toBe('hello langchain world');
  });

  it('returns input unchanged when text is empty', () => {
    expect(injectCitations('', [REPOS.langchain])).toBe('');
  });

  it('wraps a bare repo-name mention in a markdown link to its anchor', () => {
    const out = injectCitations('Try langchain for this.', [REPOS.langchain]);
    expect(out).toBe('Try [langchain](#ask-source-langchain-ai-langchain) for this.');
  });

  it('preserves the visible casing of the matched word', () => {
    const out = injectCitations('Use LangChain here.', [REPOS.langchain]);
    expect(out).toBe('Use [LangChain](#ask-source-langchain-ai-langchain) here.');
  });

  it('only links the first occurrence of a given repo to avoid noise', () => {
    const out = injectCitations(
      'langchain is great. langchain again. and langchain once more.',
      [REPOS.langchain],
    );
    // first only
    expect(out).toBe(
      '[langchain](#ask-source-langchain-ai-langchain) is great. langchain again. and langchain once more.',
    );
  });

  it('prefers the longer match when one repo name is a prefix of another', () => {
    const out = injectCitations(
      'Compare langchain-community against langchain itself.',
      [REPOS.langchain, REPOS.langchainCommunity],
    );
    // longer name wins on the first slot, then plain "langchain" gets linked second
    expect(out).toBe(
      'Compare [langchain-community](#ask-source-langchain-ai-langchain-community) against [langchain](#ask-source-langchain-ai-langchain) itself.',
    );
  });

  it('skips matches inside a fenced code block', () => {
    const input = 'See code:\n```\npip install langchain\n```\nthen ask about langchain.';
    const out = injectCitations(input, [REPOS.langchain]);
    // the fenced block is untouched; only the prose mention is linked
    expect(out).toContain('```\npip install langchain\n```');
    expect(out).toContain('then ask about [langchain](#ask-source-langchain-ai-langchain).');
  });

  it('skips matches inside inline code', () => {
    const out = injectCitations('Run `langchain init` then try langchain.', [REPOS.langchain]);
    expect(out).toBe('Run `langchain init` then try [langchain](#ask-source-langchain-ai-langchain).');
  });

  it('skips matches that already appear inside a markdown link', () => {
    const input = 'See [langchain](https://example.com) and also langchain again.';
    const out = injectCitations(input, [REPOS.langchain]);
    // the existing link is preserved; the prose mention is linked
    expect(out).toBe(
      'See [langchain](https://example.com) and also [langchain](#ask-source-langchain-ai-langchain) again.',
    );
  });

  it('skips repo names that are too short', () => {
    const out = injectCitations('use foo for this', [{ owner: 'a', name: 'foo' }]);
    expect(out).toBe('use foo for this'); // 3 chars < min
  });

  it('skips generic repo names from the blocklist', () => {
    const out = injectCitations('open the docs and the agent', [
      { owner: 'a', name: 'docs' },
      { owner: 'b', name: 'agent' },
    ]);
    expect(out).toBe('open the docs and the agent');
  });

  it('respects word boundaries (no partial matches)', () => {
    // "langchainjs" should not match "langchain"
    const out = injectCitations('Try langchainjs and others.', [REPOS.langchain]);
    expect(out).toBe('Try langchainjs and others.');
  });

  it('handles multiple distinct repos in one paragraph', () => {
    const out = injectCitations(
      'For RAG, langchain and haystack are both popular.',
      [REPOS.langchain, REPOS.haystack],
    );
    expect(out).toBe(
      'For RAG, [langchain](#ask-source-langchain-ai-langchain) and [haystack](#ask-source-deepset-ai-haystack) are both popular.',
    );
  });

  it('uses owner+name in the anchor so forks of the same name are addressable', () => {
    // Two repos both named "langchain" (one upstream, one perditio-mirrored fork)
    // should produce different anchors. Sorted by name length, the first match
    // in source-order wins. In practice these don't appear together in one
    // sources block (the API returns one canonical repo per name), but the
    // anchor scheme must remain owner-disambiguated.
    const linkUpstream = injectCitations('Use langchain here.', [REPOS.langchain]);
    expect(linkUpstream).toContain('#ask-source-langchain-ai-langchain');
    const linkFork = injectCitations('Use langchain here.', [REPOS.langchainFork]);
    expect(linkFork).toContain('#ask-source-perditioinc-langchain');
  });

  it('does not double-link inside an injected link on subsequent passes', () => {
    // Run the function twice; second pass should be a no-op for already-linked text.
    const once = injectCitations('Try langchain here.', [REPOS.langchain]);
    const twice = injectCitations(once, [REPOS.langchain]);
    expect(twice).toBe(once);
  });
});
