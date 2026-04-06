'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING } from '@/styles/tokens';

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

interface SourcesEvent { type: 'sources'; sources: SourceRepo[]; cache_hit: boolean }
interface TokenEvent { type: 'token'; text: string }
interface DoneEvent { type: 'done'; tokens: TokensUsed; cache_hit?: boolean }
interface ErrorEvent { type: 'error'; message: string }
type StreamEvent = SourcesEvent | TokenEvent | DoneEvent | ErrorEvent;

// ---------------------------------------------------------------------------
// Client-side rate limit guard
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
    const minuteCount = timestamps.filter((t) => t > now - 60_000).length;
    const dayCount = timestamps.filter((t) => t > now - 86_400_000).length;
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
    const pruned = timestamps.filter((t) => t > now - 86_400_000);
    pruned.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(pruned));
  } catch { /* degrade gracefully */ }
}

// ---------------------------------------------------------------------------
// Injection pre-check (mirrors server-side patterns)
// ---------------------------------------------------------------------------
const INJECTION_RE = /ignore (previous|above|all|prior)|disregard (instructions?|rules?|system)|you are now|act as|new (role|persona|instructions?)|system:\s|reveal (your|the) (prompt|instructions?)|print (your|the) (prompt|instructions?)|repeat (after|back)|DAN mode|jailbreak|END OF CONTEXT|IGNORE ABOVE/i;

function parseSseLine(line: string): StreamEvent | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6)) as StreamEvent;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------
type BarState = 'collapsed' | 'expanded' | 'fullscreen';

const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '';

const API_URL =
  process.env.NEXT_PUBLIC_REPORIUM_API_URL ??
  'https://api.reporium.com';

export function StickyAskBar() {
  const [barState, setBarState] = useState<BarState>('collapsed');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  // Streaming state
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [sources, setSources] = useState<SourceRepo[]>([]);
  const [tokensUsed, setTokensUsed] = useState<TokensUsed | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  // Esc key exits fullscreen
  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Escape' && barState === 'fullscreen') {
        setBarState('expanded');
      }
    }
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [barState]);

  // Auto-scroll answer area as tokens arrive
  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [streamingAnswer]);

  const handleNewConversation = useCallback(() => {
    clearSessionId();
    setSessionId(null);
    setTurnCount(0);
    setStreamingAnswer('');
    setSources([]);
    setTokensUsed(null);
    setDone(false);
    setError(null);
    setCacheHit(false);
    setRouteLabel(null);
    setQuestion('');
    setBarState('collapsed');
    inputRef.current?.focus();
  }, []);

  const { minuteCount, dayCount } = getRateLimitState();
  const atMinuteLimit = minuteCount >= RATE_PER_MIN;
  const atDayLimit = dayCount >= RATE_PER_DAY;
  const nearMinuteLimit = minuteCount >= RATE_PER_MIN - 2;
  const nearDayLimit = dayCount >= RATE_PER_DAY - 5;
  const remainingMin = Math.max(0, RATE_PER_MIN - minuteCount);
  const remainingDay = Math.max(0, RATE_PER_DAY - dayCount);

  async function handleAsk() {
    const q = question.trim();
    if (!q || q.length < 3) { setError('Please enter at least 3 characters.'); return; }
    if (q.length > 500) { setError('Question must be 500 characters or fewer.'); return; }
    if (INJECTION_RE.test(q)) { setError('That question contains disallowed content. Please rephrase.'); return; }
    if (atMinuteLimit) { setError('Rate limit: 10 questions per minute. Please wait a moment.'); return; }
    if (atDayLimit) { setError('Daily limit of 100 questions reached. Try again tomorrow.'); return; }

    setLoading(true);
    setError(null);
    setStreamingAnswer('');
    setSources([]);
    setTokensUsed(null);
    setDone(false);
    setCacheHit(false);
    setRouteLabel(null);
    setBarState('expanded');
    recordRequest();

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const sid = sessionId ?? getOrCreateSessionId();
      if (!sessionId) setSessionId(sid);

      const res = await fetch(`${API_URL}/intelligence/ask/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(APP_TOKEN && { 'X-App-Token': APP_TOKEN }),
        },
        body: JSON.stringify({ question: q, top_k: 8, session_id: sid }),
        signal: controller.signal,
      });

      if (res.status === 429) { setError('Rate limit exceeded. Please wait before asking again.'); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail ?? `Server error (${res.status}). Please try again.`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setError('Streaming not supported by this browser. Please try again.'); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const event = parseSseLine(trimmed);
          if (!event) continue;

          if (event.type === 'sources') {
            setSources(event.sources);
            // Track if this was a smart-routed or cached response
            if ('cache_hit' in event && event.cache_hit) setCacheHit(true);
            if ('route' in event) setRouteLabel((event as Record<string, unknown>).route as string);
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
      if (err instanceof Error && err.name === 'AbortError') return;
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

  // Fetch suggested questions on mount
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_URL}/intelligence/suggestions`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.suggestions) setSuggestions(d.suggestions); })
      .catch(() => {}); // silently degrade — suggestions are a nice-to-have
  }, []);

  const hasAnswer = streamingAnswer.length > 0;

  // 100 AI-native cycling suggestions showcasing Reporium's capabilities
  const FALLBACK_SUGGESTIONS = [
    // Agent frameworks & MCP
    'Which agent frameworks support tool use and MCP?',
    'Compare CrewAI vs AutoGen vs LangGraph for multi-agent orchestration',
    'What repos implement the Model Context Protocol?',
    'Show me agent memory systems for long-running conversations',
    'What tools support chain-of-thought reasoning in agents?',
    'Which repos enable function calling for LLM agents?',
    'Best frameworks for building autonomous coding agents?',
    'What agent planning systems are production-ready?',
    'Compare agent architectures: ReAct vs plan-and-execute vs tree of thought',
    'Which repos support structured output from LLM agents?',
    // RAG & retrieval
    'Compare RAG approaches: LlamaIndex vs LangChain vs Haystack',
    'What vector databases have the best hybrid search?',
    'Which repos implement advanced chunking strategies?',
    'Best reranking models for RAG pipelines?',
    'What tools handle multi-modal RAG with images and tables?',
    'Show me document parsing repos for PDFs and Office files',
    'Which repos support graph-based RAG?',
    'What embedding models work best for semantic search?',
    'Compare Chroma vs Weaviate vs Qdrant vs Milvus',
    'Which RAG frameworks handle real-time streaming retrieval?',
    // Model training & fine-tuning
    'Which fine-tuning tools support LoRA and QLoRA?',
    'Best repos for RLHF and preference learning?',
    'What synthetic data generators work with open models?',
    'Compare Unsloth vs Axolotl vs TRL for efficient fine-tuning',
    'Which repos support distributed training with DeepSpeed?',
    'What tools exist for dataset curation and cleaning?',
    'Show me repos for training custom embedding models',
    'Best open-source model merging and pruning tools?',
    'What repos support continued pre-training of LLMs?',
    'Which training frameworks handle vision-language models?',
    // Foundation models & inference
    'Best open-source alternatives to GPT-4 for code generation?',
    'Which inference engines support speculative decoding?',
    'Compare vLLM vs TGI vs Ollama for local model serving',
    'What repos optimize transformer inference with quantization?',
    'Show me model routers that switch between LLM providers',
    'Which repos serve models with sub-100ms latency?',
    'Best tools for running LLMs on consumer GPUs?',
    'What repos handle batch inference at scale?',
    'Compare quantization methods: GPTQ vs AWQ vs GGUF',
    'Which repos support multi-model orchestration?',
    // Evals & benchmarking
    'What tools exist for LLM evaluation and red teaming?',
    'Best repos for automated prompt testing at scale?',
    'Which evaluation frameworks measure hallucination rates?',
    'Compare LLM eval tools: lm-eval-harness vs HELM vs Eleuther',
    'What repos benchmark multi-turn conversation quality?',
    'Show me tools for testing LLM safety and alignment',
    'Which repos evaluate code generation accuracy?',
    'Best frameworks for A/B testing different prompts?',
    'What tools measure semantic correctness vs reference answers?',
    'Which repos track model regression over time?',
    // Observability & monitoring
    'What observability tools trace LLM chains end-to-end?',
    'Compare LangSmith vs Phoenix vs Langfuse for LLM monitoring',
    'Which repos provide cost tracking across LLM providers?',
    'Best tools for logging and replaying LLM conversations?',
    'What repos detect prompt injection in production?',
    'Show me LLM error analysis and debugging tools',
    'Which observability platforms support streaming traces?',
    'Best open-source alternatives to LangSmith?',
    'What repos visualize token usage and latency distributions?',
    'Which monitoring tools alert on quality regressions?',
    // Security & safety
    'What repos help with prompt injection defense?',
    'Best guardrail frameworks for content filtering?',
    'Which repos implement output sanitization for LLMs?',
    'Compare NeMo Guardrails vs Guardrails AI vs Rebuff',
    'What tools detect jailbreak attempts in real-time?',
    'Show me repos for PII redaction in LLM pipelines',
    'Which repos handle secrets management for AI apps?',
    'Best tools for rate limiting and abuse prevention?',
    'What repos audit LLM outputs for compliance?',
    'Which security scanning tools work with AI codebases?',
    // Code generation & dev tools
    'Best open-source coding assistants and copilots?',
    'Which repos generate unit tests from source code?',
    'Compare Continue vs Cody vs Tabby for code completion',
    'What tools auto-generate API documentation?',
    'Show me repos that convert natural language to SQL',
    'Which repos do automated code review with LLMs?',
    'Best tools for generating frontend UI from descriptions?',
    'What repos handle code translation between languages?',
    'Which developer tools integrate LLMs into CI/CD?',
    'Show me AI-powered git commit message generators',
    // Data engineering & MLOps
    'What repos handle data labeling with LLM assistance?',
    'Best MLOps platforms for managing model lifecycle?',
    'Which repos support feature stores for ML pipelines?',
    'Compare Weights & Biases vs MLflow vs Neptune',
    'What tools automate model deployment to Kubernetes?',
    'Show me repos for data versioning and lineage tracking',
    'Which repos handle experiment tracking at scale?',
    'Best tools for model registry and artifact management?',
    'What repos support A/B testing deployed ML models?',
    'Which data pipeline frameworks handle streaming ML?',
    // Community & discovery
    'Which repos have the strongest community health signals?',
    'What are the fastest-growing repos this month?',
    'Show me repos with active discussions and contributors',
    'Which projects have the best documentation?',
    'What repos were most mentioned on Hacker News?',
    'Compare community activity: LangChain vs LlamaIndex',
    'Which repos have the most professional test suites?',
    'Show me repos maintained by major AI labs',
    'What new repos were added this week?',
    'Which repos have the best production readiness signals?',
  ];
  const placeholderOptions = suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS;
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestionOverlay, setShowSuggestionOverlay] = useState(true);

  useEffect(() => {
    if (isFocused || question || loading || hasAnswer) return;
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % placeholderOptions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isFocused, question, loading, hasAnswer, placeholderOptions.length]);

  const currentPlaceholder = placeholderOptions[placeholderIdx % placeholderOptions.length] ?? 'Ask anything about the repo library...';

  const heightValue =
    barState === 'collapsed' ? 56 :
    barState === 'fullscreen' ? '100vh' :
    '50vh';

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 overflow-hidden"
      initial={{ height: 56 }}
      animate={{ height: heightValue }}
      transition={SPRING.snappy}
    >
      {/* Input bar — always visible */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 h-14">
        {/* Jellyfish mascot */}
        <button
          type="button"
          onClick={() => {
            if (!question && !loading) {
              setQuestion(currentPlaceholder);
              inputRef.current?.focus();
            }
          }}
          className="shrink-0 group"
          aria-label="Ask a suggestion"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            className="transition-transform group-hover:scale-110"
          >
            {/* Bell / head */}
            <ellipse cx="16" cy="11" rx="9" ry="8" className="fill-violet-500/80 group-hover:fill-violet-400/90 transition-colors">
              <animate attributeName="ry" values="8;8.6;8" dur="2.5s" repeatCount="indefinite" />
            </ellipse>
            {/* Inner glow */}
            <ellipse cx="16" cy="10" rx="5" ry="4.5" className="fill-violet-300/25">
              <animate attributeName="ry" values="4.5;5;4.5" dur="2.5s" repeatCount="indefinite" />
            </ellipse>
            {/* Eyes */}
            <circle cx="13" cy="10" r="1.2" className="fill-white/90" />
            <circle cx="19" cy="10" r="1.2" className="fill-white/90" />
            <circle cx="13.3" cy="10.2" r="0.5" className="fill-zinc-900" />
            <circle cx="19.3" cy="10.2" r="0.5" className="fill-zinc-900" />
            {/* Tentacles */}
            <path d="M9 17 Q8 22 10 26" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.7">
              <animate attributeName="d" values="M9 17 Q8 22 10 26;M9 17 Q7 22 9 26;M9 17 Q8 22 10 26" dur="3s" repeatCount="indefinite" />
            </path>
            <path d="M12 18 Q11 23 12 27" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6">
              <animate attributeName="d" values="M12 18 Q11 23 12 27;M12 18 Q12.5 23 11 27;M12 18 Q11 23 12 27" dur="2.8s" repeatCount="indefinite" />
            </path>
            <path d="M16 18 Q16 24 16 28" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.7">
              <animate attributeName="d" values="M16 18 Q16 24 16 28;M16 18 Q15 24 17 28;M16 18 Q16 24 16 28" dur="3.2s" repeatCount="indefinite" />
            </path>
            <path d="M20 18 Q21 23 20 27" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6">
              <animate attributeName="d" values="M20 18 Q21 23 20 27;M20 18 Q19.5 23 21 27;M20 18 Q21 23 20 27" dur="2.6s" repeatCount="indefinite" />
            </path>
            <path d="M23 17 Q24 22 22 26" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.7">
              <animate attributeName="d" values="M23 17 Q24 22 22 26;M23 17 Q25 22 23 26;M23 17 Q24 22 22 26" dur="3.1s" repeatCount="indefinite" />
            </path>
          </svg>
        </button>

        <div className="flex-1 min-w-0 relative">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setShowSuggestionOverlay(false); }}
            onKeyDown={handleKeyDown}
            onFocus={() => { setIsFocused(true); setShowSuggestionOverlay(false); }}
            onBlur={() => { setIsFocused(false); if (!question) setShowSuggestionOverlay(true); }}
            placeholder={isFocused ? 'Ask anything about the repo library...' : ''}
            maxLength={500}
            disabled={atMinuteLimit || atDayLimit}
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/60 py-1.5 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50 transition-colors"
          />
          {/* Cycling suggestion overlay — click to select, focus to dismiss */}
          {showSuggestionOverlay && !question && !isFocused && !loading && !hasAnswer && (
            <button
              type="button"
              onClick={() => {
                setQuestion(currentPlaceholder);
                setShowSuggestionOverlay(false);
                inputRef.current?.focus();
              }}
              className="absolute inset-0 flex items-center px-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer truncate text-left"
            >
              {currentPlaceholder}
            </button>
          )}
        </div>

        {/* Ask / Stop button */}
        <button
          type="button"
          onClick={loading ? () => abortRef.current?.abort() : handleAsk}
          disabled={(!loading && (atMinuteLimit || atDayLimit))}
          className="shrink-0 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              Stop
            </span>
          ) : 'Ask'}
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-zinc-700 shrink-0" />

        {/* Minimize (collapse) button — only when expanded/fullscreen */}
        {barState !== 'collapsed' && (
          <button
            type="button"
            onClick={() => setBarState(barState === 'fullscreen' ? 'expanded' : 'collapsed')}
            aria-label={barState === 'fullscreen' ? 'Exit fullscreen' : 'Minimize'}
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            {/* Chevron down */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </button>
        )}

        {/* Fullscreen button — only when expanded */}
        {barState === 'expanded' && (
          <button
            type="button"
            onClick={() => setBarState('fullscreen')}
            aria-label="Fullscreen"
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            {/* Expand icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 3 3 3 3 5" /><polyline points="11 3 13 3 13 5" />
              <polyline points="5 13 3 13 3 11" /><polyline points="11 13 13 13 13 11" />
            </svg>
          </button>
        )}

        {/* Clear / close button — when there is content */}
        {(hasAnswer || error || question) && (
          <button
            type="button"
            onClick={handleNewConversation}
            aria-label="Clear"
            className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            {/* X icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Answer / content area — visible when expanded or fullscreen */}
      <AnimatePresence>
        {barState !== 'collapsed' && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3"
            ref={answerRef}
          >
            {/* Session continuity indicator */}
            {sessionId && turnCount > 0 && (
              <div className="flex items-center justify-between gap-3 pt-1">
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

            {/* Loading status */}
            {loading && sources.length === 0 && (
              <p className="text-xs text-zinc-500 pt-1">Searching repos and finding the best matches…</p>
            )}
            {loading && sources.length > 0 && !hasAnswer && (
              <p className="text-xs text-zinc-500 pt-1">Generating answer from {sources.length} repos…</p>
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

            {/* Source repos */}
            {sources.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
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
                          <span className="shrink-0 text-xs text-zinc-600">{score}% match</span>
                        </div>
                        {repo.description && (
                          <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{repo.description}</p>
                        )}
                        {repo.stars != null && (
                          <p className="mt-1 text-xs text-zinc-600">★ {repo.stars.toLocaleString()}</p>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Streaming answer */}
            {hasAnswer && (
              <div className="space-y-2">
                <div className="rounded-lg bg-zinc-800/60 px-4 py-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {streamingAnswer}
                  {loading && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 bg-zinc-400 align-middle animate-pulse" />
                  )}
                </div>
                {done && tokensUsed && (
                  <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                    {(cacheHit || routeLabel) && (
                      <span className="text-emerald-500/80">⚡ Instant</span>
                    )}
                    {sources.length > 0 ? `${sources.length} repos searched` : ''}
                    {sources.length > 0 && tokensUsed.total > 0 ? ' · ' : ''}
                    {tokensUsed.total > 0 ? `${tokensUsed.total} tokens` : ''}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
