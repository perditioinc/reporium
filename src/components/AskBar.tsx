'use client';

import { useState, useRef, useCallback } from 'react';
import { AskBudgetIndicator } from './AskBudgetIndicator';

// ---------------------------------------------------------------------------
// Session ID management (KAN-158/KAN-159)
// ---------------------------------------------------------------------------
const SESSION_KEY = 'reporium_ask_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function clearSessionId(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY);
}

// ---------------------------------------------------------------------------
// Types matching /intelligence/ask/stream SSE events
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

interface TokensUsed {
  input: number;
  output: number;
  total: number;
}

// SSE event shapes
interface SourcesEvent {
  type: 'sources';
  sources: SourceRepo[];
  cache_hit: boolean;
}
interface TokenEvent {
  type: 'token';
  text: string;
}
interface DoneEvent {
  type: 'done';
  tokens: TokensUsed;
  cache_hit?: boolean;
}
interface ErrorEvent {
  type: 'error';
  message: string;
}
type StreamEvent = SourcesEvent | TokenEvent | DoneEvent | ErrorEvent;

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
// Parse an SSE line buffer into events
// ---------------------------------------------------------------------------
function parseSseLine(line: string): StreamEvent | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6)) as StreamEvent;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AskBar component
// ---------------------------------------------------------------------------
const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '';

interface AskBarProps {
  apiUrl: string;
}

export function AskBar({ apiUrl }: AskBarProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  // Streaming state
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [sources, setSources] = useState<SourceRepo[]>([]);
  const [tokensUsed, setTokensUsed] = useState<TokensUsed | null>(null);
  const [done, setDone] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // KAN-158: conversational session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  const handleNewConversation = useCallback(() => {
    clearSessionId();
    setSessionId(null);
    setTurnCount(0);
    setStreamingAnswer('');
    setSources([]);
    setTokensUsed(null);
    setDone(false);
    setError(null);
    setQuestion('');
    inputRef.current?.focus();
  }, []);

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

    // Reset state for new query
    setLoading(true);
    setError(null);
    setStreamingAnswer('');
    setSources([]);
    setTokensUsed(null);
    setDone(false);
    recordRequest();

    // Cancel any previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Get or create a session ID for conversational memory (KAN-158)
      const sid = sessionId ?? getOrCreateSessionId();
      if (!sessionId) setSessionId(sid);

      const res = await fetch(`${apiUrl}/intelligence/ask/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(APP_TOKEN && { 'X-App-Token': APP_TOKEN }),
        },
        body: JSON.stringify({ question: q, top_k: 8, session_id: sid }),
        signal: controller.signal,
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

      // Read the SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        setError('Streaming not supported by this browser. Please try again.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const event = parseSseLine(trimmed);
          if (!event) continue;

          if (event.type === 'sources') {
            setSources(event.sources);
          } else if (event.type === 'token') {
            setStreamingAnswer((prev) => prev + event.text);
          } else if (event.type === 'done') {
            setTokensUsed(event.tokens);
            setDone(true);
            setTurnCount((n) => n + 1);
          } else if (event.type === 'error') {
            setError(event.message);
            break;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User aborted — ignore
        return;
      }
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

  const hasAnswer = streamingAnswer.length > 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      {/* Conversation continuity indicator (KAN-158) */}
      {sessionId && turnCount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-sky-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Continuing conversation ({turnCount} {turnCount === 1 ? 'turn' : 'turns'})
          </span>
          <button
            onClick={handleNewConversation}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline-offset-2 hover:underline"
          >
            New conversation
          </button>
        </div>
      )}

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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-8 pr-4 text-base sm:text-sm text-zinc-200 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
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
              {sources.length > 0 ? 'Answering…' : 'Searching…'}
            </span>
          ) : (
            'Ask'
          )}
        </button>
      </div>

      {/* Persistent client-side budget meter (Design Phase 1 — P2). */}
      <div className="flex justify-end">
        <AskBudgetIndicator className="w-40" />
      </div>

      {/* Loading status */}
      {loading && sources.length === 0 && (
        <p className="text-xs text-zinc-400">Searching repos and finding the best matches…</p>
      )}
      {loading && sources.length > 0 && !hasAnswer && (
        <p className="text-xs text-zinc-400">Generating answer from {sources.length} repos…</p>
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

      {/* Source repos — shown as soon as we have them (before generation completes) */}
      {sources.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
            Sources · {sources.length} repos
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((repo) => {
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
                    <span className="shrink-0 text-xs text-zinc-400">
                      {score}% match
                    </span>
                  </div>
                  {repo.description && (
                    <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                  {repo.stars != null && (
                    <p className="mt-1 text-xs text-zinc-400">
                      ★ {repo.stars.toLocaleString()}
                    </p>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Streaming answer — appears token-by-token */}
      {hasAnswer && (
        <div className="space-y-2">
          <div className="rounded-lg bg-zinc-800/60 px-4 py-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {streamingAnswer}
            {/* Blinking cursor while still streaming */}
            {loading && (
              <span className="inline-block w-0.5 h-4 ml-0.5 bg-zinc-400 align-middle animate-pulse" />
            )}
          </div>

          {/* Meta — shown once done */}
          {done && tokensUsed && (
            <p className="text-xs text-zinc-600">
              {sources.length > 0 ? `${sources.length} repos searched` : ''}{sources.length > 0 && tokensUsed ? ' · ' : ''}{tokensUsed ? `${tokensUsed.total} tokens` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
