import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TaxonomyPage from '@/app/taxonomy/page';

jest.mock('next/link', () => {
  return function Link(props: { href: string; children: React.ReactNode; className?: string }) {
    return React.createElement('a', { href: props.href, className: props.className }, props.children);
  };
});

describe('TaxonomyPage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    // TaxonomyPage now routes through createDataProvider() which needs an API URL
    process.env = { ...originalEnv, NEXT_PUBLIC_REPORIUM_API_URL: 'https://api.example.com' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Per-dimension seed values used by the fetch mock below.
  const dimSeed: Record<string, { name: string; repo_count: number }> = {
    skill_area: { name: 'Agents', repo_count: 10 },
    industry: { name: 'Healthcare', repo_count: 7 },
    use_case: { name: 'Code generation', repo_count: 6 },
    modality: { name: 'Text', repo_count: 9 },
    ai_trend: { name: 'Agentic AI', repo_count: 8 },
    deployment_context: { name: 'Cloud', repo_count: 5 },
    tags: { name: 'production-ready', repo_count: 4 },
    maturity_level: { name: 'production', repo_count: 3 },
  };

  function buildFetchMock(opts: { dimHasValues: boolean; gaps: Array<Record<string, unknown>> }) {
    return jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      // Per-dimension taxonomy endpoint: /taxonomy/{dim}
      const dimMatch = url.match(/\/taxonomy\/([a-z_]+)(?:$|\?)/);
      if (dimMatch) {
        const dim = dimMatch[1];
        const seed = dimSeed[dim];
        return {
          ok: true,
          json: async () => ({
            dimension: dim,
            values: opts.dimHasValues && seed
              ? [{ id: 1, dimension: dim, name: seed.name, repo_count: seed.repo_count }]
              : [],
          }),
        };
      }
      if (url.includes('/gaps/taxonomy')) {
        return { ok: true, json: async () => ({ gaps: opts.gaps }) };
      }
      if (url.includes('/library/full')) {
        // getDerivedDimensionValues routes through getLibrary()
        return {
          ok: true,
          json: async () => ({ repos: [], totalPages: 1, totalRepos: 0 }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;
  }

  test('renders 8 dimension cards', async () => {
    global.fetch = buildFetchMock({
      dimHasValues: true,
      gaps: [
        { dimension: 'ai_trend', value: 'Long Context', repo_count: 1, gap_score: 0.81 },
        { dimension: 'industry', value: 'Finance', repo_count: 2, gap_score: 0.52 },
      ],
    });

    const element = await TaxonomyPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Skill Areas');
    expect(html).toContain('Industries');
    expect(html).toContain('Use Cases');
    expect(html).toContain('Modalities');
    expect(html).toContain('AI Trends');
    expect(html).toContain('Deployment Context');
    expect(html).toContain('Tags');
    expect(html).toContain('Maturity Level');
  });

  test('renders gap chips with the expected labels', async () => {
    global.fetch = buildFetchMock({
      dimHasValues: false,
      gaps: [
        { dimension: 'ai_trend', value: 'Long Context', repo_count: 1, gap_score: 0.81 },
      ],
    });

    const element = await TaxonomyPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Gap Analysis Summary');
    expect(html).toContain('Long Context');
    expect(html).toContain('amber');
  });
});
