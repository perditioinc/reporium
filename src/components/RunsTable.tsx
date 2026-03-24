'use client';

import { Fragment, useState, useCallback, useEffect } from 'react';
import type { IngestionRun } from '@/app/runs/page';

interface RunsTableProps {
  runs: IngestionRun[];
  apiUrl: string;
  showRefresh?: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(started: string, finished: string | null): string {
  if (!finished) return 'In progress';
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (ms < 0) return '—';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'success':
    case 'completed':
      return 'text-emerald-400 border-emerald-700/40 bg-emerald-900/30';
    case 'failed':
    case 'error':
      return 'text-red-400 border-red-700/40 bg-red-900/30';
    case 'running':
    case 'in_progress':
      return 'text-sky-400 border-sky-700/40 bg-sky-900/30';
    default:
      return 'text-zinc-400 border-zinc-700 bg-zinc-800/50';
  }
}

export function RunsTable({ runs: initialRuns, apiUrl, showRefresh }: RunsTableProps) {
  const [runs, setRuns] = useState<IngestionRun[]>(initialRuns);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(initialRuns.length === 0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${apiUrl}/admin/runs`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRuns(data as IngestionRun[]);
        else if (Array.isArray(data?.runs)) setRuns(data.runs as IngestionRun[]);
      }
    } catch {
      // silently ignore — keep stale data
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    refresh();

    if (!showRefresh) return;

    const intervalId = window.setInterval(() => {
      refresh();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh, showRefresh]);

  function toggleRow(runId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-4 w-full">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Loading run history...</p>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="space-y-4 w-full">
        {showRefresh && (
          <div className="flex justify-end">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-50 transition-colors"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-sm text-zinc-500">No run history available yet.</p>
          <p className="mt-1 text-xs text-zinc-600">Ingestion runs will appear here once completed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {showRefresh && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">{runs.length} run{runs.length !== 1 ? 's' : ''} found</p>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/70">
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-zinc-500">Run ID</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-zinc-500">Mode</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-zinc-500">Status</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.15em] text-zinc-500">Repos</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-zinc-500">Started</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.15em] text-zinc-500">Finished</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.15em] text-zinc-500">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {runs.map((run) => {
              const hasErrors = run.errors && run.errors.length > 0;
              const isExpanded = expandedRows.has(run.run_id);
              return (
                <Fragment key={run.run_id}>
                  <tr
                    className={`bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors ${hasErrors ? 'cursor-pointer' : ''}`}
                    onClick={() => hasErrors && toggleRow(run.run_id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        {hasErrors && (
                          <span className="text-zinc-600">{isExpanded ? '▼' : '▶'}</span>
                        )}
                        {run.run_id.length > 16 ? `${run.run_id.slice(0, 16)}…` : run.run_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{run.mode}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">{run.repos_upserted.toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(run.started_at)}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(run.finished_at)}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{formatDuration(run.started_at, run.finished_at)}</td>
                  </tr>
                  {hasErrors && isExpanded && (
                    <tr key={`${run.run_id}-errors`} className="bg-red-950/10">
                      <td colSpan={7} className="px-6 py-3">
                        <p className="text-[11px] uppercase tracking-[0.15em] text-red-400 mb-2">
                          Errors ({run.errors!.length})
                        </p>
                        <ul className="space-y-1">
                          {run.errors!.map((err, i) => (
                            <li key={i} className="text-xs text-red-300 font-mono bg-red-950/20 rounded px-3 py-1">
                              {err}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
