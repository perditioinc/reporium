'use client';

import { JellyfishLayer } from './JellyfishLayer';

/**
 * Home page hero billboard — cyberpunk neon, horizontal scrolling marquee.
 *
 * Purpose: first-time visitors land on the home page with no clue what
 * Reporium is. This banner sits above the knowledge graph and broadcasts
 * the value prop in motion, like a Blade Runner street sign. The scroll
 * is CSS-only (transform animation, compositor layer) so it's cheap.
 */

// Messages the billboard cycles through. Order is deliberate: identity →
// scale → how-to-use → outcome. Separator characters are chosen so the
// neon glow on each side renders cleanly at small sizes.
const MESSAGES = [
  'REPORIUM // THE AI DEV-TOOL LIBRARY',
  '1,641 REPOS INDEXED · 16 CATEGORIES · 4 GRAPH EDGE TYPES',
  'ASK IN PLAIN ENGLISH — REPORIUM ANSWERS WITH CITATIONS',
  'EXPLORE DEPENDENCIES · ALTERNATIVES · COMPATIBILITY IN 3D',
  'FILTER BY SKILL AREA, INDUSTRY, MODALITY, AI TREND',
  'BUILT FOR AI PRACTITIONERS — FIND IT, FORK IT, SHIP FASTER',
];

const SEPARATOR = '  ◢◤  ';

export function CyberpunkBillboard() {
  // We render the marquee twice in sequence and translate by -50% so the
  // loop is seamless (the second copy picks up where the first leaves off).
  const line = MESSAGES.join(SEPARATOR) + SEPARATOR;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-fuchsia-500/40 bg-zinc-950"
      style={{
        boxShadow:
          '0 0 30px rgba(217,70,239,0.25), inset 0 0 24px rgba(34,211,238,0.08)',
      }}
      role="banner"
      aria-label="What Reporium is for"
    >
      {/* Jellyfish ambient layer — behind all billboard text */}
      <JellyfishLayer />

      {/* Scanline / grid underlay — very cheap, all CSS */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(236,72,153,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.25) 1px, transparent 1px)',
          backgroundSize: '22px 22px, 22px 22px',
          backgroundPosition: 'center',
          maskImage:
            'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        }}
      />

      {/* Left edge fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 sm:w-16"
        style={{
          background:
            'linear-gradient(to right, rgb(9,9,11) 0%, rgba(9,9,11,0.95) 40%, transparent 100%)',
        }}
      />
      {/* Right edge fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 sm:w-16"
        style={{
          background:
            'linear-gradient(to left, rgb(9,9,11) 0%, rgba(9,9,11,0.95) 40%, transparent 100%)',
        }}
      />

      {/* Corner accents */}
      <span aria-hidden className="absolute left-2 top-2 text-[9px] font-mono uppercase tracking-[0.3em] text-cyan-400/70">
        ◢ system.online
      </span>
      <span aria-hidden className="absolute right-2 top-2 text-[9px] font-mono uppercase tracking-[0.3em] text-fuchsia-400/70">
        v2026.04 ◣
      </span>
      <span aria-hidden className="absolute bottom-2 left-2 text-[9px] font-mono uppercase tracking-[0.3em] text-cyan-400/50">
        ░░ uplink stable ░░
      </span>

      {/* Marquee — two copies of the same line translated back-to-back */}
      <div className="py-6 sm:py-7">
        <div
          className="flex whitespace-nowrap will-change-transform"
          style={{
            animation: 'cyberpunk-scroll 48s linear infinite',
          }}
        >
          <MarqueeLine text={line} />
          <MarqueeLine text={line} aria-hidden />
        </div>
      </div>

      <style jsx>{`
        @keyframes cyberpunk-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .will-change-transform {
            animation: none !important;
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </div>
  );
}

function MarqueeLine({
  text,
  ...rest
}: {
  text: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className="shrink-0 px-4 font-mono text-base sm:text-lg md:text-xl font-semibold tracking-[0.15em] uppercase"
      style={{
        // Layered text-shadow gives the classic neon bloom without a filter.
        color: '#f5d0fe',
        textShadow:
          '0 0 6px rgba(236,72,153,0.95), 0 0 14px rgba(236,72,153,0.55), 0 0 28px rgba(217,70,239,0.35), 0 0 2px rgba(34,211,238,0.7)',
      }}
      {...rest}
    >
      {text}
    </span>
  );
}
