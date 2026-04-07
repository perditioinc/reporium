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

  // 100 AI-native asks that showcase Reporium's reasoning — not dashboard lookups
  const FALLBACK_SUGGESTIONS = (() => {
    const asks = [
      // Architecture & design decisions
      "I'm building a RAG pipeline that needs to handle 10k PDFs — what's the best stack?",
      "My team is debating LangChain vs building from scratch. What are the real tradeoffs?",
      "We need to add AI search to a Django app with 2M records. What should we use?",
      "I want to replace our Elasticsearch with a vector DB. What will break?",
      "Should I use a framework or raw API calls for a simple chatbot?",
      "I'm choosing between self-hosting and API-based LLMs for a healthcare app. Advise me.",
      "What's the simplest way to add semantic search to a Postgres database?",
      "We're migrating from OpenAI to open-source models. What's the realistic upgrade path?",
      "I need to build an AI agent that can browse the web and fill out forms. Where do I start?",
      "Our RAG answers are mediocre — what repos would help with reranking and chunking?",
      // Workflow & integration scenarios
      "I want an LLM to read my Slack threads and draft responses. What tools exist for this?",
      "How would I build an AI code reviewer that runs in GitHub Actions?",
      "What's the best way to let an LLM call my internal REST APIs safely?",
      "I need to extract structured data from thousands of invoices. What repos handle this?",
      "How do I build an AI assistant that remembers context across sessions?",
      "What tools let me build a chatbot that can query my SQL database directly?",
      "I want to build a Notion-like AI writing assistant. What repos provide the building blocks?",
      "How would I set up an agent that monitors my logs and creates Jira tickets?",
      "What's the best approach for building a multi-tenant AI app with per-customer data isolation?",
      "I need to process 100k support tickets and auto-categorize them. What pipeline should I use?",
      // Comparison & tradeoff analysis
      "When does LlamaIndex actually outperform LangChain for production use?",
      "What are the hidden costs of running Ollama vs vLLM in production?",
      "CrewAI vs AutoGen vs LangGraph — which one will still exist in a year?",
      "Is Qdrant worth the migration from Pinecone? What do I gain and lose?",
      "Llama 3 vs Mistral vs Gemma — which open model is best for coding tasks?",
      "What's the real difference between LangSmith and Langfuse for tracing?",
      "Should I use Guardrails AI or NeMo Guardrails? They seem to do the same thing.",
      "Chroma is easy but is it production-ready? What should I graduate to?",
      "Text-generation-inference vs vLLM — which handles more concurrent users?",
      "When should I use a graph database vs a vector database for knowledge retrieval?",
      // Problem-first discovery
      "My LLM keeps hallucinating citations. What repos specifically address this?",
      "Users are prompt-injecting our customer support bot. What's the state of the art defense?",
      "Our embedding search returns garbage for short queries. How do I fix this?",
      "I need to make my LLM app HIPAA compliant. What repos help with PII handling?",
      "My fine-tuned model is worse than the base model. What evaluation tools can diagnose this?",
      "Our AI responses are too slow — 8 seconds average. What inference optimizations exist?",
      "I'm getting rate-limited by OpenAI. What caching and fallback tools should I use?",
      "My RAG pipeline works in English but fails for Japanese. What multilingual tools exist?",
      "How do I prevent my AI agent from running up a $500 API bill overnight?",
      "My chatbot gives different answers to the same question. How do I make it deterministic?",
      // Stack recommendations
      "What's the 2025 starter stack for a solo dev building an AI SaaS?",
      "I have a Mac M2 with 16GB RAM. What models and tools can I actually run locally?",
      "Recommend a minimal stack for adding AI to an existing Next.js app",
      "What's the lightest-weight way to add function calling to an open-source model?",
      "I need a fully offline AI stack for a government project. What's possible?",
      "What repos would I need to build a Perplexity-style search engine?",
      "Recommend tools for building an AI tutor that adapts to student level",
      "What's the best stack for a real-time AI voice assistant?",
      "I want to build a local Copilot alternative. What do I need?",
      "What tools should I combine to build an AI data analyst that writes SQL?",
      // Deep technical questions
      "How do repos like vLLM achieve continuous batching and why does it matter?",
      "What's the actual difference between GPTQ, AWQ, and GGUF quantization in practice?",
      "Why do some RAG systems use HyDE and when should I bother with it?",
      "How does speculative decoding work and which repos implement it well?",
      "What's the state of mixture-of-experts inference optimization?",
      "How do agent memory systems actually persist context — what approaches work?",
      "What's the real performance impact of adding guardrails to an LLM pipeline?",
      "How do the different embedding models compare on retrieval quality, not just benchmarks?",
      "What repos implement effective semantic caching for LLM responses?",
      "How do tool-use frameworks handle error recovery when an API call fails mid-chain?",
      // Unconventional & creative
      "What repos would I need to build an AI dungeon master for tabletop RPGs?",
      "Can I use open-source models to generate music or audio? What's production-ready?",
      "What tools exist for AI-powered 3D asset generation?",
      "How would I build an AI that reads my codebase and generates architecture diagrams?",
      "What repos let me build a personal AI that learns from my browsing history?",
      "Is there anything that can turn a whiteboard photo into working code?",
      "What tools exist for building AI-powered game NPCs with persistent memory?",
      "Can I build a local AI that summarizes my daily meetings? What repos would I need?",
      "What repos handle AI-generated video — is any of it usable in production?",
      "How would I build an AI that reviews pull requests and suggests architectural improvements?",
      // Production & ops wisdom
      "What's the cheapest way to serve an open model to 1000 concurrent users?",
      "How do I set up model A/B testing without disrupting users?",
      "What monitoring should I add to an LLM app before going to production?",
      "How do companies handle LLM versioning when the model provider updates?",
      "What's the best pattern for graceful degradation when an LLM API goes down?",
      "How do I load test an LLM application? Traditional tools don't handle streaming.",
      "What repos help me track and optimize my LLM spend across providers?",
      "How should I structure prompts so they're maintainable as a team?",
      "What's the right way to handle LLM output validation in a typed backend?",
      "How do I build a playground where my team can experiment with prompts before deploying?",
      // Niche & underserved
      "What repos handle AI for time-series forecasting that aren't just stats libraries?",
      "Are there good open-source tools for AI-powered accessibility testing?",
      "What tools exist for using LLMs to analyze and refactor legacy COBOL code?",
      "What repos help with AI-powered test generation for mobile apps?",
      "How would I build an AI that reads scientific papers and extracts methodology?",
      "What tools exist for LLM-powered API fuzzing and security testing?",
      "Are there repos that use AI for database query optimization?",
      "What open-source tools exist for AI-powered localization and translation workflows?",
      "What repos handle AI-assisted data migration between different schemas?",
      "How do I build an AI that can understand and query GraphQL schemas dynamically?",
    ];
    // Fisher-Yates shuffle for true random order each mount
    for (let i = asks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [asks[i], asks[j]] = [asks[j], asks[i]];
    }
    return asks;
  })();
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
