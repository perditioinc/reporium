'use client';

import Link from 'next/link';
import type { EnrichedRepo } from '@/types/repo';

interface TrendingThisWeekWidgetProps {
  repos: EnrichedRepo[];
}

export function TrendingThisWeekWidget({ repos }: TrendingThisWeekWidgetProps) {
  if (repos.length === 0) return null;

  return (
    <section className="rounded-2xl border border-emerald-900/30 bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Trending This Week</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">Top repos by recent commit activity</h2>
        </div>
        <p className="text-xs text-zinc-500">Last 7 days</p>
      </div>

      <div className="mt-4 space-y-2">
        {repos.map((repo) => {
          const commitCount = repo.commitStats?.last7Days ?? repo.weeklyCommitCount ?? 0;
          return (
            <Link
              key={repo.id}
              href={`/repo/${encodeURIComponent(repo.name)}`}
              className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 transition-colors hover:border-zinc-700"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{repo.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {repo.language ? (
                    <span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-zinc-300">
                      {repo.language}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-700/30 bg-emerald-900/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                {commitCount} commit{commitCount === 1 ? '' : 's'}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
