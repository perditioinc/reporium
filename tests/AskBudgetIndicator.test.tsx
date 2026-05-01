/** @jest-environment jsdom */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { AskBudgetIndicator } from '@/components/AskBudgetIndicator';

const RATE_KEY = 'reporium_ask_timestamps';

function seedTimestamps(count: number, ageMs = 5_000) {
  const now = Date.now();
  const timestamps = Array.from({ length: count }, (_, i) => now - ageMs - i * 10);
  window.localStorage.setItem(RATE_KEY, JSON.stringify(timestamps));
}

describe('AskBudgetIndicator', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('renders zero budget when storage is empty', () => {
    render(<AskBudgetIndicator />);
    const indicator = screen.getByTestId('ask-budget-indicator');
    expect(indicator.textContent).toContain('0/10');
    expect(indicator.textContent).toContain('0/100');
  });

  test('reads recent timestamps and shows current minute and day counts', async () => {
    seedTimestamps(3);
    render(<AskBudgetIndicator />);
    const indicator = await screen.findByTestId('ask-budget-indicator');
    // Effect runs after mount; allow a microtask for state to flush.
    await act(async () => {
      await Promise.resolve();
    });
    expect(indicator.textContent).toContain('3/10');
    expect(indicator.textContent).toContain('3/100');
  });

  test('exposes an aria-live status with the budget summary', () => {
    seedTimestamps(2);
    render(<AskBudgetIndicator />);
    const indicator = screen.getByTestId('ask-budget-indicator');
    expect(indicator.getAttribute('role')).toBe('status');
    expect(indicator.getAttribute('aria-live')).toBe('polite');
    expect(indicator.getAttribute('aria-label')).toMatch(/Ask budget/);
  });

  test('handles malformed localStorage gracefully', () => {
    window.localStorage.setItem(RATE_KEY, 'not json');
    render(<AskBudgetIndicator />);
    const indicator = screen.getByTestId('ask-budget-indicator');
    expect(indicator.textContent).toContain('0/10');
  });

  test('compact variant drops the trailing label', () => {
    render(<AskBudgetIndicator compact />);
    const indicator = screen.getByTestId('ask-budget-indicator');
    expect(indicator.textContent).not.toMatch(/asks/);
  });

  test('refreshes on the polling interval', async () => {
    jest.useFakeTimers();
    try {
      render(<AskBudgetIndicator />);
      const indicator = screen.getByTestId('ask-budget-indicator');
      expect(indicator.textContent).toContain('0/10');

      seedTimestamps(5);
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(indicator.textContent).toContain('5/10');
    } finally {
      jest.useRealTimers();
    }
  });
});
