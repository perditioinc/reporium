'use client';

/**
 * /insights — Intelligent analysis of the library.
 * KAN-81: Insights page
 *
 * Sections:
 * - Rising Fast: repos ranked by recent star velocity (stars relative to age)
 * - Most Active This Week: by commit count in last 7 days
 * - Newly Discovered: repos added to library in the last 14 days
 * - Category Leaders: top repo per primary_category by combined signal
 * - Health Alerts: repos with archived parents or declining activity
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { EnrichedRepo, LibraryData } from '@/types/repo';

const API_URL = process.env.NEXT_PUBLIC_REPORIUM_API_URL ?? '';

const CATEGORY_ICONS: Record<string, string> = {
  'agents': '🤖', 'rag-retrieval': '🔍', 'llm-serving': '⚡',
  'fine-tuning': '🎯', 'evaluation': '📊', 'orchestration': '🔀',
  'vector-databases': '🗄️', 'observability': '👁️', 'security-safety': '🔒',
  'code-generation': '💻', 'data-processing': '⚙️', 'computer-vision': '👁',
  'nlp-text': '📝', 'speech-audio': '🎙️', 'generative-media': '🎨',
  'infrastructure': '🏗️',
};

function repoAge(repo: EnrichedRepo): number {
  const created = repo.upstreamCreatedAt ?? repo.createdAt;
  return Math.max(1, (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24 * 30));
}

function risingScore(repo: EnrichedRepo): number {
  const stars = repo.parentStats?.stars ?? repo.stars;
  const ageMonths = repoAge(repo);
  const recentCommits = repo.commitStats?.last30Days ?? 0;
  return (stars / ageMonths) + recentCommits * 2;
}

function healthScore(repo: EnrichedRepo): number {
  const activity = repo.qualitySignals?.activity_score ?? repo.qualitySignals?.overall_score ?? 0;
  const commits30 = repo.commitStats?.last30Days ?? 0;
  return activity + commits30;
}

interface RepoCardMiniProps {
  repo: EnrichedRepo;
  badge?: string;
  badgeColor?: string;
}

function RepoCardMini({ repo, badge, badgeColor = 'text-zinc-400' }: RepoCardMiniProps) {
  const stars = repo.parentStats?.stars ?? repo.stars;
  const category = repo.dbCategory;
  return (
    <Link
      href={`/repo/${repo.name}`}
      className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 hover:border-zinc-700 transition-colors group"
    >
      {category && <span className="text-lg mt-0.5">{CATEGORY_ICONS[category] ?? '📦'}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-zinc-100">{repo.name}</p>
          {badge && <span className={`text-xs ${badgeColor} shrink-0`}>{badge}</span>}
        </div>
        {repo.description && (
          <p className="text-xs text-zinc-500 truncate mt-0.5">{repo.description}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {stars > 0 && (
          <span className="text-xs text-zinc-500">
            ★ {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
          </span>
        )}
        {(repo.commitStats?.last7Days ?? 0) > 0 && (
          <span className="text-xs text-emerald-400">+{repo.commitStats.last7Days}</span>
        )}
      </div>
    </Link>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/library/full?page=1&page_size=2000`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        setData(await res.json());
      } catch (e) {
        try {
          const res = await fetch('/data/library.json');
          if (!res.ok) throw new Error('Cache miss');
          setData(await res.json());
        } catch {
          setError((e as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const risingFast = useMemo(() => {
    if (!data) return [];
    return [...data.repos]
      .filter(r => (r.parentStats?.stars ?? r.stars) > 100)
      .sort((a, b) => risingScore(b) - risingScore(a))
      .slice(0, 15);
  }, [data]);

  const mostActive = useMemo(() => {
    if (!data) return [];
    return [...data.repos]
      .filter(r => (r.commitStats?.last7Days ?? 0) > 0)
      .sort((a, b) => (b.commitStats?.last7Days ?? 0) - (a.commitStats?.last7Days ?? 0))
      .slice(0, 15);
  }, [data]);

  const newlyDiscovered = useMemo(() => {
    if (!data) return [];
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return data.repos
      .filter(r => {
        const added = r.forkedAt ?? r.createdAt;
        return added && new Date(added).getTime() >= fourteenDaysAgo;
      })
      .sort((a, b) => {
        const aDate = new Date(a.forkedAt ?? a.createdAt).getTime();
        const bDate = new Date(b.forkedAt ?? b.createdAt).getTime();
        return bDate - aDate;
      })
      .slice(0, 20);
  }, [data]);

  const categoryLeaders = useMemo(() => {
    if (!data) return [] as EnrichedRepo[];
    const leaders = new Map<string, EnrichedRepo>();
    for (const repo of data.repos) {
      const cat = repo.dbCategory;
      if (!cat) continue;
      const current = leaders.get(cat);
      const score = (repo.parentStats?.stars ?? repo.stars) + (repo.commitStats?.last30Days ?? 0) * 10;
      if (!current) {
        leaders.set(cat, repo);
      } else {
        const currentScore = (current.parentStats?.stars ?? current.stars) + (current.commitStats?.last30Days ?? 0) * 10;
        if (score > currentScore) leaders.set(cat, repo);
      }
    }
    return [...leaders.entries()]
      .sort((a, b) => {
        const aScore = (a[1].parentStats?.stars ?? a[1].stars);
        const bScore = (b[1].parentStats?.stars ?? b[1].stars);
        return bScore - aScore;
      })
      .map(([, repo]) => repo);
  }, [data]);

  const healthAlerts = useMemo(() => {
    if (!data) return [];
    return data.repos
      .filter(r => {
        const archivedParent = r.parentStats?.isArchived;
        const lowActivity = healthScore(r) < 5;
        return archivedParent || lowActivity;
      })
      .sort((a, b) => healthScore(a) - healthScore(b))
      .slice(0, 15);
  }, [data]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <div className="border-b border-zinc-800 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Reporium
        </Link>
        <h1 className="text-lg font-bold text-zinc-100">Insights</h1>
        <Link href="/trends" className="ml-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Trends →
        </Link>
        {data && (
          <span className="ml-auto text-xs text-zinc-600">
            {data.repos.length.toLocaleString()} repos
          </span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-zinc-500">Loading insights...</div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
            Failed to load: {error}
          </div>
        )}

        {data && (
          <>
            {/* Rising Fast */}
            <section>
              <h2 className="text-base font-semibold text-zinc-200 mb-1">Rising Fast</h2>
              <p className="text-xs text-zinc-500 mb-4">
                Repos ranked by star velocity relative to age (stars/month + recent commit activity)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {risingFast.map(r => (
                  <RepoCardMini
                    key={r.id}
                    repo={r}
                    badge={`${Math.round(risingScore(r)).toLocaleString()} pts`}
                    badgeColor="text-amber-400"
                  />
                ))}
              </div>
            </section>

            {/* Most Active This Week */}
            {mostActive.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-zinc-200 mb-1">Most Active This Week</h2>
                <p className="text-xs text-zinc-500 mb-4">Ranked by commits in the last 7 days</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {mostActive.map(r => (
                    <RepoCardMini
                      key={r.id}
                      repo={r}
                      badge={`${r.commitStats.last7Days} commits`}
                      badgeColor="text-emerald-400"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Newly Discovered */}
            {newlyDiscovered.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-zinc-200 mb-1">Newly Discovered</h2>
                <p className="text-xs text-zinc-500 mb-4">Repos added to Reporium in the last 14 days</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {newlyDiscovered.map(r => (
                    <RepoCardMini key={r.id} repo={r} />
                  ))}
                </div>
              </section>
            )}

            {/* Category Leaders */}
            <section>
              <h2 className="text-base font-semibold text-zinc-200 mb-1">Category Leaders</h2>
              <p className="text-xs text-zinc-500 mb-4">
                Top repo per primary category by combined stars + commit activity
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryLeaders.map(r => (
                  <RepoCardMini
                    key={r.id}
                    repo={r}
                  />
                ))}
              </div>
            </section>

            {/* Health Alerts */}
            {healthAlerts.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-zinc-200 mb-1">Health Alerts</h2>
                <p className="text-xs text-zinc-500 mb-4">
                  Repos with archived parents or low activity — may need review
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {healthAlerts.map(r => (
                    <RepoCardMini
                      key={r.id}
                      repo={r}
                      badge={r.parentStats?.isArchived ? 'archived parent' : 'low activity'}
                      badgeColor={r.parentStats?.isArchived ? 'text-red-400' : 'text-zinc-500'}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
