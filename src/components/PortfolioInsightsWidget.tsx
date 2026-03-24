'use client';

import type { PortfolioInsights } from '@/types/repo';

interface PortfolioInsightsWidgetProps {
  insights: PortfolioInsights | null;
  onRepoClick: (name: string) => void;
}

function percent(similarity: number): string {
  return `${Math.round(similarity * 100)}%`;
}

function repoNameFromFull(fullName: string): string {
  return fullName.split('/').slice(-1)[0] ?? fullName;
}

export function PortfolioInsightsWidget({ insights, onRepoClick }: PortfolioInsightsWidgetProps) {
  if (!insights) return null;

  const hasSignals =
    insights.summary.length > 0 ||
    insights.taxonomy_gaps.length > 0 ||
    insights.stale_repos.length > 0 ||
    insights.velocity_leaders.length > 0 ||
    insights.near_duplicate_clusters.length > 0;

  if (!hasSignals) return null;

  return (
    <section className="rounded-2xl border border-sky-900/40 bg-gradient-to-br from-sky-950/50 via-zinc-950 to-zinc-950 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Library Insights</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">Proactive intelligence feed</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Updated {new Date(insights.generated_at).toLocaleString()}
        </p>
      </div>

      {insights.summary.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {insights.summary.map((item) => (
            <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300">
              {item}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Emerging Taxonomy Gaps</p>
          <div className="mt-2 space-y-2">
            {insights.taxonomy_gaps.slice(0, 4).map((gap) => (
              <div key={`${gap.dimension}:${gap.value}`} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-200">{gap.value}</p>
                  <p className="text-xs text-zinc-500">{gap.dimension.replaceAll('_', ' ')} · {gap.repo_count} repos</p>
                </div>
                <span className="rounded-full border border-sky-700/40 bg-sky-900/30 px-2 py-0.5 text-xs text-sky-300">
                  {gap.trending_score.toFixed(1)}
                </span>
              </div>
            ))}
            {insights.taxonomy_gaps.length === 0 && (
              <p className="text-sm text-zinc-500">No rising taxonomy gaps surfaced right now.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Velocity Leaders</p>
          <div className="mt-2 space-y-2">
            {insights.velocity_leaders.slice(0, 4).map((repo) => (
              <div key={`${repo.owner}/${repo.repo_name}`} className="flex items-start justify-between gap-3 text-sm">
                <button
                  onClick={() => onRepoClick(repo.repo_name)}
                  className="text-left font-medium text-zinc-200 hover:text-sky-300"
                >
                  {repo.owner}/{repo.repo_name}
                </button>
                <span className="text-xs text-emerald-400">{repo.commits_last_30_days} commits / 30d</span>
              </div>
            ))}
            {insights.velocity_leaders.length === 0 && (
              <p className="text-sm text-zinc-500">No velocity leaders available.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Stale Repos</p>
          <div className="mt-2 space-y-2">
            {insights.stale_repos.slice(0, 4).map((repo) => (
              <div key={`${repo.owner}/${repo.repo_name}`} className="flex items-start justify-between gap-3 text-sm">
                <button
                  onClick={() => onRepoClick(repo.repo_name)}
                  className="text-left font-medium text-zinc-200 hover:text-sky-300"
                >
                  {repo.owner}/{repo.repo_name}
                </button>
                <span className="text-xs text-amber-400">{repo.stale_days}d stale</span>
              </div>
            ))}
            {insights.stale_repos.length === 0 && (
              <p className="text-sm text-zinc-500">No stale repos passed the threshold.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Near-Duplicate Clusters</p>
          <div className="mt-2 space-y-2">
            {insights.near_duplicate_clusters.slice(0, 4).map((cluster) => (
              <div key={cluster.repos.join('|')} className="text-sm text-zinc-300">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-x-1">
                    {cluster.repos.map((repo) => (
                      <button
                        key={repo}
                        onClick={() => onRepoClick(repoNameFromFull(repo))}
                        className="font-medium text-zinc-200 hover:text-sky-300"
                      >
                        {repo}
                      </button>
                    ))}
                  </div>
                  <span className="rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-300">
                    {percent(cluster.similarity)} match
                  </span>
                </div>
              </div>
            ))}
            {insights.near_duplicate_clusters.length === 0 && (
              <p className="text-sm text-zinc-500">No high-similarity duplicate clusters detected in the current snapshot.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
