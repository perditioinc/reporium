'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { API_URL } from '@/lib/apiUrl';

const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '';

// Shares AskBar's client-side budget key so /faq expands and /ask submissions
// draw from one wallet (10/min, 100/day). Does not stop a determined attacker
// — that requires a server-side proxy (see KAN-272 design memo, Phase 3).
const RATE_KEY = 'reporium_ask_timestamps';
const RATE_PER_MIN = 10;
const RATE_PER_DAY = 100;

// FAQ questions are hardcoded literals, so cache hits are high and safe.
const CACHE_KEY = 'reporium_faq_answer_cache';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CachedAnswer {
  at: number;
  answer: string;
  sources: SourceRepo[];
}

function readBudget(): { minute: number; day: number } {
  if (typeof window === 'undefined') return { minute: 0, day: 0 };
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const ts: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    return {
      minute: ts.filter((t) => t > now - 60_000).length,
      day: ts.filter((t) => t > now - 86_400_000).length,
    };
  } catch {
    return { minute: 0, day: 0 };
  }
}

function recordAsk() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const ts: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const pruned = ts.filter((t) => t > now - 86_400_000);
    pruned.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage unavailable — degrade gracefully (no counter, no cache)
  }
}

function readCache(question: string): CachedAnswer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const map: Record<string, CachedAnswer> = raw ? JSON.parse(raw) : {};
    const hit = map[question];
    if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
    return hit;
  } catch {
    return null;
  }
}

function writeCache(question: string, answer: string, sources: SourceRepo[]) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const map: Record<string, CachedAnswer> = raw ? JSON.parse(raw) : {};
    const fresh: Record<string, CachedAnswer> = {};
    const now = Date.now();
    for (const [k, v] of Object.entries(map)) {
      if (now - v.at <= CACHE_TTL_MS) fresh[k] = v;
    }
    fresh[question] = { at: now, answer, sources };
    localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
  } catch {
    // ignore — cache is best-effort
  }
}

// Grouped so the page reads as a tour of Reporium's capabilities. Every entry
// is pinned to a deterministic smart-route match in reporium-api so the answer
// is always grounded — no generic "not enough information" early-exit. Keep in
// sync with `_CURATED_SUGGESTIONS` in `reporium-api/app/routers/intelligence.py`.
interface FAQSection {
  title: string;
  blurb: string;
  questions: string[];
}

const FAQ_SECTIONS: readonly FAQSection[] = [
  {
    title: 'Library stats',
    blurb: 'Instant SQL counts over the indexed library. Zero token cost.',
    questions: [
      'How many repos are tracked?',
      'What categories are available?',
      'How many Python repos are there?',
    ],
  },
  {
    title: 'Leaderboards',
    blurb: 'Ranked repos by stars, forks, activity, or recency.',
    questions: [
      'What are the most forked repos?',
      'What are the most starred repos?',
      'What are the most active repos?',
      'What are the newest repos?',
    ],
  },
  {
    title: 'Topic-narrowed picks',
    blurb: 'Leaderboards filtered to a specific AI-dev category.',
    questions: [
      'Show me RAG tools with the most stars',
      'Show me agent tools with the most stars',
      'Show me inference tools with the most stars',
      'Show me evaluation tools with the most stars',
    ],
  },
  {
    title: 'Tag search',
    blurb: 'Find every repo tagged with a given capability.',
    questions: [
      'Which repos support MCP?',
      'Which repos use pgvector?',
    ],
  },
  {
    title: 'Comparisons',
    blurb: 'Side-by-side metadata for two repos — license, category, stars, activity.',
    questions: [
      'Compare LangChain and LlamaIndex',
      "What's the difference between vLLM and TGI?",
      'Compare CrewAI and AutoGen',
    ],
  },
];

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

interface AnswerState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  answer?: string;
  sources?: SourceRepo[];
  error?: string;
}

const MARKDOWN_COMPONENTS = {
  a: (props: React.ComponentProps<'a'>) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-zinc-200 underline underline-offset-2 hover:text-white"
    />
  ),
  code: (props: React.ComponentProps<'code'>) => (
    <code {...props} className="rounded bg-zinc-800 px-1 py-0.5 text-xs" />
  ),
  pre: (props: React.ComponentProps<'pre'>) => (
    <pre {...props} className="rounded-lg bg-zinc-900 p-3 overflow-x-auto my-2 text-xs" />
  ),
  ul: (props: React.ComponentProps<'ul'>) => (
    <ul {...props} className="list-disc pl-5 space-y-1 my-2" />
  ),
  ol: (props: React.ComponentProps<'ol'>) => (
    <ol {...props} className="list-decimal pl-5 space-y-1 my-2" />
  ),
  p: (props: React.ComponentProps<'p'>) => (
    <p {...props} className="my-2 first:mt-0 last:mb-0" />
  ),
};

function formatRepoLink(src: SourceRepo) {
  if (src.forked_from) {
    return { label: src.forked_from, href: `https://github.com/${src.forked_from}` };
  }
  const slug = `${src.owner}/${src.name}`;
  return { label: slug, href: `https://github.com/${slug}` };
}

async function fetchAnswer(question: string, signal: AbortSignal): Promise<AnswerState> {
  if (!APP_TOKEN) {
    return {
      status: 'error',
      error: 'Ask is not configured in this environment (missing NEXT_PUBLIC_APP_API_TOKEN).',
    };
  }
  try {
    const res = await fetch(`${API_URL}/intelligence/ask`, {
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-App-Token': APP_TOKEN,
      },
      body: JSON.stringify({ question, top_k: 8 }),
    });
    if (res.status === 429) {
      return { status: 'error', error: 'Rate limit exceeded. Try refreshing in a minute.' };
    }
    if (!res.ok) {
      return { status: 'error', error: `Server error (${res.status}).` };
    }
    const body = (await res.json()) as { answer: string; sources: SourceRepo[] };
    return { status: 'ready', answer: body.answer, sources: body.sources ?? [] };
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      return { status: 'idle' };
    }
    return { status: 'error', error: 'Network error — please refresh to retry.' };
  }
}

/**
 * FAQ card — lazily fetches the answer the first time the details element opens.
 * Keeps the initial page weightless (one fetch per user-initiated expansion)
 * instead of firing 16 requests on mount.
 */
function FAQCard({ question }: { question: string }) {
  const [state, setState] = useState<AnswerState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  function load() {
    if (state.status === 'loading' || state.status === 'ready') return;

    const cached = readCache(question);
    if (cached) {
      setState({ status: 'ready', answer: cached.answer, sources: cached.sources });
      return;
    }

    const { minute, day } = readBudget();
    if (minute >= RATE_PER_MIN) {
      setState({
        status: 'error',
        error: "You've hit Reporium's per-minute Ask budget (10/min). Try again in a moment.",
      });
      return;
    }
    if (day >= RATE_PER_DAY) {
      setState({
        status: 'error',
        error: "Today's Ask budget is used up (100/day). Try again tomorrow.",
      });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading' });
    void fetchAnswer(question, controller.signal).then((next) => {
      if (next.status === 'ready') {
        recordAsk();
        writeCache(question, next.answer ?? '', next.sources ?? []);
      }
      setState(next);
    });
  }

  useEffect(() => () => controllerRef.current?.abort(), []);

  return (
    <details
      className="group rounded-lg border border-zinc-800 bg-zinc-900/60 open:bg-zinc-900 transition-colors"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) load();
      }}
    >
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-100">{question}</span>
        <span
          aria-hidden
          className="text-zinc-500 group-open:rotate-180 transition-transform text-xs shrink-0"
        >
          ▾
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60">
        {state.status === 'idle' && (
          <p className="text-xs text-zinc-500 py-2">Click to load the answer.</p>
        )}
        {state.status === 'loading' && <FAQSkeleton />}
        {state.status === 'error' && (
          <div className="py-2">
            <p className="text-xs text-red-400">{state.error}</p>
            <button
              type="button"
              onClick={() => {
                setState({ status: 'idle' });
                load();
              }}
              className="mt-2 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:border-zinc-600"
            >
              Retry
            </button>
          </div>
        )}
        {state.status === 'ready' && (
          <div className="space-y-3">
            <div className="prose prose-invert prose-sm max-w-none text-sm text-zinc-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={MARKDOWN_COMPONENTS}
              >
                {state.answer ?? ''}
              </ReactMarkdown>
            </div>
            {state.sources && state.sources.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5">
                  Sources
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {state.sources.slice(0, 8).map((src) => {
                    const link = formatRepoLink(src);
                    return (
                      <li key={`${src.owner}/${src.name}`}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
                        >
                          {link.label}
                          {typeof src.stars === 'number' && (
                            <span className="text-zinc-500">★ {src.stars.toLocaleString()}</span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <a
              href={`/ask?q=${encodeURIComponent(question)}`}
              className="inline-block text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
            >
              Open in Ask →
            </a>
          </div>
        )}
      </div>
    </details>
  );
}

function FAQSkeleton() {
  return (
    <div className="space-y-2 py-2" aria-hidden>
      <div className="h-3 w-3/4 rounded bg-zinc-800 animate-pulse" />
      <div className="h-3 w-5/6 rounded bg-zinc-800 animate-pulse" />
      <div className="h-3 w-2/3 rounded bg-zinc-800 animate-pulse" />
    </div>
  );
}

export function FAQPanel() {
  const total = useMemo(
    () => FAQ_SECTIONS.reduce((acc, s) => acc + s.questions.length, 0),
    [],
  );
  return (
    <div className="space-y-10">
      <p className="text-xs text-zinc-500">
        {total} questions · answers come directly from <code className="bg-zinc-800 px-1 rounded">/intelligence/ask</code>,
        the same endpoint that powers the Ask bar.
      </p>
      {FAQ_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="text-lg font-semibold text-zinc-200">{section.title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{section.blurb}</p>
          <div className="mt-4 space-y-2">
            {section.questions.map((q) => (
              <FAQCard key={q} question={q} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
