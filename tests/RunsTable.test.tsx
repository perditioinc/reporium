/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { metadata } from '@/app/runs/page';
import { RunsTable } from '@/components/RunsTable';

const API_URL = 'https://api.example.com';

describe('RunsTable', () => {
  test('exports runs page metadata', () => {
    expect(metadata.title).toBe('Ingestion Run History | Reporium');
    expect(metadata.description).toBe('Recent ingestion pipeline runs for the Reporium AI dev tool library.');
  });

  test('renders empty state', () => {
    render(<RunsTable runs={[]} apiUrl={API_URL} showRefresh />);

    expect(screen.getByText('No run history available yet.')).toBeTruthy();
    expect(screen.getByText('Refresh')).toBeTruthy();
  });

  test('renders run rows with formatted duration and status badge', () => {
    render(
      <RunsTable
        apiUrl={API_URL}
        runs={[
          {
            run_id: 'run-1',
            mode: 'quick',
            status: 'success',
            repos_upserted: 42,
            started_at: '2026-03-24T05:00:00Z',
            finished_at: '2026-03-24T05:02:30Z',
            errors: [],
          },
        ]}
      />,
    );

    expect(screen.getByText('quick')).toBeTruthy();
    expect(screen.getByText('success')).toBeTruthy();
    expect(screen.getByText('2m 30s')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  test('expands error rows on click', () => {
    render(
      <RunsTable
        apiUrl={API_URL}
        runs={[
          {
            run_id: 'run-2',
            mode: 'full',
            status: 'failed',
            repos_upserted: 3,
            started_at: '2026-03-24T05:00:00Z',
            finished_at: '2026-03-24T05:00:20Z',
            errors: ['boom'],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByText('run-2'));

    expect(screen.getByText('Errors (1)')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
  });
});
