'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';

import { SlideWrapper, childVariants } from '@/components/ai-native/SlideWrapper';
import { SlideDots } from '@/components/ai-native/SlideDots';
import { SlideProgress } from '@/components/ai-native/SlideProgress';
import { JellyfishLayer } from '@/components/JellyfishLayer';

// Dynamic-import the architecture SVG — ~1500 LOC of motion + SVG that only
// Slide 6 renders. Client-only (ssr:false) because the entire /ai-native page
// is client-gated anyway, and this shaves it from the initial JS bundle.
const ArchitectureDiagram = dynamic(
  () => import('@/components/ai-native/ArchitectureDiagram').then((m) => m.ArchitectureDiagram),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/80">
        <span className="font-mono text-xs text-zinc-500">loading architecture…</span>
      </div>
    ),
  },
);

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
  'Trust is the Foundation',
  'One Takeaway',
  'Start Walkthrough',
];

const TOTAL_SLIDES = 11;

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

// ─── SSR-safe reduced-motion hook ────────────────────────────────────────────
// framer-motion's useReducedMotion returns null on the server but synchronously
// reads matchMedia on the client's first render. When the user has reduced
// motion enabled, that produces a different render tree than SSR and trips
// React's hydration mismatch warning. Gate the value behind a mount flag so the
// first client render matches SSR, then re-render after hydration.
function useSSRSafeReducedMotion(): boolean {
  const pref = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect
  return mounted && !!pref;
}

// ─── Generic FlipCard primitive ───────────────────────────────────────────────
// Click / Enter / Space flips 180° around Y. Respects prefers-reduced-motion:
// falls back to a crossfade. Pass `front` and `back` as ReactNodes — any layout.
// The parent is responsible for height — both faces are absolutely stacked on
// the back face, so front height sets the card height.

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  minHeight?: string | number;
  ariaLabel?: string;
  onFlipChange?: (flipped: boolean) => void;
}

function FlipCard({ front, back, className = '', minHeight, ariaLabel, onFlipChange }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const prefersReduced = useSSRSafeReducedMotion();

  const toggle = useCallback(() => setFlipped((f) => !f), []);

  // Notify parent of flip changes via effect (never during render or inside a
  // setState updater — that triggers React's "setState while rendering a
  // different component" error).
  const onFlipChangeRef = useRef(onFlipChange);
  useEffect(() => {
    onFlipChangeRef.current = onFlipChange;
  }, [onFlipChange]);
  const isFirstFlipRef = useRef(true);
  useEffect(() => {
    if (isFirstFlipRef.current) {
      isFirstFlipRef.current = false;
      return;
    }
    onFlipChangeRef.current?.(flipped);
  }, [flipped]);
  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  const common =
    'rounded-xl border cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400';

  if (prefersReduced) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={ariaLabel}
        onClick={toggle}
        onKeyDown={handleKey}
        className={`relative ${common} ${className}`}
        style={{ minHeight }}
      >
        <motion.div animate={{ opacity: flipped ? 0 : 1 }} transition={{ duration: 0.2 }} aria-hidden={flipped}>
          {front}
        </motion.div>
        <motion.div
          animate={{ opacity: flipped ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
          aria-hidden={!flipped}
        >
          {back}
        </motion.div>
      </div>
    );
  }

  return (
    <div
      style={{ perspective: '1000px', height: minHeight, minHeight, display: 'flex' }}
      className={className}
    >
      <motion.div
        onClick={toggle}
        onKeyDown={handleKey}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={ariaLabel}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        whileHover={!flipped ? { scale: 1.025, y: -3 } : {}}
        whileTap={{ scale: 0.98 }}
        style={{
          transformStyle: 'preserve-3d',
          position: 'relative',
          cursor: 'pointer',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        className={common}
      >
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
          aria-hidden={flipped}
        >
          {front}
        </div>
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
          }}
          aria-hidden={!flipped}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Micro-interaction: floating bubbles ─────────────────────────────────────
// A cluster of 3 tiny translucent circles that rise + fade in place — same
// visual language as the site-wide AmbientBubbles background, but scoped to a
// flip-card corner so it reads as "this is tappable / there's more here."
//
// Performance: pure CSS keyframes on transform + opacity (GPU-composited).
// No JS per frame, no state, no will-change (dot count is tiny). Mobile-first:
// cluster is 14×20px with 3 bubbles; label hides below sm. A single shared
// styled-jsx block defines one keyframe reused by all instances on the page.
function ClickBubble({
  label = 'tap',
  corner = 'tr',
  accent = 'cyan',
}: {
  label?: string;
  corner?: 'tr' | 'br' | 'tl';
  accent?: 'cyan' | 'fuchsia';
}) {
  const pos =
    corner === 'tr'
      ? 'right-2 top-2'
      : corner === 'br'
        ? 'right-2 bottom-2'
        : 'left-2 top-2';
  const color = accent === 'cyan' ? 'rgba(165,243,252,0.85)' : 'rgba(240,171,252,0.85)';
  const rim = accent === 'cyan' ? 'rgba(34,211,238,0.5)' : 'rgba(217,70,239,0.5)';
  const textClr = accent === 'cyan' ? 'text-cyan-300/85' : 'text-fuchsia-300/85';

  const bubbles = [
    { size: 6, left: 2, delay: -0.5, dur: 2.4 },
    { size: 4, left: 8, delay: -1.8, dur: 2.1 },
    { size: 3, left: 5, delay: -3.1, dur: 2.7 },
  ];

  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${pos} flex items-center gap-1.5`}
    >
      <span
        className="relative inline-block"
        style={{ width: 14, height: 20, overflow: 'visible' }}
      >
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="cue-bubble absolute rounded-full"
            style={{
              width: b.size,
              height: b.size,
              left: b.left,
              bottom: 0,
              background: `radial-gradient(circle at 35% 30%, ${color}, ${rim} 60%, transparent 85%)`,
              border: `0.5px solid ${rim}`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
            }}
          />
        ))}
      </span>
      {label ? (
        <span className={`hidden font-mono text-[9px] uppercase tracking-widest sm:inline ${textClr}`}>
          {label}
        </span>
      ) : null}

      <style jsx>{`
        .cue-bubble {
          animation: cue-rise ease-in-out infinite;
          opacity: 0;
        }
        @keyframes cue-rise {
          0%   { transform: translateY(0) scale(0.85);  opacity: 0; }
          15%  { opacity: 0.95; }
          60%  { opacity: 0.7; }
          100% { transform: translateY(-20px) scale(1.05); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cue-bubble { animation: none; opacity: 0.6; }
        }
      `}</style>
    </span>
  );
}

// ─── Slide 1 — HERO (Intro) ───────────────────────────────────────────────────

// ─── Slide 1 atoms ────────────────────────────────────────────────────────────

// Hologram eyebrow — scan-line shimmer + subtle flicker + chromatic edge.
// All CSS (no JS timers). Motion limited to small opacity/background-position
// changes — no layout, no paint.
function HologramEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <C>
      <span
        className="holo-eyebrow relative inline-block rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] sm:text-sm"
        style={{
          borderColor: 'rgba(34,211,238,0.55)',
          color: '#a5f3fc',
          background: 'rgba(34,211,238,0.06)',
          textShadow: '1px 0 0 rgba(236,72,153,0.35), -1px 0 0 rgba(34,211,238,0.45), 0 0 6px rgba(165,243,252,0.6)',
        }}
      >
        <span className="relative z-10">{children}</span>
        <style jsx>{`
          .holo-eyebrow::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 9999px;
            background: repeating-linear-gradient(
              0deg,
              rgba(165, 243, 252, 0.06) 0px,
              rgba(165, 243, 252, 0.06) 1px,
              transparent 1px,
              transparent 3px
            );
            pointer-events: none;
            animation: holo-scan 4.5s linear infinite;
          }
          .holo-eyebrow::after {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: 9999px;
            background: linear-gradient(90deg, transparent 0%, rgba(165,243,252,0.35) 50%, transparent 100%);
            opacity: 0;
            animation: holo-sweep 3.2s ease-in-out infinite;
            pointer-events: none;
            mix-blend-mode: screen;
          }
          @keyframes holo-scan {
            0%   { background-position: 0 0; }
            100% { background-position: 0 24px; }
          }
          @keyframes holo-sweep {
            0%, 90%, 100% { opacity: 0; transform: translateX(-30%); }
            45%            { opacity: 0.55; transform: translateX(30%); }
          }
          @media (prefers-reduced-motion: reduce) {
            .holo-eyebrow::before,
            .holo-eyebrow::after { animation: none; }
          }
        `}</style>
      </span>
    </C>
  );
}

// Interactive foreground jellyfish — sits atop the ambient layer. Hover speeds
// up the tentacle wobble and brightens the bell glow; click triggers a quick
// "jet" (scale + upward bob) and emits a small burst of bubbles.
// Motion budget: three transforms on click (bell + bubble cluster), all via
// framer-motion spring. Hover = CSS-only animation-duration switch.
function FeaturedJellyfish() {
  const [jetting, setJetting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const prefersReduced = useSSRSafeReducedMotion();

  const onActivate = useCallback(() => {
    setJetting(true);
    window.setTimeout(() => setJetting(false), 900);
  }, []);

  const size = 120;
  const r = size / 2;
  const bellH = size * 0.55;

  // Deterministic tentacle geometry — stable across renders
  const tentacles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI;
    const startX = r + Math.cos(angle) * r * 0.85;
    const startY = bellH;
    const endX = startX + (i % 2 === 0 ? 1 : -1) * (4 + (i % 5) * 3);
    const endY = startY + size * 0.55 + (i % 3) * 8;
    const cp1X = startX + ((i % 3) - 1) * 8;
    const cp1Y = startY + size * 0.18;
    const cp2X = endX + ((i % 2) - 0.5) * 12;
    const cp2Y = endY - size * 0.1;
    return { i, startX, startY, endX, endY, cp1X, cp1Y, cp2X, cp2Y };
  });

  const totalH = bellH + size * 0.6;

  return (
    <motion.button
      type="button"
      aria-label="Interactive jellyfish — click to jet"
      onClick={onActivate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      animate={prefersReduced ? {} : jetting ? { y: -24, scale: 1.08 } : { y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      className="featured-jelly absolute z-20 cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      style={{
        right: '6%',
        bottom: '12%',
        width: size,
        height: totalH,
        border: 'none',
        background: 'transparent',
        padding: 0,
      }}
    >
      <svg
        width={size}
        height={totalH}
        viewBox={`0 0 ${size} ${totalH}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="featured-jbell" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="rgba(216,180,254,0.85)" />
            <stop offset="55%" stopColor="rgba(139,92,246,0.55)" />
            <stop offset="100%" stopColor="rgba(91,33,182,0.18)" />
          </radialGradient>
          <radialGradient id="featured-jglow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(196,181,253,0.7)" />
            <stop offset="100%" stopColor="rgba(109,40,217,0)" />
          </radialGradient>
          <radialGradient id="featured-jhighlight" cx="38%" cy="28%" r="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Glow halo — brighter on hover or jet */}
        <ellipse
          cx={r}
          cy={bellH * 0.5}
          rx={r * 1.35}
          ry={bellH * 0.8}
          fill="url(#featured-jglow)"
          opacity={hovered || jetting ? 0.95 : 0.6}
          style={{ transition: 'opacity 0.3s ease-out' }}
        />

        {/* Bell */}
        <path
          d={`M ${r * 0.05},${bellH} Q 0,${bellH * 0.3} ${r},0 Q ${size},${bellH * 0.3} ${size * 0.95},${bellH} Q ${r},${bellH * 1.12} ${r * 0.05},${bellH} Z`}
          fill="url(#featured-jbell)"
          stroke="rgba(196,181,253,0.65)"
          strokeWidth="1"
        />

        {/* Highlight */}
        <path
          d={`M ${r * 0.3},${bellH * 0.7} Q ${r * 0.22},${bellH * 0.3} ${r * 0.55},${bellH * 0.05} Q ${r * 0.7},${bellH * 0.25} ${r * 0.62},${bellH * 0.72} Z`}
          fill="url(#featured-jhighlight)"
        />

        {/* Tentacles — hover speeds wobble */}
        {tentacles.map((t) => (
          <path
            key={t.i}
            className={`featured-tentacle ${hovered ? 'is-hovered' : ''} ${jetting ? 'is-jetting' : ''}`}
            d={`M ${t.startX},${t.startY} C ${t.cp1X},${t.cp1Y} ${t.cp2X},${t.cp2Y} ${t.endX},${t.endY}`}
            stroke="rgba(196,181,253,0.75)"
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
            style={{ animationDelay: `${t.i * -0.6}s` }}
          />
        ))}

        {/* Jet bubbles — emitted on click */}
        {jetting &&
          !prefersReduced &&
          [0, 1, 2, 3].map((i) => (
            <circle
              key={`bubble-${i}`}
              className="jet-bubble"
              cx={r + (i - 1.5) * 6}
              cy={totalH}
              r={2 + (i % 2)}
              fill="rgba(165,243,252,0.85)"
              stroke="rgba(34,211,238,0.6)"
              strokeWidth="0.5"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
      </svg>

      <style jsx>{`
        .featured-tentacle {
          animation: tentacle-sway 3s ease-in-out infinite alternate;
          transform-origin: top center;
        }
        .featured-tentacle.is-hovered {
          animation-duration: 1.1s;
        }
        .featured-tentacle.is-jetting {
          animation-duration: 0.5s;
        }
        @keyframes tentacle-sway {
          0%   { transform: skewX(-5deg) scaleX(0.94); }
          100% { transform: skewX(5deg)  scaleX(1.06); }
        }
        .jet-bubble {
          animation: jet-rise 0.9s ease-out forwards;
          opacity: 0;
        }
        @keyframes jet-rise {
          0%   { transform: translateY(0) scale(0.6); opacity: 0.9; }
          100% { transform: translateY(60px) scale(1.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .featured-tentacle, .jet-bubble { animation: none !important; }
        }
      `}</style>
    </motion.button>
  );
}

function Slide1() {
  return (
    <SlideWrapper id="slide-0">
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
      {/* Ambient jellyfish — behind the text */}
      <JellyfishLayer />
      {/* Featured jellyfish — foreground, interactive */}
      <FeaturedJellyfish />

      <span
        aria-hidden
        className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-widest text-cyan-400/50"
      >
        ◢ system.online ◣
      </span>

      <HologramEyebrow>BEGINNER → INTERMEDIATE</HologramEyebrow>

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
        <p className="mt-3 text-sm text-zinc-300 sm:text-lg md:text-xl">
          What AI-native actually means — and how to ship it
        </p>
      </C>

      {/* Data-stream tagline block — cyberpunk-underwater terminal card.
          Replaces three loose colored lines that felt visually unrelated. */}
      <C>
        <div
          className="mt-4 relative z-10 inline-flex w-full max-w-2xl flex-col gap-1.5 rounded-lg border px-4 py-3 font-mono text-xs sm:text-sm"
          style={{
            borderColor: 'rgba(34,211,238,0.35)',
            background: 'linear-gradient(135deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            boxShadow: '0 0 24px rgba(34,211,238,0.08), inset 0 0 20px rgba(6,182,212,0.05)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <span
            aria-hidden
            className="absolute -top-2 left-3 px-1.5 font-mono text-[9px] uppercase tracking-widest"
            style={{ color: 'rgba(165,243,252,0.85)', background: 'rgba(9,9,17,0.95)' }}
          >
            ◈ signal
          </span>

          <div className="flex items-start gap-2">
            <span className="select-none text-cyan-400/80">&gt;</span>
            <span className="text-zinc-200">A framework from building <span className="text-fuchsia-300">Reporium</span></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="select-none text-cyan-400/80">&gt;</span>
            <span className="text-cyan-200">a tool for AI practitioners to evaluate AI development tools trusted by developers</span>
          </div>
          <div className="mt-1 flex items-start gap-2 border-t border-cyan-500/20 pt-2">
            <span className="select-none text-fuchsia-400/80">◇</span>
            <span className="text-zinc-300">
              Developed by <span className="font-bold text-cyan-200">Kim Loza</span>
              <span className="text-zinc-500"> — AI Systems Builder &amp; Developer Advocate</span>
            </span>
          </div>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 2 — WHY THIS MATTERS (failures flip to Reporium learnings) ────────

// ─── Slide 2 infographics (one per failure card) ─────────────────────────────
function FailureInfographic({ kind, className = '' }: { kind: string; className?: string }) {
  // Larger, more legible infographics. 200x100 viewBox gives more room for
  // labels at readable sizes (10-12px). Thicker strokes, higher contrast.
  const svg = {
    viewBox: '0 0 200 100',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const textStyle = {
    fill: 'currentColor',
    stroke: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontWeight: 600,
  };

  if (kind === 'hallucination') {
    // claim → cited source (check badge)
    return (
      <svg {...svg} className={className} aria-hidden>
        <rect x="6" y="36" width="58" height="28" rx="4" />
        <text x="35" y="54" fontSize="11" textAnchor="middle" {...textStyle}>claim</text>
        <path d="M66 50 L120 50" strokeDasharray="4 3" />
        <path d="M112 44 L120 50 L112 56" />
        <rect x="122" y="34" width="60" height="32" rx="4" />
        <text x="152" y="47" fontSize="10" textAnchor="middle" {...textStyle}>source</text>
        <text x="152" y="60" fontSize="9" textAnchor="middle" {...textStyle} opacity="0.75">[cited]</text>
        <circle cx="184" cy="18" r="10" />
        <path d="M179 18 L183 22 L189 14" strokeWidth="2.5" />
      </svg>
    );
  }
  if (kind === 'stale citation') {
    // fresh-vs-stale timestamp compare
    return (
      <svg {...svg} className={className} aria-hidden>
        <circle cx="24" cy="50" r="18" />
        <path d="M24 36 L24 50 L34 50" strokeWidth="2.5" />
        <text x="54" y="30" fontSize="10" {...textStyle} opacity="0.55">v0.28 · 14 mo</text>
        <line x1="52" y1="26" x2="124" y2="32" strokeWidth="2" opacity="0.7" />
        <text x="54" y="58" fontSize="10" {...textStyle}>enriched</text>
        <text x="54" y="74" fontSize="10" {...textStyle}>3 days ago</text>
        <circle cx="146" cy="70" r="7" />
        <path d="M142 70 L145 73 L151 66" strokeWidth="2.5" />
        <rect x="160" y="20" width="34" height="60" rx="3" opacity="0.4" />
        <path d="M166 32 L188 32 M166 44 L188 44 M166 56 L188 56 M166 68 L188 68" opacity="0.4" />
      </svg>
    );
  }
  if (kind === 'confident but wrong') {
    // same input → same output (determinism)
    return (
      <svg {...svg} className={className} aria-hidden>
        <rect x="6" y="14" width="50" height="22" rx="3" />
        <text x="31" y="29" fontSize="10" textAnchor="middle" {...textStyle}>query</text>
        <rect x="6" y="64" width="50" height="22" rx="3" />
        <text x="31" y="79" fontSize="10" textAnchor="middle" {...textStyle}>query</text>
        <path d="M58 25 L96 42" strokeDasharray="4 3" />
        <path d="M58 75 L96 58" strokeDasharray="4 3" />
        <rect x="96" y="38" width="32" height="24" rx="3" />
        <text x="112" y="55" fontSize="14" textAnchor="middle" {...textStyle}>=</text>
        <path d="M130 50 L152 50" strokeDasharray="4 3" />
        <path d="M144 44 L152 50 L144 56" />
        <rect x="152" y="34" width="46" height="32" rx="3" />
        <text x="175" y="54" fontSize="10" textAnchor="middle" {...textStyle}>answer</text>
      </svg>
    );
  }
  // 'the pattern' — team of devs blocked at senior-dev gate, graph opens parallel path
  return (
    <svg {...svg} className={className} aria-hidden>
      <circle cx="18" cy="22" r="6" />
      <circle cx="18" cy="50" r="6" />
      <circle cx="18" cy="78" r="6" />
      <line x1="24" y1="22" x2="82" y2="46" strokeDasharray="3 3" />
      <line x1="24" y1="50" x2="82" y2="50" strokeDasharray="3 3" />
      <line x1="24" y1="78" x2="82" y2="54" strokeDasharray="3 3" />
      <ellipse cx="100" cy="50" rx="18" ry="12" opacity="0.55" />
      <text x="100" y="53" fontSize="9" textAnchor="middle" {...textStyle}>sr dev</text>
      <path d="M120 50 L144 50" strokeWidth="2.5" />
      <path d="M136 44 L144 50 L136 56" />
      <rect x="146" y="22" width="50" height="56" rx="4" />
      <text x="171" y="34" fontSize="9" textAnchor="middle" {...textStyle}>graph</text>
      <circle cx="158" cy="52" r="2.5" fill="currentColor" />
      <circle cx="184" cy="48" r="2.5" fill="currentColor" />
      <circle cx="170" cy="68" r="2.5" fill="currentColor" />
      <line x1="158" y1="52" x2="184" y2="48" />
      <line x1="158" y1="52" x2="170" y2="68" />
      <line x1="184" y1="48" x2="170" y2="68" />
    </svg>
  );
}

// Small red-tinted "problem" infographic for the FRONT of each card — shows
// the failure visually so the un-flipped state carries a graphic payload.
// Distinct from FailureInfographic (which shows the Reporium fix on the back).
function ProblemInfographic({ kind, className = '' }: { kind: string; className?: string }) {
  const svg = {
    viewBox: '0 0 200 80',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const textStyle = {
    fill: 'currentColor',
    stroke: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontWeight: 600,
  };
  if (kind === 'hallucination') {
    // claim with no backing source (broken chain)
    return (
      <svg {...svg} className={className} aria-hidden>
        <rect x="6" y="28" width="58" height="24" rx="4" />
        <text x="35" y="44" fontSize="10" textAnchor="middle" {...textStyle}>claim</text>
        <path d="M66 40 L104 40" strokeDasharray="3 3" />
        <line x1="110" y1="28" x2="132" y2="52" strokeWidth="2.5" />
        <line x1="132" y1="28" x2="110" y2="52" strokeWidth="2.5" />
        <rect x="142" y="28" width="52" height="24" rx="4" opacity="0.45" strokeDasharray="3 3" />
        <text x="168" y="44" fontSize="10" textAnchor="middle" {...textStyle} opacity="0.55">no source</text>
      </svg>
    );
  }
  if (kind === 'stale citation') {
    // expired clock / timestamp
    return (
      <svg {...svg} className={className} aria-hidden>
        <circle cx="22" cy="40" r="16" />
        <path d="M22 28 L22 40 L32 40" strokeWidth="2.5" />
        <line x1="10" y1="52" x2="34" y2="28" strokeWidth="2.5" />
        <text x="48" y="32" fontSize="10" {...textStyle}>v0.28 API</text>
        <text x="48" y="50" fontSize="9" {...textStyle} opacity="0.7">deprecated</text>
        <text x="48" y="64" fontSize="9" {...textStyle} opacity="0.7">14 months ago</text>
        <rect x="150" y="20" width="42" height="42" rx="3" opacity="0.4" />
        <line x1="156" y1="26" x2="186" y2="56" strokeWidth="2" opacity="0.55" />
        <line x1="186" y1="26" x2="156" y2="56" strokeWidth="2" opacity="0.55" />
      </svg>
    );
  }
  if (kind === 'confident but wrong') {
    // green check on a broken formula
    return (
      <svg {...svg} className={className} aria-hidden>
        <rect x="6" y="24" width="82" height="32" rx="4" />
        <text x="47" y="38" fontSize="9" textAnchor="middle" {...textStyle}>tax(100)</text>
        <text x="47" y="50" fontSize="9" textAnchor="middle" {...textStyle} opacity="0.7">= 7.5 ✗</text>
        <path d="M92 40 L120 40" strokeDasharray="3 3" />
        <path d="M114 34 L120 40 L114 46" />
        <circle cx="138" cy="40" r="12" />
        <path d="M132 40 L136 44 L144 34" strokeWidth="2.5" />
        <text x="160" y="44" fontSize="10" {...textStyle}>PASS</text>
      </svg>
    );
  }
  // 'the pattern' — team funneled to a single gate; work piles up behind it
  return (
    <svg {...svg} className={className} aria-hidden>
      {/* team members on the left */}
      <circle cx="14" cy="18" r="4" />
      <circle cx="14" cy="40" r="4" />
      <circle cx="14" cy="62" r="4" />
      <line x1="19" y1="18" x2="72" y2="36" strokeDasharray="3 3" />
      <line x1="19" y1="40" x2="72" y2="40" strokeDasharray="3 3" />
      <line x1="19" y1="62" x2="72" y2="44" strokeDasharray="3 3" />
      {/* gate — wider oval with label inside, reserved height */}
      <ellipse cx="92" cy="40" rx="20" ry="14" />
      <text x="92" y="43" fontSize="10" textAnchor="middle" {...textStyle}>sr dev</text>
      {/* backlog piled up behind the gate on the right */}
      <path d="M114 40 L140 40" strokeDasharray="3 3" opacity="0.55" />
      <path d="M134 36 L140 40 L134 44" opacity="0.55" />
      <rect x="142" y="20" width="48" height="14" rx="2" opacity="0.55" />
      <rect x="142" y="38" width="48" height="14" rx="2" opacity="0.4" strokeDasharray="3 3" />
      <rect x="142" y="56" width="48" height="14" rx="2" opacity="0.3" strokeDasharray="3 3" />
      <text x="166" y="30" fontSize="9" textAnchor="middle" {...textStyle}>queued</text>
    </svg>
  );
}

// Back face of Slide 2 FlipCards: title + large infographic by default, with
// a controlled expand toggle (state lifted to Slide2 so only one back can be
// expanded at a time). Expanded state grows the card into a taller rectangle
// so the sub-line has room without overlapping the infographic.
function Slide2Back({
  tag,
  backTitle,
  backSub,
  expanded,
  onToggleExpand,
}: {
  tag: string;
  backTitle: string;
  backSub: string;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden p-3 sm:p-4"
      style={{ borderRadius: '0.75rem', border: '1px solid rgba(34,211,238,0.45)', background: 'rgba(6,24,36,0.92)' }}
    >
      <ClickBubble label={expanded ? 'collapse' : 'details'} accent="cyan" />
      <p
        className="pr-16 text-sm font-bold leading-tight text-cyan-100 sm:text-base"
        style={{ textShadow: '0 0 8px rgba(34,211,238,0.35)' }}
      >
        {backTitle}
      </p>
      <div className="mt-2 flex min-h-0 flex-1 items-center justify-center">
        <FailureInfographic
          kind={tag}
          className={`w-full text-cyan-300 ${expanded ? 'max-h-28' : 'max-h-20 sm:max-h-24'}`}
        />
      </div>
      {expanded && (
        <p className="mt-2 text-[11px] leading-snug text-zinc-200 sm:text-xs">{backSub}</p>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        className="mt-2 inline-flex items-center gap-1 self-start rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400/20 sm:text-[11px]"
        aria-expanded={expanded}
      >
        <span>{expanded ? '− hide details' : '+ how it works'}</span>
      </button>
    </div>
  );
}

function Slide2() {
  const items = [
    {
      tag: 'hallucination',
      snippet: 'from langchain.agents import load_agent  # ← does not exist',
      why: 'Plausible import. Confident tone. Wrong.',
      // Back of card: per-card title tied to the front's problem + what made
      // the fix actually work, in developer voice.
      backTitle: 'Citations catch hallucinations',
      backSub: 'Every /ask answer in Reporium cites the repos it used. No citation → flagged in the UI.',
    },
    {
      tag: 'stale citation',
      snippet: 'cites OpenAI v0.28 API — deprecated 14 months ago',
      why: 'Training data frozen. No freshness signal on the claim.',
      backTitle: 'Timestamps catch staleness',
      backSub: 'Every repo carries last-commit + last-enriched. Past threshold? Re-enrich triggers before serving.',
    },
    {
      tag: 'confident but wrong',
      snippet: 'expect(calc.tax(100)).toBe(7.5)  // PASSES — but formula is wrong',
      why: 'Green tests. Broken logic. Nobody caught it in review.',
      backTitle: 'Determinism beats vibes',
      backSub: 'Evaluations return structured signals. Same query → same answer. Re-runnable, review-friendly.',
    },
    {
      tag: 'the pattern',
      snippet: 'one senior dev gates "should we try X?" for the whole team',
      why: 'No standard way to evaluate. Velocity bottlenecks on one person.',
      backTitle: 'Knowledge graph breaks the bottleneck',
      backSub: 'Structured pros, cons, best-for — any team member can query. Senior dev reviews, not gates.',
    },
  ];

  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  return (
    <SlideWrapper id="slide-1">
      <HologramEyebrow>◤ FRAME·02 // WHY THIS MATTERS</HologramEyebrow>
      <C>
        <h2
          className="mt-2 font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.3rem, 3.8vw + 0.8svh, 2.8rem)' }}
        >
          Every week, another &ldquo;game-changing&rdquo; AI dev tool
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-sm text-zinc-400 sm:text-lg">
          Recommendation fatigue is real. Trust is built off what developers can verify.
        </p>
      </C>

      <C>
        <div className="mt-3 grid grid-cols-1 items-start gap-2.5 sm:mt-5 sm:gap-3 md:grid-cols-2 md:auto-rows-min">
          {items.map(({ tag, snippet, why, backTitle, backSub }, idx) => {
            const isPattern = tag === 'the pattern';
            const borderColor = isPattern ? 'rgba(217,70,239,0.35)' : 'rgba(239,68,68,0.30)';
            const tagColor = isPattern ? 'text-fuchsia-400' : 'text-red-400';
            const iconColor = isPattern ? 'text-fuchsia-400/70' : 'text-red-400/70';
            const problemColor = isPattern ? 'text-fuchsia-400/80' : 'text-red-400/80';
            const frontGradient = isPattern
              ? 'linear-gradient(135deg, rgba(30,6,40,0.55), rgba(6,0,14,0.75))'
              : 'linear-gradient(135deg, rgba(60,8,8,0.55), rgba(12,0,0,0.75))';
            const frontGlow = isPattern
              ? '0 0 24px rgba(217,70,239,0.08), inset 0 0 22px rgba(217,70,239,0.05)'
              : '0 0 24px rgba(239,68,68,0.08), inset 0 0 22px rgba(239,68,68,0.05)';
            const nodeTickColor = isPattern ? 'rgba(217,70,239,0.7)' : 'rgba(239,68,68,0.7)';
            const nodeLabel = `NODE·0${idx + 1}`;
            const isExpanded = expandedTag === tag;
            return (
              <FlipCard
                key={tag}
                ariaLabel={`${tag} — tap to see how Reporium fixed it`}
                minHeight={isExpanded ? '17rem' : '12.5rem'}
                onFlipChange={(flipped) => {
                  // When the card flips back to its front face, collapse it
                  // so the unflipped card never shows the expanded height.
                  if (!flipped && isExpanded) {
                    setExpandedTag(null);
                  }
                }}
                front={
                  <div
                    className="relative flex h-full flex-col overflow-hidden p-3 sm:p-4"
                    style={{ borderRadius: '0.75rem', border: `1px solid ${borderColor}`, background: frontGradient, boxShadow: frontGlow }}
                  >
                    <span aria-hidden className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] tracking-widest" style={{ color: nodeTickColor }}>◤ {nodeLabel}</span>
                    <ClickBubble label="flip" />
                    <div className="mt-4 flex items-center gap-2 sm:mt-5">
                      {isPattern ? (
                        <span className="font-mono text-sm">⚠</span>
                      ) : (
                        <IconX className={`h-3.5 w-3.5 ${iconColor}`} />
                      )}
                      <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${tagColor} sm:text-xs`}>
                        {tag}
                      </span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-black/50 px-2 py-1.5 font-mono text-[10px] leading-snug text-zinc-200 sm:text-[11px]">
                      {snippet}
                    </pre>
                    <p className="mt-1.5 text-[11px] italic text-zinc-400 sm:text-xs">{why}</p>
                    <div className="mt-auto flex min-h-0 flex-1 items-end justify-center pt-2">
                      <ProblemInfographic
                        kind={tag}
                        className={`w-full max-h-16 sm:max-h-20 ${problemColor}`}
                      />
                    </div>
                  </div>
                }
                back={
                  <Slide2Back
                    tag={tag}
                    backTitle={backTitle}
                    backSub={backSub}
                    expanded={isExpanded}
                    onToggleExpand={() => setExpandedTag((t) => (t === tag ? null : tag))}
                  />
                }
              />
            );
          })}
        </div>
      </C>

      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ this is why I architected Reporium to be AI-native
          </span>
          <span className="opacity-70">sys::why</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 3 — THE AI-NATIVE TEST (layered diagram, click to reveal Q+A) ─────

function Slide3() {
  const layers = [
    {
      num: '01',
      name: 'Intelligence layer',
      color: '#f0abfc',
      border: 'rgba(217,70,239,0.45)',
      bg: 'rgba(60,10,70,0.55)',
      q: 'Does AI change the outcome — or just the interface?',
      a: "If removing the AI leaves the product intact, you added AI. You didn't build AI-native.",
    },
    {
      num: '02',
      name: 'Semantic layer',
      color: '#67e8f9',
      border: 'rgba(34,211,238,0.45)',
      bg: 'rgba(8,40,56,0.55)',
      q: 'Is retrieval by meaning — or by strings?',
      a: 'AI-native products understand queries semantically. Exact-match search is not AI-native retrieval.',
    },
    {
      num: '03',
      name: 'Agent-accessible layer',
      color: '#c084fc',
      border: 'rgba(147,51,234,0.45)',
      bg: 'rgba(32,12,56,0.55)',
      q: 'Can an agent call it directly — or must it scrape your UI?',
      a: 'AI-native products expose typed, documented endpoints any agent can invoke. If the only client is a browser, agents are shut out.',
    },
    {
      num: '04',
      name: 'Compounding layer',
      color: '#6ee7b7',
      border: 'rgba(52,211,153,0.45)',
      bg: 'rgba(8,42,28,0.55)',
      q: 'Does the product get smarter with use?',
      a: 'AI-native products compound. Every query, every edge, every interaction makes the next one better.',
    },
  ];

  return (
    <SlideWrapper id="slide-2">
      <HologramEyebrow>◤ FRAME·03 // THE TEST</HologramEyebrow>
      <C>
        <h2
          className="font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.4rem, 4vw + 0.8svh, 3rem)' }}
        >
          The AI-Native Test: 4 Layers
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-xs text-zinc-400 sm:text-base">
          Click a layer to reveal the question &amp; answer. Pass all four — you&rsquo;re AI-native.
        </p>
      </C>

      <C>
        <div className="mt-4 sm:mt-6 flex flex-col gap-2 sm:gap-2.5 w-full max-w-3xl mx-auto">
          {layers.map(({ num, name, color, border, bg, q, a }) => (
            <FlipCard
              key={num}
              ariaLabel={`${name} — tap to reveal question`}
              minHeight="4.25rem"
              front={
                <div
                  className="relative flex h-full items-center gap-3 overflow-hidden px-4 py-3 sm:px-5 sm:py-4"
                  style={{ borderRadius: '0.75rem', border: `1px solid ${border}`, background: bg }}
                >
                  {/* Left accent stripe — signals depth without breaking grid */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: color, opacity: 0.85 }}
                  />
                  <span
                    className="font-mono text-2xl font-black leading-none sm:text-3xl"
                    style={{ color, textShadow: `0 0 10px ${color}` }}
                  >
                    {num}
                  </span>
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.15em] sm:text-sm" style={{ color }}>
                    {name}
                  </span>
                  <ClickBubble label="tap" corner="tr" accent="cyan" />
                </div>
              }
              back={
                <div
                  className="relative flex h-full flex-col justify-center overflow-hidden px-4 py-2.5 sm:px-5 sm:py-3"
                  style={{ borderRadius: '0.75rem', border: `1px solid ${border}`, background: bg }}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: color, opacity: 0.85 }}
                  />
                  <p className="text-xs font-semibold text-zinc-100 sm:text-sm">{q}</p>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-300 sm:text-xs">{a}</p>
                </div>
              }
            />
          ))}
        </div>
      </C>

      <C>
        <p className="mt-3 text-[11px] text-zinc-500 sm:text-xs text-center">
          Four layers, one stack. Pass all four — you&rsquo;re AI-native.
        </p>
      </C>

      {/* Footer strip — cyberpunk terminal tag */}
      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ four questions · one answer
          </span>
          <span className="opacity-70">sys::test</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 4 — AI-NATIVE vs AI-ADDED (flip to examples) ──────────────────────

// Brand logo marks — small inline-SVG glyphs that read as a product icon.
// Not real trademarks, just recognizable silhouettes so the examples land
// faster than a plain monogram.
function BrandLogo({ kind, className = '' }: { kind: string; className?: string }) {
  const svg = {
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    // ── AI-Added ──
    case 'crm':
      // database + chat bubble bolted on
      return (
        <svg {...svg} className={className} aria-hidden>
          <ellipse cx="11" cy="9" rx="7" ry="2.5" />
          <path d="M4 9 V22 A7 2.5 0 0 0 18 22 V9" />
          <path d="M4 15.5 A7 2.5 0 0 0 18 15.5" />
          <path d="M20 6 H29 V14 H26 L23 17 V14 H20 Z" />
          <circle cx="23" cy="10" r="0.8" fill="currentColor" />
          <circle cx="26" cy="10" r="0.8" fill="currentColor" />
        </svg>
      );
    case 'copilot':
      // code braces with a sparkle (sidebar LLM)
      return (
        <svg {...svg} className={className} aria-hidden>
          <path d="M12 6 Q7 6 7 11 Q7 16 4 16 Q7 16 7 21 Q7 26 12 26" />
          <path d="M20 6 Q25 6 25 11 Q25 16 28 16 Q25 16 25 21 Q25 26 20 26" />
          <path d="M16 11 L16 17 M13 14 L19 14" strokeWidth="2" />
          <path d="M23 21 L24 23 L26 24 L24 25 L23 27 L22 25 L20 24 L22 23 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'docs-ai':
      // book with a spark above
      return (
        <svg {...svg} className={className} aria-hidden>
          <path d="M6 8 C9 7 13 7 16 9 C19 7 23 7 26 8 V24 C23 23 19 23 16 25 C13 23 9 23 6 24 Z" />
          <line x1="16" y1="9" x2="16" y2="25" />
          <path d="M16 3 L17 5 L19 6 L17 7 L16 9 L15 7 L13 6 L15 5 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'chat-summary':
      // chat bubble with condensed lines
      return (
        <svg {...svg} className={className} aria-hidden>
          <path d="M4 8 H26 A2 2 0 0 1 28 10 V20 A2 2 0 0 1 26 22 H12 L6 27 V22 A2 2 0 0 1 4 20 Z" />
          <line x1="9" y1="13" x2="23" y2="13" />
          <line x1="9" y1="17" x2="19" y2="17" />
          <line x1="9" y1="21" x2="15" y2="21" />
        </svg>
      );
    // ── AI-Native ──
    case 'perplexity':
      // orbits / search ring
      return (
        <svg {...svg} className={className} aria-hidden>
          <circle cx="16" cy="16" r="9" />
          <ellipse cx="16" cy="16" rx="9" ry="3.5" />
          <ellipse cx="16" cy="16" rx="3.5" ry="9" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'cursor':
      // arrow cursor + code block
      return (
        <svg {...svg} className={className} aria-hidden>
          <path d="M8 5 L8 21 L12 17 L14 22 L17 21 L15 16 L21 16 Z" fill="currentColor" stroke="none" />
          <rect x="20" y="20" width="9" height="8" rx="1.5" />
          <path d="M22 23 L24 24.5 L22 26 M26 26 H27.5" strokeWidth="1.4" />
        </svg>
      );
    case 'midjourney':
      // stylized sailboat (Midjourney's mark is a paper-ship silhouette)
      return (
        <svg {...svg} className={className} aria-hidden>
          <path d="M16 4 L16 22" strokeWidth="2" />
          <path d="M16 6 L25 20 L16 20 Z" />
          <path d="M16 9 L9 20 L16 20 Z" />
          <path d="M4 22 Q8 25 12 23 Q16 25 20 23 Q24 25 28 22" strokeWidth="1.75" />
        </svg>
      );
    case 'reporium':
      // jellyfish with glasses holding a book — Reporium's mark
      return (
        <svg {...svg} className={className} aria-hidden>
          {/* bell */}
          <path d="M5 14 Q5 6 16 6 Q27 6 27 14 Q27 16 25 16 L7 16 Q5 16 5 14 Z" />
          {/* glasses */}
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="20" cy="12" r="2.2" />
          <line x1="14.2" y1="12" x2="17.8" y2="12" />
          {/* tentacles */}
          <path d="M8 16 Q7 20 9 22 Q7 24 9 26" strokeWidth="1.4" />
          <path d="M13 16 Q12 20 14 22 Q12 24 14 26" strokeWidth="1.4" />
          <path d="M19 16 Q18 20 20 22 Q18 24 20 26" strokeWidth="1.4" />
          <path d="M24 16 Q23 20 25 22 Q23 24 25 26" strokeWidth="1.4" />
          {/* book in tentacles */}
          <rect x="13.5" y="20.5" width="5" height="4" rx="0.5" fill="currentColor" stroke="none" opacity="0.85" />
          <line x1="16" y1="20.5" x2="16" y2="24.5" stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" />
        </svg>
      );
    default:
      return null;
  }
}

// Example chip — brand logo + name + one-line pitch.
// Cyberpunk-styled card that uses a recognizable SVG glyph instead of a
// plain monogram, so the brand lands visually before you read the label.
function ExampleChip({
  logo,
  name,
  pitch,
  accent,
}: {
  logo: string;
  name: string;
  pitch: string;
  accent: 'red' | 'fuchsia';
}) {
  const palette =
    accent === 'red'
      ? {
          frame: 'rgba(239,68,68,0.45)',
          logoColor: 'text-red-200',
          logoBg: 'bg-red-500/10 border-red-500/40',
          nameColor: 'text-red-100',
          glow: '0 0 12px rgba(239,68,68,0.15), inset 0 0 16px rgba(239,68,68,0.06)',
          bg: 'linear-gradient(135deg, rgba(40,4,4,0.6), rgba(12,0,0,0.75))',
        }
      : {
          frame: 'rgba(217,70,239,0.5)',
          logoColor: 'text-fuchsia-200',
          logoBg: 'bg-fuchsia-500/10 border-fuchsia-500/40',
          nameColor: 'text-fuchsia-100',
          glow: '0 0 14px rgba(217,70,239,0.18), inset 0 0 16px rgba(217,70,239,0.08)',
          bg: 'linear-gradient(135deg, rgba(30,6,40,0.65), rgba(6,0,14,0.75))',
        };
  return (
    <div
      className="relative flex items-start gap-2.5 overflow-hidden rounded-lg border p-2.5"
      style={{ borderColor: palette.frame, background: palette.bg, boxShadow: palette.glow }}
    >
      {/* tiny corner bracket — cyberpunk HUD accent */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-1.5 top-1.5 font-mono text-[8px] tracking-widest opacity-40"
        style={{ color: accent === 'red' ? '#fca5a5' : '#f0abfc' }}
      >
        ◢
      </span>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${palette.logoBg} ${palette.logoColor}`}
      >
        <BrandLogo kind={logo} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className={`font-mono text-[11px] font-bold uppercase tracking-wider sm:text-xs ${palette.nameColor}`}>
          {name}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-100 sm:text-xs">{pitch}</p>
      </div>
    </div>
  );
}

// Tiny pictograph per front-side bullet — replaces a plain list row
// with a visual marker, making both panels feel denser and more symmetric.
function RowPictograph({ kind, className = '' }: { kind: string; className?: string }) {
  const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'product-before':
      return (
        <svg {...svg} className={className} aria-hidden>
          <rect x="3" y="7" width="18" height="10" rx="2" />
          <path d="M7 7 V4 H17 V7" />
        </svg>
      );
    case 'layer-on-top':
      return (
        <svg {...svg} className={className} aria-hidden>
          <rect x="3" y="13" width="18" height="6" rx="1" />
          <rect x="6" y="5" width="12" height="6" rx="1" opacity="0.6" />
        </svg>
      );
    case 'remove-still-works':
      return (
        <svg {...svg} className={className} aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <line x1="6" y1="12" x2="18" y2="12" strokeDasharray="2 2" />
        </svg>
      );
    case 'humans-schema':
      return (
        <svg {...svg} className={className} aria-hidden>
          <rect x="4" y="5" width="16" height="4" rx="1" />
          <rect x="4" y="11" width="16" height="4" rx="1" />
          <rect x="4" y="17" width="16" height="4" rx="1" />
        </svg>
      );
    case 'improves-ux':
      return (
        <svg {...svg} className={className} aria-hidden>
          <path d="M4 18 L10 12 L14 15 L20 7" />
          <path d="M15 7 L20 7 L20 12" />
        </svg>
      );
    // native
    case 'architecture':
      return (
        <svg {...svg} className={className} aria-hidden>
          <polygon points="12 3 21 8 12 13 3 8 12 3" />
          <polyline points="3 13 12 18 21 13" />
          <polyline points="3 18 12 22 21 18" />
        </svg>
      );
    case 'remove-gone':
      return (
        <svg {...svg} className={className} aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="2" strokeDasharray="3 3" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case 'embedding-schema':
      return (
        <svg {...svg} className={className} aria-hidden>
          <circle cx="6" cy="6" r="1.5" fill="currentColor" />
          <circle cx="18" cy="6" r="1.5" fill="currentColor" />
          <circle cx="6" cy="18" r="1.5" fill="currentColor" />
          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <line x1="6" y1="6" x2="12" y2="12" />
          <line x1="18" y1="6" x2="12" y2="12" />
          <line x1="6" y1="18" x2="12" y2="12" />
          <line x1="18" y1="18" x2="12" y2="12" />
        </svg>
      );
    case 'intelligence-core':
      return (
        <svg {...svg} className={className} aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.5" />
        </svg>
      );
    case 'system-decides':
      return (
        <svg {...svg} className={className} aria-hidden>
          <rect x="3" y="9" width="18" height="12" rx="2" />
          <path d="M7 9 L7 6 A5 5 0 0 1 17 6 L17 9" />
        </svg>
      );
    default:
      return null;
  }
}

function Slide4() {
  const added = [
    { kind: 'product-before', text: 'Product existed before AI' },
    { kind: 'layer-on-top', text: 'AI is a feature layer on top' },
    { kind: 'remove-still-works', text: 'Remove AI → product still works' },
    { kind: 'humans-schema', text: 'Data model built for humans' },
    { kind: 'improves-ux', text: 'AI improves the experience' },
  ];
  const addedExamples = [
    { logo: 'crm', name: 'Legacy CRM + chatbot', pitch: 'Chat interface bolted onto a database designed for contacts.' },
    { logo: 'copilot', name: 'Copilot in a non-AI IDE', pitch: 'Editor core is unchanged. The LLM lives in a sidebar.' },
    { logo: 'docs-ai', name: '"Ask AI" on a docs site', pitch: 'Docs are still docs. The LLM is a toggle above the search bar.' },
    { logo: 'chat-summary', name: 'Summarize-thread in chat', pitch: 'Messaging works fine without it. Feature, not foundation.' },
  ];
  const native = [
    { kind: 'architecture', text: 'AI is the architecture, not a feature' },
    { kind: 'remove-gone', text: "Remove AI → product doesn't exist" },
    { kind: 'embedding-schema', text: 'Data model built for embeddings' },
    { kind: 'intelligence-core', text: 'Intelligence is the core value prop' },
    { kind: 'system-decides', text: 'Decisions made by the system, not UI' },
  ];
  const nativeExamples = [
    { logo: 'perplexity', name: 'Perplexity', pitch: 'Search IS the LLM. The product does not exist without it.' },
    { logo: 'cursor', name: 'Cursor', pitch: 'Editor designed around codegen. Codegen is not a plugin — it is the loop.' },
    { logo: 'midjourney', name: 'Midjourney', pitch: 'Prompt-to-image is the product. Remove the model — there is nothing left.' },
    { logo: 'reporium', name: 'Reporium', pitch: 'Knowledge graph + embeddings ARE the retrieval engine. No AI → no recommendations.' },
  ];

  return (
    <SlideWrapper id="slide-3">
      <HologramEyebrow>◤ FRAME·04 // COMPARE</HologramEyebrow>
      <C>
        <h2
          className="mt-2 font-black"
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
        <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:mt-6 sm:gap-4 sm:grid-cols-2">
          {/* AI-Added */}
          <FlipCard
            ariaLabel="AI-Added — tap for examples"
            minHeight="22rem"
            front={
              <div
                className="relative flex h-full flex-col overflow-hidden p-4 sm:p-5"
                style={{
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(239,68,68,0.4)',
                  background: 'linear-gradient(135deg, rgba(60,8,8,0.55), rgba(12,0,0,0.75))',
                  boxShadow: '0 0 24px rgba(239,68,68,0.08), inset 0 0 22px rgba(239,68,68,0.05)',
                }}
              >
                {/* cyberpunk corner ticks */}
                <span aria-hidden className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] tracking-widest text-red-300/70">◤ NODE·01</span>
                <ClickBubble label="examples" accent="cyan" />
                <h3 className="mt-4 mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-red-400 sm:text-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                  AI-Added
                </h3>
                <ul className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 py-1">
                  {added.map(({ kind, text }) => (
                    <li key={text} className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-950/25 px-2.5 py-2 text-[11px] text-zinc-200 sm:text-xs">
                      <RowPictograph kind={kind} className="h-4 w-4 shrink-0 text-red-300" />
                      <span className="flex-1">{text}</span>
                      <IconX className="h-3 w-3 shrink-0 text-red-400/70" />
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-2 flex items-center justify-between rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-widest"
                  style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(0,0,0,0.45)', color: '#fca5a5' }}
                >
                  <span>&gt; pattern: bolt_on</span>
                  <span className="opacity-70">v·feature</span>
                </div>
              </div>
            }
            back={
              <div
                className="relative flex h-full flex-col overflow-hidden p-4 sm:p-5"
                style={{
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(239,68,68,0.55)',
                  background: 'linear-gradient(135deg, rgba(40,4,4,0.95), rgba(12,0,0,0.95))',
                  boxShadow: '0 0 28px rgba(239,68,68,0.18), inset 0 0 20px rgba(239,68,68,0.08)',
                }}
              >
                {/* scanline wash */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.05]"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,180,180,0.6) 0px, rgba(255,180,180,0.6) 1px, transparent 1px, transparent 3px)',
                  }}
                />
                <h3 className="relative mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-red-300 sm:text-xs">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                  {'// examples'}
                  <span className="ml-auto font-normal opacity-55">ai-added</span>
                </h3>
                <div className="relative grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  {addedExamples.map((ex) => (
                    <ExampleChip key={ex.name} {...ex} accent="red" />
                  ))}
                </div>
              </div>
            }
          />

          {/* AI-Native */}
          <FlipCard
            ariaLabel="AI-Native — tap for examples"
            minHeight="22rem"
            front={
              <div
                className="relative flex h-full flex-col overflow-hidden p-4 sm:p-5"
                style={{
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(217,70,239,0.4)',
                  background: 'linear-gradient(135deg, rgba(50,10,60,0.55), rgba(6,0,14,0.75))',
                  boxShadow: '0 0 26px rgba(217,70,239,0.16), inset 0 0 22px rgba(217,70,239,0.08)',
                }}
              >
                <span aria-hidden className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] tracking-widest text-fuchsia-300/70">◤ NODE·02</span>
                <ClickBubble label="examples" accent="cyan" />
                <h3 className="mt-4 mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-fuchsia-400 sm:text-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-fuchsia-400" />
                  AI-Native
                </h3>
                <ul className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 py-1">
                  {native.map(({ kind, text }) => (
                    <li key={text} className="flex items-center gap-2.5 rounded-lg border border-fuchsia-500/20 bg-fuchsia-950/25 px-2.5 py-2 text-[11px] text-zinc-100 sm:text-xs">
                      <RowPictograph kind={kind} className="h-4 w-4 shrink-0 text-fuchsia-300" />
                      <span className="flex-1">{text}</span>
                      <IconCheck className="h-3 w-3 shrink-0 text-fuchsia-400/80" />
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-2 flex items-center justify-between rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-widest"
                  style={{ borderColor: 'rgba(217,70,239,0.4)', background: 'rgba(0,0,0,0.45)', color: '#f0abfc' }}
                >
                  <span>&gt; pattern: core_loop</span>
                  <span className="opacity-70">v·foundation</span>
                </div>
              </div>
            }
            back={
              <div
                className="relative flex h-full flex-col overflow-hidden p-4 sm:p-5"
                style={{
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(217,70,239,0.6)',
                  background: 'linear-gradient(135deg, rgba(30,6,40,0.95), rgba(6,0,14,0.95))',
                  boxShadow: '0 0 30px rgba(217,70,239,0.22), inset 0 0 22px rgba(217,70,239,0.1)',
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.05]"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, rgba(240,171,252,0.6) 0px, rgba(240,171,252,0.6) 1px, transparent 1px, transparent 3px)',
                  }}
                />
                <h3 className="relative mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-300 sm:text-xs">
                  <span className="inline-block h-2 w-2 rounded-full bg-fuchsia-400" />
                  {'// examples'}
                  <span className="ml-auto font-normal opacity-55">ai-native</span>
                </h3>
                <div className="relative grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  {nativeExamples.map((ex) => (
                    <ExampleChip key={ex.name} {...ex} accent="fuchsia" />
                  ))}
                </div>
              </div>
            }
          />
        </div>
      </C>

      {/* Footer strip — replaces the redundant "tap either panel" subhead */}
      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ compare patterns
          </span>
          <span className="hidden text-zinc-400 sm:inline">tap panels</span>
          <span className="opacity-70">sys::compare</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 5 — MINIMAL STACK (all layers flip to Reporium learnings) ─────────

// Bubble-loop infographic — four layers orbit a central "loop" node with
// animated bubbles traveling along the cycle. Reinforces the "one loop"
// mental model before the user flips through individual layer cards.
function LoopBubbles({ className = '' }: { className?: string }) {
  // Compressed, wide loop pushed to the right of the slide so it never
  // sits behind the left-aligned title/subtitle. Nodes rendered as ovals
  // sized to their text; sublabels always sit below each oval.
  // Ellipse center: (530, 70), rx=210, ry=40. viewBox 800×150.
  const nodes = [
    // ask: top of loop — moved left toward center
    { label: 'ask',        sub: 'interface',    color: '#fde68a', cx: 580, cy: 36,  subBelow: true  },
    // understand: right of loop (0°)
    { label: 'understand', sub: 'semantic',     color: '#a5f3fc', cx: 740, cy: 70,  subBelow: true  },
    // retrieve: bottom-right — sublabel above the oval
    { label: 'retrieve',   sub: 'data',         color: '#86efac', cx: 619, cy: 106, subBelow: false },
    // reason: bottom-left — sublabel above the oval
    { label: 'reason',     sub: 'intelligence', color: '#f0abfc', cx: 441, cy: 106, subBelow: false },
  ];
  // Elliptical loop path (full ellipse drawn as 2 half-arcs for mpath support).
  const loopPath =
    'M320 70 A 210 40 0 1 1 740 70 A 210 40 0 1 1 320 70';
  // Oval geometry for nodes (wide enough to fit the longest label, "understand").
  const nodeRx = 44;
  const nodeRy = 14;
  return (
    <div className={className}>
      <svg
        viewBox="0 0 800 128"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <path id="loopPath" d={loopPath} />
          <radialGradient id="loopCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(232,121,249,0.4)" />
            <stop offset="100%" stopColor="rgba(232,121,249,0)" />
          </radialGradient>
        </defs>

        {/* loop track */}
        <use
          href="#loopPath"
          fill="none"
          stroke="rgba(165,243,252,0.35)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />

        {/* soft glow at loop center — kept subtle so title reads clearly */}
        <ellipse cx="530" cy="70" rx="160" ry="34" fill="url(#loopCenter)" opacity="0.6" />

        {/* flowing bubbles — 3 offset around the cycle */}
        {[0, 0.33, 0.66].map((begin) => (
          <circle key={begin} r="3.5" fill="#a5f3fc" opacity="0.9">
            <animateMotion dur="6s" repeatCount="indefinite" begin={`${begin * 6}s`}>
              <mpath href="#loopPath" />
            </animateMotion>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="6s" repeatCount="indefinite" begin={`${begin * 6}s`} />
          </circle>
        ))}

        {/* layer nodes as ovals — label inside; sublabel above or below per node */}
        {nodes.map(({ label, sub, color, cx, cy, subBelow }) => {
          const subY = subBelow ? cy + nodeRy + 14 : cy - nodeRy - 6;
          return (
            <g key={label}>
              {/* outer halo ring */}
              <ellipse cx={cx} cy={cy} rx={nodeRx + 6} ry={nodeRy + 5} fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
              {/* node body */}
              <ellipse cx={cx} cy={cy} rx={nodeRx} ry={nodeRy} fill="rgba(9,9,17,0.92)" stroke={color} strokeWidth="1.75" />
              {/* label inside oval */}
              <text
                x={cx} y={cy + 4}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                fontSize="11"
                fontWeight="700"
                fill={color}
              >{label}</text>
              {/* sublabel */}
              <text
                x={cx} y={subY}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                fontSize="9"
                fontWeight="700"
                fill={color}
                opacity="0.85"
                letterSpacing="1.5"
              >{sub.toUpperCase()}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Slide5() {
  const layers = [
    {
      name: 'Intelligence Layer',
      tech: 'LLM API (model-agnostic — Claude, GPT, local)',
      desc: 'Answers, enrichment, classification',
      reporium: 'Model-agnostic endpoints. Swapped LLM providers twice without touching product code — the layer boundary held.',
      accent: '#f0abfc',
      border: 'rgba(217,70,239,0.4)',
      glow: 'rgba(217,70,239,0.15)',
    },
    {
      name: 'Semantic Layer',
      tech: 'Embeddings + Vector DB (pgvector, Pinecone)',
      desc: 'Understanding, not just matching',
      reporium: 'pgvector on Postgres. Same DB as structured repo data, so similarity joins with filters in one query. No second datastore.',
      accent: '#a5f3fc',
      border: 'rgba(34,211,238,0.4)',
      glow: 'rgba(34,211,238,0.15)',
    },
    {
      name: 'Data Layer',
      tech: 'Structured store + graph edges',
      desc: 'Relationships are the product',
      reporium: 'Typed edges (depends-on, similar-to, built-with) stored alongside nodes. Graph traversal and SQL filters compose — no ETL gap.',
      accent: '#86efac',
      border: 'rgba(134,239,172,0.4)',
      glow: 'rgba(134,239,172,0.1)',
    },
    {
      name: 'Interface Layer',
      tech: 'API-first (FastAPI, Next.js)',
      desc: 'Humans and agents both need access',
      reporium: 'Every UI route is backed by a public REST endpoint. Agents call the same API the web app calls. No scraping, no private contract.',
      accent: '#fde68a',
      border: 'rgba(253,230,138,0.4)',
      glow: 'rgba(253,230,138,0.08)',
    },
  ];

  const crossCutting = [
    {
      name: 'Trust',
      tech: 'Citations · provenance · freshness',
      desc: 'Every claim carries its sources',
      reporium: 'Every /ask response cites the exact repos used. If sources are stale, freshness timestamps surface in the UI — not buried in logs.',
    },
    {
      name: 'Orchestration',
      tech: 'Agents · tool-calling · pipelines',
      desc: 'Compose intelligence',
      reporium: 'MCP server + agent-callable tools. Nightly enrichment pipeline orchestrates classification → embedding → graph edges as a DAG.',
    },
    {
      name: 'Observability',
      tech: 'Traces · token cost · latency',
      desc: 'See what the model did',
      reporium: 'Sentry traces per /ask, token cost per request, p95 latency tracked in GCP. Every LLM call is replayable from trace ID.',
    },
    {
      name: 'Evals & Benchmarks',
      tech: 'Deterministic quality checks',
      desc: 'Re-runnable, not vibes',
      reporium: 'Golden-set regression tests — same query must return same top-3 repos. Deterministic pros/cons, not paraphrased generations.',
    },
  ];

  return (
    <SlideWrapper id="slide-4">
      {/* Header block — FRAME eyebrow + title + subtitle are left-aligned;
          the animated loop spans the full width behind them from the top
          of the eyebrow down. Mobile-first via aspect-ratio so the loop
          scales cleanly at every width without distortion. */}
      <C>
        <div className="relative w-full aspect-[800/128]">
          <LoopBubbles className="pointer-events-none absolute inset-0 z-0 opacity-90" />
          {/* Title column is constrained to the left ~55% so it never
              sits behind the loop nodes which live on the right half. */}
          <div className="relative z-10 flex h-full w-[58%] flex-col justify-center pr-3 text-left sm:w-[55%]">
            <HologramEyebrow>◤ FRAME·05 // MINIMAL STACK</HologramEyebrow>
            <h2
              className="mt-2 whitespace-nowrap font-black leading-tight"
              style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(0.95rem, 2.2vw + 0.4svh, 2.1rem)' }}
            >
              The Minimal AI-Native Stack
            </h2>
            <p className="mt-1.5 text-[11px] text-zinc-400 sm:text-sm md:text-base">
              You don&rsquo;t need much. You need the right things.
            </p>
          </div>
        </div>
      </C>

      <C>
        <div className="mt-1 flex flex-col gap-2 sm:gap-3">
          {layers.map(({ name, tech, desc, reporium, accent, border, glow }) => (
            <FlipCard
              key={name}
              ariaLabel={`${name} — tap for Reporium example`}
              minHeight="4.5rem"
              front={
                <div
                  className="relative flex h-full flex-col p-3 sm:flex-row sm:items-center sm:gap-6 sm:p-4"
                  style={{ borderRadius: '0.75rem', border: `1px solid ${border}`, background: 'rgba(9,9,17,0.75)', boxShadow: `0 0 18px ${glow}` }}
                >
                  <ClickBubble label="flip" />
                  <div className="flex items-center gap-3 sm:w-48">
                    <IconLayers className="h-4 w-4 shrink-0" style={{ color: accent }} />
                    <span className="font-mono text-xs font-bold sm:text-sm" style={{ color: accent }}>
                      {name}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-1 flex-col sm:mt-0 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-zinc-300 sm:text-sm">{tech}</span>
                    <span className="text-[10px] italic text-zinc-500 sm:text-xs sm:text-right">{desc}</span>
                  </div>
                </div>
              }
              back={
                <div
                  className="flex h-full flex-col justify-center p-3 sm:p-4"
                  style={{ borderRadius: '0.75rem', border: `1px solid ${border}`, background: 'rgba(18,6,24,0.92)' }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest sm:text-xs" style={{ color: accent }}>
                    Reporium — {name}
                  </span>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-100 sm:text-xs">{reporium}</p>
                </div>
              }
            />
          ))}
        </div>
      </C>

      <C>
        <div className="mt-3 sm:mt-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 sm:text-xs">
            + Cross-cutting — what keeps it trustworthy in production
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {crossCutting.map(({ name, tech, desc, reporium }) => (
              <FlipCard
                key={name}
                ariaLabel={`${name} — tap for Reporium example`}
                minHeight="8.5rem"
                front={
                  <div
                    className="relative flex h-full flex-col p-2.5 sm:p-3"
                    style={{ borderRadius: '0.5rem', border: '1px solid rgba(113,113,122,0.5)', background: 'rgba(24,24,32,0.6)' }}
                  >
                    <ClickBubble label="flip" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-200 sm:text-xs">
                      {name}
                    </span>
                    <span className="mt-1 text-[10px] text-zinc-400 sm:text-xs">{tech}</span>
                    <span className="mt-1 text-[9px] italic text-zinc-600 sm:text-[11px]">{desc}</span>
                  </div>
                }
                back={
                  <div
                    className="flex h-full flex-col justify-start overflow-y-auto p-2.5 sm:p-3"
                    style={{ borderRadius: '0.5rem', border: '1px solid rgba(217,70,239,0.45)', background: 'rgba(30,10,38,0.92)' }}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-300 sm:text-[10px]">
                      Reporium — {name}
                    </span>
                    <p className="mt-1 text-[10px] leading-snug text-zinc-100 sm:text-[11px]">{reporium}</p>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      </C>

      {/* Footer strip — cyberpunk terminal tag */}
      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ tap any layer for the Reporium version · four layers · one loop
          </span>
          <span className="opacity-70">sys::stack</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 6 — WHAT MAKES REPORIUM AI-NATIVE (architecture) ──────────────────

function Slide6() {
  return (
    <SlideWrapper id="slide-5">
      <HologramEyebrow>◤ FRAME·06 // ARCHITECTURE</HologramEyebrow>
      <C>
        <h2
          className="mt-2 font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.4rem, 4vw + 0.8svh, 3rem)' }}
        >
          What Makes Reporium AI-Native
        </h2>
      </C>
      <C>
        <p className="mt-1.5 text-xs text-zinc-400 sm:text-base">
          The same four layers — wired to real services. Three cross-cutting bands keep it trustworthy in production.
        </p>
      </C>

      <C className="mt-3">
        <ArchitectureDiagram />
      </C>

      {/* Footer — moves the "click any layer" hint out of the intro paragraph */}
      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ click any layer or band to zoom in
          </span>
          <span className="opacity-70">sys::architecture</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 7 — 4 MISTAKES (flip for fix + infographic) ───────────────────────

// Problem infographic — shows the anti-pattern visually (red/fuchsia).
function MistakeIcon({ kind, className = '' }: { kind: string; className?: string }) {
  const common = { viewBox: '0 0 120 80', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'model-first') {
    // A model (gear) is placed before the problem exists — the problem box is empty/question-mark.
    return (
      <svg {...common} className={className} aria-hidden>
        <g opacity="0.95">
          <circle cx="28" cy="40" r="16" />
          <circle cx="28" cy="40" r="5" fill="currentColor" opacity="0.25" />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const rad = (a * Math.PI) / 180;
            const x1 = 28 + Math.cos(rad) * 16;
            const y1 = 40 + Math.sin(rad) * 16;
            const x2 = 28 + Math.cos(rad) * 21;
            const y2 = 40 + Math.sin(rad) * 21;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        <text x="13" y="72" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace">MODEL</text>
        <path d="M56 40 L76 40" strokeDasharray="3 3" opacity="0.65" />
        <path d="M72 35 L76 40 L72 45" opacity="0.65" />
        <rect x="82" y="26" width="30" height="28" rx="2" strokeDasharray="2 3" opacity="0.6" />
        <text x="91" y="46" fontSize="18" fill="currentColor" stroke="none" fontWeight="700">?</text>
        <text x="85" y="72" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace">PROBLEM</text>
      </svg>
    );
  }
  if (kind === 'schema') {
    // Flat rows (traditional DB) forced through a funnel into vector space — misfit.
    return (
      <svg {...common} className={className} aria-hidden>
        <g>
          <rect x="8" y="18" width="32" height="8" rx="1" />
          <rect x="8" y="30" width="32" height="8" rx="1" />
          <rect x="8" y="42" width="32" height="8" rx="1" />
          <line x1="16" y1="22" x2="36" y2="22" opacity="0.4" />
          <line x1="16" y1="34" x2="36" y2="34" opacity="0.4" />
          <line x1="16" y1="46" x2="36" y2="46" opacity="0.4" />
        </g>
        <text x="10" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">rows</text>
        <path d="M44 22 L58 34 L44 46 Z" opacity="0.5" strokeDasharray="2 2" />
        <path d="M64 22 L78 22 L72 34 L78 46 L64 46" opacity="0.55" />
        <text x="48" y="66" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">no fit</text>
        <g opacity="0.9">
          <circle cx="92" cy="28" r="2.5" fill="currentColor" />
          <circle cx="104" cy="34" r="2.5" fill="currentColor" />
          <circle cx="96" cy="44" r="2.5" fill="currentColor" />
          <line x1="92" y1="28" x2="104" y2="34" opacity="0.4" />
          <line x1="104" y1="34" x2="96" y2="44" opacity="0.4" />
        </g>
        <text x="86" y="66" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">vectors</text>
      </svg>
    );
  }
  if (kind === 'feature') {
    // A product shell with an LLM badge bolted on — extractable/removable.
    return (
      <svg {...common} className={className} aria-hidden>
        <rect x="6" y="14" width="108" height="52" rx="3" />
        <line x1="6" y1="24" x2="114" y2="24" opacity="0.4" />
        <circle cx="12" cy="19" r="1.3" fill="currentColor" />
        <circle cx="17" cy="19" r="1.3" fill="currentColor" />
        <circle cx="22" cy="19" r="1.3" fill="currentColor" />
        <rect x="14" y="32" width="50" height="6" rx="1" opacity="0.4" />
        <rect x="14" y="42" width="38" height="6" rx="1" opacity="0.3" />
        <g>
          <rect x="74" y="32" width="32" height="22" rx="2" strokeDasharray="3 2" />
          <text x="80" y="46" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace">LLM</text>
          <path d="M108 30 L114 36 M114 30 L108 36" strokeWidth="2" />
        </g>
        <text x="6" y="76" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">remove AI → product still works</text>
      </svg>
    );
  }
  // 'verify'
  // Three claims, none cited — floating confidently in a void.
  return (
    <svg {...common} className={className} aria-hidden>
      <g>
        <rect x="8" y="12" width="70" height="12" rx="2" />
        <line x1="14" y1="18" x2="54" y2="18" opacity="0.4" />
        <text x="60" y="21" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">!</text>
      </g>
      <g>
        <rect x="8" y="30" width="70" height="12" rx="2" />
        <line x1="14" y1="36" x2="62" y2="36" opacity="0.4" />
        <text x="60" y="39" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">!</text>
      </g>
      <g>
        <rect x="8" y="48" width="70" height="12" rx="2" />
        <line x1="14" y1="54" x2="58" y2="54" opacity="0.4" />
        <text x="60" y="57" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">!</text>
      </g>
      {/* missing source column — big question mark void */}
      <path d="M90 14 L90 60" strokeDasharray="2 3" opacity="0.5" />
      <text x="96" y="42" fontSize="20" fill="currentColor" stroke="none" fontWeight="700">?</text>
      <text x="6" y="74" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">claims without sources</text>
    </svg>
  );
}

// Fix infographic — shows what changes on the back (cyan). Visually contrasts
// with MistakeIcon: same layout flipped/corrected so the fix is obvious.
function FixIcon({ kind, className = '' }: { kind: string; className?: string }) {
  const common = { viewBox: '0 0 120 80', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'model-first') {
    // Problem defined FIRST (left, solid box with aha moment), model chosen after.
    return (
      <svg {...common} className={className} aria-hidden>
        <rect x="6" y="18" width="44" height="36" rx="2" />
        <path d="M18 32 L22 36 L34 24" strokeWidth="2.5" />
        <text x="11" y="66" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace">USER AHA</text>
        <path d="M54 36 L74 36" strokeWidth="2" />
        <path d="M70 32 L74 36 L70 40" strokeWidth="2" />
        <g>
          <circle cx="94" cy="36" r="14" />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const rad = (a * Math.PI) / 180;
            const x1 = 94 + Math.cos(rad) * 14;
            const y1 = 36 + Math.sin(rad) * 14;
            const x2 = 94 + Math.cos(rad) * 18;
            const y2 = 36 + Math.sin(rad) * 18;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        <text x="81" y="66" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace">MODEL</text>
      </svg>
    );
  }
  if (kind === 'schema') {
    // Schema designed for vectors + edges from day one (graph shape inside DB frame).
    return (
      <svg {...common} className={className} aria-hidden>
        <rect x="6" y="10" width="108" height="56" rx="3" />
        <text x="10" y="22" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">schema</text>
        <g>
          <circle cx="32" cy="40" r="4" fill="currentColor" opacity="0.25" />
          <circle cx="32" cy="40" r="4" />
          <circle cx="60" cy="28" r="4" fill="currentColor" opacity="0.25" />
          <circle cx="60" cy="28" r="4" />
          <circle cx="60" cy="52" r="4" fill="currentColor" opacity="0.25" />
          <circle cx="60" cy="52" r="4" />
          <circle cx="88" cy="40" r="4" fill="currentColor" opacity="0.25" />
          <circle cx="88" cy="40" r="4" />
          <line x1="36" y1="38" x2="56" y2="30" opacity="0.7" />
          <line x1="36" y1="42" x2="56" y2="50" opacity="0.7" />
          <line x1="64" y1="30" x2="84" y2="38" opacity="0.7" />
          <line x1="64" y1="50" x2="84" y2="42" opacity="0.7" />
        </g>
        <text x="20" y="74" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">vectors + edges, day one</text>
      </svg>
    );
  }
  if (kind === 'feature') {
    // AI is the product — removing it collapses the shell.
    return (
      <svg {...common} className={className} aria-hidden>
        <rect x="6" y="14" width="108" height="52" rx="3" fill="currentColor" opacity="0.08" />
        <rect x="6" y="14" width="108" height="52" rx="3" />
        <g>
          {/* centered LLM core drives the whole product */}
          <circle cx="60" cy="40" r="14" />
          <circle cx="60" cy="40" r="8" fill="currentColor" opacity="0.3" />
          <text x="51" y="43" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" fontWeight="700">LLM</text>
          {/* rays radiating outward — core powers everything */}
          {[20, 60, 110, 160, 200, 250, 300, 340].map((a) => {
            const rad = (a * Math.PI) / 180;
            const x1 = 60 + Math.cos(rad) * 16;
            const y1 = 40 + Math.sin(rad) * 16;
            const x2 = 60 + Math.cos(rad) * 24;
            const y2 = 40 + Math.sin(rad) * 24;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} opacity="0.65" />;
          })}
        </g>
        <text x="6" y="76" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">remove AI → product collapses</text>
      </svg>
    );
  }
  // 'verify' — every claim carries a citation + freshness stamp.
  return (
    <svg {...common} className={className} aria-hidden>
      <g>
        <rect x="6" y="12" width="60" height="12" rx="2" />
        <line x1="12" y1="18" x2="52" y2="18" opacity="0.4" />
        <path d="M72 14 L94 14" strokeDasharray="2 2" opacity="0.6" />
        <rect x="96" y="10" width="18" height="16" rx="1.5" fill="currentColor" opacity="0.18" />
        <rect x="96" y="10" width="18" height="16" rx="1.5" />
        <text x="99" y="21" fontSize="6" fill="currentColor" stroke="none" fontFamily="monospace">src</text>
      </g>
      <g>
        <rect x="6" y="30" width="60" height="12" rx="2" />
        <line x1="12" y1="36" x2="58" y2="36" opacity="0.4" />
        <path d="M72 32 L94 32" strokeDasharray="2 2" opacity="0.6" />
        <rect x="96" y="28" width="18" height="16" rx="1.5" fill="currentColor" opacity="0.18" />
        <rect x="96" y="28" width="18" height="16" rx="1.5" />
        <text x="99" y="39" fontSize="6" fill="currentColor" stroke="none" fontFamily="monospace">src</text>
      </g>
      <g>
        <rect x="6" y="48" width="60" height="12" rx="2" />
        <line x1="12" y1="54" x2="50" y2="54" opacity="0.4" />
        <path d="M72 50 L94 50" strokeDasharray="2 2" opacity="0.6" />
        <rect x="96" y="46" width="18" height="16" rx="1.5" fill="currentColor" opacity="0.18" />
        <rect x="96" y="46" width="18" height="16" rx="1.5" />
        <text x="99" y="57" fontSize="6" fill="currentColor" stroke="none" fontFamily="monospace">src</text>
      </g>
      <text x="6" y="74" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">every claim → source + timestamp</text>
    </svg>
  );
}

function Slide7() {
  const mistakes = [
    {
      kind: 'model-first',
      title: 'Starting with the model, not the problem',
      body: '"Let\'s add GPT" is not a product strategy. Define what intelligence should change about the outcome first.',
      fix: "Write the user's 'aha moment' before choosing any model.",
    },
    {
      kind: 'schema',
      title: 'Building AI on top of a non-AI data model',
      body: "If your database wasn't designed for embeddings and relationships, every AI layer will fight you.",
      fix: 'Schema-first. Design for vectors and edges from day one.',
    },
    {
      kind: 'feature',
      title: 'Making AI a feature instead of the foundation',
      body: "A search bar that uses an LLM is still just a search bar. AI-native means the product can't function without intelligence.",
      fix: 'Ask: if I removed the AI, does this product still exist?',
    },
    {
      kind: 'verify',
      title: "Shipping AI output devs can't verify",
      body: 'Hallucinated imports, stale citations, confident-but-wrong tests. Without provenance, teams bottleneck on one senior reviewer.',
      fix: 'Citations + deterministic re-checks + freshness timestamps on every AI claim.',
    },
  ];

  return (
    <SlideWrapper id="slide-6">
      <HologramEyebrow>◤ FRAME·07 // ANTI-PATTERNS</HologramEyebrow>
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
          {mistakes.map(({ kind, title, body, fix }, idx) => (
            <FlipCard
              key={title}
              ariaLabel={`${title} — tap for the fix`}
              minHeight="15rem"
              front={
                <div
                  className="relative flex h-full flex-col overflow-hidden p-3 sm:p-3.5"
                  style={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(217,70,239,0.35)',
                    background: 'linear-gradient(135deg, rgba(30,6,40,0.55), rgba(6,0,14,0.75))',
                    boxShadow: '0 0 24px rgba(217,70,239,0.08), inset 0 0 22px rgba(217,70,239,0.05)',
                  }}
                >
                  <span aria-hidden className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] tracking-widest" style={{ color: 'rgba(217,70,239,0.7)' }}>◤ NODE·0{idx + 1}</span>
                  <ClickBubble label="fix" />
                  <div className="mt-4 flex flex-1 items-center justify-center">
                    <MistakeIcon kind={kind} className="h-full w-full max-h-[6.5rem] text-fuchsia-400" />
                  </div>
                  <span className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-fuchsia-300/80">
                    ✕ anti-pattern
                  </span>
                  <p className="mt-0.5 text-[11px] font-bold leading-snug text-zinc-100 sm:text-xs">{title}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-zinc-400 sm:text-[11px]">{body}</p>
                </div>
              }
              back={
                <div
                  className="relative flex h-full flex-col overflow-hidden p-3 sm:p-3.5"
                  style={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(34,211,238,0.45)',
                    background: 'linear-gradient(135deg, rgba(6,24,32,0.92), rgba(6,32,40,0.92))',
                    boxShadow: '0 0 22px rgba(34,211,238,0.08), inset 0 0 18px rgba(6,182,212,0.05)',
                  }}
                >
                  <span aria-hidden className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] tracking-widest text-cyan-300/80">✓ FIX·0{idx + 1}</span>
                  <div className="mt-4 flex flex-1 items-center justify-center">
                    <FixIcon kind={kind} className="h-full w-full max-h-[8.5rem] text-cyan-300" />
                  </div>
                  <span className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-cyan-300/90">
                    ✓ the fix
                  </span>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-100 sm:text-xs">{fix}</p>
                </div>
              }
            />
          ))}
        </div>
      </C>

      {/* Footer strip — cyberpunk terminal tag */}
      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ tap any card to reveal the fix
          </span>
          <span className="opacity-70">sys::mistakes</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 8 — HOW TO START (flip cards with action links) ───────────────────

function Slide8() {
  const steps = [
    {
      n: '1',
      title: 'Define the intelligence outcome',
      desc: "What should the product know that humans can't easily compute?",
      reporium: 'Surface the right repo for a use-case without keyword search — ranked by relevance, not star count.',
    },
    {
      n: '2',
      title: 'Design your data model for AI',
      desc: 'Tables + embeddings + edges. Schema is destiny.',
      reporium: 'Postgres + pgvector for similarity search; typed graph edges stored alongside nodes for traversal in one query.',
    },
    {
      n: '3',
      title: 'Pick the smallest useful model',
      desc: "Fast, cheap model for classification. Stronger one only when reasoning is needed. Don't over-engineer early.",
      reporium: 'Two-tier model routing at ingest vs. reasoning. Keeps cost flat and latency predictable.',
    },
    {
      n: '4',
      title: 'Build the intelligence endpoint first',
      desc: 'Query before UI. Make the API useful to agents before humans.',
      reporium: 'REST /search and /ask shipped before the web UI existed. The MCP server exposes the same routes to agents.',
    },
    {
      n: '5',
      title: 'Ship, measure, compound',
      desc: 'Every query tells you what to build next. Let the product teach you.',
      reporium: 'View tracking and search history feed the recommendation loop nightly. Every ingest makes the next query better.',
    },
  ];

  return (
    <SlideWrapper id="slide-7">
      <HologramEyebrow>◤ FRAME·08 // PATH — THE 5-STEP PATH FROM IDEA TO INTELLIGENCE</HologramEyebrow>
      <C>
        <h2
          className="mt-2 font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.3rem, 3.8vw + 0.8svh, 2.8rem)' }}
        >
          How to Start Building AI-Native that Actually Works
        </h2>
      </C>

      <C>
        <div className="mt-3 sm:mt-5 flex flex-col gap-2 sm:gap-3">
          {steps.map(({ n, title, desc, reporium }) => (
            <FlipCard
              key={n}
              ariaLabel={`Step ${n}: ${title} — tap for Reporium example`}
              minHeight="5.5rem"
              front={
                <div
                  className="relative flex h-full items-start gap-3 p-3 sm:p-4"
                  style={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(34,211,238,0.3)',
                    background: 'linear-gradient(135deg, rgba(6,30,40,0.55), rgba(24,24,32,0.7))',
                    boxShadow: '0 0 16px rgba(34,211,238,0.06), inset 0 0 14px rgba(6,182,212,0.04)',
                  }}
                >
                  <ClickBubble label="flip" />
                  <div className="flex shrink-0 flex-col items-center">
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/80">
                      STEP
                    </span>
                    <span
                      className="font-mono text-2xl font-black leading-none sm:text-3xl"
                      style={{ color: '#67e8f9', textShadow: neonCyan }}
                    >
                      {n}
                    </span>
                  </div>
                  <div className="min-w-0 border-l border-cyan-400/20 pl-3">
                    <p className="text-xs font-semibold text-zinc-100 sm:text-sm">{title}</p>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-400 sm:text-xs">{desc}</p>
                  </div>
                </div>
              }
              back={
                <div
                  className="flex h-full flex-col justify-center p-3 sm:p-4"
                  style={{ borderRadius: '0.75rem', border: '1px solid rgba(217,70,239,0.45)', background: 'rgba(30,10,38,0.92)' }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300 sm:text-xs">
                    Reporium — step {n}
                  </span>
                  <p className="mt-1 text-[11px] text-zinc-100 sm:text-xs">{reporium}</p>
                </div>
              }
            />
          ))}
        </div>
      </C>

      {/* Footer strip — cyberpunk terminal tag, matches Frame 06/07 */}
      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ click any card to see how Reporium did it
          </span>
          <span className="opacity-70">sys::path</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 9 — TRUST IS THE FOUNDATION ────────────────────────────────────────

// Trust-vector infographics — 4 pillars × 2 sides.
// Wider 180×100 viewBox and generous padding so no label sits on a rect edge.
// Front = the concept; back = the Reporium implementation.
function TrustIcon({
  kind, side, className = '',
}: { kind: string; side: 'front' | 'back'; className?: string }) {
  const common = {
    viewBox: '0 0 180 100',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  // ═══ CITATIONS ═══
  if (kind === 'provenance') {
    if (side === 'front') {
      // [claim] --→ [source] ✓
      return (
        <svg {...common} className={className} aria-hidden>
          <rect x="10" y="42" width="56" height="24" rx="4" />
          <text x="38" y="58" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">claim</text>
          <path d="M68 54 L108 54" strokeDasharray="4 3" />
          <path d="M104 50 L108 54 L104 58" />
          <rect x="110" y="30" width="58" height="48" rx="4" />
          <text x="139" y="52" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">source</text>
          <text x="139" y="68" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle" opacity="0.75">[cited]</text>
          <g transform="translate(164 18)">
            <circle r="8" />
            <path d="M-3.5 0 L-1 2.5 L3.5 -2.5" strokeWidth="1.8" />
          </g>
        </svg>
      );
    }
    // back — reporium answer card with inline citation pills
    return (
      <svg {...common} className={className} aria-hidden>
        <rect x="10" y="12" width="160" height="76" rx="5" />
        <text x="18" y="28" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.7">ans::reporium</text>
        <line x1="18" y1="36" x2="140" y2="36" opacity="0.4" />
        <line x1="18" y1="46" x2="150" y2="46" opacity="0.4" />
        <line x1="18" y1="56" x2="120" y2="56" opacity="0.4" />
        <g>
          <rect x="18" y="66" width="42" height="14" rx="7" fill="currentColor" opacity="0.18" />
          <rect x="18" y="66" width="42" height="14" rx="7" />
          <text x="39" y="76" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">[repo#1]</text>
        </g>
        <g>
          <rect x="66" y="66" width="46" height="14" rx="7" fill="currentColor" opacity="0.18" />
          <rect x="66" y="66" width="46" height="14" rx="7" />
          <text x="89" y="76" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">[commit]</text>
        </g>
        <g>
          <rect x="118" y="66" width="44" height="14" rx="7" fill="currentColor" opacity="0.18" />
          <rect x="118" y="66" width="44" height="14" rx="7" />
          <text x="140" y="76" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">[/docs]</text>
        </g>
      </svg>
    );
  }

  // ═══ FRESHNESS ═══
  if (kind === 'freshness') {
    if (side === 'front') {
      // clock + "enriched 3 days ago" with old version struck
      return (
        <svg {...common} className={className} aria-hidden>
          <g transform="translate(36 50)">
            <circle r="26" />
            <line x1="0" y1="0" x2="0" y2="-16" strokeWidth="1.8" />
            <line x1="0" y1="0" x2="12" y2="7" strokeWidth="1.8" />
            <circle r="2" fill="currentColor" />
          </g>
          <text x="82" y="36" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.5">v0.28 · 14 mo</text>
          <line x1="80" y1="33" x2="150" y2="31" strokeWidth="1.5" opacity="0.8" />
          <text x="82" y="56" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace">enriched</text>
          <text x="82" y="72" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace">3 days ago</text>
        </svg>
      );
    }
    // back — timeline with ingested / enriched / last-checked timestamps
    return (
      <svg {...common} className={className} aria-hidden>
        <line x1="16" y1="54" x2="164" y2="54" strokeWidth="1.5" />
        {[
          { x: 30, label: 'ingest', ts: '14d' },
          { x: 90, label: 'enrich', ts: '3d' },
          { x: 150, label: 'verify', ts: 'now' },
        ].map((t) => (
          <g key={t.label}>
            <circle cx={t.x} cy={54} r={5} fill="currentColor" opacity="0.2" />
            <circle cx={t.x} cy={54} r={5} strokeWidth="1.8" />
            <text x={t.x} y={40} fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">{t.label}</text>
            <text x={t.x} y={78} fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle" opacity="0.85">{t.ts}</text>
          </g>
        ))}
      </svg>
    );
  }

  // ═══ RE-RUNNABILITY ═══
  if (kind === 'rerun') {
    if (side === 'front') {
      // [query] [query] → [=] → [answer]
      return (
        <svg {...common} className={className} aria-hidden>
          <rect x="8" y="22" width="44" height="20" rx="3" />
          <text x="30" y="36" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">query</text>
          <rect x="8" y="58" width="44" height="20" rx="3" />
          <text x="30" y="72" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">query</text>
          <path d="M54 34 L84 48" strokeDasharray="3 3" />
          <path d="M54 66 L84 52" strokeDasharray="3 3" />
          <rect x="84" y="40" width="24" height="20" rx="3" fill="currentColor" opacity="0.15" />
          <rect x="84" y="40" width="24" height="20" rx="3" />
          <text x="96" y="54" fontSize="12" fill="currentColor" stroke="none" fontWeight="700" textAnchor="middle">=</text>
          <path d="M110 50 L134 50" strokeWidth="1.8" />
          <path d="M130 46 L134 50 L130 54" strokeWidth="1.8" />
          <rect x="134" y="40" width="42" height="20" rx="3" />
          <text x="155" y="54" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">answer</text>
        </svg>
      );
    }
    // back — hash equality proof: sha(q1) → sha(a), sha(q2) → sha(a)
    return (
      <svg {...common} className={className} aria-hidden>
        <text x="16" y="24" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.7">run · today</text>
        <rect x="16" y="30" width="70" height="18" rx="3" />
        <text x="51" y="43" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">sha a8f2…</text>
        <text x="16" y="64" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.7">run · yesterday</text>
        <rect x="16" y="70" width="70" height="18" rx="3" />
        <text x="51" y="83" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">sha a8f2…</text>
        <path d="M90 56 L110 56" strokeWidth="1.8" />
        <path d="M106 52 L110 56 L106 60" strokeWidth="1.8" />
        <rect x="112" y="44" width="52" height="24" rx="4" fill="currentColor" opacity="0.18" />
        <rect x="112" y="44" width="52" height="24" rx="4" />
        <text x="138" y="60" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle" fontWeight="700">match</text>
      </svg>
    );
  }

  // ═══ AGREEMENT ═══
  if (side === 'front') {
    // sources → conflict edge → resolved graph
    return (
      <svg {...common} className={className} aria-hidden>
        <circle cx="18" cy="28" r="5" fill="currentColor" opacity="0.35" />
        <circle cx="18" cy="28" r="5" />
        <circle cx="18" cy="52" r="5" fill="currentColor" opacity="0.35" />
        <circle cx="18" cy="52" r="5" />
        <circle cx="18" cy="76" r="5" fill="currentColor" opacity="0.35" />
        <circle cx="18" cy="76" r="5" />
        <path d="M24 28 L62 52" strokeDasharray="3 3" />
        <path d="M24 52 L62 52" strokeDasharray="3 3" />
        <path d="M24 76 L62 52" strokeDasharray="3 3" />
        <ellipse cx="86" cy="52" rx="24" ry="14" />
        <text x="86" y="50" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">conflict</text>
        <text x="86" y="60" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">edge</text>
        <path d="M112 52 L128 52" strokeWidth="1.8" />
        <path d="M124 48 L128 52 L124 56" strokeWidth="1.8" />
        <rect x="130" y="28" width="42" height="48" rx="4" />
        <text x="151" y="44" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">graph</text>
        <g transform="translate(151 60)">
          <circle cx="-8" cy="0" r="2.5" fill="currentColor" />
          <circle cx="8" cy="-5" r="2.5" fill="currentColor" />
          <circle cx="6" cy="7" r="2.5" fill="currentColor" />
          <line x1="-8" y1="0" x2="8" y2="-5" opacity="0.6" />
          <line x1="-8" y1="0" x2="6" y2="7" opacity="0.6" />
          <line x1="8" y1="-5" x2="6" y2="7" opacity="0.6" />
        </g>
      </svg>
    );
  }
  // back — side-by-side diff view: src A vs src B with mismatch row
  return (
    <svg {...common} className={className} aria-hidden>
      <rect x="10" y="14" width="72" height="72" rx="4" />
      <text x="46" y="28" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle" opacity="0.75">src A</text>
      <line x1="16" y1="38" x2="76" y2="38" opacity="0.4" />
      <line x1="16" y1="50" x2="72" y2="50" opacity="0.4" />
      <rect x="14" y="56" width="64" height="14" rx="2" fill="currentColor" opacity="0.2" />
      <text x="46" y="66" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">stars: 5</text>
      <line x1="16" y1="78" x2="66" y2="78" opacity="0.4" />
      <rect x="98" y="14" width="72" height="72" rx="4" />
      <text x="134" y="28" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle" opacity="0.75">src B</text>
      <line x1="104" y1="38" x2="164" y2="38" opacity="0.4" />
      <line x1="104" y1="50" x2="160" y2="50" opacity="0.4" />
      <rect x="102" y="56" width="64" height="14" rx="2" fill="currentColor" opacity="0.2" />
      <text x="134" y="66" fontSize="9" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">stars: 9</text>
      <line x1="104" y1="78" x2="154" y2="78" opacity="0.4" />
      <text x="90" y="67" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle" fontWeight="700">≠</text>
    </svg>
  );
}

function Slide9() {
  const pillars = [
    {
      kind: 'provenance',
      vector: 'citations',
      name: 'Citations catch hallucinations',
      caption: 'claim → source, not claim → vibes',
      proof: 'Every AI claim links back to the artifact it came from. If you can\'t click through, you can\'t verify it — and you won\'t trust it twice.',
    },
    {
      kind: 'freshness',
      vector: 'freshness',
      name: 'Timestamps catch staleness',
      caption: 'data ages on the clock, not the deploy',
      proof: 'Enrichment and source timestamps travel with the data. Developers see at a glance whether a source was updated last week or last year.',
    },
    {
      kind: 'rerun',
      vector: 're-runnability',
      name: 'Determinism beats vibes',
      caption: 'same query → same answer, or a tracked diff',
      proof: 'Re-runs return the same answer or surface exactly what changed. Drift becomes a diff in the UI, not a silent regression.',
    },
    {
      kind: 'agreement',
      vector: 'agreement',
      name: 'Conflicts surface, not averaged',
      caption: 'sources disagree → the edge is shown',
      proof: 'When sources conflict, the product highlights the disagreement edge so developers review the edges, not a paraphrased consensus.',
    },
  ];

  return (
    <SlideWrapper id="slide-8">
      <HologramEyebrow>◤ FRAME·09 // TRUST STACK</HologramEyebrow>
      <C>
        <h2
          className="mt-2 font-black"
          style={{ color: '#f5d0fe', textShadow: neonFuchsia, fontSize: 'clamp(1.3rem, 3.8vw + 0.8svh, 2.8rem)' }}
        >
          Trust Is the Foundation of Every Developer Community
        </h2>
      </C>

      <C>
        <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {pillars.map(({ kind, vector, name, caption, proof }, idx) => (
            <FlipCard
              key={name}
              ariaLabel={`${name} — tap for how it works`}
              minHeight="15rem"
              front={
                <div
                  className="relative flex h-full flex-col overflow-hidden p-3 sm:p-3.5"
                  style={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(34,211,238,0.45)',
                    background: 'linear-gradient(135deg, rgba(6,24,32,0.92), rgba(6,32,40,0.92))',
                    boxShadow: '0 0 22px rgba(34,211,238,0.08), inset 0 0 18px rgba(6,182,212,0.05)',
                  }}
                >
                  <span aria-hidden className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] tracking-widest text-cyan-300/80">◤ VECTOR·0{idx + 1}</span>
                  <ClickBubble label="details" />
                  <p className="mt-5 text-[13px] font-bold leading-snug text-zinc-100 sm:text-sm">{name}</p>
                  <div className="mt-2 flex flex-1 items-center justify-center">
                    <TrustIcon kind={kind} side="front" className="h-full w-full max-h-[7rem] text-cyan-300" />
                  </div>
                  <p className="mt-1 text-[10px] font-mono leading-snug text-cyan-300/80 sm:text-[11px]">{caption}</p>
                </div>
              }
              back={
                <div
                  className="relative flex h-full flex-col overflow-hidden p-3 sm:p-3.5"
                  style={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(217,70,239,0.45)',
                    background: 'linear-gradient(135deg, rgba(30,6,40,0.92), rgba(20,4,30,0.92))',
                    boxShadow: '0 0 22px rgba(217,70,239,0.08), inset 0 0 18px rgba(217,70,239,0.05)',
                  }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300 sm:text-xs">
                    ✓ how trust is built
                  </span>
                  <span className="mt-0.5 font-mono text-[11px] italic text-fuchsia-200/80 sm:text-xs">
                    through {vector}
                  </span>
                  <div className="mt-2 flex flex-1 items-center justify-center">
                    <TrustIcon kind={kind} side="back" className="h-full w-full max-h-[7rem] text-fuchsia-300" />
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-100 sm:text-xs">{proof}</p>
                </div>
              }
            />
          ))}
        </div>
      </C>

      {/* Footer strip — cyberpunk terminal tag */}
      <C>
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#67e8f9',
            boxShadow: '0 0 18px rgba(34,211,238,0.08), inset 0 0 14px rgba(6,182,212,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
            ◈ flip each vector to see how trust is proven
          </span>
          <span className="opacity-70">sys::foundation</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 10 — ONE TAKEAWAY ──────────────────────────────────────────────────

// Takeaway infographics — three design rules distilled to SVG.
function TakeawayIcon({ kind, className = '' }: { kind: 'outcome' | 'verify' | 'compound'; className?: string }) {
  const common = {
    viewBox: '0 0 160 100',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (kind === 'outcome') {
    // Product shell with intelligence at the CORE (radiating) — not a bolt-on.
    return (
      <svg {...common} className={className} aria-hidden>
        <rect x="14" y="22" width="132" height="60" rx="6" />
        <line x1="14" y1="34" x2="146" y2="34" opacity="0.4" />
        <circle cx="20" cy="28" r="1.4" fill="currentColor" />
        <circle cx="26" cy="28" r="1.4" fill="currentColor" />
        <circle cx="32" cy="28" r="1.4" fill="currentColor" />
        <circle cx="80" cy="58" r="14" fill="currentColor" opacity="0.18" />
        <circle cx="80" cy="58" r="14" />
        <text x="80" y="62" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle" fontWeight="700">AI</text>
        {[30, 90, 150, 210, 270, 330].map((a) => {
          const rad = (a * Math.PI) / 180;
          const x1 = 80 + Math.cos(rad) * 16;
          const y1 = 58 + Math.sin(rad) * 16;
          const x2 = 80 + Math.cos(rad) * 24;
          const y2 = 58 + Math.sin(rad) * 24;
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} opacity="0.7" />;
        })}
      </svg>
    );
  }

  if (kind === 'verify') {
    // Claim with clickable click-through → source — click-target visualized.
    return (
      <svg {...common} className={className} aria-hidden>
        <rect x="10" y="36" width="62" height="28" rx="4" />
        <text x="41" y="54" fontSize="10" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">claim</text>
        <path d="M74 50 L110 50" strokeWidth="1.8" />
        <path d="M106 46 L110 50 L106 54" strokeWidth="1.8" />
        <rect x="112" y="26" width="42" height="48" rx="4" />
        <line x1="118" y1="38" x2="148" y2="38" opacity="0.4" />
        <line x1="118" y1="46" x2="146" y2="46" opacity="0.4" />
        <line x1="118" y1="54" x2="144" y2="54" opacity="0.4" />
        <line x1="118" y1="62" x2="140" y2="62" opacity="0.4" />
        <g transform="translate(92 50)">
          <circle r="9" strokeDasharray="2 2" opacity="0.7" />
          <path d="M-4 -4 L2 2 L5 -2 L2 -5" strokeWidth="1.6" fill="currentColor" opacity="0.75" />
        </g>
      </svg>
    );
  }

  // compound — seed → sapling → tree, iterative growth that compounds
  return (
    <svg {...common} className={className} aria-hidden>
      <g>
        <rect x="14" y="68" width="24" height="10" rx="2" opacity="0.6" />
        <path d="M26 68 L26 56" strokeWidth="1.5" />
        <circle cx="26" cy="50" r="5" />
      </g>
      <path d="M44 64 L58 64" strokeWidth="1.4" opacity="0.7" />
      <path d="M54 60 L58 64 L54 68" strokeWidth="1.4" opacity="0.7" />
      <g>
        <rect x="62" y="62" width="28" height="16" rx="2" opacity="0.7" />
        <path d="M76 62 L76 44" strokeWidth="1.5" />
        <circle cx="76" cy="38" r="7" />
        <circle cx="70" cy="42" r="4" opacity="0.7" />
        <circle cx="82" cy="42" r="4" opacity="0.7" />
      </g>
      <path d="M96 64 L112 64" strokeWidth="1.4" opacity="0.7" />
      <path d="M108 60 L112 64 L108 68" strokeWidth="1.4" opacity="0.7" />
      <g>
        <rect x="118" y="54" width="34" height="24" rx="2" opacity="0.7" />
        <path d="M135 54 L135 28" strokeWidth="1.5" />
        <circle cx="135" cy="22" r="10" />
        <circle cx="124" cy="28" r="6" opacity="0.8" />
        <circle cx="146" cy="28" r="6" opacity="0.8" />
        <circle cx="130" cy="38" r="4" opacity="0.7" />
        <circle cx="140" cy="38" r="4" opacity="0.7" />
      </g>
      <text x="26" y="92" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">v1</text>
      <text x="76" y="92" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">v2</text>
      <text x="135" y="92" fontSize="8" fill="currentColor" stroke="none" fontFamily="monospace" textAnchor="middle">v3</text>
    </svg>
  );
}

function Slide10() {
  const rules: Array<{ kind: 'outcome' | 'verify' | 'compound'; label: string; caption: string }> = [
    {
      kind: 'outcome',
      label: 'Intelligence is the product',
      caption: 'not a feature bolted onto one',
    },
    {
      kind: 'verify',
      label: 'Verification is the feature',
      caption: 'every claim is one click from its source',
    },
    {
      kind: 'compound',
      label: 'Compounding is the moat',
      caption: 'small useful version → every query improves the next',
    },
  ];

  return (
    <SlideWrapper id="slide-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(217,70,239,0.07) 0%, transparent 65%)',
        }}
      />

      <HologramEyebrow>◤ FRAME·10 // TAKEAWAY</HologramEyebrow>
      <C>
        <h2
          className="font-black uppercase tracking-widest text-zinc-500"
          style={{ fontSize: 'clamp(0.9rem, 2vw + 0.5svh, 1.5rem)' }}
        >
          The One Thing to Remember
        </h2>
      </C>

      {/* Takeaway — three-clause stack. Each line echoes one pillar of the deck. */}
      <C>
        <div
          className="mt-4 font-black leading-[1.15]"
          style={{ fontSize: 'clamp(1.4rem, 4.2vw + 1svh, 3.2rem)' }}
        >
          <div style={{ color: '#f5d0fe', textShadow: neonFuchsia }}>
            Intelligence is the product.
          </div>
          <div className="mt-1" style={{ color: '#67e8f9', textShadow: neonCyan }}>
            Verification is the feature.
          </div>
          <div className="mt-1 text-zinc-200">
            Trust is the foundation.
          </div>
        </div>
      </C>

      {/* Three design rules — as compact infographic cards */}
      <C>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-7 sm:grid-cols-3 sm:gap-4">
          {rules.map(({ kind, label, caption }, idx) => (
            <div
              key={kind}
              className="relative flex flex-col overflow-hidden rounded-xl border p-3 sm:p-3.5"
              style={{
                borderColor: 'rgba(34,211,238,0.35)',
                background: 'linear-gradient(135deg, rgba(6,24,32,0.88), rgba(6,32,40,0.88))',
                boxShadow: '0 0 20px rgba(34,211,238,0.07), inset 0 0 16px rgba(6,182,212,0.04)',
              }}
            >
              <span aria-hidden className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] tracking-widest text-cyan-300/70">◤ RULE·0{idx + 1}</span>
              <div className="mt-4 flex h-24 items-center justify-center">
                <TakeawayIcon kind={kind} className="h-full w-full max-h-[5.5rem] text-cyan-300" />
              </div>
              <p className="mt-2 text-[13px] font-bold leading-snug text-zinc-100 sm:text-sm">{label}</p>
              <p className="mt-1 text-[10px] font-mono leading-snug text-cyan-300/80 sm:text-[11px]">{caption}</p>
            </div>
          ))}
        </div>
      </C>

      {/* Footer strip — signals proceed to the live Reporium walkthrough */}
      <C>
        <div
          className="mt-5 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(217,70,239,0.35)',
            background: 'linear-gradient(90deg, rgba(30,6,40,0.55), rgba(6,30,40,0.55))',
            color: '#f5d0fe',
            boxShadow: '0 0 18px rgba(217,70,239,0.1), inset 0 0 14px rgba(217,70,239,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_6px_rgba(217,70,239,0.95)]" />
            ▶ proceed :: live reporium walkthrough
          </span>
          <span className="opacity-70">sys::handoff</span>
        </div>
      </C>
    </SlideWrapper>
  );
}

// ─── Slide 11 — Guided Walkthrough CTA ───────────────────────────────────────
// Hand-off from deck to live product. One job: a big, magnetic, cyberpunk
// button that fires the visitor over to reporium.com?utm_mode=guide, where
// the GuidedTour takes over. Backdrop: a large ambient jellyfish so the
// page reads as "back to the sea where Reporium lives" — same visual
// language as Slide 1's intro. Motion is intentionally heavier here than on
// the content slides: pulsating glow, animated gradient sweep, and a small
// rising-bubble cluster under the button to reward the cursor.

function AmbientBigJellyfish() {
  // Pure-CSS decorative jellyfish that fills the slide's negative space.
  // No interactivity — it's background. Reuses the same violet/purple bell
  // gradient as FeaturedJellyfish so the visual lineage with Slide 1 reads
  // immediately.
  const size = 420;
  const r = size / 2;
  const bellH = size * 0.55;
  const totalH = bellH + size * 0.7;

  // Deterministic tentacle geometry (no Math.random — SSR-stable).
  const tentacles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI;
    const startX = r + Math.cos(angle) * r * 0.82;
    const startY = bellH;
    const endX = startX + (i % 2 === 0 ? 1 : -1) * (6 + (i % 5) * 4);
    const endY = startY + size * 0.62 + (i % 3) * 10;
    const cp1X = startX + ((i % 3) - 1) * 10;
    const cp1Y = startY + size * 0.2;
    const cp2X = endX + ((i % 2) - 0.5) * 14;
    const cp2Y = endY - size * 0.1;
    return { i, startX, startY, endX, endY, cp1X, cp1Y, cp2X, cp2Y };
  });

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70"
      style={{ width: size, height: totalH, zIndex: 0 }}
    >
      <svg width={size} height={totalH} viewBox={`0 0 ${size} ${totalH}`} style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="s11-jbell" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="rgba(216,180,254,0.55)" />
            <stop offset="55%" stopColor="rgba(139,92,246,0.38)" />
            <stop offset="100%" stopColor="rgba(91,33,182,0.12)" />
          </radialGradient>
          <radialGradient id="s11-jglow" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="rgba(196,181,253,0.55)" />
            <stop offset="100%" stopColor="rgba(109,40,217,0)" />
          </radialGradient>
          <radialGradient id="s11-jhi" cx="38%" cy="28%" r="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Glow halo */}
        <ellipse cx={r} cy={bellH * 0.5} rx={r * 1.4} ry={bellH * 0.9} fill="url(#s11-jglow)" />

        {/* Bell */}
        <path
          d={`M ${r * 0.05},${bellH} Q 0,${bellH * 0.3} ${r},0 Q ${size},${bellH * 0.3} ${size * 0.95},${bellH} Q ${r},${bellH * 1.12} ${r * 0.05},${bellH} Z`}
          fill="url(#s11-jbell)"
          stroke="rgba(196,181,253,0.5)"
          strokeWidth="1.25"
          className="s11-bell"
        />

        {/* Highlight */}
        <path
          d={`M ${r * 0.3},${bellH * 0.7} Q ${r * 0.22},${bellH * 0.3} ${r * 0.55},${bellH * 0.05} Q ${r * 0.7},${bellH * 0.25} ${r * 0.62},${bellH * 0.72} Z`}
          fill="url(#s11-jhi)"
        />

        {/* Tentacles */}
        {tentacles.map((t) => (
          <path
            key={t.i}
            className="s11-tent"
            d={`M ${t.startX},${t.startY} C ${t.cp1X},${t.cp1Y} ${t.cp2X},${t.cp2Y} ${t.endX},${t.endY}`}
            stroke="rgba(196,181,253,0.6)"
            strokeWidth="1.15"
            fill="none"
            strokeLinecap="round"
            style={{ animationDelay: `${t.i * -0.55}s` }}
          />
        ))}
      </svg>

      <style jsx>{`
        :global(.s11-bell) {
          animation: s11-bell-pulse 5.5s ease-in-out infinite;
          transform-origin: center;
        }
        :global(.s11-tent) {
          animation: s11-tent-sway 4s ease-in-out infinite alternate;
          transform-origin: top center;
        }
        @keyframes s11-bell-pulse {
          0%, 100% { transform: scale(1) translateY(0); filter: drop-shadow(0 0 28px rgba(168,85,247,0.3)); }
          50%      { transform: scale(1.03) translateY(-6px); filter: drop-shadow(0 0 42px rgba(168,85,247,0.5)); }
        }
        @keyframes s11-tent-sway {
          0%   { transform: skewX(-5deg) scaleX(0.93); }
          100% { transform: skewX(5deg)  scaleX(1.07); }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.s11-bell), :global(.s11-tent) { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function WalkthroughButton() {
  // href is relative — /ai-native lives on reporium.com, so the browser
  // resolves this to https://www.reporium.com/?utm_mode=guide. No hardcoded
  // origin (keeps preview deploys self-consistent).
  const href = '/?utm_mode=guide';

  // 5-bubble rising cluster anchored under the button, reusing the same
  // visual vocabulary as ClickBubble but sized/spaced for the larger target.
  const underBubbles = [
    { size: 10, left: 10, delay: -0.6, dur: 2.6 },
    { size: 7,  left: 32, delay: -1.9, dur: 2.3 },
    { size: 12, left: 52, delay: -0.3, dur: 2.9 },
    { size: 6,  left: 72, delay: -2.4, dur: 2.2 },
    { size: 9,  left: 88, delay: -1.1, dur: 2.7 },
  ];

  // Gold particles — deterministic positions around the button perimeter.
  // Using % coords against a wrapper that sits behind/around the button
  // (inset: -40px), so particles orbit the button, not the text.
  const goldParticles = [
    { size: 4, top: 8,  left: 6,   delay: -0.2, dur: 4.2, drift: 14 },
    { size: 3, top: 22, left: 92,  delay: -1.8, dur: 3.6, drift: -10 },
    { size: 5, top: 78, left: 14,  delay: -2.6, dur: 4.8, drift: 12 },
    { size: 3, top: 90, left: 82,  delay: -0.9, dur: 3.4, drift: -8 },
    { size: 4, top: 4,  left: 48,  delay: -3.1, dur: 4.4, drift: 10 },
    { size: 2, top: 48, left: 2,   delay: -1.3, dur: 3.2, drift: -6 },
    { size: 2, top: 55, left: 98,  delay: -2.2, dur: 3.8, drift: 8 },
    { size: 5, top: 94, left: 44,  delay: -0.5, dur: 5.0, drift: -14 },
    { size: 3, top: 14, left: 74,  delay: -2.9, dur: 3.9, drift: 12 },
    { size: 2, top: 36, left: 26,  delay: -1.6, dur: 3.5, drift: -9 },
    { size: 4, top: 68, left: 64,  delay: -0.7, dur: 4.6, drift: 11 },
    { size: 3, top: 30, left: 58,  delay: -2.4, dur: 4.1, drift: -7 },
  ];

  return (
    <div className="relative flex flex-col items-center">
      {/* Gold particle field — sits behind and around the button */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{ inset: -40, zIndex: 0 }}
      >
        {goldParticles.map((p, i) => (
          <span
            key={i}
            className="s11-gold absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              top: `${p.top}%`,
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              // Per-particle drift via CSS custom property
              ['--drift' as string]: `${p.drift}px`,
            }}
          />
        ))}
      </span>

      <a
        href={href}
        className="s11-cta group relative inline-flex items-center gap-3 rounded-2xl px-14 py-7 font-mono text-base font-bold uppercase tracking-[0.2em] sm:px-20 sm:py-9 sm:text-xl md:text-2xl"
        style={{ color: '#ffffff', textShadow: '0 0 14px rgba(255,255,255,0.75), 0 0 28px rgba(240,171,252,0.45)' }}
        aria-label="Start Reporium guided walkthrough"
      >
        {/* Glass stack — frosted base, subtle gradient tint, highlight, edge ring */}
        <span className="s11-cta-glass" aria-hidden />
        <span className="s11-cta-bg" aria-hidden />
        <span className="s11-cta-highlight" aria-hidden />
        <span className="s11-cta-shine" aria-hidden />
        <span className="s11-cta-ring" aria-hidden />

        <span className="relative z-10 flex items-center gap-3">
          {/* leading dot — heartbeat accent */}
          <span className="s11-dot" aria-hidden />
          Start Reporium Walkthrough
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="relative z-10 transition-transform group-hover:translate-x-1" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </a>

      {/* Rising bubbles under the button — pure decoration */}
      <span aria-hidden className="pointer-events-none relative mt-3 block" style={{ width: 200, height: 28 }}>
        {underBubbles.map((b, i) => (
          <span
            key={i}
            className="s11-bubble absolute rounded-full"
            style={{
              width: b.size,
              height: b.size,
              left: `${b.left}%`,
              bottom: 0,
              background: 'radial-gradient(circle at 35% 30%, rgba(165,243,252,0.85), rgba(34,211,238,0.5) 60%, transparent 85%)',
              border: '0.5px solid rgba(34,211,238,0.5)',
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
            }}
          />
        ))}
      </span>

      <style jsx>{`
        .s11-cta {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          border: 1.5px solid rgba(255,255,255,0.38);
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          box-shadow:
            0 0 30px rgba(217,70,239,0.35),
            0 0 60px rgba(34,211,238,0.28),
            inset 0 1px 0 rgba(255,255,255,0.35),
            inset 0 0 24px rgba(255,255,255,0.08);
          animation: s11-pulse 2.4s ease-in-out infinite;
          transform-origin: center;
          will-change: transform, box-shadow;
        }
        .s11-cta:hover {
          animation-duration: 1.6s;
        }
        .s11-cta:active {
          animation-play-state: paused;
          transform: scale(0.98);
        }
        .s11-cta:focus-visible {
          outline: 2px solid rgba(240,171,252,0.9);
          outline-offset: 4px;
        }

        /* Frosted glass base — sits below the tinted gradient */
        .s11-cta-glass {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.14) 0%,
            rgba(255,255,255,0.05) 45%,
            rgba(255,255,255,0.02) 100%
          );
        }
        .s11-cta-bg {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            120deg,
            rgba(217,70,239,0.28) 0%,
            rgba(168,85,247,0.22) 30%,
            rgba(14,165,233,0.22) 60%,
            rgba(34,211,238,0.28) 100%
          );
          background-size: 300% 300%;
          animation: s11-sweep 6s linear infinite;
          mix-blend-mode: screen;
        }
        /* Upper highlight — the hallmark curved glass sheen */
        .s11-cta-highlight {
          position: absolute;
          left: 4%;
          right: 4%;
          top: 4%;
          height: 42%;
          z-index: 2;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.45) 0%,
            rgba(255,255,255,0.12) 60%,
            transparent 100%
          );
          filter: blur(0.3px);
          pointer-events: none;
        }
        .s11-cta-shine {
          position: absolute;
          inset: 0;
          z-index: 3;
          background: linear-gradient(
            100deg,
            transparent 30%,
            rgba(255,255,255,0.45) 50%,
            transparent 70%
          );
          transform: translateX(-100%);
          animation: s11-shine 3.4s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        .s11-cta-ring {
          position: absolute;
          inset: -3px;
          z-index: -1;
          border-radius: 18px;
          background: linear-gradient(120deg, #d946ef, #22d3ee, #d946ef);
          background-size: 200% 200%;
          animation: s11-sweep 6s linear infinite;
          filter: blur(10px);
          opacity: 0.6;
        }
        .s11-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #ffffff;
          box-shadow: 0 0 10px rgba(255,255,255,0.95), 0 0 20px rgba(240,171,252,0.7);
          animation: s11-dot 1.4s ease-in-out infinite;
        }

        .s11-bubble {
          animation-name: s11-bubble-rise;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          opacity: 0;
        }

        /* Gold particles — orbit/float around the button */
        .s11-gold {
          background:
            radial-gradient(circle at 35% 30%,
              rgba(255,244,200,1) 0%,
              rgba(253,215,110,0.95) 35%,
              rgba(217,160,30,0.85) 70%,
              transparent 100%);
          box-shadow:
            0 0 6px rgba(253,215,110,0.95),
            0 0 14px rgba(251,191,36,0.7),
            0 0 28px rgba(217,160,30,0.45);
          opacity: 0;
          animation-name: s11-gold-float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }

        @keyframes s11-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 0 30px rgba(217,70,239,0.45),
              0 0 60px rgba(34,211,238,0.35),
              inset 0 0 24px rgba(255,255,255,0.06);
          }
          50% {
            transform: scale(1.06);
            box-shadow:
              0 0 54px rgba(217,70,239,0.8),
              0 0 110px rgba(34,211,238,0.65),
              inset 0 0 34px rgba(255,255,255,0.12);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .s11-cta { animation: none !important; }
        }
        @keyframes s11-sweep {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes s11-shine {
          0%   { transform: translateX(-100%); }
          55%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes s11-dot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.5); opacity: 0.7; }
        }
        @keyframes s11-bubble-rise {
          0%   { transform: translateY(0)   scale(0.85); opacity: 0; }
          20%  { opacity: 0.9; }
          70%  { opacity: 0.55; }
          100% { transform: translateY(-36px) scale(1.05); opacity: 0; }
        }
        @keyframes s11-gold-float {
          0%   { transform: translate(0, 0) scale(0.6);                       opacity: 0; }
          15%  {                                                               opacity: 1; }
          50%  { transform: translate(var(--drift, 10px), -18px) scale(1.15); opacity: 0.9; }
          85%  {                                                               opacity: 0.6; }
          100% { transform: translate(calc(var(--drift, 10px) * -0.3), -32px) scale(0.75); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .s11-cta,
          .s11-cta-bg,
          .s11-cta-shine,
          .s11-cta-ring,
          .s11-dot,
          .s11-bubble,
          .s11-gold {
            animation: none !important;
          }
          .s11-cta-shine { opacity: 0; }
          .s11-gold { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

function Slide11() {
  return (
    <SlideWrapper id="slide-10">
      {/* Radial backlight — cyan-fuchsia duet */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 55%, rgba(34,211,238,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 50% 40%, rgba(217,70,239,0.1) 0%, transparent 65%)',
        }}
      />

      {/* Large ambient jellyfish — behind the button */}
      <AmbientBigJellyfish />

      <HologramEyebrow>◤ FRAME·11 // HANDOFF</HologramEyebrow>

      <C className="relative z-10 mt-8 flex flex-col items-center sm:mt-10">
        <WalkthroughButton />
      </C>

      {/* Tour stops — visual cue for what the button opens */}
      <C className="relative z-10 mx-auto mt-8 w-full max-w-2xl">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {[
            { n: '01', label: 'Knowledge Graph', hint: 'see every repo + edge' },
            { n: '02', label: 'Search for repos', hint: 'narrow by tag or name' },
            { n: '03', label: 'Ask the library', hint: 'run a real question' },
          ].map((s) => (
            <div
              key={s.n}
              className="rounded-lg border px-3 py-3 text-center font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
              style={{
                borderColor: 'rgba(34,211,238,0.28)',
                background: 'linear-gradient(180deg, rgba(6,24,32,0.55), rgba(12,6,30,0.45))',
                color: '#a5f3fc',
                boxShadow: 'inset 0 0 14px rgba(34,211,238,0.06)',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-cyan-300">{s.n}</span>
                <span className="h-1 w-1 rounded-full bg-cyan-300/80 shadow-[0_0_5px_rgba(34,211,238,0.9)]" />
                <span className="text-zinc-200">{s.label}</span>
              </div>
              <div className="mt-1 text-[9px] text-zinc-500 sm:text-[10px]">{s.hint}</div>
            </div>
          ))}
        </div>
      </C>

      <C>
        <div
          className="relative z-10 mt-8 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest sm:text-[11px]"
          style={{
            borderColor: 'rgba(34,211,238,0.35)',
            background: 'linear-gradient(90deg, rgba(6,30,40,0.55), rgba(30,6,40,0.55))',
            color: '#a5f3fc',
            boxShadow: '0 0 18px rgba(34,211,238,0.1), inset 0 0 14px rgba(34,211,238,0.05)',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.95)]" />
            ▶ ready :: utm_mode=guide
          </span>
          <span className="opacity-70">sys::launch</span>
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

  // SSR guard: /ai-native is a fully interactive client-side presentation
  // (framer-motion, scroll-snap, IntersectionObserver, matchMedia, SVG
  // animation). It has no SEO value and many of its sub-components rely on
  // client-only APIs. Rendering anything on the server opens the door to
  // hydration mismatches (useReducedMotion, framer-motion inline styles,
  // locale-dependent formatting, etc.). Render an empty shell on the server
  // and on the client's first pass, then swap in the real content after mount
  // — both the server and first client render produce the same DOM, so there
  // is nothing to hydrate-mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    slideRefs.current = Array.from({ length: TOTAL_SLIDES }).map((_, i) =>
      container.querySelector(`#slide-${i}`)
    );
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    // Observe intersection relative to the SCROLL CONTAINER, not the viewport.
    // The page lives under a sticky nav bar, so the document viewport includes
    // area hidden behind the nav — using it as the root gives skewed ratios
    // (two slides can report near-equal intersection during a snap, and the
    // wrong dot highlights). Scoping root to the container that actually
    // scrolls makes "most-visible slide" unambiguous: one slide fills the
    // container, the rest report ~0.
    const slides = Array.from({ length: TOTAL_SLIDES })
      .map((_, i) => document.getElementById(`slide-${i}`))
      .filter((el): el is HTMLElement => el !== null);

    const ratios = new Map<HTMLElement, number>();
    slides.forEach((s) => ratios.set(s, 0));

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          ratios.set(e.target as HTMLElement, e.intersectionRatio);
        });
        let maxRatio = -1;
        let activeIdx = 0;
        ratios.forEach((ratio, el) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            const match = el.id.match(/slide-(\d+)/);
            if (match) activeIdx = parseInt(match[1], 10);
          }
        });
        // Guard with functional updater — skip state commit if the active
        // slide hasn't changed. IntersectionObserver fires on every threshold
        // cross (up to ~7 per slide with our threshold array) and React would
        // otherwise re-render the outer tree on each one.
        setActiveSlide((prev) => (prev === activeIdx ? prev : activeIdx));
      },
      {
        root: container,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1],
      },
    );

    slides.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [mounted]);

  const scrollToSlide = useCallback((index: number) => {
    if (typeof window === 'undefined') return;
    const container = containerRef.current;
    const el = document.getElementById(`slide-${index}`);
    if (!container || !el) return;
    container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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

  // Server / first-client-render shell — matches exactly so hydration is a
  // no-op. After useEffect fires, `mounted` flips and the real deck renders.
  if (!mounted) {
    return (
      <div
        className="h-[100svh] w-screen overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
        aria-busy="true"
      />
    );
  }

  return (
    <>
      <SlideProgress current={activeSlide} total={TOTAL_SLIDES} />

      <SlideDots
        total={TOTAL_SLIDES}
        active={activeSlide}
        onDotClick={scrollToSlide}
        labels={SLIDE_LABELS}
      />

      <div
        ref={containerRef}
        className="h-[100svh] w-screen overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <MSlide1 />
        <MSlide2 />
        <MSlide3 />
        <MSlide4 />
        <MSlide5 />
        <MSlide6 />
        <MSlide7 />
        <MSlide8 />
        <MSlide9 />
        <MSlide10 />
        <MSlide11 />
      </div>
    </>
  );
}

// Memoize each slide so setActiveSlide (fires on every IO threshold cross)
// doesn't cascade a re-render through 11 heavy SVG/motion subtrees. Slides
// take no props, so `memo()` with default comparator is a free win.
const MSlide1 = memo(Slide1);
const MSlide2 = memo(Slide2);
const MSlide3 = memo(Slide3);
const MSlide4 = memo(Slide4);
const MSlide5 = memo(Slide5);
const MSlide6 = memo(Slide6);
const MSlide7 = memo(Slide7);
const MSlide8 = memo(Slide8);
const MSlide9 = memo(Slide9);
const MSlide10 = memo(Slide10);
const MSlide11 = memo(Slide11);
