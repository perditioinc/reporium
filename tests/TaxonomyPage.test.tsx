import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TaxonomyPage from '@/app/taxonomy/page';

jest.mock('next/link', () => {
  return function Link(props: { href: string; children: React.ReactNode; className?: string }) {
    return React.createElement('a', { href: props.href, className: props.className }, props.children);
  };
});

describe('TaxonomyPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('renders 8 dimension cards', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { dimension: 'skill_area', value: 'Agents', repo_count: 10 },
          { dimension: 'industry', value: 'Healthcare', repo_count: 7 },
          { dimension: 'use_case', value: 'Code generation', repo_count: 6 },
          { dimension: 'modality', value: 'Text', repo_count: 9 },
          { dimension: 'ai_trend', value: 'Agentic AI', repo_count: 8 },
          { dimension: 'deployment_context', value: 'Cloud', repo_count: 5 },
          { dimension: 'tags', value: 'production-ready', repo_count: 4 },
          { dimension: 'maturity_level', value: 'production', repo_count: 3 },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gaps: [
            { dimension: 'ai_trend', value: 'Long Context', repo_count: 1, gap_score: 0.81 },
            { dimension: 'industry', value: 'Finance', repo_count: 2, gap_score: 0.52 },
          ],
        }),
      }) as unknown as typeof fetch;

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
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gaps: [
            { dimension: 'ai_trend', value: 'Long Context', repo_count: 1, gap_score: 0.81 },
          ],
        }),
      }) as unknown as typeof fetch;

    const element = await TaxonomyPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Gap Analysis Summary');
    expect(html).toContain('Long Context');
    expect(html).toContain('amber');
  });
});
