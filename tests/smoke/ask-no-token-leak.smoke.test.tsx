/** @jest-environment jsdom */

// Smoke: the Ask surface does not leak the app token into the rendered DOM
// or into any browser-side request options. Auth-hardening PR #5 removed the
// browser-held token entirely — asks go through the same-origin proxy
// (/api/intelligence/ask), which attaches the server-held REPORIUM_APP_TOKEN.
// Any token appearing in the DOM or in provider options would be a
// credential-exposure regression.
//
// We use a unique sentinel so a literal substring search is unambiguous.

// Set the legacy env var BEFORE the import: even if a regression reintroduced
// a module-load-time read of it, the sentinel must never surface anywhere.
// We must NOT use jest.resetModules — that would create a second React copy
// whose hooks don't match the React used by @testing-library/react, raising
// "Cannot read properties of null (reading 'useState')".
const TOKEN_SENTINEL = 'SMOKE_TOKEN_SENTINEL_q7Hn4xPv9zLbR';
process.env.NEXT_PUBLIC_APP_API_TOKEN = TOKEN_SENTINEL;
process.env.NEXT_PUBLIC_REPORIUM_API_URL = 'https://api.example.com';

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const getSearchParams = jest.fn(() => new URLSearchParams());

jest.mock('next/navigation', () => ({
  useSearchParams: () => getSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/ask',
}));

// askQuestion is the only entry point AskPanel calls. We capture the
// options it receives so we can assert the token is NOT passed through the
// browser at all — the same-origin proxy route holds it server-side.
const askQuestion = jest.fn();
jest.mock('@/lib/dataProvider', () => ({
  createDataProvider: () => ({
    mode: 'production',
    askQuestion,
  }),
}));

describe('smoke: Ask surface never exposes the app token in the browser', () => {
  beforeEach(() => {
    askQuestion.mockReset();
    getSearchParams.mockReturnValue(new URLSearchParams());
  });

  test('rendered DOM never contains the token sentinel — initial mount', () => {
    const { AskPanel } = require('@/components/AskPanel');

    const { container } = render(<AskPanel />);

    expect(container.innerHTML).not.toContain(TOKEN_SENTINEL);
    expect(document.body.innerHTML).not.toContain(TOKEN_SENTINEL);
  });

  test('rendered DOM never contains the token sentinel — after a query is submitted', async () => {
    askQuestion.mockResolvedValue({
      answer: 'Stub answer from the smoke harness.',
      question: 'smoke question',
      model: 'claude-test',
      answered_at: new Date().toISOString(),
      embedding_candidates: 0,
      tokens_used: { input: 0, output: 0, total: 0 },
      sources: [],
    });

    const { AskPanel } = require('@/components/AskPanel');
    const { container } = render(<AskPanel />);

    fireEvent.change(screen.getByPlaceholderText('Ask a question about AI dev tools...'), {
      target: { value: 'smoke question' },
    });
    fireEvent.click(screen.getByText('Submit'));

    // Wait for the answer to render — that's the moment when, if there
    // were a leak path through props/state, it would be visible.
    await screen.findByText('Stub answer from the smoke harness.');
    await waitFor(() => {
      expect(askQuestion).toHaveBeenCalled();
    });

    expect(container.innerHTML).not.toContain(TOKEN_SENTINEL);
    expect(document.body.innerHTML).not.toContain(TOKEN_SENTINEL);

    // No input should carry the sentinel as its value or any data-* attr
    const inputs = container.querySelectorAll('input, textarea, button, [data-app-token]');
    inputs.forEach((el) => {
      const val = (el as HTMLInputElement).value;
      if (typeof val === 'string') expect(val).not.toContain(TOKEN_SENTINEL);
      for (const attr of Array.from(el.attributes)) {
        expect(attr.value).not.toContain(TOKEN_SENTINEL);
      }
    });
  });

  test('token is NOT forwarded through the browser — the same-origin proxy holds it (auth-hardening PR #5)', async () => {
    askQuestion.mockResolvedValue({
      answer: 'ok',
      question: 'q',
      model: 'm',
      answered_at: '',
      embedding_candidates: 0,
      tokens_used: { input: 0, output: 0, total: 0 },
      sources: [],
    });

    const { AskPanel } = require('@/components/AskPanel');
    render(<AskPanel />);

    fireEvent.change(screen.getByPlaceholderText('Ask a question about AI dev tools...'), {
      target: { value: 'wired test' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => expect(askQuestion).toHaveBeenCalled());

    // PR #5 inverted the old contract: the browser must NOT hold or forward
    // the app token. The same-origin route handler attaches the server-held
    // REPORIUM_APP_TOKEN instead. Any app_token in the provider options (or
    // the sentinel anywhere in them) is a credential-exposure regression.
    const [, options] = askQuestion.mock.calls[0];
    expect(options).not.toHaveProperty('app_token');
    expect(JSON.stringify(options ?? {})).not.toContain(TOKEN_SENTINEL);
  });
});
