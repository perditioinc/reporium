'use client';

import type { CrossDimensionAnalytics } from '@/types/repo';

interface CrossDimensionWidgetProps {
  analytics: CrossDimensionAnalytics | null;
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

export function CrossDimensionWidget({ analytics }: CrossDimensionWidgetProps) {
  if (!analytics || analytics.pairs.length === 0) return null;

  const peak = Math.max(...analytics.pairs.map((pair) => pair.repo_count), 1);

  return (
    <section className="rounded-2xl border border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-zinc-950 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Cross-Dimension Analytics</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            {label(analytics.dim1)} × {label(analytics.dim2)}
          </h2>
        </div>
        <p className="text-xs text-zinc-500">Top {analytics.pairs.length} pairings</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {analytics.pairs.map((pair) => (
          <div key={`${pair.dim1_value}:${pair.dim2_value}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-200">{pair.dim1_value}</p>
                <p className="truncate text-xs text-zinc-500">{pair.dim2_value}</p>
              </div>
              <span className="rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-300">
                {pair.repo_count}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-zinc-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-400"
                style={{ width: `${Math.max((pair.repo_count / peak) * 100, 8)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
