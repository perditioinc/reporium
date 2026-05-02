/** @jest-environment jsdom */

// Smoke: the Ask surface does not leak NEXT_PUBLIC_APP_API_TOKEN into the
// rendered DOM. Token transmission is via request body / X-App-Token header
// only (see reporium-api/auth header reference: `app_token` body field and
// `X-App-Token` header on the provider). Any DOM leak — value attribute,
// data-*, text node — would be a credential exposure regression.
//
// We use a unique sentinel so a literal substring search is unambiguous.

// AskPanel reads NEXT_PUBLIC_APP_API_TOKEN at module-load time. We must set
// the env var BEFORE the import (so APP_TOKEN closes over our sentinel) and
// must NOT use jest.resetModules — that would create a second React copy
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
// options it receives so we can also assert the token is being passed
// THROUGH the provider — proving AskPanel doesn't render it but DOES use
// it for auth.
const askQuestion = jest.fn();
jest.mock('@/lib/dataProvider', () => ({
  createDataProvider: () => ({
    mode: 'production',
    askQuestion,
  }),
}));

describe('smoke: Ask surface does not expose NEXT_PUBLIC_APP_API_TOKEN', () => {
  beforeEach(() => {
    askQuestion.mockReset();
    getSearchParams.mockReturnValue(new URLSearchParams());
  });

  test('rendered DOM never contains the token sentinel — initial mount', () => {
    // Module evaluation reads NEXT_PUBLIC_APP_API_TOKEN at the top level, so
    // the env value above is what AskPanel will use.
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

  test('token IS forwarded to the data provider — proves the value is wired, just not rendered', async () => {
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

    // The token MUST be in the options passed to askQuestion — that's the
    // approved channel. If this fails, the provider isn't getting the
    // token and the API will 401 in production.
    const [, options] = askQuestion.mock.calls[0];
    expect(options).toEqual(expect.objectContaining({ app_token: TOKEN_SENTINEL }));
  });
});
