/** @jest-environment jsdom */

/**
 * KAN-153: HomeGraphWidget mobile branch — renders a static link card to /graph
 * and does not trigger any graph-data fetch.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

const loadGraphDataset = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Force mobile gate to true regardless of jsdom matchMedia behaviour.
jest.mock('@/lib/useIsMobile', () => ({
  useIsMobile: () => true,
  MOBILE_QUERY: '(max-width: 767px)',
}));

jest.mock('next/dynamic', () => () => {
  const NeverRendered = () => null;
  return NeverRendered;
});

jest.mock('@/lib/graphData', () => ({
  loadGraphDataset: (...args: unknown[]) => loadGraphDataset(...args),
}));

jest.mock('@/components/KnowledgeGraph3D', () => ({
  KnowledgeGraph3D: () => null,
}));

describe('HomeGraphWidget — mobile branch (KAN-153)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the mobile CTA card linking to /graph', () => {
    const { HomeGraphWidget } = require('@/components/HomeGraphWidget');
    render(<HomeGraphWidget />);

    const cta = screen.getByTestId('home-graph-mobile-cta');
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toBe('/graph');
    expect(screen.getByText('Knowledge Graph')).toBeTruthy();
    expect(screen.getByText('View graph')).toBeTruthy();
  });

  test('does NOT call loadGraphDataset on mobile', () => {
    const { HomeGraphWidget } = require('@/components/HomeGraphWidget');
    render(<HomeGraphWidget />);
    expect(loadGraphDataset).not.toHaveBeenCalled();
  });
});
