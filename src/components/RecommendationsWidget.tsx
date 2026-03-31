'use client';

/**
 * KAN-159: "Recommended for you" section on homepage.
 *
 * Reads recently viewed repos from localStorage, picks the most recently
 * viewed, calls GET /intelligence/similar/{name}?limit=6, deduplicates,
 * and shows top results as a horizontal scroll section.
 *
 * Cost: $0 (pure pgvector cosine similarity, no AI call).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SimilarRepo } from '@/types/repo';

const API_URL =
  process.env.NEXT_PUBLIC_REPORIUM_API_URL ??
  'https://reporium-api-573778300586.us-central1.run.app';

const VIEWED_KEY = 'reporium_viewed_repos';
const MAX_VIEWED = 10;
const REC_LIMIT = 6;

/** Push a repo name to the recently-viewed list (called from detail page). */
export function trackRepoView(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const deduped = [name, ...list.filter((n) => n !== name)].slice(0, MAX_VIEWED);
    localStorage.setItem(VIEWED_KEY, JSON.stringify(deduped));
  } catch {
    // localStorage not available
  }
}

function getRecentlyViewed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface RecommendationsWidgetProps {
  currentRepos?: Set<string>; // names already visible in filtered grid — skip these
}

export function RecommendationsWidget({ currentRepos }: RecommendationsWidgetProps) {
  const [seedName, setSeedName] = useState<string | null>(null);
  const [recs, setRecs] = useState<SimilarRepo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const viewed = getRecentlyViewed();
    if (viewed.length === 0) return;

    const seed = viewed[0]; // most recently viewed
    setSeedName(seed);
    setLoading(true);

    fetch(`${API_URL}/intelligence/similar/${encodeURIComponent(seed)}?limit=${REC_LIMIT}`)
<<<<<<< HEAD
      .then((r) => (r.ok ? r.json() : { similar: [] }))
      .then((data: { similar?: SimilarRepo[] } | SimilarRepo[]) => {
        // API returns { source_repo, similar: [...], total } — unwrap
        const repoList: SimilarRepo[] = Array.isArray(data) ? data : (data.similar ?? []);
        // Filter out repos already visible in the grid
        const filtered = currentRepos
          ? repoList.filter((r) => !currentRepos.has(r.name))
          : repoList;
        setRecs(filtered.slice(0, REC_LIMIT));
      })
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, []); // run once on mount — recently viewed is read from localStorage

  // Don't render if no recommendations
  if (!seedName || (recs.length === 0 && !loading)) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-zinc-400">
          Recommended · based on{' '}
          <Link
            href={`/repo/${encodeURIComponent(seedName)}`}
            className="text-zinc-300 hover:text-zinc-100 transition-colors underline-offset-2 hover:underline"
          >
            {seedName}
          </Link>
        </h2>
        <span className="text-xs text-zinc-600">pgvector · $0</span>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-52 h-20 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
          {recs.map((repo) => (
            <Link
              key={repo.name}
              href={`/repo/${encodeURIComponent(repo.name)}`}
              className="group shrink-0 w-56 snap-start rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 hover:border-zinc-600 transition-colors"
            >
              <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-zinc-100">
                {repo.name}
              </p>
              {repo.description && (
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                  {repo.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                {repo.primary_language && (
                  <span className="text-xs text-zinc-600">{repo.primary_language}</span>
                )}
                {typeof repo.similarity === 'number' && (
                  <span className="ml-auto text-xs text-sky-400/70">
                    {Math.round(repo.similarity * 100)}%
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
