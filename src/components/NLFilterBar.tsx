'use client';

/**
 * KAN-159: NL Filter Bar
 *
 * POST /intelligence/nl-filter → structured filter params → apply to repo grid.
 * Single Haiku call ~$0.0005. Results cached 1 hour server-side.
 *
 * Example: "actively maintained Python RAG tools with >1000 stars"
 * → { language: "python", category: "rag-retrieval", min_stars: 1000,
 *     sort: "stars", exclude_archived: true, interpretation: "..." }
 */

import { useState, useRef } from 'react';
import type { NLFilterResult } from '@/types/repo';

const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '';

const API_URL =
  process.env.NEXT_PUBLIC_REPORIUM_API_URL ??
  'https://api.reporium.com';

interface NLFilterBarProps {
  onApply: (result: NLFilterResult) => void;
  onClear: () => void;
  activeInterpretation?: string | null;
}

export function NLFilterBar({ onApply, onClear, activeInterpretation }: NLFilterBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFilter() {
    const q = query.trim();
    if (!q || q.length < 3) {
      setError('Enter at least 3 characters.');
      return;
    }
    if (q.length > 300) {
      setError('Query must be 300 characters or fewer.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/intelligence/nl-filter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(APP_TOKEN && { 'X-App-Token': APP_TOKEN }),
        },
        body: JSON.stringify({ query: q }),
      });

      if (res.status === 429) {
        setError('Too many requests — wait a moment and try again.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail ?? `Server error (${res.status}).`);
        return;
      }

      const result: NLFilterResult = await res.json();
      onApply(result);
      setQuery('');
    } catch {
      setError('Network error — check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFilter();
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  }

  function handleClear() {
    setQuery('');
    setError(null);
    onClear();
    inputRef.current?.focus();
  }

  const hasActive = Boolean(activeInterpretation);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Input */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/70 text-sm select-none pointer-events-none">
            ✦
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder={'Smart filter: \u201cPython RAG repos with 1000+ stars\u201d\u2026'}
            maxLength={300}
            disabled={loading}
            className="w-full rounded-lg border border-purple-900/50 bg-zinc-900/80 py-2 pl-8 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-purple-700/60 focus:outline-none focus:ring-1 focus:ring-purple-700/40 disabled:opacity-50 transition-colors"
          />
        </div>

        {/* Apply button */}
        <button
          onClick={handleFilter}
          disabled={loading || query.trim().length < 3}
          className="shrink-0 rounded-lg bg-purple-900/60 border border-purple-700/40 px-4 py-2 text-sm text-purple-200 hover:bg-purple-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
              Filtering…
            </span>
          ) : (
            'Smart Filter'
          )}
        </button>

        {/* Clear button — only when active filter */}
        {hasActive && (
          <button
            onClick={handleClear}
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            title="Clear smart filter"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}

      {/* Active filter interpretation pill */}
      {activeInterpretation && !error && (
        <div className="flex items-center gap-2 px-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-purple-900/20 px-2.5 py-0.5 text-xs text-purple-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            {activeInterpretation}
          </span>
        </div>
      )}
    </div>
  );
}
