'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SimilarRepo } from '@/types/repo';

const API_URL = process.env.NEXT_PUBLIC_REPORIUM_API_URL ?? '';

interface Props {
  repoName: string;
}

export function SimilarReposPanel({ repoName }: Props) {
  const [repos, setRepos] = useState<SimilarRepo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/intelligence/similar/${encodeURIComponent(repoName)}?limit=8`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : { similar: [] }))
      .then((data: { similar?: SimilarRepo[] } | SimilarRepo[]) => {
        const list: SimilarRepo[] = Array.isArray(data) ? data : (data.similar ?? []);
        setRepos(list);
      })
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, [repoName]);

  return (
    <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">Similar Repos</h2>
        <p className="text-xs text-zinc-500">pgvector cosine similarity · $0</p>
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-zinc-600">Loading…</p>
      ) : repos.length > 0 ? (
        <div className="mt-4 space-y-3">
          {repos.map((similar) => (
            <Link
              key={similar.name}
              href={`/repo/${encodeURIComponent(similar.name)}`}
              className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 transition-colors hover:border-zinc-700"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{similar.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                  {similar.readme_summary ?? similar.description ?? 'No description available.'}
                </p>
                {similar.stars != null && (
                  <p className="mt-1 text-xs text-zinc-600">★ {similar.stars.toLocaleString()}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {similar.primary_language ? (
                  <span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-xs text-zinc-300">
                    {similar.primary_language}
                  </span>
                ) : null}
                {typeof similar.similarity === 'number' ? (
                  <span className="rounded-full border border-sky-700/30 bg-sky-900/30 px-2 py-0.5 text-xs font-medium text-sky-300">
                    {Math.round(similar.similarity * 100)}% match
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          No similar repos surfaced yet — embeddings may still be generating.
        </p>
      )}
    </section>
  );
}
