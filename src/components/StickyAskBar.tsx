'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, memo } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { API_URL } from '@/lib/apiUrl';

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
// Phase state machine
// idle → expanding → searching → sources → streaming → done | error
// ---------------------------------------------------------------------------
type BarState = 'collapsed' | 'expanded' | 'fullscreen';
type Phase =
  | 'idle'
  | 'expanding'    // bar opened, fetch not yet started
  | 'searching'    // fetch in flight, no sources yet, < 2s elapsed
  | 'reasoning'    // 2s elapsed, still no first token
  | 'warming'      // 5s elapsed, Cloud Run cold-start hint
  | 'sources'      // sources received, reading them before first token
  | 'streaming'    // first token arrived
  | 'done'
  | 'error';

// Thinking copy driven by phase
const PHASE_COPY: Record<Phase, string> = {
  idle: '',
  expanding: 'Preparing…',
  searching: 'Searching the library…',
  reasoning: 'Reasoning across repos…',
  warming: 'Cloud Run warming up — first ask takes a moment',
  sources: 'Generating answer…',
  streaming: 'Streaming answer…',
  done: '',
  error: '',
};

const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '';

// ---------------------------------------------------------------------------
// Shimmer / skeleton primitives (no external deps)
// ---------------------------------------------------------------------------
const ShimmerLine = memo(function ShimmerLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return (
    <div
      className={`${w} ${h} rounded bg-zinc-800 overflow-hidden relative`}
      aria-hidden="true"
    >
      <div className="shimmer-sweep absolute inset-0" />
    </div>
  );
});

const SourceCardSkeleton = memo(function SourceCardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 space-y-2" aria-hidden="true">
      <div className="flex justify-between gap-2">
        <ShimmerLine w="w-2/3" h="h-3" />
        <ShimmerLine w="w-12" h="h-3" />
      </div>
      <ShimmerLine w="w-full" h="h-2.5" />
      <ShimmerLine w="w-4/5" h="h-2.5" />
    </div>
  );
});

const AnswerSkeleton = memo(function AnswerSkeleton() {
  return (
    <div className="rounded-lg bg-zinc-800/60 px-4 py-3 space-y-2.5" aria-hidden="true">
      <ShimmerLine w="w-full" h="h-3" />
      <ShimmerLine w="w-5/6" h="h-3" />
      <ShimmerLine w="w-4/5" h="h-3" />
      <ShimmerLine w="w-2/3" h="h-3" />
    </div>
  );
});

// ---------------------------------------------------------------------------
// JellyfishIcon — bar mascot + thinking state
//
// Color story:
//   idle    : static violet bell (#7c3aed / fill-violet-500/80) — calm, present
//   thinking: violet-to-cyan gradient pulse on bell + glow halo
//             round academic glasses (cyan frame rgba(165,243,252,0.9))
//             floating open book (violet rgba(216,180,254,0.85), cyan page lines)
//             book hover animation + page-flip on a central tentacle
// ---------------------------------------------------------------------------
const JellyfishIcon = memo(function JellyfishIcon({
  size = 28,
  thinking = false,
  className = '',
}: {
  size?: number;
  thinking?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Thinking-phase outer glow halo — violet-to-cyan ring */}
      {thinking && (
        <ellipse
          cx="16" cy="11" rx="12.5" ry="11.5"
          fill="none"
          stroke="url(#jelly-think-grad)"
          strokeWidth="1.5"
          opacity="0.5"
          className="jelly-think-halo"
        />
      )}

      <defs>
        {/* Violet-to-cyan gradient for thinking bell */}
        <linearGradient id="jelly-think-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(139,92,246,1)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0.85)" />
        </linearGradient>
        {/* Book gradient — violet spine, lighter pages */}
        <linearGradient id="jelly-book-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(167,139,250,0.9)" />
          <stop offset="45%" stopColor="rgba(216,180,254,0.85)" />
          <stop offset="100%" stopColor="rgba(196,181,253,0.8)" />
        </linearGradient>
      </defs>

      {/* Bell / head — thinking uses gradient fill, idle uses violet */}
      <ellipse
        cx="16" cy="11" rx="9" ry="8"
        fill={thinking ? 'url(#jelly-think-grad)' : 'rgba(124,58,237,0.8)'}
        className="transition-colors"
      >
        {thinking ? (
          <animate attributeName="ry" values="8;9.5;8" dur="1.2s" repeatCount="indefinite" />
        ) : (
          <animate attributeName="ry" values="8;8.6;8" dur="2.5s" repeatCount="indefinite" />
        )}
      </ellipse>

      {/* Inner glow */}
      <ellipse cx="16" cy="10" rx="5" ry="4.5" fill={thinking ? 'rgba(165,243,252,0.2)' : 'rgba(167,139,250,0.25)'}>
        {thinking ? (
          <animate attributeName="ry" values="4.5;6;4.5" dur="1.2s" repeatCount="indefinite" />
        ) : (
          <animate attributeName="ry" values="4.5;5;4.5" dur="2.5s" repeatCount="indefinite" />
        )}
      </ellipse>

      {/* Eyes — squinting/reading when thinking, open when idle */}
      {thinking ? (
        <>
          {/* Squinting reading eyes */}
          <path d="M11.5 10 Q13 9 14.5 10" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.9" />
          <path d="M17.5 10 Q19 9 20.5 10" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.9" />
          {/* Round academic glasses — cyan frame, bridge + arms */}
          {/* Left lens */}
          <circle cx="13" cy="10.2" r="2.1" fill="none" stroke="rgba(165,243,252,0.9)" strokeWidth="0.9" />
          {/* Right lens */}
          <circle cx="19" cy="10.2" r="2.1" fill="none" stroke="rgba(165,243,252,0.9)" strokeWidth="0.9" />
          {/* Bridge between lenses */}
          <path d="M15.1 10.2 L16.9 10.2" stroke="rgba(165,243,252,0.9)" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          {/* Left arm */}
          <path d="M10.9 10.2 L9.5 9.8" stroke="rgba(165,243,252,0.9)" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          {/* Right arm */}
          <path d="M21.1 10.2 L22.5 9.8" stroke="rgba(165,243,252,0.9)" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="13" cy="10" r="1.2" fill="rgba(255,255,255,0.9)" />
          <circle cx="19" cy="10" r="1.2" fill="rgba(255,255,255,0.9)" />
          <circle cx="13.3" cy="10.2" r="0.5" fill="rgb(24,24,27)" />
          <circle cx="19.3" cy="10.2" r="0.5" fill="rgb(24,24,27)" />
        </>
      )}

      {/* Tentacles */}
      <path d="M9 17 Q8 22 10 26" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate
          attributeName="d"
          values={thinking ? "M9 17 Q7 21 9 26;M9 17 Q11 21 8 26;M9 17 Q7 21 9 26" : "M9 17 Q8 22 10 26;M9 17 Q7 22 9 26;M9 17 Q8 22 10 26"}
          dur={thinking ? "0.9s" : "3s"}
          repeatCount="indefinite"
        />
      </path>
      <path d="M12 18 Q11 23 12 27" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6">
        <animate
          attributeName="d"
          values={thinking ? "M12 18 Q13 22 11 27;M12 18 Q10 22 13 27;M12 18 Q13 22 11 27" : "M12 18 Q11 23 12 27;M12 18 Q12.5 23 11 27;M12 18 Q11 23 12 27"}
          dur={thinking ? "1.0s" : "2.8s"}
          repeatCount="indefinite"
        />
      </path>
      {/* Center tentacle — holds the book when thinking */}
      <path d="M16 18 Q16 24 16 28" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate
          attributeName="d"
          values={thinking ? "M16 18 Q14 23 17 28;M16 18 Q18 23 15 28;M16 18 Q14 23 17 28" : "M16 18 Q16 24 16 28;M16 18 Q15 24 17 28;M16 18 Q16 24 16 28"}
          dur={thinking ? "1.1s" : "3.2s"}
          repeatCount="indefinite"
        />
      </path>
      <path d="M20 18 Q21 23 20 27" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6">
        <animate
          attributeName="d"
          values={thinking ? "M20 18 Q18 22 21 27;M20 18 Q22 22 19 27;M20 18 Q18 22 21 27" : "M20 18 Q21 23 20 27;M20 18 Q19.5 23 21 27;M20 18 Q21 23 20 27"}
          dur={thinking ? "0.85s" : "2.6s"}
          repeatCount="indefinite"
        />
      </path>
      <path d="M23 17 Q24 22 22 26" stroke="rgb(167,139,250)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate
          attributeName="d"
          values={thinking ? "M23 17 Q25 21 22 26;M23 17 Q21 21 24 26;M23 17 Q25 21 22 26" : "M23 17 Q24 22 22 26;M23 17 Q25 22 23 26;M23 17 Q24 22 22 26"}
          dur={thinking ? "0.95s" : "3.1s"}
          repeatCount="indefinite"
        />
      </path>

      {/* Floating open book — only in thinking state, held near center tentacle */}
      {thinking && (
        <g>
          {/* Book hover animation — bobs gently like it's floating */}
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-1.5; 0,0"
            dur="1.6s"
            repeatCount="indefinite"
            additive="sum"
          />
          {/* Book body — two open pages, violet/purple tones */}
          {/* Left page */}
          <path
            d="M10 22.5 Q13 21.5 16 22 L16 27.5 Q13 27 10 28 Z"
            fill="url(#jelly-book-grad)"
            stroke="rgba(139,92,246,0.6)"
            strokeWidth="0.5"
            opacity="0.92"
          />
          {/* Right page */}
          <path
            d="M16 22 Q19 21.5 22 22.5 L22 28 Q19 27 16 27.5 Z"
            fill="rgba(216,180,254,0.8)"
            stroke="rgba(139,92,246,0.6)"
            strokeWidth="0.5"
            opacity="0.92"
          />
          {/* Spine crease */}
          <line x1="16" y1="22" x2="16" y2="27.5" stroke="rgba(109,40,217,0.7)" strokeWidth="0.8" />
          {/* Cyan page lines on left page */}
          <line x1="11.5" y1="24" x2="14.5" y2="23.6" stroke="rgba(34,211,238,0.6)" strokeWidth="0.55" strokeLinecap="round" />
          <line x1="11.5" y1="25.2" x2="14.5" y2="24.8" stroke="rgba(34,211,238,0.5)" strokeWidth="0.55" strokeLinecap="round" />
          <line x1="11.5" y1="26.4" x2="14.5" y2="26" stroke="rgba(34,211,238,0.4)" strokeWidth="0.55" strokeLinecap="round" />
          {/* Cyan page lines on right page */}
          <line x1="17.5" y1="23.6" x2="20.5" y2="24" stroke="rgba(34,211,238,0.6)" strokeWidth="0.55" strokeLinecap="round" />
          <line x1="17.5" y1="24.8" x2="20.5" y2="25.2" stroke="rgba(34,211,238,0.5)" strokeWidth="0.55" strokeLinecap="round" />
          <line x1="17.5" y1="26" x2="20.5" y2="26.4" stroke="rgba(34,211,238,0.4)" strokeWidth="0.55" strokeLinecap="round" />
          {/* Page-flip hint — a curling right-page corner */}
          <path
            d="M20 21.8 Q21.5 21 22 22.5"
            fill="rgba(240,171,252,0.5)"
            stroke="rgba(167,139,250,0.7)"
            strokeWidth="0.6"
            strokeLinecap="round"
          >
            <animate attributeName="d"
              values="M20 21.8 Q21.5 21 22 22.5;M20 21.5 Q22 20.5 22 22.5;M20 21.8 Q21.5 21 22 22.5"
              dur="2.2s" repeatCount="indefinite"
            />
          </path>
        </g>
      )}
    </svg>
  );
});

// ---------------------------------------------------------------------------
// Global shimmer CSS — injected into <head> as early as possible via a
// plain <link rel="stylesheet"> trick: we use a <style> tag inserted in
// the <head> at module-evaluation time (SSR-safe guard included).
// This avoids the 1-frame delay of a useEffect injection.
// ---------------------------------------------------------------------------
const SHIMMER_CSS = `
  .shimmer-sweep {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer-move 1.6s ease-in-out infinite;
  }
  @keyframes shimmer-move {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .ask-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: radial-gradient(circle at 35% 30%, rgba(216,180,254,0.95), rgba(139,92,246,0.75) 60%, transparent 85%);
    box-shadow: 0 0 8px rgba(167,139,250,0.7);
    animation: ask-dot-pulse 1.0s ease-in-out infinite;
  }
  .ask-dot:nth-child(2) { animation-delay: 0.12s; }
  .ask-dot:nth-child(3) { animation-delay: 0.24s; }
  @keyframes ask-dot-pulse {
    0%, 100% { transform: translateY(0) scale(1);   opacity: 0.6; }
    50%       { transform: translateY(-3px) scale(1.25); opacity: 1; }
  }
  /* thinking phase: violet-to-cyan gradient glow pulse — distinct from idle (static violet) */
  .jelly-think-pulse {
    animation: jelly-think 1.0s ease-in-out infinite;
  }
  @keyframes jelly-think {
    0%, 100% {
      filter: drop-shadow(0 0 5px rgba(167,139,250,0.5)) drop-shadow(0 0 12px rgba(34,211,238,0.15));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 14px rgba(139,92,246,0.9)) drop-shadow(0 0 22px rgba(34,211,238,0.55));
      transform: scale(1.09);
    }
  }
  /* Thinking phase halo ring — appears only when thinking=true via class */
  .jelly-think-halo {
    animation: jelly-halo-pulse 1.0s ease-in-out infinite;
  }
  @keyframes jelly-halo-pulse {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50%       { opacity: 0.7; transform: scale(1.18); }
  }
  @media (prefers-reduced-motion: reduce) {
    .shimmer-sweep, .ask-dot, .jelly-think-pulse, .jelly-think-halo { animation: none !important; }
  }
`;

// Fast out-expo spring for expand (snappy ~100ms perceived) — beats a tween
// because the spring has initial velocity that avoids the "easing-in" stutter.
// Stiffness 480 / damping 36 lands in ≈100ms with no overshoot.
const HEIGHT_EXPAND_TRANSITION = { type: 'spring' as const, stiffness: 480, damping: 36 };
const HEIGHT_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

// Stable animation props for source cards — hoisted to avoid re-creation per render
const SOURCE_CARD_INITIAL = { opacity: 0, y: 6 };
const SOURCE_CARD_ANIMATE = { opacity: 1, y: 0 };

export function StickyAskBar() {
  const [barState, setBarState] = useState<BarState>('collapsed');
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  // Streaming state
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [sources, setSources] = useState<SourceRepo[]>([]);
  const [revealedSourceCount, setRevealedSourceCount] = useState(0);
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
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track when the last loading phase started (for slow-path timers)
  const loadStartRef = useRef<number>(0);
  // rAF handle for throttled autoscroll — prevents per-token layout thrash
  const scrollRafRef = useRef<number | null>(null);

  // Nav-safety: abort in-flight stream on soft navigation (App Router never fires pagehide)
  const pathname = usePathname();
  const initialPathnameRef = useRef<string>(pathname);
  useEffect(() => {
    // Skip the initial mount — only react to actual route changes
    if (pathname === initialPathnameRef.current) return;
    abortRef.current?.abort();
    setPhase('idle');
    setLoading(false);
    setStreamingAnswer('');
    setSources([]);
  }, [pathname]);

  // Inject shimmer CSS synchronously before paint via useLayoutEffect.
  // This ensures the .ask-dot and .jelly-think-pulse animations are available
  // on the very first frame the loading state renders — not a frame late.
  useLayoutEffect(() => {
    if (document.getElementById('ask-bar-styles')) return;
    const style = document.createElement('style');
    style.id = 'ask-bar-styles';
    style.textContent = SHIMMER_CSS;
    document.head.appendChild(style);
  }, []);

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

  // Auto-scroll answer area as tokens arrive — rAF-throttled to avoid per-token layout thrash
  useEffect(() => {
    if (!answerRef.current) return;
    if (scrollRafRef.current) return; // frame already queued
    scrollRafRef.current = requestAnimationFrame(() => {
      if (answerRef.current) {
        answerRef.current.scrollTop = answerRef.current.scrollHeight;
      }
      scrollRafRef.current = null;
    });
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [streamingAnswer]);

  // Accessibility: mark aria-busy on the live region.
  // We intentionally skip programmatic focus() here — triggering focus on
  // first paint causes a layout reflow that adds perceived latency.
  // Screen readers will pick up the aria-live="polite" region automatically.

  // Clear phase timers on unmount + abort any in-flight stream
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (sourceRevealTimerRef.current) clearTimeout(sourceRevealTimerRef.current);
    };
  }, []);

  // Progressive source reveal — stagger cards in as they arrive
  useEffect(() => {
    if (sources.length === 0) {
      setRevealedSourceCount(0);
      return;
    }
    // Reveal cards one by one with 80ms stagger
    let i = revealedSourceCount;
    function revealNext() {
      if (i < sources.length) {
        i++;
        setRevealedSourceCount(i);
        sourceRevealTimerRef.current = setTimeout(revealNext, 80);
      }
    }
    if (revealedSourceCount < sources.length) {
      sourceRevealTimerRef.current = setTimeout(revealNext, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length]);

  const handleNewConversation = useCallback(() => {
    abortRef.current?.abort();
    clearSessionId();
    setSessionId(null);
    setTurnCount(0);
    setStreamingAnswer('');
    setSources([]);
    setRevealedSourceCount(0);
    setTokensUsed(null);
    setDone(false);
    setError(null);
    setCacheHit(false);
    setRouteLabel(null);
    setQuestion('');
    setPhase('idle');
    setBarState('collapsed');
    setLoading(false);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    inputRef.current?.focus();
  }, []);

  const { minuteCount, dayCount } = getRateLimitState();
  const atMinuteLimit = minuteCount >= RATE_PER_MIN;
  const atDayLimit = dayCount >= RATE_PER_DAY;
  const nearMinuteLimit = minuteCount >= RATE_PER_MIN - 2;
  const nearDayLimit = dayCount >= RATE_PER_DAY - 5;
  const remainingMin = Math.max(0, RATE_PER_MIN - minuteCount);
  const remainingDay = Math.max(0, RATE_PER_DAY - dayCount);

  // Schedule slow-path phase timers (called once per ask)
  function scheduleSlowPathTimers() {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    loadStartRef.current = Date.now();

    // At 2s: bump to 'reasoning' (if still in searching/expanding)
    phaseTimerRef.current = setTimeout(() => {
      setPhase((p) => (p === 'searching' || p === 'expanding') ? 'reasoning' : p);

      // At 5s: bump to 'warming' (Cloud Run cold start hint)
      phaseTimerRef.current = setTimeout(() => {
        setPhase((p) => (p === 'reasoning' || p === 'searching') ? 'warming' : p);
      }, 3000);
    }, 2000);
  }

  async function handleAsk(override?: string) {
    const q = (override ?? question).trim();
    if (override !== undefined) setQuestion(override);
    if (!q || q.length < 3) { setError('Please enter at least 3 characters.'); return; }
    if (q.length > 500) { setError('Question must be 500 characters or fewer.'); return; }
    if (INJECTION_RE.test(q)) { setError('That question contains disallowed content. Please rephrase.'); return; }
    if (atMinuteLimit) { setError('Rate limit: 10 questions per minute. Please wait a moment.'); return; }
    if (atDayLimit) { setError('Daily limit of 100 questions reached. Try again tomorrow.'); return; }

    // ── INSTANT first paint ──────────────────────────────────────────────────
    // Set ALL visual state synchronously before any await so React batches it
    // into a single paint. The user sees the skeleton panel in < 1 frame.
    setLoading(true);
    setError(null);
    setStreamingAnswer('');
    setSources([]);
    setRevealedSourceCount(0);
    setTokensUsed(null);
    setDone(false);
    setCacheHit(false);
    setRouteLabel(null);
    setPhase('expanding');
    setBarState('expanded');
    recordRequest();

    // Schedule slow-path copy timers
    scheduleSlowPathTimers();

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const sid = sessionId ?? getOrCreateSessionId();
      if (!sessionId) setSessionId(sid);

      // Advance phase right as fetch begins (still synchronous before await)
      setPhase('searching');

      const res = await fetch(`${API_URL}/intelligence/ask/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(APP_TOKEN && { 'X-App-Token': APP_TOKEN }),
        },
        body: JSON.stringify({ question: q, top_k: 8, session_id: sid }),
        signal: controller.signal,
      });

      if (res.status === 429) { setError('Rate limit exceeded. Please wait before asking again.'); setPhase('error'); return; }
      if (res.status === 401 || res.status === 403) {
        setError(
          APP_TOKEN
            ? 'Ask is temporarily unavailable — the API rejected the app token.'
            : 'Ask is not configured in this environment (missing NEXT_PUBLIC_APP_API_TOKEN). Contact the site owner.',
        );
        setPhase('error');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail ?? `Server error (${res.status}). Please try again.`);
        setPhase('error');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setError('Streaming not supported by this browser. Please try again.'); setPhase('error'); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let streamEnded = false;

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        // Stop processing if aborted between chunk reads
        if (controller.signal.aborted) break;
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
            setPhase('sources');
            if ('cache_hit' in event && event.cache_hit) setCacheHit(true);
            if ('route' in event) setRouteLabel((event as Record<string, unknown>).route as string);
          } else if (event.type === 'token') {
            setStreamingAnswer((prev) => prev + event.text);
            setPhase((p) => (p !== 'streaming' && p !== 'done') ? 'streaming' : p);
          } else if (event.type === 'done') {
            setTokensUsed(event.tokens);
            setDone(true);
            setPhase('done');
            setTurnCount((n) => n + 1);
            if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
          } else if (event.type === 'error') {
            setError(event.message);
            setPhase('error');
            streamEnded = true;
            break;
          }
        }
        if (streamEnded) break;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Aborted — keep whatever partial content is visible, just stop loading
        setPhase((p) => p === 'streaming' ? 'done' : 'idle');
        return;
      }
      setError('Network error. Please check your connection and try again.');
      setPhase('error');
    } finally {
      setLoading(false);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleAsk();
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

  // Listen for external ask requests (e.g. from the GuidedTour finish step).
  useEffect(() => {
    const onExternalAsk = (e: Event) => {
      const detail = (e as CustomEvent<{ question?: string }>).detail;
      const q = (detail?.question ?? '').trim();
      if (!q) return;
      setBarState('expanded');
      void handleAsk(q);
    };
    window.addEventListener('reporium:ask', onExternalAsk);
    return () => window.removeEventListener('reporium:ask', onExternalAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abort any in-flight streaming fetch on true unload only.
  useEffect(() => {
    const abortInFlight = () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
    window.addEventListener('pagehide', abortInFlight);
    return () => window.removeEventListener('pagehide', abortInFlight);
  }, []);

  const hasAnswer = streamingAnswer.length > 0;
  const isLoading = loading;
  const isThinking = isLoading && !hasAnswer;

  // Delay skeleton render by 150ms so it doesn't compete with the bar height
  // animation on first paint. The in-bar micro-feedback (dots + copy) is
  // instant; the heavier skeleton fades in after the spring settles.
  const [skeletonReady, setSkeletonReady] = useState(false);
  useEffect(() => {
    if (!isThinking) {
      setSkeletonReady(false);
      return;
    }
    const t = setTimeout(() => setSkeletonReady(true), 150);
    return () => clearTimeout(t);
  }, [isThinking]);

  const showSkeleton = isThinking && skeletonReady;

  // 100 AI-native asks
  const FALLBACK_SUGGESTIONS_BASE = useMemo(() => [
    "Which repos in my library pair well together for a production RAG pipeline?",
    "Find me repos that solve the same problem but take completely different approaches",
    "What gaps exist in my AI toolkit — what categories am I missing coverage in?",
    "Which of my forked repos have diverged most from upstream and might need syncing?",
    "Show me repos where the community loves the concept but flags maintenance concerns",
    "Which repos in my library are most likely to become obsolete in the next year?",
    "Find repos that overlap — am I tracking redundant tools for the same job?",
    "What's the strongest open-source alternative to each commercial AI tool I track?",
    "Which repos have the best quality signals but the least stars — hidden gems?",
    "Map my library by maturity — what's production-ready vs experimental?",
    "I'm building an internal doc search for 50k PDFs — which repos should I combine?",
    "Design me a stack for AI-powered customer support using only repos I already track",
    "I need to add guardrails to an existing LLM app — what's the fastest path from my library?",
    "Build me an evaluation pipeline using repos I have — how do they connect?",
    "Which repos would I wire together for a code review agent in CI/CD?",
    "What combination of my repos gives me the most complete MLOps platform?",
    "I need structured output from LLMs with validation — which repos handle each piece?",
    "Design a multi-agent system using only tools from my library",
    "What's the minimum set of repos I need for a full LLM observability stack?",
    "I'm adding AI features to a Django app — which repos integrate cleanest?",
    "Compare the agent frameworks I track — which ones have real production traction?",
    "Between the vector databases in my library, which trades off speed for accuracy best?",
    "Which embedding repos balance quality vs inference speed for production use?",
    "Rank my RAG-related repos by community health — which ones will still be maintained?",
    "What are the real cons of the highest-starred repos I track?",
    "Compare the inference servers I follow — what does each sacrifice for performance?",
    "Which LLM frameworks in my library have the steepest vs flattest learning curves?",
    "Between my tracing/observability repos — what does each one miss?",
    "Which of my repos promise production-readiness but have quality signals that disagree?",
    "Compare deployment approaches across my inference repos — serverless vs dedicated vs hybrid",
    "Which repos have strong test coverage AND active maintenance — the truly reliable ones?",
    "Find repos where commit velocity is accelerating — what's gaining momentum?",
    "Which repos have slowed down recently — should I watch for alternatives?",
    "What repos are maintained by known AI companies vs independent developers?",
    "Which repos share the most dependencies — what's the common foundation?",
    "Find me repos with great README summaries but weak quality signals — all hype?",
    "Which repos in my library support the most programming languages?",
    "Show me repos where the builder has multiple projects in my library — prolific creators",
    "What's the average age of repos by category — where is innovation freshest?",
    "Which categories have the most competition — where should I be selective?",
    "My RAG retrieval quality drops on short queries — which repos address sparse retrieval?",
    "I need to prevent prompt injection in production — which repos have battle-tested defenses?",
    "My LLM responses are inconsistent — which repos add determinism and output validation?",
    "How do I handle LLM provider outages gracefully — what fallback patterns do my repos support?",
    "I need to reduce my LLM API costs by 80% — which repos offer caching, batching, or local inference?",
    "My embeddings don't capture domain-specific meaning — which repos help with fine-tuning?",
    "Users are getting stale answers — which repos handle real-time knowledge updates?",
    "My agent loops infinitely on complex tasks — which repos add planning and self-correction?",
    "I need to audit every LLM call for compliance — which repos provide full trace lineage?",
    "My multimodal pipeline breaks on PDFs with tables — which repos handle complex document parsing?",
    "Should I add a vector database or extend Postgres with pgvector based on my current stack?",
    "When should I move from API-based LLMs to self-hosted given my library's inference tools?",
    "Framework vs raw API calls — based on the frameworks I track, when is the overhead worth it?",
    "Monolith agent vs microservice agents — which pattern do my tracked repos support better?",
    "Graph RAG vs vector RAG — which repos support each approach and when does each win?",
    "Prompt engineering vs fine-tuning — based on my tools, which path has better tooling support?",
    "Synchronous vs streaming LLM responses — which of my repos handle streaming well?",
    "Centralized vs federated evaluation — how do my eval repos compare in architecture?",
    "Build vs buy for embeddings — do my local model repos match commercial embedding quality?",
    "Monorepo vs multi-repo for AI microservices — what patterns do my tracked tools assume?",
    "What unexpected repo combinations could solve problems neither was designed for?",
    "Which repos could I use for AI applications outside of typical tech — healthcare, law, education?",
    "What's the most underrated repo in my library that deserves more attention?",
    "If I could only keep 10 repos from my entire library, which 10 cover the most ground?",
    "Which repos are doing something genuinely novel that nothing else in my library does?",
    "What emerging AI patterns do my newest repos signal — where is the field heading?",
    "Find repos that could replace a paid SaaS tool I might be using",
    "What would a complete AI-native development environment look like from my library alone?",
    "Which repos would benefit most from being combined into a single integrated platform?",
    "What's the most impactful repo I'm not tracking yet based on gaps in my library?",
    "Which repos have known scaling bottlenecks based on their architecture and community feedback?",
    "What's the safest upgrade path if I need to swap out a core dependency in my AI stack?",
    "Which repos require the most operational expertise to run — what's the true cost of adoption?",
    "Rank my deployment-related repos by how much infrastructure they assume",
    "Which repos have the best error handling and graceful degradation patterns?",
    "What monitoring blind spots exist if I combine these observability repos?",
    "Which repos are designed for single-tenant vs multi-tenant — does my stack match my needs?",
    "What's the cold start performance like across my inference repos — can any go serverless?",
    "Which repos handle secrets and API key management properly vs leaving it to the user?",
    "If my primary LLM provider raises prices 5x, which repos help me migrate fastest?",
    "Which repos handle non-English content well — what's my multilingual coverage?",
    "What repos in my library support on-device or edge inference?",
    "Find me repos specifically designed for regulated industries — HIPAA, SOC2, GDPR",
    "Which repos support time-series or temporal data in AI workflows?",
    "What repos help with AI-assisted code migration between languages or frameworks?",
    "Find repos that bridge the gap between data engineering and ML pipelines",
    "Which repos support real-time streaming inference vs batch processing?",
    "What testing and QA repos specifically target AI/ML applications?",
    "Which repos help build AI features for mobile or embedded devices?",
    "What repos handle knowledge graph construction from unstructured text?",
  ], []);

  // Shuffle AFTER mount — Math.random during render is SSR-unsafe.
  const [shuffledFallbacks, setShuffledFallbacks] = useState<string[]>(FALLBACK_SUGGESTIONS_BASE);
  useEffect(() => {
    const arr = [...FALLBACK_SUGGESTIONS_BASE];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffledFallbacks(arr);
  }, [FALLBACK_SUGGESTIONS_BASE]);

  const placeholderOptions = suggestions.length > 0 ? suggestions : shuffledFallbacks;
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestionOverlay, setShowSuggestionOverlay] = useState(false);

  // Delay showing the overlay until after hydration to avoid SSR mismatch
  useEffect(() => { setShowSuggestionOverlay(true); }, []);

  // Pause cycling while loading — (isLoading check added)
  useEffect(() => {
    if (isFocused || question || isLoading || hasAnswer) return;
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % placeholderOptions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isFocused, question, isLoading, hasAnswer, placeholderOptions.length]);

  const currentPlaceholder = placeholderOptions[placeholderIdx % placeholderOptions.length] ?? 'Ask anything about the repo library...';

  const heightValue =
    barState === 'collapsed' ? 56 :
    barState === 'fullscreen' ? '100vh' :
    '50vh';

  // Use a fast tween for expand, spring for all other transitions
  const heightTransition = barState === 'expanded' && phase === 'expanding'
    ? HEIGHT_EXPAND_TRANSITION
    : HEIGHT_SPRING;

  const thinkingCopy = PHASE_COPY[phase];

  // 2 skeleton cards — minimal paint work; enough visual scaffolding.
  // 4 was too heavy and competed with the height spring on first paint.
  const SKELETON_SOURCE_COUNT = 2;

  return (
    <motion.div
      data-tour="ask"
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-zinc-950/95 md:bg-zinc-950/80 md:backdrop-blur-md border-t border-zinc-800 overflow-hidden"
      initial={{ height: 56 }}
      animate={{ height: heightValue }}
      transition={heightTransition}
      role="region"
      aria-label="Ask the library"
    >
      {/* Input bar — always visible */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 h-14">
        {/* Jellyfish mascot — pulses visibly when thinking */}
        <button
          type="button"
          onClick={() => {
            if (!question && !isLoading) {
              setQuestion(currentPlaceholder);
              inputRef.current?.focus();
            }
          }}
          className={`shrink-0 group ${isThinking ? 'jelly-think-pulse' : 'transition-transform group-hover:scale-110'}`}
          aria-label={isThinking ? 'Thinking…' : 'Ask a suggestion'}
          aria-busy={isThinking}
        >
          <JellyfishIcon size={28} thinking={isThinking} />
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
            aria-label="Ask a question about the repo library"
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/60 py-1.5 px-3 text-base sm:text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50 transition-colors"
          />

          {/* Cycling suggestion overlay — paused during loading */}
          {showSuggestionOverlay && !question && !isFocused && !isLoading && !hasAnswer && (
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

          {/* Thinking indicator in input — visible immediately on submit */}
          {isThinking && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center gap-2 px-3 rounded-lg overflow-hidden"
              style={{
                background: 'linear-gradient(90deg, rgba(24,24,27,0.95) 0%, rgba(45,18,70,0.8) 50%, rgba(24,24,27,0.95) 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer-move 2.2s ease-in-out infinite',
              }}
            >
              <span className="inline-flex gap-1 items-center" aria-hidden="true">
                <span className="ask-dot" />
                <span className="ask-dot" />
                <span className="ask-dot" />
              </span>
              <span
                className="text-xs font-mono tracking-wide"
                style={{ color: 'rgba(216,180,254,0.95)', textShadow: '0 0 10px rgba(167,139,250,0.5)' }}
              >
                {thinkingCopy || 'Thinking…'}
              </span>
            </div>
          )}
        </div>

        {/* Ask / Stop button */}
        <button
          type="button"
          onClick={isLoading ? () => abortRef.current?.abort() : () => { void handleAsk(); }}
          disabled={(!isLoading && (atMinuteLimit || atDayLimit))}
          className="shrink-0 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          {isLoading ? (
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
            className="shrink-0 rounded-md p-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
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
            className="shrink-0 rounded-md p-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
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
            aria-label="Clear conversation"
            className="shrink-0 rounded-md p-2.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Esc-to-cancel hint — visible only during in-flight phases */}
      {(phase === 'searching' || phase === 'reasoning' || phase === 'warming' || phase === 'sources' || phase === 'streaming') && (
        <div className="px-4 py-1 border-t border-zinc-800/50">
          <span className="text-xs text-zinc-500" style={{ opacity: 0.6 }} aria-hidden="true">
            Press Esc to cancel
          </span>
        </div>
      )}

      {/* Answer / content area — shown whenever bar is not collapsed */}
      {barState !== 'collapsed' && (
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3"
          ref={answerRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          aria-busy={isLoading}
          aria-label="Answer area"
        >
          {/* ── Prominent thinking header — jellyfish + phase copy ─────────── */}
          {isThinking && (
            <div className="flex items-center gap-3 pt-2 pb-1">
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-sm font-mono font-medium"
                  style={{ color: 'rgba(216,180,254,0.95)', textShadow: '0 0 8px rgba(167,139,250,0.4)' }}
                >
                  {thinkingCopy || 'Thinking…'}
                </span>
                {(phase === 'warming') && (
                  <span className="text-xs text-zinc-500">
                    Cloud Run is spinning up — this only happens on the first request
                  </span>
                )}
              </div>
            </div>
          )}

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
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          {/* ── Source section — skeletons while loading, real cards when ready ── */}
          {(showSkeleton || sources.length > 0) && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                {sources.length > 0
                  ? `Sources · ${sources.length} repos`
                  : 'Sources · searching…'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {/* Skeleton cards — shown while no sources yet */}
                {showSkeleton && sources.length === 0 && (
                  Array.from({ length: SKELETON_SOURCE_COUNT }).map((_, i) => (
                    <SourceCardSkeleton key={`skeleton-${i}`} />
                  ))
                )}
                {/* Real source cards — staggered reveal as they arrive */}
                {sources.slice(0, revealedSourceCount).map((repo, idx) => {
                  const upstream = repo.forked_from ?? `${repo.owner}/${repo.name}`;
                  const ghUrl = `https://github.com/${upstream}`;
                  const score = Math.round(repo.relevance_score * 100);
                  return (
                    <motion.a
                      key={`${repo.owner}/${repo.name}`}
                      href={ghUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={SOURCE_CARD_INITIAL}
                      animate={SOURCE_CARD_ANIMATE}
                      transition={{ duration: 0.2, delay: idx * 0.05 }}
                      className="group block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono text-zinc-300 group-hover:text-zinc-100 truncate">
                          {upstream}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-600">{score}%</span>
                      </div>
                      {repo.description && (
                        <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{repo.description}</p>
                      )}
                      {repo.stars != null && (
                        <p className="mt-1 text-xs text-zinc-600">★ {repo.stars.toLocaleString()}</p>
                      )}
                    </motion.a>
                  );
                })}
                {/* While real sources arriving, keep remaining skeleton slots */}
                {sources.length > 0 && revealedSourceCount < sources.length && (
                  Array.from({ length: sources.length - revealedSourceCount }).map((_, i) => (
                    <SourceCardSkeleton key={`filling-${i}`} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Answer section — skeleton until first token, then streaming ── */}
          {(showSkeleton || hasAnswer) && (
            <div className="space-y-2">
              {showSkeleton && !hasAnswer ? (
                <AnswerSkeleton />
              ) : (
                <div
                  className="rounded-lg bg-zinc-800/60 px-4 py-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap"
                >
                  {streamingAnswer}
                  {isLoading && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 bg-zinc-400 align-middle animate-pulse" />
                  )}
                </div>
              )}
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
        </div>
      )}
    </motion.div>
  );
}
