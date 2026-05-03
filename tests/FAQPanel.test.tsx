/** @jest-environment jsdom */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { FAQPanel } from '@/components/FAQPanel';

// KAN-183: assert that the FAQ list defers markdown render until a card is
// expanded. Without deferral, mounting <ReactMarkdown> for ~100 entries up
// front blows the main-thread budget (TBT 342ms on mobile Lighthouse).

// react-markdown is ESM-only in v9+ and trips ts-jest's CJS pipeline. Mock it
// to a marker element so we can count rendered bodies via querySelector.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    <div data-testid="rendered-markdown">{children}</div>
  ),
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => () => undefined }));
jest.mock('rehype-sanitize', () => ({ __esModule: true, default: () => () => undefined }));

const FAQ_FIXTURE = {
  generatedAt: '2026-05-03T00:00:00Z',
  sections: [
    {
      title: 'Section A',
      blurb: 'blurb a',
      questions: ['Q1?', 'Q2?', 'Q3?'],
    },
    {
      title: 'Section B',
      blurb: 'blurb b',
      questions: ['Q4?', 'Q5?'],
    },
  ],
  answers: {
    'Q1?': {
      answer: '**Answer for Q1.**',
      sources: [],
      model: 'claude-test',
      generatedAt: '2026-05-03T00:00:00Z',
    },
    'Q2?': {
      answer: 'Answer for Q2.',
      sources: [],
      model: 'claude-test',
      generatedAt: '2026-05-03T00:00:00Z',
    },
    'Q3?': {
      answer: 'Answer for Q3.',
      sources: [],
      model: 'claude-test',
      generatedAt: '2026-05-03T00:00:00Z',
    },
    'Q4?': {
      answer: 'Answer for Q4.',
      sources: [],
      model: 'claude-test',
      generatedAt: '2026-05-03T00:00:00Z',
    },
    'Q5?': {
      answer: 'Answer for Q5.',
      sources: [],
      model: 'claude-test',
      generatedAt: '2026-05-03T00:00:00Z',
    },
  },
};

describe('FAQPanel (KAN-183 render-on-demand)', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => FAQ_FIXTURE,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders all question summaries up-front (preserves SEO/text)', async () => {
    render(<FAQPanel />);

    // Wait for the fetched data to resolve and questions to appear.
    expect(await screen.findByText('Q1?')).toBeTruthy();
    expect(screen.getByText('Q2?')).toBeTruthy();
    expect(screen.getByText('Q3?')).toBeTruthy();
    expect(screen.getByText('Q4?')).toBeTruthy();
    expect(screen.getByText('Q5?')).toBeTruthy();
  });

  test('does NOT render any markdown bodies until a card is expanded', async () => {
    const { container } = render(<FAQPanel />);

    // Wait for FAQ data to load (questions appear).
    await screen.findByText('Q1?');

    // No markdown bodies should be mounted yet — that's the whole point of the
    // KAN-183 fix. Even though five <details> elements are in the DOM, none of
    // them should have rendered <ReactMarkdown>.
    const renderedBodies = container.querySelectorAll('[data-testid="rendered-markdown"]');
    expect(renderedBodies.length).toBe(0);
  });

  test('renders a single markdown body after one card is expanded', async () => {
    const { container } = render(<FAQPanel />);

    await screen.findByText('Q1?');

    // Expand Q1 by toggling its <details>. JSDOM fires onToggle when `open`
    // changes; toggling the property directly + dispatching the event mimics
    // the browser's native click-to-open behavior.
    const detailsList = container.querySelectorAll('details');
    expect(detailsList.length).toBe(5);

    const first = detailsList[0] as HTMLDetailsElement;
    act(() => {
      first.open = true;
      first.dispatchEvent(new Event('toggle', { bubbles: false }));
    });

    await waitFor(() => {
      const rendered = container.querySelectorAll('[data-testid="rendered-markdown"]');
      expect(rendered.length).toBe(1);
    });

    // The other four cards are still un-rendered.
    const stillCollapsed = container.querySelectorAll('[data-testid="rendered-markdown"]');
    expect(stillCollapsed.length).toBe(1);
  });
});
