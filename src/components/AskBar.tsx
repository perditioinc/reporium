'use client';

import { useState, useRef } from 'react';

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

interface AskResponse {
  answer: string;
  sources: SourceRepo[];
  question: string;
  model: string;
  answered_at: string;
  embedding_candidates: number;
  tokens_used: { input: number; output: number; total: number };
}

// ---------------------------------------------------------------------------
// Client-side rate limit guard (warns before the server rejects)
// ---------------------------------------------------------------------------
const RATE_KEY = 'reporium_ask_timestamps';
const RATE_PER_MIN = 10;
const RATE_PER_DAY = 100;

function getRateLimitState(): { minuteCount: number; dayCount: number } {
  if (typeof window === 'undefined') return { minuteCount: 0, dayCount: 0 };
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const oneMinAgo = now - 60_000;
    const oneDayAgo = now - 86_400_000;
    const minuteCount = timestamps.filter((t) => t > oneMinAgo).length;
    const dayCount = timestamps.filter((t) => t > oneDayAgo).length;
    return { minuteCount, dayCount };
  } catch {
    return { minuteCount: 0, dayCount: 0 };
  }
}

function recordRequest() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const oneDayAgo = now - 86_400_000;
    // Prune old entries, add current
    const pruned = timestamps.filter((t) => t > oneDayAgo);
    pruned.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage not available — degrade gracefully
  }
}

// ---------------------------------------------------------------------------
// Basic client-side injection pre-check (mirrors server-side patterns)
// ---------------------------------------------------------------------------
const INJECTION_RE = /ignore (previous|above|all|prior)|disregard (instructions?|rules?|system)|you are now|act as|new (role|persona|instructions?)|system:\s|reveal (your|the) (prompt|instructions?)|print (your|the) (prompt|instructions?)|repeat (after|back)|DAN mode|jailbreak|END OF CONTEXT|IGNORE ABOVE/i;

// ---------------------------------------------------------------------------
// AskBar component
// ---------------------------------------------------------------------------
interface AskBarProps {
  apiUrl: string;
}

export function AskBar({ apiUrl }: AskBarProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { minuteCount, dayCount } = getRateLimitState();
  const nearMinuteLimit = minuteCount >= RATE_PER_MIN - 2;
  const nearDayLimit = dayCount >= RATE_PER_DAY - 5;
  const atMinuteLimit = minuteCount >= RATE_PER_MIN;
  const atDayLimit = dayCount >= RATE_PER_DAY;

  async function handleAsk() {
    const q = question.trim();
    if (!q || q.length < 3) {
      setError('Please enter at least 3 characters.');
      return;
    }
    if (q.length > 500) {
      setError('Question must be 500 characters or fewer.');
      return;
    }
    if (INJECTION_RE.test(q)) {
      setError('That question contains disallowed content. Please rephrase.');
      return;
    }
    if (atMinuteLimit) {
      setError('Rate limit: 10 questions per minute. Please wait a moment.');
      return;
    }
    if (atDayLimit) {
      setError('Daily limit of 100 questions reached. Try again tomorrow.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    recordRequest();

    try {
      const res = await fetch(`${apiUrl}/intelligence/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, top_k: 8 }),
      });

      if (res.status === 429) {
        setError('Rate limit exceeded. Please wait before asking again.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail ?? `Server error (${res.status}). Please try again.`);
        return;
      }

      const data: AskResponse = await res.json();
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
      handleAsk();
    }
  }

  const remainingMin = Math.max(0, RATE_PER_MIN - minuteCount);
  const remainingDay = Math.max(0, RATE_PER_DAY - dayCount);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">
            ✦
          </span>
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the repo library..."
            maxLength={500}
            disabled={atMinuteLimit || atDayLimit}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-8 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleAsk}
          disabled={loading || atMinuteLimit || atDayLimit}
          className="shrink-0 rounded-lg bg-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              Asking...
            </span>
          ) : (
            'Ask'
          )}
        </button>
      </div>

      {/* Loading status */}
      {loading && (
        <p className="text-xs text-zinc-500">Searching repos and generating answer — this takes ~10 seconds…</p>
      )}

      {/* Rate limit warning */}
      {(nearMinuteLimit || nearDayLimit) && !atMinuteLimit && !atDayLimit && (
        <p className="text-xs text-amber-500/80">
          {nearDayLimit
            ? `${remainingDay} questions remaining today`
            : `${remainingMin} questions remaining this minute`}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Answer */}
      {result && (
        <div className="space-y-3 pt-1">
          {/* Answer text */}
          <div className="rounded-lg bg-zinc-800/60 px-4 py-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {result.answer}
          </div>

          {/* Source repos */}
          {result.sources.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Sources · {result.sources.length} repos
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.sources.map((repo) => {
                  const upstream = repo.forked_from ?? `${repo.owner}/${repo.name}`;
                  const ghUrl = `https://github.com/${upstream}`;
                  const score = Math.round(repo.relevance_score * 100);
                  return (
                    <a
                      key={`${repo.owner}/${repo.name}`}
                      href={ghUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono text-zinc-300 group-hover:text-zinc-100 truncate">
                          {upstream}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-600">
                          {score}% match
                        </span>
                      </div>
                      {repo.description && (
                        <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      {repo.stars != null && (
                        <p className="mt-1 text-xs text-zinc-600">
                          ★ {repo.stars.toLocaleString()}
                        </p>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meta */}
          <p className="text-xs text-zinc-600">
            {result.embedding_candidates} repos searched · {result.tokens_used.total} tokens
          </p>
        </div>
      )}
    </div>
  );
}
