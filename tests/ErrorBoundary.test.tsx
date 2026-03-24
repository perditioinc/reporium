/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function ThrowingChild(): React.ReactElement {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  test('renders fallback UI when a child throws', () => {
    const reload = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    expect(screen.getByText('Please reload the page.')).toBeTruthy();

    fireEvent.click(screen.getByText('Reload page'));
    expect(reload).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
