/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AskPanel } from '@/components/AskPanel';

// useSearchParams() requires a Next.js router context that jsdom doesn't provide.
// Use a controllable jest.fn() so individual tests can inject URL params.
const getSearchParams = jest.fn(() => new URLSearchParams());

jest.mock('next/navigation', () => ({
  useSearchParams: () => getSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));

describe('AskPanel', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    getSearchParams.mockReturnValue(new URLSearchParams());
  });

  test('renders input and submits to the API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        answer: 'Use the RAG stack.',
        question: 'best RAG tools',
        model: 'claude-3',
        answered_at: new Date().toISOString(),
        embedding_candidates: 10,
        tokens_used: { input: 100, output: 50, total: 150 },
        sources: [{
          name: 'repo-a',
          owner: 'perditioinc',
          forked_from: null,
          description: 'Repo A',
          stars: 42,
          relevance_score: 0.91,
          problem_solved: null,
          integration_tags: [],
        }],
      }),
    }) as unknown as typeof fetch;

    render(<AskPanel apiUrl="https://api.example.com" />);

    fireEvent.change(screen.getByPlaceholderText('Ask a question about AI dev tools...'), {
      target: { value: 'best RAG tools' },
    });
    fireEvent.click(screen.getByText('Submit'));

    expect(await screen.findByText('Use the RAG stack.')).toBeTruthy();
    // Component renders "owner/name" as the upstream label
    expect(screen.getByText('perditioinc/repo-a')).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/intelligence/ask',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('shows loading state while waiting for the API', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    render(<AskPanel apiUrl="https://api.example.com" />);

    fireEvent.change(screen.getByPlaceholderText('Ask a question about AI dev tools...'), {
      target: { value: 'agent frameworks' },
    });
    fireEvent.click(screen.getByText('Submit'));

    expect(screen.getByText('Querying...')).toBeTruthy();

    resolveFetch?.({
      ok: true,
      status: 200,
      json: async () => ({ answer: 'Done', sources: [] }),
    });

    expect(await screen.findByText('Done')).toBeTruthy();
  });

  test('shows server error state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Boom' }),
    }) as unknown as typeof fetch;

    // Simulate navigating to /ask?q=bad+query — triggers auto-submit via useEffect
    getSearchParams.mockReturnValue(new URLSearchParams('q=bad%20query'));

    render(<AskPanel apiUrl="https://api.example.com" />);

    expect(await screen.findByText('Boom')).toBeTruthy();
  });

  test('shows network error state', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    render(<AskPanel apiUrl="https://api.example.com" />);

    fireEvent.change(screen.getByPlaceholderText('Ask a question about AI dev tools...'), {
      target: { value: 'edge inference' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Network error. Please check your connection and try again.')).toBeTruthy();
    });
  });
});
