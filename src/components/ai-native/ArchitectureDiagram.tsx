'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';

// ─── Color tokens (matching reporium.com visual style) ─────────────────────
const LAYER_COLORS = {
  agentAccessible: {
    fill: 'rgba(147,51,234,0.08)',
    stroke: 'rgba(147,51,234,0.45)',
    text: '#c084fc',
    badge: 'rgba(147,51,234,0.18)',
  },
  intelligence: {
    fill: 'rgba(217,70,239,0.08)',
    stroke: 'rgba(217,70,239,0.45)',
    text: '#f0abfc',
    badge: 'rgba(217,70,239,0.18)',
  },
  semantic: {
    fill: 'rgba(34,211,238,0.08)',
    stroke: 'rgba(34,211,238,0.45)',
    text: '#67e8f9',
    badge: 'rgba(34,211,238,0.18)',
  },
  compounding: {
    fill: 'rgba(52,211,153,0.08)',
    stroke: 'rgba(52,211,153,0.45)',
    text: '#6ee7b7',
    badge: 'rgba(52,211,153,0.18)',
  },
} as const;

const BAND_COLORS = {
  observability: {
    fill: 'rgba(251,191,36,0.07)',
    stroke: 'rgba(251,191,36,0.4)',
    text: '#fcd34d',
    itemColor: 'rgba(253,211,77,0.92)',
  },
  governance: {
    fill: 'rgba(239,68,68,0.07)',
    stroke: 'rgba(239,68,68,0.4)',
    text: '#fca5a5',
    itemColor: 'rgba(252,165,165,0.92)',
  },
  performance: {
    fill: 'rgba(99,102,241,0.07)',
    stroke: 'rgba(99,102,241,0.4)',
    text: '#a5b4fc',
    itemColor: 'rgba(165,180,252,0.92)',
  },
} as const;

// ─── Layer detail data for the zoom modal (developer voice) ─────────────────
type LayerKey = 'agentAccessible' | 'intelligence' | 'semantic' | 'compounding';
type BandKey = 'observability' | 'governance' | 'performance';
type DetailKey = LayerKey | BandKey;

interface DetailColors {
  fill: string;
  stroke: string;
  text: string;
  badge: string;
}

interface LayerDetail {
  key: DetailKey;
  label: string;
  caption: string;
  colors: DetailColors;
  purpose: string;
  tradeoff: string;
  components: Array<{
    name: string;
    tech: string;
    detail?: string;
  }>;
}

// Band colors need a `badge` field to match DetailColors; derive from stroke.
const BAND_BADGES: Record<BandKey, string> = {
  observability: 'rgba(251,191,36,0.18)',
  governance: 'rgba(239,68,68,0.18)',
  performance: 'rgba(99,102,241,0.18)',
};

const LAYER_DETAILS: LayerDetail[] = [
  {
    key: 'agentAccessible',
    label: 'Interface Layer',
    caption: 'MCP and typed endpoints — agents call this directly',
    colors: LAYER_COLORS.agentAccessible,
    purpose: 'Exposes Reporium data via typed HTTP + MCP so both human UIs and agent runtimes share one surface.',
    tradeoff: 'Trade-off: single surface simplifies auth but means any MCP client sees the same rate limits as browsers.',
    components: [
      { name: 'Reporium Web', tech: 'Next.js 16 · Vercel · static export', detail: 'Human-facing UI; serves pre-rendered pages from Vercel edge.' },
      { name: 'reporium-mcp', tech: 'MCP protocol · TypeScript SDK', detail: 'Agent-native endpoint; Claude Desktop and LangChain connect here.' },
      { name: 'External orchestrators', tech: 'Workato · LangChain · custom HTTP clients', detail: 'Any client that speaks HTTP or MCP can call the API directly.' },
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence Layer',
    caption: 'AI is in the decision loop',
    colors: LAYER_COLORS.intelligence,
    purpose: 'Routes queries through an LLM enrichment pass so every stored repo has structured metadata before it reaches the index.',
    tradeoff: 'Trade-off: enrichment latency (~1–3 s per repo) is paid at ingest time, not query time; keeps p99 reads fast.',
    components: [
      { name: 'reporium-api', tech: 'FastAPI · Cloud Run · Sentry', detail: 'Public reads (keyless) / ingest (keyed) / admin (keyed). Scalar docs at /docs.' },
      { name: 'LLM enrichment', tech: 'model-agnostic — Claude, GPT-4o, local', detail: 'Generates structured tags, summary, and taxonomy labels for each repo.' },
      { name: 'Pub/Sub event bus', tech: 'GCP Pub/Sub · topic: repo-ingested', detail: 'Decouples ingestion from downstream subscribers; reporium-events library wraps this.' },
    ],
  },
  {
    key: 'semantic',
    label: 'Semantic Layer',
    caption: 'Retrieval is by meaning, not strings',
    colors: LAYER_COLORS.semantic,
    purpose: 'Stores dense vector embeddings alongside relational data so nearest-neighbour queries return conceptually similar repos.',
    tradeoff: 'Trade-off: HNSW index trades ~2% recall for 10× query speed vs. exact cosine scan on 9k+ repos.',
    components: [
      { name: 'Postgres + pgvector', tech: 'Cloud SQL · managed backups · HNSW', detail: 'repo_embeddings: 384-dim, vector_cosine_ops. taxonomy_values: 8 dynamic dimensions, cosine ≥ 0.65 assignment.' },
      { name: 'GCS snapshot', tech: 'Google Cloud Storage · JSON', detail: 'Read fallback for /graph/edges — avoids heavy DB join on cold cache.' },
      { name: 'Redis cache (optional)', tech: 'Upstash or self-hosted · 5-min TTL', detail: '/library/full served from cache; HNSW approximate-NN results also cached.' },
    ],
  },
  {
    key: 'compounding',
    label: 'Data Layer',
    caption: 'Every ingest makes the next query better',
    colors: LAYER_COLORS.compounding,
    purpose: 'Nightly Cloud Run jobs keep the corpus and forks fresh, feeding new embeddings back into the Semantic layer.',
    tradeoff: 'Trade-off: 24 h staleness window is acceptable for OSS repos; real-time ingest is available via POST /ingest/repos for urgent adds.',
    components: [
      { name: 'reporium-ingestion', tech: 'Cloud Run Job · nightly cron · Python', detail: 'pull → LLM enrich → POST /ingest/repos → publish repo.ingested. Processes batches of 50.' },
      { name: 'forksync', tech: 'Cloud Run Job · nightly cron · Go', detail: 'Keeps fork metadata aligned with upstream; prevents stale star / language counts.' },
    ],
  },
];

const BAND_DETAILS: LayerDetail[] = [
  {
    key: 'observability',
    label: 'Observability',
    caption: "You can't trust what you can't see — every AI decision leaves a trail.",
    colors: { ...BAND_COLORS.observability, badge: BAND_BADGES.observability },
    purpose: 'Every AI decision leaves a trail: errors, traces, structured logs, latency percentiles, and alerts keep the system auditable in production.',
    tradeoff: 'Trade-off: instrumentation adds ~5-10ms per request and a steady log/trace bill, but without it debugging an LLM failure in prod is guesswork.',
    components: [
      { name: 'Sentry', tech: 'error tracking · release tagging', detail: 'Captures exceptions from reporium-api and ingestion jobs; ties errors to commit SHA.' },
      { name: 'OpenTelemetry traces', tech: 'OTel SDK · distributed spans', detail: 'Spans across /ask → LLM → pgvector; isolates latency per stage.' },
      { name: 'Cloud Logging', tech: 'GCP · structured JSON logs', detail: 'Every request logged with correlation id; queryable by user, endpoint, status.' },
      { name: 'Latency dashboards', tech: 'p95 / p99 per endpoint', detail: 'Read path SLO: p95 < 400ms; /ask SLO: p95 < 3s (LLM-bound).' },
      { name: 'Alert policies', tech: '6 Cloud Monitoring policies', detail: 'Cost, error rate, latency, queue depth, ingest failure, token burn.' },
    ],
  },
  {
    key: 'governance',
    label: 'Governance',
    caption: 'AI without guardrails becomes a liability — governance is how trust survives scale.',
    colors: { ...BAND_COLORS.governance, badge: BAND_BADGES.governance },
    purpose: 'Keep AI auditable and safe: scrub inputs, block injection, rate-limit abuse, log every query, and pin versions so answers stay reproducible.',
    tradeoff: 'Trade-off: every guardrail costs latency and a bit of recall, but governance is the only thing keeping an AI feature from becoming a liability.',
    components: [
      { name: 'PII scrubbing', tech: 'regex + entity filters · pre-LLM', detail: 'Strips emails, tokens, and keys from prompts before they leave the API boundary.' },
      { name: 'Prompt injection filters', tech: 'regex heuristics · allow-list', detail: 'Blocks common jailbreak patterns on /ask; failures audited, not silently passed.' },
      { name: 'Rate limiting', tech: 'per user · per IP', detail: 'Prevents ingest-key abuse and anonymous /ask flooding; tuned for Cloud Run f1-micro.' },
      { name: 'Audit log', tech: '/ask query log · append-only', detail: 'Every question, model version, prompt hash, and citation list persisted for review.' },
      { name: 'Citations required', tech: 'generator constraint', detail: 'No answer ships without pointer to the repos it came from — breaks the "vibes-based" answer.' },
      { name: 'Version pinning', tech: 'model + prompt SHA', detail: 'Answers tagged with model id and prompt hash; rollback is a single config flip.' },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    caption: 'AI-native only works if it\'s cheap and fast enough to run on every request.',
    colors: { ...BAND_COLORS.performance, badge: BAND_BADGES.performance },
    purpose: 'Keep the $0 infra budget honest: cache aggressively, pre-compute embeddings, and push slow work off the request path.',
    tradeoff: 'Trade-off: caching and async enrichment mean users see slightly stale data for seconds-to-minutes, in exchange for staying on f1-micro.',
    components: [
      { name: 'Response cache', tech: 'Cloud Memorystore · TTL-bounded', detail: '/library/full and hot /ask queries cached; memory footprint bounded by key count.' },
      { name: 'Embedding pre-compute', tech: 'at ingest time', detail: 'Vectors generated once when a repo lands; query path never waits on an encoder.' },
      { name: 'Async enrichment', tech: 'GCP Pub/Sub · repo.ingested', detail: 'LLM enrichment happens off the request path via subscriber workers.' },
      { name: 'Cloud SQL f1-micro', tech: 'pgvector · pool_size=5+2', detail: 'Max connections 25; asyncpg pool sized for burst tolerance without OOM.' },
      { name: 'Materialized views', tech: 'nightly refresh', detail: 'Graph edge aggregates precomputed nightly; /graph/edges reads the view, not the join.' },
    ],
  },
];

const ALL_DETAILS: LayerDetail[] = [...LAYER_DETAILS, ...BAND_DETAILS];

// ─── SVG sub-components (all at module level — required by react-hooks/static-components) ──

interface CompBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel?: string | string[];
  accent: string;
  textColor: string;
  animDelay?: number;
  shouldReduce: boolean;
}

function CompBox({ x, y, w, h, label, sublabel, accent, textColor, animDelay = 0, shouldReduce }: CompBoxProps) {
  const lines = sublabel === undefined ? [] : Array.isArray(sublabel) ? sublabel : [sublabel];
  const pad = 10;
  const inner = (
    <>
      <rect
        x={x} y={y} width={w} height={h} rx={6} ry={6}
        fill="rgba(9,9,17,0.82)"
        stroke={accent}
        strokeWidth={1.25}
      />
      {/* subtle inner-glow for cyberpunk-underwater feel */}
      <rect
        x={x + 0.75} y={y + 0.75} width={w - 1.5} height={h - 1.5} rx={5.5} ry={5.5}
        fill="none" stroke={accent} strokeWidth={0.5} opacity={0.35}
      />
      <text x={x + pad} y={y + 18} fontSize={13} fontFamily="monospace" fill={textColor} fontWeight="700">
        {label}
      </text>
      {lines.map((line, i) =>
        line === '' ? null : (
          <text
            key={i}
            x={x + pad}
            y={y + 34 + i * 14}
            fontSize={11}
            fontFamily="monospace"
            fill="rgba(220,220,230,0.9)"
          >
            {line}
          </text>
        )
      )}
    </>
  );

  if (shouldReduce) {
    return <g>{inner}</g>;
  }

  const variants = {
    hidden: { opacity: 0, y: 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, delay: animDelay, ease: 'easeOut' as const } },
  };

  return (
    <motion.g variants={variants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0 }}>
      {inner}
    </motion.g>
  );
}

interface LayerRowProps {
  layerX: number;
  layerW: number;
  y: number;
  h: number;
  label: string;
  caption: string;
  colors: (typeof LAYER_COLORS)[keyof typeof LAYER_COLORS];
  children: React.ReactNode;
  rowDelay: number;
  shouldReduce: boolean;
  onClick?: () => void;
  triggerRef?: React.RefObject<SVGGElement | null>;
}

function LayerRow({ layerX, layerW, y, h, label, caption, colors, children, rowDelay, shouldReduce, onClick, triggerRef }: LayerRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const clickableProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: handleKeyDown,
        style: { cursor: 'pointer' } as React.CSSProperties,
        'aria-label': `${label} layer — click to expand`,
      }
    : {};

  if (shouldReduce) {
    return (
      <g
        ref={triggerRef as React.RefObject<SVGGElement>}
        aria-label={`${label} layer`}
        {...clickableProps}
      >
        <rect x={layerX} y={y} width={layerW} height={h} rx={10} ry={10} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
        <rect x={layerX + 10} y={y + 7} width={190} height={22} rx={4} ry={4} fill={colors.badge} />
        <text x={layerX + 19} y={y + 22} fontSize={11} fontFamily="monospace" fill={colors.text} fontWeight="700" letterSpacing="0.1em" textAnchor="start">
          {label.toUpperCase()}
        </text>
        <text x={layerX + 210} y={y + 22} fontSize={11.5} fontFamily="sans-serif" fill="rgba(220,220,230,0.92)" fontStyle="italic">
          {caption}
        </text>
        {onClick && (
          <TapCue
            x={layerX + layerW - 12}
            y={y + 18}
            color={colors.text}
            shouldReduce={shouldReduce}
          />
        )}
        {children}
      </g>
    );
  }

  const bandVariants = {
    hidden: { opacity: 0, scaleX: 0.92 },
    visible: { opacity: 1, scaleX: 1, transition: { duration: 0.35, delay: rowDelay, ease: 'easeOut' as const } },
  };
  const labelVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25, delay: rowDelay + 0.12 } },
  };

  return (
    <motion.g
      ref={triggerRef as React.RefObject<SVGGElement>}
      aria-label={`${label} layer`}
      {...clickableProps}
      whileHover={onClick ? { filter: 'brightness(1.12) drop-shadow(0 0 6px rgba(255,255,255,0.08))' } : undefined}
    >
      <motion.rect
        x={layerX} y={y} width={layerW} height={h} rx={10} ry={10}
        fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5}
        style={{ transformOrigin: `${layerX + layerW / 2}px ${y + h / 2}px` }}
        variants={bandVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0 }}
      />
      <motion.g variants={labelVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0 }}>
        <rect x={layerX + 10} y={y + 7} width={190} height={22} rx={4} ry={4} fill={colors.badge} />
        <text x={layerX + 19} y={y + 22} fontSize={11} fontFamily="monospace" fill={colors.text} fontWeight="700" letterSpacing="0.1em" textAnchor="start">
          {label.toUpperCase()}
        </text>
        <text x={layerX + 210} y={y + 22} fontSize={11.5} fontFamily="sans-serif" fill="rgba(220,220,230,0.92)" fontStyle="italic">
          {caption}
        </text>
        {onClick && (
          <TapCue
            x={layerX + layerW - 12}
            y={y + 18}
            color={colors.text}
            shouldReduce={shouldReduce}
          />
        )}
      </motion.g>
      {children}
    </motion.g>
  );
}

interface ArrowPathProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  delay: number;
  markerId: string;
  labelX?: number;
  labelY?: number;
  labelText?: string;
  labelFill?: string;
  shouldReduce: boolean;
}

function ArrowPath({ x1, y1, x2, y2, stroke: strokeColor, delay, markerId, labelX, labelY, labelText, labelFill, shouldReduce }: ArrowPathProps) {
  const pathId = `arch-path-${markerId}-${x1}-${y1}-${x2}-${y2}`;
  const pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
  const isIngest = strokeColor.includes('52,211,153');
  const bubbleFill = isIngest ? 'rgba(134,239,172,0.95)' : 'rgba(165,243,252,0.95)';

  if (shouldReduce) {
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={2.5} markerEnd={`url(#${markerId})`} />
        {labelText && <text x={labelX} y={labelY} fontSize={10} fontFamily="monospace" fontWeight="600" fill={labelFill}>{labelText}</text>}
      </g>
    );
  }
  return (
    <g>
      <defs>
        <path id={pathId} d={pathD} />
      </defs>
      {/* Glow trail — chunky soft halo so the path reads at a glance */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={strokeColor}
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.22}
      />
      <motion.path
        d={pathD}
        stroke={strokeColor}
        strokeWidth={2.75}
        strokeLinecap="round"
        fill="none"
        markerEnd={`url(#${markerId})`}
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0 }}
        transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      />
      {/* Flowing bubbles along the arrow — echoes loop-slide motion.
          Four bubbles at different offsets so the stream is always visible. */}
      {[0, 0.25, 0.5, 0.75].map((offset) => (
        <circle key={offset} r={2.75} fill={bubbleFill}>
          <animateMotion
            dur="2.4s"
            repeatCount="indefinite"
            begin={`${delay + 0.35 + offset * 2.4}s`}
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="2.4s"
            repeatCount="indefinite"
            begin={`${delay + 0.35 + offset * 2.4}s`}
          />
        </circle>
      ))}
      {labelText && (
        <motion.text
          x={labelX} y={labelY}
          fontSize={10} fontFamily="monospace" fontWeight="600"
          fill={labelFill}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.25, delay: delay + 0.35 }}
        >
          {labelText}
        </motion.text>
      )}
    </g>
  );
}

// Tap cue — rising-bubble micro-interaction matching the ClickBubble
// component used on every FlipCard in the presentation deck.
// Three bubbles rise upward and fade; cycle staggered with negative begin.
interface TapCueProps {
  x: number;       // anchor point (bubbles rise toward this y)
  y: number;
  color: string;
  shouldReduce: boolean;
}
function TapCue({ x, y, color, shouldReduce }: TapCueProps) {
  // bubble params match ClickBubble: {6, 4, 3} px sizes, staggered offsets
  const bubbles = [
    { r: 3,   dx: 1,  begin: '-0.5s',  dur: '2.4s' },
    { r: 2,   dx: 5,  begin: '-1.8s',  dur: '2.1s' },
    { r: 1.5, dx: 3,  begin: '-3.1s',  dur: '2.7s' },
  ];
  // bubbles travel from y+9 (bottom of cue) up to y-9 (above cue)
  const bottomY = y + 9;
  const topY = y - 9;

  const label = (
    <text
      x={x - 9} y={y + 3}
      fontSize={9} fontFamily="monospace"
      fill={color} opacity={0.85} textAnchor="end"
      letterSpacing="0.08em"
    >
      tap
    </text>
  );

  if (shouldReduce) {
    return (
      <g aria-hidden>
        <circle cx={x} cy={y} r={3} fill={color} opacity={0.85} />
        {label}
      </g>
    );
  }

  return (
    <g aria-hidden>
      {bubbles.map((b, i) => (
        <circle key={i} cx={x + b.dx} r={b.r} fill={color} opacity={0}>
          <animate
            attributeName="cy"
            values={`${bottomY};${topY}`}
            dur={b.dur}
            begin={b.begin}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.95;0.95;0"
            dur={b.dur}
            begin={b.begin}
            repeatCount="indefinite"
          />
        </circle>
      ))}
      {label}
    </g>
  );
}

// Cross-cutting band panel — mirrors LayerRow / CompBox styling for a
// consistent cyberpunk-underwater look: accent bar on the left, badge
// header, structured item tags, and the same rising-bubble tap cue.
interface BandPanelProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  items: string[];
  colors: (typeof BAND_COLORS)[keyof typeof BAND_COLORS];
  clickableProps: React.SVGAttributes<SVGGElement> & { 'aria-label'?: string; role?: 'button'; tabIndex?: number };
  triggerRef: React.RefObject<SVGGElement | null>;
  shouldReduce: boolean;
}

function BandPanel({
  x, y, w, h, label, items, colors, clickableProps, triggerRef, shouldReduce,
}: BandPanelProps) {
  const badgeW = 150;
  const headerH = 34;        // space above the first item
  const padBottom = 10;      // trailing pad below the last item
  const itemRectH = 20;      // height of each item's pill
  // distribute items across the panel: step so last pill bottom sits at h-padBottom
  const n = items.length;
  const availableForItems = h - headerH - padBottom - itemRectH;
  const itemStep = n > 1 ? availableForItems / (n - 1) : 0;
  const itemsStartY = y + headerH;
  const itemX = x + 18;
  const itemW = w - 28;

  return (
    <g ref={triggerRef} {...clickableProps}>
      {/* outer frame */}
      <rect x={x} y={y} width={w} height={h} rx={8} ry={8}
        fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
      {/* inner accent rim */}
      <rect x={x + 0.75} y={y + 0.75} width={w - 1.5} height={h - 1.5} rx={7} ry={7}
        fill="none" stroke={colors.stroke} strokeWidth={0.5} opacity={0.5} />
      {/* left accent bar */}
      <rect x={x + 4} y={y + 10} width={3} height={h - 20} rx={1.5} ry={1.5}
        fill={colors.text} opacity={0.8} />

      {/* badge header */}
      <rect x={x + 14} y={y + 8} width={badgeW} height={22} rx={4} ry={4}
        fill={colors.stroke} opacity={0.22} />
      <text x={x + 22} y={y + 23}
        fontSize={11} fontFamily="monospace"
        fill={colors.text} fontWeight="700" letterSpacing="0.18em">
        {label}
      </text>
      <TapCue x={x + w - 12} y={y + 19} color={colors.text} shouldReduce={shouldReduce} />

      {/* item tags — evenly distributed so the panel has no trailing air */}
      {items.map((item, i) => {
        const rectY = itemsStartY + i * itemStep;
        return (
          <g key={item}>
            <rect
              x={itemX} y={rectY}
              width={itemW} height={itemRectH}
              rx={3} ry={3}
              fill="rgba(9,9,17,0.6)"
              stroke={colors.stroke}
              strokeWidth={0.75}
              opacity={0.85}
            />
            <circle
              cx={itemX + 8} cy={rectY + itemRectH / 2}
              r={1.8} fill={colors.text} opacity={0.85}
            />
            <text
              x={itemX + 16} y={rectY + itemRectH / 2 + 4}
              fontSize={11} fontFamily="monospace"
              fill={colors.itemColor}
            >
              {item}
            </text>
          </g>
        );
      })}
    </g>
  );
}

interface BandGroupProps {
  children: React.ReactNode;
  delay: number;
  shouldReduce: boolean;
}

function BandGroup({ children, delay, shouldReduce }: BandGroupProps) {
  if (shouldReduce) {
    return <g>{children}</g>;
  }
  return (
    <motion.g
      initial={{ opacity: 0, x: 28 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.g>
  );
}

// ─── Layer Detail Modal ──────────────────────────────────────────────────────

interface LayerDetailModalProps {
  layer: LayerDetail;
  onClose: () => void;
  triggerEl: SVGGElement | null;
}

function LayerDetailModal({ layer, onClose, triggerEl }: LayerDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount; restore focus to trigger on unmount
  useEffect(() => {
    closeButtonRef.current?.focus();
    // capture the element at effect setup time to avoid stale-ref warning
    const target = triggerEl;
    return () => {
      target?.focus();
    };
  }, [triggerEl]);

  // Escape key dismissal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/80"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal panel */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${layer.label} layer detail`}
          className="relative z-10 w-full max-w-2xl rounded-xl border bg-zinc-950 p-6 shadow-2xl"
          style={{
            borderColor: layer.colors.stroke,
            boxShadow: `0 0 48px ${layer.colors.stroke}`,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {/* Close button */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            aria-label="Close layer detail"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>

          {/* Header */}
          <div className="mb-5 flex items-start gap-3 pr-10">
            <div
              className="mt-0.5 rounded px-2 py-1 text-xs font-bold tracking-widest"
              style={{ backgroundColor: layer.colors.badge, color: layer.colors.text, fontFamily: 'monospace' }}
            >
              {layer.label.toUpperCase()}
            </div>
          </div>

          <p className="mb-1 text-sm italic" style={{ color: 'rgba(210,210,220,0.85)' }}>
            {layer.caption}
          </p>

          {/* Purpose */}
          <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Purpose</p>
          <p className="mb-4 text-sm text-zinc-300">{layer.purpose}</p>

          {/* Components */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Components</p>
          <div className="mb-4 flex flex-col gap-3">
            {layer.components.map((comp) => (
              <div
                key={comp.name}
                className="rounded-lg border p-3"
                style={{ borderColor: layer.colors.stroke, backgroundColor: layer.colors.fill }}
              >
                <p className="mb-0.5 text-sm font-semibold" style={{ color: layer.colors.text, fontFamily: 'monospace' }}>
                  {comp.name}
                </p>
                <p className="mb-1 text-xs text-zinc-400" style={{ fontFamily: 'monospace' }}>
                  {comp.tech}
                </p>
                {comp.detail && (
                  <p className="text-xs text-zinc-500">{comp.detail}</p>
                )}
              </div>
            ))}
          </div>

          {/* Trade-off */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-zinc-500">Trade-off</p>
            <p className="text-xs text-zinc-400">{layer.tradeoff}</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ─── Desktop SVG (≥ 768px) ──────────────────────────────────────────────────

// SSR-safe reduced-motion: useReducedMotion returns null on the server but
// synchronously reads matchMedia on the client's first render, producing a
// hydration mismatch when the user has reduced motion enabled. Defer until
// mount so the first client render matches SSR.
function useSSRSafeReducedMotion(): boolean {
  const pref = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect
  return mounted && !!pref;
}

function DesktopDiagram() {
  const shouldReduce = useSSRSafeReducedMotion();
  const [activeLayer, setActiveLayer] = useState<DetailKey | null>(null);
  // Store the actual DOM element that triggered the modal (for focus restoration)
  const [triggerEl, setTriggerEl] = useState<SVGGElement | null>(null);

  // Individual refs for each layer row
  const refAgentAccessible = useRef<SVGGElement>(null);
  const refIntelligence = useRef<SVGGElement>(null);
  const refSemantic = useRef<SVGGElement>(null);
  const refCompounding = useRef<SVGGElement>(null);
  const refObservability = useRef<SVGGElement>(null);
  const refGovernance = useRef<SVGGElement>(null);
  const refPerformance = useRef<SVGGElement>(null);

  const openLayer = useCallback((key: DetailKey, el: SVGGElement | null) => {
    setTriggerEl(el);
    setActiveLayer(key);
  }, []);
  const closeLayer = useCallback(() => setActiveLayer(null), []);

  const activeDetail = activeLayer ? ALL_DETAILS.find((l) => l.key === activeLayer) ?? null : null;

  const bandKeyHandler = (key: BandKey, ref: React.RefObject<SVGGElement | null>) => (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLayer(key, ref.current);
    }
  };
  const clickableBandProps = (key: BandKey, ref: React.RefObject<SVGGElement | null>, label: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => openLayer(key, ref.current),
    onKeyDown: bandKeyHandler(key, ref),
    style: { cursor: 'pointer' } as React.CSSProperties,
    'aria-label': `${label} band — click to expand`,
  });

  const W = 1000;
  const H = 600;

  const layerX = 16;
  const layerW = 700;
  const layerGap = 22;

  const rowH = [100, 118, 148, 100];
  const totalLayerH = rowH.reduce((a, b) => a + b, 0) + layerGap * 3;
  // Reserve a top strip for the arrow legend so it never collides with
  // the Interface panel's badge. Bottom strip kept equal for visual balance.
  const topStrip = 34;
  const layerY = topStrip + Math.max(0, (H - topStrip - totalLayerH) / 2);

  const rowY: number[] = [];
  let curY = layerY;
  for (const h of rowH) {
    rowY.push(curY);
    curY += h + layerGap;
  }

  const bandX = layerX + layerW + 16;
  const bandW = W - bandX - 16;
  const bandY0 = layerY;

  // Tight-fit bands — each band sized to its own items, no trailing air.
  // Formula: header(34) + items*itemH + padBottom(12). Remaining layer-area
  // vertical slack distributed as extra gap between bands so the trio
  // still spans the layer stack without stretching any individual panel.
  const bandItemCounts = [5, 4, 4];
  const bandItemH = 26;
  const bandHeaderPx = 34;
  const bandPadBottomPx = 12;
  const bandHeights = bandItemCounts.map(
    (n) => bandHeaderPx + n * bandItemH + bandPadBottomPx
  );
  const bandsContentH = bandHeights.reduce((a, b) => a + b, 0);
  const bandGapPx = Math.max(8, (totalLayerH - bandsContentH) / 2);
  const bandYs = [
    bandY0,
    bandY0 + bandHeights[0] + bandGapPx,
    bandY0 + bandHeights[0] + bandHeights[1] + bandGapPx * 2,
  ];

  // Continuous motion circuit — rounded rect that wraps the whole layer
  // stack so the query path (left, CCW, cyan) and ingest flow (right, CW,
  // green) read as one always-on circulatory loop, echoing the loop slide.
  const circuitPad = 10;
  const cx1 = layerX - circuitPad;
  const cy1 = layerY - circuitPad;
  const cx2 = layerX + layerW + circuitPad;
  const cy2 = layerY + totalLayerH + circuitPad;
  const cr = 12;
  // CCW path starting top-left corner — used for query bubbles (down-left side)
  const circuitPath =
    `M ${cx1 + cr} ${cy1} ` +
    `L ${cx2 - cr} ${cy1} ` +
    `A ${cr} ${cr} 0 0 1 ${cx2} ${cy1 + cr} ` +
    `L ${cx2} ${cy2 - cr} ` +
    `A ${cr} ${cr} 0 0 1 ${cx2 - cr} ${cy2} ` +
    `L ${cx1 + cr} ${cy2} ` +
    `A ${cr} ${cr} 0 0 1 ${cx1} ${cy2 - cr} ` +
    `L ${cx1} ${cy1 + cr} ` +
    `A ${cr} ${cr} 0 0 1 ${cx1 + cr} ${cy1} Z`;

  const arrowId = 'arch-arrow';
  const arrowUpId = 'arch-arrow-up';

  // Timing constants
  const layerBaseDelay = 0.25;   // outer frame fade-in
  const rowStagger = 0.18;       // each row 180ms after previous
  const compBoxStagger = 0.08;   // each box inside a row
  const arrowDelay = layerBaseDelay + rowStagger * 4 + 0.15;
  const bandDelay = arrowDelay + 0.25;

  const containerVariants = shouldReduce
    ? undefined
    : {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.35, delay: 0.05 } },
      };

  return (
    <>
      <motion.svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="arch-title arch-desc"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        variants={containerVariants}
        initial={shouldReduce ? false : 'hidden'}
        whileInView={shouldReduce ? undefined : 'visible'}
        viewport={{ once: true, amount: 0.4 }}
      >
        <title id="arch-title">Reporium AI-Native Architecture</title>
        <desc id="arch-desc">
          Four AI-native layers (Interface, Intelligence, Semantic, Data) with three cross-cutting bands
          (Observability, Governance, Performance) mapping to real Reporium services. Click any layer to expand it.
        </desc>

        <defs>
          <marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(34,211,238,0.7)" />
          </marker>
          <marker id={arrowUpId} markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto">
            <path d="M8,0 L8,6 L0,3 z" fill="rgba(52,211,153,0.7)" />
          </marker>
        </defs>

        {/* Arrow legend — seated in the reserved top strip above all panels */}
        <g aria-label="Arrow legend">
          <rect x={W - 300} y={10} width={14} height={14} fill="rgba(34,211,238,0.6)" />
          <text x={W - 282} y={22} fontSize={11} fontFamily="monospace" fill="rgba(34,211,238,0.9)">query path ↓</text>
          <rect x={W - 180} y={10} width={14} height={14} fill="rgba(52,211,153,0.6)" />
          <text x={W - 162} y={22} fontSize={11} fontFamily="monospace" fill="rgba(52,211,153,0.9)">ingest flow ↑</text>
        </g>

        {/* Continuous motion circuit — wraps the 4 layers; cyan bubbles
            flow CCW (query path down the left), green bubbles flow CW
            (ingest up the right). Low-opacity ambient motion, matches
            the loop slide's underwater-cyberpunk motion vocabulary. */}
        <defs>
          <path id="arch-circuit" d={circuitPath} />
          <path id="arch-circuit-rev" d={
            // Reversed path for CW traversal (ingest flow — right-side up)
            `M ${cx2 - cr} ${cy1} ` +
            `L ${cx1 + cr} ${cy1} ` +
            `A ${cr} ${cr} 0 0 0 ${cx1} ${cy1 + cr} ` +
            `L ${cx1} ${cy2 - cr} ` +
            `A ${cr} ${cr} 0 0 0 ${cx1 + cr} ${cy2} ` +
            `L ${cx2 - cr} ${cy2} ` +
            `A ${cr} ${cr} 0 0 0 ${cx2} ${cy2 - cr} ` +
            `L ${cx2} ${cy1 + cr} ` +
            `A ${cr} ${cr} 0 0 0 ${cx2 - cr} ${cy1} Z`
          } />
        </defs>
        <g aria-hidden="true" opacity={0.9}>
          <use href="#arch-circuit" fill="none" stroke="rgba(165,243,252,0.18)" strokeWidth={1} strokeDasharray="3 4" />
          {!shouldReduce && (
            <>
              {/* Query path — cyan bubbles flowing CCW (down the left side) */}
              {[0, 0.2, 0.4, 0.6, 0.8].map((offset) => (
                <circle key={`q-${offset}`} r={2.5} fill="rgba(165,243,252,0.85)">
                  <animateMotion dur="9s" repeatCount="indefinite" begin={`${offset * 9}s`}>
                    <mpath href="#arch-circuit" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0.9;0.9;0"
                    dur="9s" repeatCount="indefinite" begin={`${offset * 9}s`} />
                </circle>
              ))}
              {/* Ingest flow — green bubbles flowing CW (up the right side) */}
              {[0, 0.25, 0.5, 0.75].map((offset) => (
                <circle key={`i-${offset}`} r={2.5} fill="rgba(134,239,172,0.85)">
                  <animateMotion dur="10s" repeatCount="indefinite" begin={`${offset * 10}s`}>
                    <mpath href="#arch-circuit-rev" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0.9;0.9;0"
                    dur="10s" repeatCount="indefinite" begin={`${offset * 10}s`} />
                </circle>
              ))}
            </>
          )}
        </g>

        {/* ── Layer 1: Interface ─────────────────────────────────────────── */}
        <LayerRow
          layerX={layerX} layerW={layerW}
          y={rowY[0]} h={rowH[0]}
          label="Interface Layer"
          caption="MCP and typed endpoints — agents call this directly"
          colors={LAYER_COLORS.agentAccessible}
          rowDelay={layerBaseDelay}
          shouldReduce={shouldReduce}
          onClick={() => openLayer('agentAccessible', refAgentAccessible.current)}
          triggerRef={refAgentAccessible}
        >
          <CompBox
            x={layerX + 12} y={rowY[0] + 38} w={220} h={56}
            label="Reporium Web"
            sublabel={["Next.js · Vercel", "human readers"]}
            accent="rgba(147,51,234,0.5)" textColor="#c084fc"
            animDelay={layerBaseDelay + 0.15}
            shouldReduce={shouldReduce}
          />
          <CompBox
            x={layerX + 240} y={rowY[0] + 38} w={220} h={56}
            label="reporium-mcp"
            sublabel={["MCP protocol", "agent readers"]}
            accent="rgba(147,51,234,0.5)" textColor="#c084fc"
            animDelay={layerBaseDelay + 0.15 + compBoxStagger}
            shouldReduce={shouldReduce}
          />
          <CompBox
            x={layerX + 468} y={rowY[0] + 38} w={220} h={56}
            label="External orchestrators"
            sublabel={["Workato · LangChain", "Claude Desktop · custom"]}
            accent="rgba(147,51,234,0.4)" textColor="#c084fc"
            animDelay={layerBaseDelay + 0.15 + compBoxStagger * 2}
            shouldReduce={shouldReduce}
          />
        </LayerRow>

        {/* Query path arrow: Interface → Intelligence */}
        <ArrowPath
          x1={layerX + 80} y1={rowY[0] + rowH[0]}
          x2={layerX + 80} y2={rowY[1]}
          stroke="rgba(34,211,238,0.85)"
          delay={arrowDelay}
          markerId={arrowId}
          labelX={layerX + 94} labelY={rowY[0] + rowH[0] + 14}
          labelText="query ↓" labelFill="rgba(165,243,252,0.95)"
          shouldReduce={shouldReduce}
        />

        {/* ── Layer 2: Intelligence ──────────────────────────────────────── */}
        <LayerRow
          layerX={layerX} layerW={layerW}
          y={rowY[1]} h={rowH[1]}
          label="Intelligence Layer"
          caption="AI is in the decision loop"
          colors={LAYER_COLORS.intelligence}
          rowDelay={layerBaseDelay + rowStagger}
          shouldReduce={shouldReduce}
          onClick={() => openLayer('intelligence', refIntelligence.current)}
          triggerRef={refIntelligence}
        >
          <CompBox
            x={layerX + 12} y={rowY[1] + 38} w={328} h={76}
            label="reporium-api"
            sublabel={[
              "FastAPI · Cloud Run · Sentry",
              "public reads / ingest (keyed)",
              "admin (keyed) · Scalar docs",
            ]}
            accent="rgba(217,70,239,0.5)" textColor="#f0abfc"
            animDelay={layerBaseDelay + rowStagger + 0.15}
            shouldReduce={shouldReduce}
          />
          <CompBox
            x={layerX + 348} y={rowY[1] + 38} w={340} h={50}
            label="LLM enrichment"
            sublabel="model-agnostic — Claude · GPT · local"
            accent="rgba(217,70,239,0.5)" textColor="#f0abfc"
            animDelay={layerBaseDelay + rowStagger + 0.15 + compBoxStagger}
            shouldReduce={shouldReduce}
          />
          <CompBox
            x={layerX + 348} y={rowY[1] + 92} w={340} h={22}
            label="Pub/Sub · topic: repo-ingested"
            accent="rgba(217,70,239,0.4)" textColor="#f0abfc"
            animDelay={layerBaseDelay + rowStagger + 0.15 + compBoxStagger * 2}
            shouldReduce={shouldReduce}
          />
        </LayerRow>

        {/* Query path arrow: Intelligence → Semantic */}
        <ArrowPath
          x1={layerX + 80} y1={rowY[1] + rowH[1]}
          x2={layerX + 80} y2={rowY[2]}
          stroke="rgba(34,211,238,0.85)"
          delay={arrowDelay + 0.1}
          markerId={arrowId}
          labelX={layerX + 94} labelY={rowY[1] + rowH[1] + 14}
          labelText="query ↓" labelFill="rgba(165,243,252,0.95)"
          shouldReduce={shouldReduce}
        />

        {/* ── Layer 3: Semantic ──────────────────────────────────────────── */}
        <LayerRow
          layerX={layerX} layerW={layerW}
          y={rowY[2]} h={rowH[2]}
          label="Semantic Layer"
          caption="Retrieval is by meaning, not strings"
          colors={LAYER_COLORS.semantic}
          rowDelay={layerBaseDelay + rowStagger * 2}
          shouldReduce={shouldReduce}
          onClick={() => openLayer('semantic', refSemantic.current)}
          triggerRef={refSemantic}
        >
          <CompBox
            x={layerX + 12} y={rowY[2] + 38} w={328} h={104}
            label="Postgres + pgvector"
            sublabel={[
              "Cloud SQL · managed backups",
              "",
              "repo_embeddings",
              "384-dim · HNSW · cosine_ops",
              "taxonomy_values",
              "cosine ≥ 0.65 · 8 dims",
            ]}
            accent="rgba(34,211,238,0.5)" textColor="#67e8f9"
            animDelay={layerBaseDelay + rowStagger * 2 + 0.15}
            shouldReduce={shouldReduce}
          />

          <CompBox
            x={layerX + 348} y={rowY[2] + 38} w={340} h={46}
            label="GCS snapshot"
            sublabel="read fallback for /graph/edges"
            accent="rgba(34,211,238,0.4)" textColor="#67e8f9"
            animDelay={layerBaseDelay + rowStagger * 2 + 0.15 + compBoxStagger}
            shouldReduce={shouldReduce}
          />
          <CompBox
            x={layerX + 348} y={rowY[2] + 90} w={340} h={52}
            label="Redis cache (optional)"
            sublabel={[
              "/library/full · 5-min TTL",
              "HNSW approx-NN",
            ]}
            accent="rgba(34,211,238,0.35)" textColor="#67e8f9"
            animDelay={layerBaseDelay + rowStagger * 2 + 0.15 + compBoxStagger * 2}
            shouldReduce={shouldReduce}
          />
        </LayerRow>

        {/* Ingest flow arrow: Data → Semantic (up) */}
        <ArrowPath
          x1={layerX + 520} y1={rowY[3]}
          x2={layerX + 520} y2={rowY[2] + rowH[2]}
          stroke="rgba(52,211,153,0.85)"
          delay={arrowDelay + 0.2}
          markerId={arrowUpId}
          labelX={layerX + 534} labelY={rowY[3] - 4}
          labelText="ingest ↑" labelFill="rgba(134,239,172,0.95)"
          shouldReduce={shouldReduce}
        />

        {/* ── Layer 4: Compounding ──────────────────────────────────────── */}
        <LayerRow
          layerX={layerX} layerW={layerW}
          y={rowY[3]} h={rowH[3]}
          label="Data Layer"
          caption="Every ingest makes the next query better"
          colors={LAYER_COLORS.compounding}
          rowDelay={layerBaseDelay + rowStagger * 3}
          shouldReduce={shouldReduce}
          onClick={() => openLayer('compounding', refCompounding.current)}
          triggerRef={refCompounding}
        >
          <CompBox
            x={layerX + 12} y={rowY[3] + 38} w={372} h={56}
            label="reporium-ingestion"
            sublabel={[
              "Cloud Run Job · nightly cron",
              "pull → enrich → POST /ingest → publish",
            ]}
            accent="rgba(52,211,153,0.5)" textColor="#6ee7b7"
            animDelay={layerBaseDelay + rowStagger * 3 + 0.15}
            shouldReduce={shouldReduce}
          />
          <CompBox
            x={layerX + 392} y={rowY[3] + 38} w={296} h={56}
            label="forksync"
            sublabel={[
              "Cloud Run Job · nightly cron",
              "fork alignment w/ upstream",
            ]}
            accent="rgba(52,211,153,0.45)" textColor="#6ee7b7"
            animDelay={layerBaseDelay + rowStagger * 3 + 0.15 + compBoxStagger}
            shouldReduce={shouldReduce}
          />
        </LayerRow>

        {/* ── Cross-cutting bands ─────────────────────────────────────────── */}

        {/* Observability */}
        <BandGroup delay={bandDelay} shouldReduce={shouldReduce}>
          <BandPanel
            triggerRef={refObservability}
            clickableProps={clickableBandProps('observability', refObservability, 'Observability')} /* eslint-disable-line react-hooks/refs */
            x={bandX} y={bandYs[0]} w={bandW} h={bandHeights[0]}
            label="OBSERVABILITY"
            colors={BAND_COLORS.observability}
            items={[
              '/health (DB, Redis, ingest)',
              '/admin/data-quality',
              'ingestion_log table',
              'observability/ directory',
              'Scalar API docs (/docs)',
            ]}
            shouldReduce={shouldReduce}
          />
        </BandGroup>

        {/* Governance */}
        <BandGroup delay={bandDelay + 0.12} shouldReduce={shouldReduce}>
          <BandPanel
            triggerRef={refGovernance}
            clickableProps={clickableBandProps('governance', refGovernance, 'Governance')} /* eslint-disable-line react-hooks/refs */
            x={bandX} y={bandYs[1]} w={bandW} h={bandHeights[1]}
            label="GOVERNANCE"
            colors={BAND_COLORS.governance}
            items={[
              'X-Ingest-Key (writes)',
              'X-Admin-Key (admin ops)',
              'GCP Secret Manager',
              'SECURITY_AUDIT.md',
            ]}
            shouldReduce={shouldReduce}
          />
        </BandGroup>

        {/* Performance */}
        <BandGroup delay={bandDelay + 0.24} shouldReduce={shouldReduce}>
          <BandPanel
            triggerRef={refPerformance}
            clickableProps={clickableBandProps('performance', refPerformance, 'Performance')} /* eslint-disable-line react-hooks/refs */
            x={bandX} y={bandYs[2]} w={bandW} h={bandHeights[2]}
            label="PERFORMANCE"
            colors={BAND_COLORS.performance}
            items={[
              'Redis cache (optional)',
              '/library/full (5-min)',
              'HNSW approximate-NN',
              'GCS snapshot fallback',
            ]}
            shouldReduce={shouldReduce}
          />
        </BandGroup>
      </motion.svg>

      {/* Layer detail modal — portal-rendered outside SVG */}
      {activeDetail && (
        <LayerDetailModal
          layer={activeDetail}
          onClose={closeLayer}
          triggerEl={triggerEl}
        />
      )}
    </>
  );
}

// ─── Mobile SVG (< 768px): layers stacked, bands below ─────────────────────

const MOBILE_LAYERS = [
  {
    key: 'agent',
    label: 'Interface Layer',
    caption: 'MCP and typed endpoints — agents call this directly',
    colors: LAYER_COLORS.agentAccessible,
    items: [
      { text: 'Reporium Web (Next.js · human readers)', sub: false },
      { text: 'reporium-mcp (MCP protocol · agent readers)', sub: false },
      { text: 'External orchestrators', sub: false },
      { text: 'Workato · LangChain · Claude Desktop · custom', sub: true },
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence Layer',
    caption: 'AI is in the decision loop',
    colors: LAYER_COLORS.intelligence,
    items: [
      { text: 'reporium-api (FastAPI · Cloud Run)', sub: false },
      { text: 'public reads / ingest (keyed) / admin (keyed)', sub: true },
      { text: 'LLM enrichment (model-agnostic — Claude, GPT, local)', sub: false },
      { text: 'Pub/Sub event bus (topic: repo-ingested)', sub: false },
    ],
  },
  {
    key: 'semantic',
    label: 'Semantic Layer',
    caption: 'Retrieval is by meaning, not strings',
    colors: LAYER_COLORS.semantic,
    items: [
      { text: 'Postgres + pgvector (Cloud SQL)', sub: false },
      { text: 'repo_embeddings — 384-dim · HNSW · vector_cosine_ops', sub: true },
      { text: 'taxonomy_values — 8 dynamic dimensions · embedded', sub: true },
      { text: 'cosine ≥ 0.65 taxonomy assignment', sub: true },
      { text: 'GCS snapshot (read fallback for /graph/edges)', sub: false },
    ],
  },
  {
    key: 'compounding',
    label: 'Data Layer',
    caption: 'Every ingest makes the next query better',
    colors: LAYER_COLORS.compounding,
    items: [
      { text: 'reporium-ingestion (Cloud Run Job · nightly)', sub: false },
      { text: 'pull → LLM enrich → POST /ingest/repos → publish repo.ingested', sub: true },
      { text: 'forksync (Cloud Run Job · nightly)', sub: false },
      { text: 'keeps forks aligned with upstreams', sub: true },
    ],
  },
];

const MOBILE_BANDS = [
  {
    key: 'observability',
    label: 'OBSERVABILITY',
    colors: BAND_COLORS.observability,
    items: [
      '/health (DB, Redis, last ingestion)',
      '/admin/data-quality',
      'ingestion_log table',
      'observability/ directory',
      'Scalar API docs (/docs)',
    ],
  },
  {
    key: 'governance',
    label: 'GOVERNANCE',
    colors: BAND_COLORS.governance,
    items: [
      'X-Ingest-Key (ingest writes)',
      'X-Admin-Key (admin ops)',
      'GCP Secret Manager',
      'SECURITY_AUDIT.md',
    ],
  },
  {
    key: 'performance',
    label: 'PERFORMANCE',
    colors: BAND_COLORS.performance,
    items: [
      'Redis cache (optional)',
      '/library/full (5-min cache)',
      'HNSW approximate-NN',
      'GCS snapshot read fallback',
    ],
  },
];

function MobileDiagram() {
  const shouldReduce = useSSRSafeReducedMotion();

  const W = 480;
  const rowH = 108;
  const rowGap = 6;
  const arrowH = 16;
  const layersTotalH = MOBILE_LAYERS.length * rowH + (MOBILE_LAYERS.length - 1) * (rowGap + arrowH);

  const bandH = 100;
  const bandGap = 8;
  const bandsStartY = layersTotalH + 24;
  const totalH = bandsStartY + MOBILE_BANDS.length * bandH + (MOBILE_BANDS.length - 1) * bandGap + 10;

  return (
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      role="img"
      aria-labelledby="arch-title-m arch-desc-m"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <title id="arch-title-m">Reporium AI-Native Architecture</title>
      <desc id="arch-desc-m">
        Four AI-native layers (Interface, Intelligence, Semantic, Data) with three
        cross-cutting bands (Observability, Governance, Performance) mapping to real Reporium services.
      </desc>

      <defs>
        <marker id="m-arrow-down" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(34,211,238,0.7)" />
        </marker>
      </defs>

      {MOBILE_LAYERS.map((layer, li) => {
        const y = li * (rowH + rowGap + arrowH);
        const animDelay = li * 0.15;

        const inner = (
          <g>
            <rect x={8} y={y} width={W - 16} height={rowH} rx={8} ry={8} fill={layer.colors.fill} stroke={layer.colors.stroke} strokeWidth={1.5} />
            {/* Badge */}
            <rect x={16} y={y + 7} width={175} height={22} rx={4} ry={4} fill={layer.colors.badge} />
            <text x={24} y={y + 22} fontSize={10.5} fontFamily="monospace" fill={layer.colors.text} fontWeight="700" letterSpacing="0.1em">
              {layer.label.toUpperCase()}
            </text>
            {/* Caption — legibility improved */}
            <text x={200} y={y + 22} fontSize={10} fontFamily="sans-serif" fill="rgba(220,220,230,0.92)" fontStyle="italic">
              {layer.caption}
            </text>
            {/* Items — primary vs sub-detail differentiated */}
            {layer.items.map((item, ii) => (
              <text
                key={`${layer.key}-item-${ii}`}
                x={item.sub ? 24 : 16} y={y + 42 + ii * 16}
                fontSize={item.sub ? 10 : 11}
                fontFamily="monospace"
                fontWeight={item.sub ? 400 : 600}
                fill={item.sub ? 'rgba(190,190,200,0.85)' : 'rgba(235,235,240,0.95)'}
              >
                {item.text}
              </text>
            ))}
            {/* Arrow between layers */}
            {li < MOBILE_LAYERS.length - 1 && (
              <line
                x1={W / 2} y1={y + rowH}
                x2={W / 2} y2={y + rowH + arrowH}
                stroke="rgba(34,211,238,0.5)" strokeWidth={1.5} strokeDasharray="3 2"
                markerEnd="url(#m-arrow-down)"
              />
            )}
          </g>
        );

        if (shouldReduce) {
          return <g key={layer.key} aria-label={`${layer.label} layer`}>{inner}</g>;
        }

        return (
          <motion.g
            key={layer.key}
            aria-label={`${layer.label} layer`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: animDelay, ease: 'easeOut' }}
          >
            {inner}
          </motion.g>
        );
      })}

      {/* Cross-cutting bands label */}
      <text x={W / 2} y={bandsStartY - 6} fontSize={9} fontFamily="monospace" fill="rgba(161,161,170,0.6)" textAnchor="middle" letterSpacing="0.12em">
        CROSS-CUTTING CONCERNS
      </text>

      {MOBILE_BANDS.map((band, bi) => {
        const y = bandsStartY + bi * (bandH + bandGap);
        const animDelay = MOBILE_LAYERS.length * 0.15 + bi * 0.12;

        const inner = (
          <g>
            <rect x={8} y={y} width={W - 16} height={bandH} rx={8} ry={8} fill={band.colors.fill} stroke={band.colors.stroke} strokeWidth={1.5} />
            <text x={W / 2} y={y + 20} fontSize={11.5} fontFamily="monospace" fill={band.colors.text} fontWeight="700" textAnchor="middle" letterSpacing="0.18em">
              {band.label}
            </text>
            {band.items.map((item, ii) => (
              <text key={`${band.key}-item-${ii}`} x={16} y={y + 40 + ii * 16} fontSize={11} fontFamily="monospace" fill="rgba(230,230,235,0.92)">
                {item}
              </text>
            ))}
          </g>
        );

        if (shouldReduce) {
          return <g key={band.key} aria-label={`${band.label} band`}>{inner}</g>;
        }

        return (
          <motion.g
            key={band.key}
            aria-label={`${band.label} band`}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: animDelay, ease: 'easeOut' }}
          >
            {inner}
          </motion.g>
        );
      })}
    </svg>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

export function ArchitectureDiagram() {
  // Initialize to false (desktop); hydrate on mount to avoid SSR mismatch
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = (matches: boolean) => setIsMobile(matches);
    update(mq.matches);
    const handler = (e: MediaQueryListEvent) => update(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 sm:p-2.5"
      style={{ boxShadow: '0 0 32px rgba(34,211,238,0.06), 0 0 64px rgba(217,70,239,0.05)' }}
    >
      {isMobile ? <MobileDiagram /> : <DesktopDiagram />}
    </div>
  );
}
