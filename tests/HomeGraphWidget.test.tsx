/** @jest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const push = jest.fn();
const loadGraphDataset = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('next/dynamic', () => {
  return () => {
    const MockGraph = require('@/components/KnowledgeGraphV2').KnowledgeGraphV2;
    return MockGraph;
  };
});

jest.mock('@/lib/graphData', () => ({
  loadGraphDataset: (...args: unknown[]) => loadGraphDataset(...args),
}));

jest.mock('@/components/KnowledgeGraphV2', () => ({
  KnowledgeGraphV2: ({ onNodeClick }: { onNodeClick?: (id: string) => void }) => (
    <button type="button" onClick={() => onNodeClick?.('perditioinc/reporium-api')}>
      Graph canvas
    </button>
  ),
}));

describe('HomeGraphWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows a visible fallback instead of disappearing when graph data fails to load', async () => {
    loadGraphDataset.mockRejectedValue(new Error('API error 503'));

    const { HomeGraphWidget } = require('@/components/HomeGraphWidget');
    render(<HomeGraphWidget />);

    await waitFor(() => {
      expect(screen.getByText('Knowledge graph temporarily unavailable')).toBeTruthy();
    });

    expect(
      screen.getByText('The homepage preview could not load, but the graph route is still available.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open full graph' }).getAttribute('href')).toBe('/graph/');
  });

  test('renders the interactive graph when dataset loading succeeds', async () => {
    loadGraphDataset.mockResolvedValue({
      edges: [{ source: 'perditioinc/reporium-api', target: 'perditioinc/reporium', edge_type: 'SIMILAR_TO' }],
      nodeMetadata: new Map(),
      totalRepos: 2,
      totalEdges: 1,
      source: 'api',
      message: null,
    });

    const { HomeGraphWidget } = require('@/components/HomeGraphWidget');
    render(<HomeGraphWidget />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Graph canvas' })).toBeTruthy();
    });
  });
});
