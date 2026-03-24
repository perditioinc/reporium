/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function ThrowingChild(): React.ReactElement {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  test('renders fallback UI when a child throws', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.getByText('Please reload the page.')).toBeTruthy();
    expect(screen.getByText('Reload page')).toBeTruthy();

    consoleError.mockRestore();
  });

  test('renders custom fallback when provided', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom fallback')).toBeTruthy();

    consoleError.mockRestore();
  });
});
