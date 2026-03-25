'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types matching /intelligence/ask response schema
// ---------------------------------------------------------------------------
interface SourceRepo {
  name: string;
  owner: string;
  forked_from: string | null;
  description: string | null;
  stars: number | null;
  relevance_score: number;
  problem_solved: string | null;
  integration_tags: string[];
}

interface QueryResponse {
  answer: string;
  sources: SourceRepo[];
  question: string;
  model: string;
  answered_at: string;
  embedding_candidates: number;
  tokens_used: { input: number; output: number; total: number };
}

// ---------------------------------------------------------------------------
// Inner panel — reads ?q= from URL on the client side
// ---------------------------------------------------------------------------
interface AskPanelProps {
  apiUrl: string;
}

function AskPanelInner({ apiUrl }: AskPanelProps) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-submit if ?q= param provided (navigated from mini bar)
  useEffect(() => {
    if (initialQuery && initialQuery.length >= 3) {
      handleSubmit(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(q?: string) {
    const queryText = (q ?? query).trim();
    if (!queryText || queryText.length < 3) {
      setError('Please enter at least 3 characters.');
      return;
    }
    if (queryText.length > 500) {
      setError('Query must be 500 characters or fewer.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${apiUrl}/intelligence/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: queryText, top_k: 8 }),
      });

      if (res.status === 429) {
        setError('Rate limit exceeded. Please wait before querying again.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { detail?: string })?.detail ?? `Server error (${res.status}). Please try again.`);
        return;
      }

      const data: QueryResponse = await res.json();
      setResult(data);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="space-y-6">
      {/* Input row */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">
              ✦
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about AI dev tools..."
              maxLength={500}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-3 pl-8 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="shrink-0 rounded-lg bg-zinc-700 px-5 py-3 text-sm text-zinc-200 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                Querying...
              </span>
            ) : (
              'Submit'
            )}
          </button>
        </div>

        {loading && (
          <p className="text-xs text-zinc-500">Searching repos and generating answer — this may take a moment…</p>
        )}

        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Answer */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Answer</p>
            <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {result.answer}
            </div>
          </div>

          {/* Source repos */}
          {result.sources && result.sources.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium">
                Sources · {result.sources.length} repo{result.sources.length !== 1 ? 's' : ''}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.sources.map((repo) => {
                  const score = Math.round(repo.relevance_score * 100);
                  const upstream = repo.forked_from ?? `${repo.owner}/${repo.name}`;
                  const ghUrl = `https://github.com/${upstream}`;
                  return (
                    <a
                      key={`${repo.owner}/${repo.name}`}
                      href={ghUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 space-y-1.5 hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono font-medium text-zinc-200 truncate group-hover:text-zinc-100">
                          {upstream}
                        </span>
                        <span className="shrink-0 rounded-full border border-sky-700/30 bg-sky-900/30 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                          {score}%
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-zinc-500 line-clamp-2">{repo.description}</p>
                      )}
                      {repo.stars != null && (
                        <p className="text-xs text-zinc-600">★ {repo.stars.toLocaleString()}</p>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — wraps inner panel in Suspense so useSearchParams() works
// in static export builds without breaking SSG
// ---------------------------------------------------------------------------
export function AskPanel({ apiUrl }: AskPanelProps) {
  return (
    <Suspense fallback={null}>
      <AskPanelInner apiUrl={apiUrl} />
    </Suspense>
  );
}
