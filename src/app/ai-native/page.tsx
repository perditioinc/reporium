'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

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
  'The Term Problem',
  'The AI-Native Test',
  'AI-Native vs AI-Added',
  'The Minimal Stack',
  'What Makes Reporium AI-Native',
  '3 Mistakes',
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
          className="mt-4 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          How to Build AI-Native Products
          <br />
          <span style={{ color: '#a5f3fc', textShadow: neonCyan }}>That Actually Work</span>
        </h1>
      </C>

      <C>
        <p className="mt-4 text-base text-zinc-400 sm:text-lg md:text-xl">
          What AI-native actually means — and how to ship it
        </p>
      </C>

      <C>
        <p className="mt-2 font-mono text-sm text-zinc-500">
          A framework from building Reporium
        </p>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 2 — THE TERM PROBLEM ───────────────────────────────────────────────

function Slide2() {
  const left = [
    '"We added an AI chatbot"',
    '"We use GPT in the backend"',
    '"Our product has AI features"',
    '"We\'re AI-powered"',
  ];
  const right = [
    'AI is in the decision loop',
    "The product can't exist without AI",
    'Intelligence IS the product',
    'Designed around model capabilities',
  ];

  return (
    <SlideWrapper id="slide-1">
      <C>
        <h2
          className="text-2xl font-black sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          Everyone Is Building &ldquo;AI-Native&rdquo;
        </h2>
      </C>
      <C>
        <p className="mt-2 text-base text-zinc-400 sm:text-lg">
          Nobody agrees on what that means.
        </p>
      </C>

      <C>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Left */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5">
            <h3 className="mb-4 font-mono text-sm uppercase tracking-widest text-zinc-400">
              What people say
            </h3>
            <ul className="space-y-3">
              {left.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-zinc-300 sm:text-base">
                  <IconX className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span className="italic">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Right */}
          <div
            className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-5"
            style={{ boxShadow: '0 0 24px rgba(217,70,239,0.1)' }}
          >
            <h3 className="mb-4 font-mono text-sm uppercase tracking-widest text-fuchsia-400">
              What AI-native actually means
            </h3>
            <ul className="space-y-3">
              {right.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-zinc-100 sm:text-base">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </C>

      <C>
        <p className="mt-6 text-sm text-zinc-500 sm:text-base">
          This framework gives you the tools to know the difference — and build the real thing.
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
      q: 'Can agents consume it as a first-class citizen?',
      body: 'AI-native APIs are designed for both humans and agents. If only a browser can use it, you\'re half-done.',
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
          className="text-2xl font-black sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          The AI-Native Test: 4 Questions
        </h2>
      </C>
      <C>
        <p className="mt-2 text-base text-zinc-400 sm:text-lg">
          Ask these before you write a single line of code — each maps to one of the 4 AI-native layers
        </p>
      </C>

      <C>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {cards.map(({ num, layer, layerColor, layerBorder, q, body }) => (
            <div
              key={num}
              className="rounded-xl border border-cyan-500/20 bg-zinc-900/70 p-4 flex flex-col"
              style={{ boxShadow: '0 0 16px rgba(34,211,238,0.06)' }}
            >
              {/* Layer mini-badge */}
              <span
                className="mb-2 inline-block self-start rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em]"
                style={{ color: layerColor, borderColor: layerBorder, background: `${layerBorder}` }}
              >
                {layer}
              </span>
              <span
                className="block font-mono text-2xl font-black"
                style={{ color: '#67e8f9', textShadow: neonCyan }}
              >
                {num}
              </span>
              <p className="mt-2 text-sm font-semibold text-zinc-100">{q}</p>
              <p className="mt-2 text-xs text-zinc-400 flex-1">{body}</p>
            </div>
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
    'Example: Reporium — a knowledge graph that only exists because of AI',
  ];

  return (
    <SlideWrapper id="slide-3">
      <C>
        <h2
          className="text-2xl font-black sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          AI-Native vs. AI-Added
        </h2>
      </C>
      <C>
        <p className="mt-2 text-base text-zinc-400 sm:text-lg">
          One mental model. Everything else follows.
        </p>
      </C>

      <C>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* AI-Added */}
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-5">
            <h3 className="mb-4 font-mono text-base font-bold uppercase tracking-widest text-red-400 sm:text-lg">
              AI-Added
            </h3>
            <ul className="space-y-2.5">
              {added.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                  <IconX className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* AI-Native */}
          <div
            className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-5"
            style={{ boxShadow: '0 0 24px rgba(217,70,239,0.12)' }}
          >
            <h3 className="mb-4 font-mono text-base font-bold uppercase tracking-widest text-fuchsia-400 sm:text-lg">
              AI-Native
            </h3>
            <ul className="space-y-2.5">
              {native.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-zinc-100">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
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

  return (
    <SlideWrapper id="slide-4">
      <C>
        <h2
          className="text-2xl font-black sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          The Minimal AI-Native Stack
        </h2>
      </C>
      <C>
        <p className="mt-2 text-base text-zinc-400 sm:text-lg">
          You don&rsquo;t need much. You need the right things.
        </p>
      </C>

      <C>
        <div className="mt-8 flex flex-col gap-3">
          {layers.map(({ name, tech, desc, accent, border, glow }) => (
            <div
              key={name}
              className="flex flex-col rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-6"
              style={{ borderColor: border, boxShadow: `0 0 18px ${glow}`, background: 'rgba(9,9,17,0.7)' }}
            >
              <div className="flex items-center gap-3 sm:w-44">
                <IconLayers className="h-5 w-5 shrink-0" style={{ color: accent }} />
                <span className="font-mono text-sm font-bold" style={{ color: accent }}>
                  {name}
                </span>
              </div>
              <div className="mt-2 flex flex-1 flex-col sm:mt-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-zinc-300">{tech}</span>
                <span className="mt-1 text-xs italic text-zinc-500 sm:mt-0 sm:text-right">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </C>

      <C>
        <p className="mt-5 text-sm text-zinc-500">
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
          className="text-2xl font-black sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          What Makes Reporium AI-Native
        </h2>
      </C>
      <C>
        <p className="mt-2 text-base text-zinc-400 sm:text-lg">
          The framework, mapped to real services
        </p>
      </C>
      <C>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base max-w-3xl">
          Four AI-native layers — Agent-accessible, Intelligence, Semantic, Compounding — run vertically through every request. Three cross-cutting bands — Observability, Governance, Performance — span all layers to keep the system trustworthy and fast.
        </p>
      </C>

      <C className="mt-4">
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
  ];

  return (
    <SlideWrapper id="slide-6">
      <C>
        <h2
          className="text-2xl font-black sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          3 Mistakes That Make Products AI-Added, Not AI-Native
        </h2>
      </C>

      <C>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {mistakes.map(({ title, body, fix }) => (
            <div
              key={title}
              className="flex flex-col rounded-xl border border-red-500/25 bg-zinc-900/70 p-5"
            >
              <IconX className="mb-3 h-6 w-6 text-red-400" />
              <p className="text-sm font-bold text-zinc-100 sm:text-base">{title}</p>
              <p className="mt-2 flex-1 text-xs text-zinc-400 sm:text-sm">{body}</p>
              <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">Fix: </span>
                <span className="text-xs text-zinc-300">{fix}</span>
              </div>
            </div>
          ))}
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 8 — HOW TO START ───────────────────────────────────────────────────

function Slide8() {
  const steps = [
    {
      n: '1',
      title: 'Define the intelligence outcome',
      desc: "What should the product know that humans can't easily compute?",
    },
    {
      n: '2',
      title: 'Design your data model for AI',
      desc: 'Tables + embeddings + edges. Schema is destiny.',
    },
    {
      n: '3',
      title: 'Pick the smallest useful model',
      desc: 'Use a fast, cheap model for classification and a stronger one only when reasoning is actually needed. Don\'t over-engineer early.',
    },
    {
      n: '4',
      title: 'Build the intelligence endpoint first',
      desc: 'Query before UI. Make the API useful to agents before humans.',
    },
    {
      n: '5',
      title: 'Ship, measure, compound',
      desc: 'Every query tells you what to build next. Let the product teach you.',
    },
  ];

  return (
    <SlideWrapper id="slide-7">
      <C>
        <h2
          className="text-2xl font-black sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          How to Actually Start Building AI-Native
        </h2>
      </C>
      <C>
        <p className="mt-2 text-base text-zinc-400 sm:text-lg">
          The 5-step path from idea to intelligence
        </p>
      </C>

      <C>
        <div className="mt-8 flex flex-col gap-3">
          {steps.map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-4 rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3">
              <span
                className="shrink-0 font-mono text-2xl font-black leading-none"
                style={{ color: '#67e8f9', textShadow: neonCyan }}
              >
                {n}
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-100 sm:text-base">{title}</p>
                <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">{desc}</p>
              </div>
            </div>
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
          className="text-xl font-black uppercase tracking-widest text-zinc-500 sm:text-2xl"
        >
          The One Thing to Remember
        </h2>
      </C>

      <C>
        <blockquote
          className="mt-6 text-2xl font-black leading-snug sm:text-4xl md:text-5xl"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia }}
        >
          &ldquo;AI-native isn&rsquo;t a technology choice.
          <br />
          It&rsquo;s a design philosophy.&rdquo;
        </blockquote>
      </C>

      <C>
        <p className="mt-4 text-base text-zinc-400 sm:text-xl">
          If the intelligence is the product — you&rsquo;re building AI-native.
        </p>
      </C>

      <C>
        <ul className="mt-6 space-y-2">
          {checks.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-zinc-200 sm:text-base">
              <IconCheck className="h-5 w-5 shrink-0 text-fuchsia-400" />
              {item}
            </li>
          ))}
        </ul>
      </C>

      <C>
        <div className="mt-8 border-t border-zinc-800 pt-6">
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
