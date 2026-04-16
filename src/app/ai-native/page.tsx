'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { SlideWrapper, childVariants } from '@/components/ai-native/SlideWrapper';
import { SlideDots } from '@/components/ai-native/SlideDots';
import { SlideProgress } from '@/components/ai-native/SlideProgress';
import { ArchitectureDiagram } from '@/components/ai-native/ArchitectureDiagram';

// ─── Inline icon components (lucide-react not installed) ──────────────────────

function IconX({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconLayers({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

// ─── Slide metadata ───────────────────────────────────────────────────────────

const SLIDE_LABELS = [
  'Intro',
  'Why This Matters',
  'The AI-Native Test',
  'AI-Native vs AI-Added',
  'The Minimal Stack',
  'What Makes Reporium AI-Native',
  '4 Mistakes',
  'How to Start',
  'One Takeaway',
];

const TOTAL_SLIDES = 9;

// ─── Neon text-shadow helper ─────────────────────────────────────────────────

const neonFuchsia =
  '0 0 6px rgba(236,72,153,0.95), 0 0 18px rgba(236,72,153,0.6), 0 0 36px rgba(217,70,239,0.35)';
const neonCyan =
  '0 0 6px rgba(34,211,238,0.95), 0 0 18px rgba(34,211,238,0.6), 0 0 36px rgba(6,182,212,0.35)';

// ─── Reusable motion child wrapper ───────────────────────────────────────────

function C({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={childVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Eyebrow tag ─────────────────────────────────────────────────────────────

function Eyebrow({ children, cyan = false }: { children: React.ReactNode; cyan?: boolean }) {
  return (
    <C>
      <span
        className="inline-block rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] sm:text-sm"
        style={{
          borderColor: cyan ? 'rgba(34,211,238,0.5)' : 'rgba(217,70,239,0.5)',
          color: cyan ? '#67e8f9' : '#f0abfc',
          background: cyan ? 'rgba(34,211,238,0.06)' : 'rgba(217,70,239,0.06)',
        }}
      >
        {children}
      </span>
    </C>
  );
}

// ─── Slide 1 — HERO (Intro) ───────────────────────────────────────────────────

function Slide1() {
  return (
    <SlideWrapper id="slide-0">
      {/* Grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(217,70,239,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.35) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          backgroundPosition: 'center',
        }}
      />
      {/* Corner label */}
      <span
        aria-hidden
        className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-widest text-cyan-400/50"
      >
        ◢ system.online ◣
      </span>

      <Eyebrow>BEGINNER → INTERMEDIATE</Eyebrow>

      <C>
        <h1
          className="mt-3 font-black leading-[1.1] tracking-tight"
          style={{
            color: '#f5d0fe',
            textShadow: neonFuchsia,
            fontSize: 'clamp(1.6rem, 5vw + 1svh, 4.5rem)',
          }}
        >
          How to Build AI-Native Products
          <br />
          <span style={{ color: '#a5f3fc', textShadow: neonCyan }}>That Actually Work</span>
        </h1>
      </C>

      <C>
        <p className="mt-3 text-sm text-zinc-400 sm:text-lg md:text-xl">
          What AI-native actually means — and how to ship it
        </p>
      </C>

      <C>
        <p className="mt-1.5 font-mono text-sm text-zinc-500">
          A framework from building Reporium
        </p>
      </C>

      <C>
        <p className="mt-1 font-mono text-xs text-cyan-400/80">
          A tool for AI practitioners to evaluate AI development tools
        </p>
      </C>
    </SlideWrapper>
  );
}

// ─── Hover-expand primitive ──────────────────────────────────────────────────
// All cards on this page use the same interaction curve: gentle scale + lift
// on hover, tiny squish on tap. Framer runs these on the GPU (transform only),
// so cost stays ~0 even with dozens of cards in flight.
const hoverExpand = {
  whileHover: { scale: 1.035, y: -4 },
  whileTap: { scale: 0.98 },
  transition: { type: 'spring' as const, stiffness: 320, damping: 22 },
};

// ─── Slide 2 — THE TERM PROBLEM ───────────────────────────────────────────────

function Slide2() {
  // Three concrete failure snippets of untrusted AI output — the dev-hook.
  // These are real patterns every developer has hit with the current crop
  // of AI tools, not hypothetical. Developer voice, no marketing framing.
  const failures = [
    {
      tag: 'hallucination',
      snippet: 'from langchain.agents import load_agent  # ← does not exist',
      why: 'Plausible import. Confident tone. Wrong.',
    },
    {
      tag: 'stale citation',
      snippet: 'cites OpenAI v0.28 API — deprecated 14 months ago',
      why: 'Training data frozen. No freshness signal on the claim.',
    },
    {
      tag: 'confident but wrong',
      snippet: 'expect(calc.tax(100)).toBe(7.5)  // PASSES — but formula is wrong',
      why: 'Green tests. Broken logic. Nobody caught it in review.',
    },
  ];

  return (
    <SlideWrapper id="slide-1">
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.3rem, 3.8vw + 0.8svh, 2.8rem)' }}
        >
          Every week, another &ldquo;game-changing&rdquo; AI dev tool
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-sm text-zinc-400 sm:text-lg">
          Recommendation fatigue is real. Trust isn&rsquo;t.
        </p>
      </C>

      {/* Three failure snippets */}
      <C>
        <div className="mt-3 sm:mt-5 grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-3">
          {failures.map(({ tag, snippet, why }) => (
            <motion.div
              key={tag}
              {...hoverExpand}
              className="rounded-xl border border-red-500/25 bg-zinc-900/70 p-3 sm:p-4 cursor-pointer flex flex-col"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-red-400 sm:text-xs">
                {tag}
              </span>
              <pre
                className="mt-2 whitespace-pre-wrap break-words rounded-md bg-black/50 px-2 py-1.5 font-mono text-[10px] leading-snug text-zinc-200 sm:text-[11px]"
              >
                {snippet}
              </pre>
              <p className="mt-2 text-[11px] italic text-zinc-400 sm:text-xs">{why}</p>
            </motion.div>
          ))}
        </div>
      </C>

      {/* The bottleneck pattern — author's lived experience, verbatim-voice */}
      <C>
        <div
          className="mt-3 sm:mt-5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-3 sm:p-4"
          style={{ boxShadow: '0 0 24px rgba(217,70,239,0.1)' }}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-400 sm:text-xs">
            The pattern
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-200 sm:text-sm">
            No standard way to evaluate what&rsquo;s worth your team&rsquo;s time.
            One senior dev becomes the gate for &ldquo;should we try X?&rdquo;
            Velocity bottlenecks on them.
          </p>
          <p className="mt-2 text-[11px] italic text-zinc-400 sm:text-xs">
            Developer adoption requires trust — and trust has to be cheap to check.
          </p>
        </div>
      </C>

      <C>
        <p className="mt-3 text-xs text-zinc-500 sm:text-sm">
          That&rsquo;s why Reporium exists. Next: how you tell &ldquo;AI-native&rdquo; from &ldquo;AI-added.&rdquo;
        </p>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 3 — THE AI-NATIVE TEST (4 Questions) ───────────────────────────────

function Slide3() {
  const cards = [
    {
      num: '01',
      layer: 'Intelligence layer',
      layerColor: '#f0abfc',
      layerBorder: 'rgba(217,70,239,0.35)',
      q: 'Does AI change the outcome — or just the interface?',
      body: 'If removing the AI leaves the product intact, you added AI. You didn\'t build AI-native.',
    },
    {
      num: '02',
      layer: 'Semantic layer',
      layerColor: '#67e8f9',
      layerBorder: 'rgba(34,211,238,0.35)',
      q: 'Is retrieval by meaning — or by strings?',
      body: 'AI-native products understand queries semantically. Exact-match search is not AI-native retrieval.',
    },
    {
      num: '03',
      layer: 'Agent-accessible layer',
      layerColor: '#c084fc',
      layerBorder: 'rgba(147,51,234,0.35)',
      q: 'Can an agent call it directly — or must it scrape your UI?',
      body: 'AI-native products expose typed, documented endpoints any agent can invoke. If the only client is a browser, agents are shut out.',
    },
    {
      num: '04',
      layer: 'Compounding layer',
      layerColor: '#6ee7b7',
      layerBorder: 'rgba(52,211,153,0.35)',
      q: 'Does the product get smarter with use?',
      body: 'AI-native products compound. Every query, every edge, every interaction makes the next one better.',
    },
  ];

  return (
    <SlideWrapper id="slide-2">
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.4rem, 4vw + 0.8svh, 3rem)' }}
        >
          The AI-Native Test: 4 Questions
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-xs text-zinc-400 sm:text-base">
          Ask these before you write a single line of code — each maps to one of the 4 AI-native layers
        </p>
      </C>

      <C>
        <div className="mt-3 sm:mt-5 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
          {cards.map(({ num, layer, layerColor, layerBorder, q, body }) => (
            <motion.div
              key={num}
              {...hoverExpand}
              className="rounded-xl border border-cyan-500/20 bg-zinc-900/70 p-4 flex flex-col cursor-pointer"
              style={{ boxShadow: '0 0 16px rgba(34,211,238,0.06)' }}
            >
              {/* Header row: layer badge + number */}
              <div className="flex items-center justify-between gap-3">
                <span
                  className="inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em]"
                  style={{ color: layerColor, borderColor: layerBorder, background: `${layerBorder}` }}
                >
                  {layer}
                </span>
                <span
                  className="font-mono text-2xl font-black leading-none"
                  style={{ color: '#67e8f9', textShadow: neonCyan }}
                >
                  {num}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-100">{q}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 flex-1">{body}</p>
            </motion.div>
          ))}
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 4 — AI-NATIVE vs AI-ADDED ─────────────────────────────────────────

function Slide4() {
  const added = [
    'Product existed before AI',
    'AI is a feature layer on top',
    'Remove AI → product still works',
    'Data model built for humans',
    'AI improves the experience',
    'Example: Adding a chatbot to a legacy CRM',
  ];
  const native = [
    'AI is the architecture, not a feature',
    "Remove AI → product doesn't exist",
    'Data model built for embeddings',
    'Intelligence is the core value prop',
    'Decisions made by the system, not UI',
    'Example: Reporium — knowledge graph + embeddings are the retrieval engine',
  ];

  return (
    <SlideWrapper id="slide-3">
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.4rem, 4vw + 0.8svh, 3rem)' }}
        >
          AI-Native vs. AI-Added
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-xs text-zinc-400 sm:text-base">
          AI-powered = feature. AI-native = architecture.
        </p>
      </C>

      <C>
        <div className="mt-3 sm:mt-6 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
          {/* AI-Added */}
          <motion.div {...hoverExpand} className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 cursor-pointer">
            <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-red-400 sm:text-sm">
              AI-Added
            </h3>
            <ul className="space-y-2">
              {added.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-zinc-300 sm:text-sm">
                  <IconX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          {/* AI-Native */}
          <motion.div
            {...hoverExpand}
            className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-4 cursor-pointer"
            style={{ boxShadow: '0 0 24px rgba(217,70,239,0.12)' }}
          >
            <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-fuchsia-400 sm:text-sm">
              AI-Native
            </h3>
            <ul className="space-y-2">
              {native.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-zinc-100 sm:text-sm">
                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 5 — MINIMAL STACK ──────────────────────────────────────────────────

function Slide5() {
  const layers = [
    {
      name: 'Intelligence Layer',
      tech: 'LLM API (model-agnostic — Claude, GPT, local)',
      desc: 'Answers, enrichment, classification',
      accent: '#f0abfc',
      border: 'rgba(217,70,239,0.4)',
      glow: 'rgba(217,70,239,0.15)',
    },
    {
      name: 'Semantic Layer',
      tech: 'Embeddings + Vector DB (pgvector, Pinecone)',
      desc: 'Understanding, not just matching',
      accent: '#a5f3fc',
      border: 'rgba(34,211,238,0.4)',
      glow: 'rgba(34,211,238,0.15)',
    },
    {
      name: 'Data Layer',
      tech: 'Structured store + graph edges',
      desc: 'Relationships are the product',
      accent: '#86efac',
      border: 'rgba(134,239,172,0.4)',
      glow: 'rgba(134,239,172,0.1)',
    },
    {
      name: 'Interface Layer',
      tech: 'API-first (FastAPI, Next.js)',
      desc: 'Humans and agents both need access',
      accent: '#fde68a',
      border: 'rgba(253,230,138,0.4)',
      glow: 'rgba(253,230,138,0.08)',
    },
  ];

  // Cross-cutting concerns — not layers themselves, but the scaffolding every
  // AI-native stack needs to stay trustworthy in production. Separated
  // visually so the core-4 message stays clean.
  const crossCutting = [
    { name: 'Trust', tech: 'Citations · provenance · freshness', desc: 'Cheap to verify' },
    { name: 'Orchestration', tech: 'Agents · tool-calling · pipelines', desc: 'Compose intelligence' },
    { name: 'Observability', tech: 'Traces · token cost · latency', desc: 'See what the model did' },
    { name: 'Evals & Benchmarks', tech: 'Deterministic quality checks', desc: 'Re-runnable, not vibes' },
  ];

  return (
    <SlideWrapper id="slide-4">
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.4rem, 4vw + 0.8svh, 3rem)' }}
        >
          The Minimal AI-Native Stack
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-xs text-zinc-400 sm:text-base">
          You don&rsquo;t need much. You need the right things.
        </p>
      </C>

      <C>
        <div className="mt-3 sm:mt-5 flex flex-col gap-2 sm:gap-3">
          {layers.map(({ name, tech, desc, accent, border, glow }) => (
            <motion.div
              key={name}
              {...hoverExpand}
              className="flex flex-col rounded-xl border p-3 cursor-pointer sm:flex-row sm:items-center sm:gap-6 sm:p-4"
              style={{ borderColor: border, boxShadow: `0 0 18px ${glow}`, background: 'rgba(9,9,17,0.7)' }}
            >
              <div className="flex items-center gap-3 sm:w-44">
                <IconLayers className="h-4 w-4 shrink-0" style={{ color: accent }} />
                <span className="font-mono text-xs font-bold sm:text-sm" style={{ color: accent }}>
                  {name}
                </span>
              </div>
              <div className="mt-1 flex flex-1 flex-col sm:mt-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-zinc-300 sm:text-sm">{tech}</span>
                <span className="text-[10px] italic text-zinc-500 sm:text-xs sm:text-right">{desc}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </C>

      <C>
        <div className="mt-3 sm:mt-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 sm:text-xs">
            + Cross-cutting — what keeps it trustworthy in production
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {crossCutting.map(({ name, tech, desc }) => (
              <motion.div
                key={name}
                {...hoverExpand}
                className="flex flex-col rounded-lg border border-zinc-700/60 bg-zinc-900/50 p-2.5 cursor-pointer sm:p-3"
              >
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-200 sm:text-xs">
                  {name}
                </span>
                <span className="mt-1 text-[10px] text-zinc-400 sm:text-xs">{tech}</span>
                <span className="mt-1 text-[9px] italic text-zinc-600 sm:text-[11px]">{desc}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </C>

      <C>
        <p className="mt-3 text-xs text-zinc-500 sm:text-sm">
          Reporium uses this exact stack.
        </p>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 6 — WHAT MAKES REPORIUM AI-NATIVE (Architecture) ──────────────────

function Slide6() {
  return (
    <SlideWrapper id="slide-5">
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.4rem, 4vw + 0.8svh, 3rem)' }}
        >
          What Makes Reporium AI-Native
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-xs text-zinc-400 sm:text-base">
          The framework, mapped to real services
        </p>
      </C>
      <C>
        <p className="mt-2 text-xs text-zinc-500 sm:text-sm max-w-3xl">
          Four AI-native layers — Agent-accessible, Intelligence, Semantic, Compounding — run vertically through every request. Three cross-cutting bands — Observability, Governance, Performance — span all layers to keep the system trustworthy and fast.
        </p>
      </C>

      <C className="mt-3">
        <ArchitectureDiagram />
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 7 — 3 MISTAKES ────────────────────────────────────────────────────

function Slide7() {
  const mistakes = [
    {
      title: 'Starting with the model, not the problem',
      body: '"Let\'s add GPT" is not a product strategy. Define what intelligence should change about the outcome first.',
      fix: 'Write the user\'s \'aha moment\' before choosing any model.',
    },
    {
      title: 'Building AI on top of a non-AI data model',
      body: "If your database wasn't designed for embeddings and relationships, every AI layer will fight you.",
      fix: 'Schema-first. Design for vectors and edges from day one.',
    },
    {
      title: 'Making AI a feature instead of the foundation',
      body: "A search bar that uses an LLM is still just a search bar. AI-native means the product can't function without intelligence.",
      fix: '"Ask — if I removed the AI, does this product still exist?"',
    },
    {
      title: 'Shipping AI output devs can\'t verify',
      body: 'Hallucinated imports, stale citations, confident-but-wrong tests. Without provenance and re-runnable checks, developer teams bottleneck on one senior who trusts the tool.',
      fix: 'Citations + deterministic re-checks + freshness timestamps on every AI claim.',
    },
  ];

  return (
    <SlideWrapper id="slide-6">
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.2rem, 3.5vw + 0.8svh, 2.8rem)' }}
        >
          4 Mistakes That Make Products AI-Added, Not AI-Native
        </h2>
      </C>

      <C>
        <div className="mt-3 sm:mt-5 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {mistakes.map(({ title, body, fix }) => (
            <motion.div
              key={title}
              {...hoverExpand}
              className="flex flex-col rounded-xl border border-red-500/25 bg-zinc-900/70 p-4 cursor-pointer"
            >
              <IconX className="mb-2 h-5 w-5 text-red-400" />
              <p className="text-xs font-bold text-zinc-100 sm:text-sm">{title}</p>
              <p className="mt-1.5 flex-1 text-[11px] text-zinc-400 sm:text-xs">{body}</p>
              <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-2.5 py-1.5">
                <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-400">Fix: </span>
                <span className="text-[11px] text-zinc-300">{fix}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 8 — HOW TO START ───────────────────────────────────────────────────

function StepFlipCard({
  n,
  title,
  desc,
  reporium,
}: {
  n: string;
  title: string;
  desc: string;
  reporium: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const prefersReduced = useReducedMotion();

  const toggle = useCallback(() => setFlipped((f) => !f), []);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  if (prefersReduced) {
    // Reduced-motion: simple crossfade, no 3-D rotation
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        onClick={toggle}
        onKeyDown={handleKey}
        className="relative rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-3 py-2.5 cursor-pointer sm:px-4 sm:py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400"
        style={{ minHeight: '3.5rem' }}
      >
        <motion.div
          animate={{ opacity: flipped ? 0 : 1 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-3"
          aria-hidden={flipped}
        >
          <span
            className="shrink-0 font-mono text-xl font-black leading-none sm:text-2xl"
            style={{ color: '#67e8f9', textShadow: neonCyan }}
          >
            {n}
          </span>
          <div>
            <p className="text-xs font-semibold text-zinc-100 sm:text-sm">{title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400 sm:text-xs">{desc}</p>
          </div>
        </motion.div>
        <motion.div
          animate={{ opacity: flipped ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex flex-col justify-center px-3 py-2.5 sm:px-4 sm:py-3"
          aria-hidden={!flipped}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest sm:text-xs"
            style={{ color: '#d946ef' }}
          >
            Reporium — step {n}
          </p>
          <p className="mt-1 text-[11px] text-zinc-300 sm:text-xs">{reporium}</p>
        </motion.div>
      </div>
    );
  }

  return (
    // Perspective wrapper — required for 3-D flip to look right
    <div style={{ perspective: '900px' }}>
      <motion.div
        onClick={toggle}
        onKeyDown={handleKey}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        whileHover={!flipped ? { scale: 1.025, y: -3 } : {}}
        whileTap={{ scale: 0.98 }}
        style={{ transformStyle: 'preserve-3d', position: 'relative', cursor: 'pointer' }}
        className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400"
      >
        {/* FRONT */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className="flex items-start gap-3 px-3 py-2.5 sm:px-4 sm:py-3"
          aria-hidden={flipped}
        >
          <span
            className="shrink-0 font-mono text-xl font-black leading-none sm:text-2xl"
            style={{ color: '#67e8f9', textShadow: neonCyan }}
          >
            {n}
          </span>
          <div>
            <p className="text-xs font-semibold text-zinc-100 sm:text-sm">{title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400 sm:text-xs">{desc}</p>
          </div>
        </div>

        {/* BACK */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
          }}
          className="flex flex-col justify-center rounded-xl border border-fuchsia-800/40 bg-zinc-900/90 px-3 py-2.5 sm:px-4 sm:py-3"
          aria-hidden={!flipped}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest sm:text-xs"
            style={{ color: '#d946ef' }}
          >
            Reporium — step {n}
          </p>
          <p className="mt-1 text-[11px] text-zinc-300 sm:text-xs">{reporium}</p>
        </div>
      </motion.div>
    </div>
  );
}

function Slide8() {
  const steps: { n: string; title: string; desc: string; reporium: string }[] = [
    {
      n: '1',
      title: 'Define the intelligence outcome',
      desc: "What should the product know that humans can't easily compute?",
      reporium:
        'Outcome: surface the right repo for a use-case without keyword search — ranked by relevance, not star count.',
    },
    {
      n: '2',
      title: 'Design your data model for AI',
      desc: 'Tables + embeddings + edges. Schema is destiny.',
      reporium:
        'Postgres + pgvector for similarity search; graph edges (DEPENDS_ON, SIMILAR_TO) stored separately for traversal.',
    },
    {
      n: '3',
      title: 'Pick the smallest useful model',
      desc: 'Use a fast, cheap model for classification and a stronger one only when reasoning is actually needed. Don\'t over-engineer early.',
      reporium:
        'Haiku handles tagging and category classification at ingest; Sonnet handles the conversational /ask endpoint.',
    },
    {
      n: '4',
      title: 'Build the intelligence endpoint first',
      desc: 'Query before UI. Make the API useful to agents before humans.',
      reporium:
        'FastAPI /search and /ask endpoints shipped before the Next.js UI existed; the MCP server exposes the same routes to agents.',
    },
    {
      n: '5',
      title: 'Ship, measure, compound',
      desc: 'Every query tells you what to build next. Let the product teach you.',
      reporium:
        '1,700 repos ingested; view tracking and recent-search history feed the recommendations loop each night.',
    },
  ];

  return (
    <SlideWrapper id="slide-7">
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.4rem, 4vw + 0.8svh, 3rem)' }}
        >
          How to Actually Start Building AI-Native
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-xs text-zinc-400 sm:text-base">
          The 5-step path from idea to intelligence — click any card to see how Reporium did it
        </p>
      </C>

      <C>
        <div className="mt-3 sm:mt-5 flex flex-col gap-2 sm:gap-3">
          {steps.map((step) => (
            <StepFlipCard key={step.n} {...step} />
          ))}
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 9 — ONE TAKEAWAY ───────────────────────────────────────────────────

function Slide9() {
  const checks = [
    'Define intelligence outcomes first',
    'Design the data model for AI from day one',
    'Ship the smallest useful version, then compound',
  ];

  return (
    <SlideWrapper id="slide-8">
      {/* Glow behind pull-quote */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(217,70,239,0.07) 0%, transparent 65%)',
        }}
      />

      <C>
        <h2
          className="font-black uppercase tracking-widest text-zinc-500"
          style={{ fontSize: 'clamp(0.9rem, 2vw + 0.5svh, 1.5rem)' }}
        >
          The One Thing to Remember
        </h2>
      </C>

      <C>
        <blockquote
          className="mt-4 font-black leading-snug"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.3rem, 4vw + 1svh, 3rem)' }}
        >
          &ldquo;AI-native isn&rsquo;t a technology choice.
          <br />
          It&rsquo;s a design philosophy.&rdquo;
        </blockquote>
      </C>

      <C>
        <p className="mt-3 text-sm text-zinc-400 sm:text-lg">
          If the intelligence is the product — you&rsquo;re building AI-native.
        </p>
      </C>

      <C>
        <ul className="mt-4 space-y-2">
          {checks.map((item) => (
            <li key={item} className="flex items-center gap-3 text-xs text-zinc-200 sm:text-sm">
              <IconCheck className="h-4 w-4 shrink-0 text-fuchsia-400" />
              {item}
            </li>
          ))}
        </ul>
      </C>

      <C>
        <div className="mt-6 border-t border-zinc-800 pt-4">
          <p className="font-mono text-xs text-zinc-500">
            reporium.com · github.com/perditioinc
          </p>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiNativePage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  // Build slide refs array from DOM after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const container = containerRef.current;
    if (!container) return;

    slideRefs.current = Array.from({ length: TOTAL_SLIDES }).map((_, i) =>
      container.querySelector(`#slide-${i}`)
    );
  }, []);

  // IntersectionObserver to track active slide
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observers: IntersectionObserver[] = [];

    for (let i = 0; i < TOTAL_SLIDES; i++) {
      const el = document.getElementById(`slide-${i}`);
      if (!el) continue;

      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSlide(i);
            }
          });
        },
        { threshold: 0.5 }
      );
      obs.observe(el);
      observers.push(obs);
    }

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  // Scroll to slide helper — scroll the snap container directly. scrollIntoView
  // on a scroll-snap-mandatory container is inconsistent across browsers (Chrome
  // 120+ sometimes snaps back, Firefox ignores smooth), so drive the container
  // with scrollTo(top) using the slide's offsetTop.
  const scrollToSlide = useCallback((index: number) => {
    if (typeof window === 'undefined') return;
    const container = containerRef.current;
    const el = document.getElementById(`slide-${index}`);
    if (!container || !el) return;
    container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't hijack arrows when user is typing in the ask bar or similar
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setActiveSlide((prev) => {
          const next = Math.min(prev + 1, TOTAL_SLIDES - 1);
          scrollToSlide(next);
          return next;
        });
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setActiveSlide((prev) => {
          const next = Math.max(prev - 1, 0);
          scrollToSlide(next);
          return next;
        });
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scrollToSlide]);

  return (
    <>
      <SlideProgress current={activeSlide} total={TOTAL_SLIDES} />

      <SlideDots
        total={TOTAL_SLIDES}
        active={activeSlide}
        onDotClick={scrollToSlide}
        labels={SLIDE_LABELS}
      />

      {/* Scroll-snap container */}
      <div
        ref={containerRef}
        className="h-[100svh] w-screen overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <Slide1 />
        <Slide2 />
        <Slide3 />
        <Slide4 />
        <Slide5 />
        <Slide6 />
        <Slide7 />
        <Slide8 />
        <Slide9 />
      </div>
    </>
  );
}
