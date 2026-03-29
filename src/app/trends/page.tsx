'use client';

/**
 * /trends — Weekly category momentum and activity signals.
 * KAN-82: Trends page
 *
 * Sections:
 * - Category Momentum: bar chart of commits/week per primary_category
 * - New Repos This Week: repos created or forked in last 7 days
 * - Most Active Repos: repos ranked by commits_last_7_days
 * - Top Repos by Stars: top parent-star repos per category
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { EnrichedRepo, LibraryData } from '@/types/repo';

const API_URL = process.env.NEXT_PUBLIC_REPORIUM_API_URL ?? '';

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  'agents':           { label: 'Agents',            icon: '🤖', color: '#6366f1' },
  'rag-retrieval':    { label: 'RAG & Retrieval',    icon: '🔍', color: '#0ea5e9' },
  'llm-serving':      { label: 'LLM Serving',        icon: '⚡', color: '#f59e0b' },
  'fine-tuning':      { label: 'Fine-tuning',        icon: '🎯', color: '#10b981' },
  'evaluation':       { label: 'Evaluation',         icon: '📊', color: '#8b5cf6' },
  'orchestration':    { label: 'Orchestration',      icon: '🔀', color: '#ec4899' },
  'vector-databases': { label: 'Vector DBs',         icon: '🗄️', color: '#14b8a6' },
  'observability':    { label: 'Observability',      icon: '👁️', color: '#f97316' },
  'security-safety':  { label: 'Security & Safety',  icon: '🔒', color: '#ef4444' },
  'code-generation':  { label: 'Code Gen',           icon: '💻', color: '#84cc16' },
  'data-processing':  { label: 'Data Processing',    icon: '⚙️', color: '#64748b' },
  'computer-vision':  { label: 'Computer Vision',    icon: '👁',  color: '#a855f7' },
  'nlp-text':         { label: 'NLP & Text',         icon: '📝', color: '#3b82f6' },
  'speech-audio':     { label: 'Speech & Audio',     icon: '🎙️', color: '#d946ef' },
  'generative-media': { label: 'Generative Media',   icon: '🎨', color: '#f43f5e' },
  'infrastructure':   { label: 'Infrastructure',     icon: '🏗️', color: '#78716c' },
};

interface CategoryMomentum {
  id: string;
  label: string;
  icon: string;
  color: string;
  repoCount: number;
  commitsLast7Days: number;
  commitsLast30Days: number;
  weeklyVelocity: number; // commits/repo/week
}

function computeCategoryMomentum(repos: EnrichedRepo[]): CategoryMomentum[] {
  const counts = new Map<string, { repos: number; c7: number; c30: number }>();
  for (const repo of repos) {
    const cat = repo.dbCategory;
    if (!cat) continue;
    const cur = counts.get(cat) ?? { repos: 0, c7: 0, c30: 0 };
    cur.repos += 1;
    cur.c7 += repo.commitStats?.last7Days ?? 0;
    cur.c30 += repo.commitStats?.last30Days ?? 0;
    counts.set(cat, cur);
  }
  return [...counts.entries()]
    .map(([id, { repos: repoCount, c7, c30 }]) => {
      const meta = CATEGORY_LABELS[id] ?? { label: id, icon: '📦', color: '#6b7280' };
      return {
        id,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        repoCount,
        commitsLast7Days: c7,
        commitsLast30Days: c30,
        weeklyVelocity: repoCount > 0 ? c7 / repoCount : 0,
      };
    })
    .sort((a, b) => b.commitsLast7Days - a.commitsLast7Days);
}

function BarChart({ data }: { data: CategoryMomentum[] }) {
  const max = Math.max(...data.map(d => d.commitsLast7Days), 1);
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.id} className="flex items-center gap-3">
          <span className="w-6 text-sm">{d.icon}</span>
          <span className="w-36 text-xs text-zinc-400 truncate">{d.label}</span>
          <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${(d.commitsLast7Days / max) * 100}%`,
                backgroundColor: d.color,
                opacity: 0.8,
              }}
            />
          </div>
          <span className="w-12 text-right text-xs text-zinc-400">{d.commitsLast7Days}</span>
        </div>
      ))}
    </div>
  );
}

function RepoRow({ repo }: { repo: EnrichedRepo }) {
  const stars = repo.parentStats?.stars ?? repo.stars;
  return (
    <Link
      href={`/repo/${repo.name}`}
      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 hover:border-zinc-700 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">{repo.name}</p>
        {repo.description && (
          <p className="text-xs text-zinc-500 truncate">{repo.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {(repo.commitStats?.last7Days ?? 0) > 0 && (
          <span className="text-xs text-emerald-400">
            +{repo.commitStats.last7Days} commits
          </span>
        )}
        {stars > 0 && (
          <span className="text-xs text-zinc-500">★ {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}</span>
        )}
      </div>
    </Link>
  );
}

export default function TrendsPage() {
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
        // Fallback to cached library.json
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

  const categoryMomentum = useMemo(() => {
    if (!data) return [];
    return computeCategoryMomentum(data.repos);
  }, [data]);

  const newThisWeek = useMemo(() => {
    if (!data) return [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return data.repos
      .filter(r => {
        const added = r.forkedAt ?? r.createdAt;
        return added && new Date(added).getTime() >= sevenDaysAgo;
      })
      .sort((a, b) => {
        const aDate = new Date(a.forkedAt ?? a.createdAt).getTime();
        const bDate = new Date(b.forkedAt ?? b.createdAt).getTime();
        return bDate - aDate;
      })
      .slice(0, 20);
  }, [data]);

  const mostActive = useMemo(() => {
    if (!data) return [];
    return [...data.repos]
      .filter(r => (r.commitStats?.last7Days ?? 0) > 0)
      .sort((a, b) => (b.commitStats?.last7Days ?? 0) - (a.commitStats?.last7Days ?? 0))
      .slice(0, 20);
  }, [data]);

  const topByStars = useMemo(() => {
    if (!data) return [];
    return [...data.repos]
      .sort((a, b) => {
        const aStars = a.parentStats?.stars ?? a.stars;
        const bStars = b.parentStats?.stars ?? b.stars;
        return bStars - aStars;
      })
      .slice(0, 20);
  }, [data]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <div className="border-b border-zinc-800 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Reporium
        </Link>
        <h1 className="text-lg font-bold text-zinc-100">Trends</h1>
        {data && (
          <span className="ml-auto text-xs text-zinc-600">
            {data.repos.length.toLocaleString()} repos
          </span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-zinc-500">Loading trends data...</div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
            Failed to load: {error}
          </div>
        )}

        {data && (
          <>
            {/* Category Momentum */}
            <section>
              <h2 className="text-base font-semibold text-zinc-200 mb-1">Category Momentum</h2>
              <p className="text-xs text-zinc-500 mb-4">Commits in the last 7 days per primary category</p>
              {categoryMomentum.length > 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <BarChart data={categoryMomentum} />
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No commit data available.</p>
              )}
            </section>

            {/* New This Week */}
            <section>
              <h2 className="text-base font-semibold text-zinc-200 mb-1">New This Week</h2>
              <p className="text-xs text-zinc-500 mb-4">Repos added or forked in the last 7 days</p>
              {newThisWeek.length > 0 ? (
                <div className="space-y-2">
                  {newThisWeek.map(r => <RepoRow key={r.id} repo={r} />)}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No new repos this week.</p>
              )}
            </section>

            {/* Most Active */}
            <section>
              <h2 className="text-base font-semibold text-zinc-200 mb-1">Most Active This Week</h2>
              <p className="text-xs text-zinc-500 mb-4">Repos ranked by commits in the last 7 days</p>
              {mostActive.length > 0 ? (
                <div className="space-y-2">
                  {mostActive.map(r => <RepoRow key={r.id} repo={r} />)}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No commit activity data available.</p>
              )}
            </section>

            {/* Top by Stars */}
            <section>
              <h2 className="text-base font-semibold text-zinc-200 mb-1">Top Repos by Stars</h2>
              <p className="text-xs text-zinc-500 mb-4">Highest-starred repos in your library</p>
              <div className="space-y-2">
                {topByStars.map(r => <RepoRow key={r.id} repo={r} />)}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
