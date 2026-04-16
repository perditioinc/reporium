'use client';

import React, { useEffect, useState } from 'react';

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
    fill: 'rgba(251,191,36,0.06)',
    stroke: 'rgba(251,191,36,0.35)',
    text: '#fcd34d',
    itemColor: 'rgba(253,211,77,0.8)',
  },
  governance: {
    fill: 'rgba(239,68,68,0.06)',
    stroke: 'rgba(239,68,68,0.35)',
    text: '#fca5a5',
    itemColor: 'rgba(252,165,165,0.8)',
  },
  performance: {
    fill: 'rgba(99,102,241,0.06)',
    stroke: 'rgba(99,102,241,0.35)',
    text: '#a5b4fc',
    itemColor: 'rgba(165,180,252,0.8)',
  },
} as const;

// ─── SVG sub-components (defined at module level to avoid react-hooks/static-components) ──

interface CompBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel?: string;
  accent: string;
  textColor: string;
}

function CompBox({ x, y, w, h, label, sublabel, accent, textColor }: CompBoxProps) {
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx={6} ry={6}
        fill="rgba(9,9,17,0.75)"
        stroke={accent}
        strokeWidth={1}
      />
      <text x={x + 8} y={y + 14} fontSize={10} fontFamily="monospace" fill={textColor} fontWeight="600">
        {label}
      </text>
      {sublabel && (
        <text x={x + 8} y={y + 26} fontSize={8.5} fontFamily="monospace" fill="rgba(161,161,170,0.8)">
          {sublabel}
        </text>
      )}
    </g>
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
}

function LayerRow({ layerX, layerW, y, h, label, caption, colors, children }: LayerRowProps) {
  return (
    <g aria-label={`${label} layer`}>
      <rect
        x={layerX} y={y} width={layerW} height={h} rx={10} ry={10}
        fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5}
      />
      {/* Layer name badge */}
      <rect x={layerX + 10} y={y + 8} width={130} height={18} rx={4} ry={4} fill={colors.badge} />
      <text
        x={layerX + 18} y={y + 20}
        fontSize={9} fontFamily="monospace"
        fill={colors.text} fontWeight="700" letterSpacing="0.08em" textAnchor="start"
      >
        {label.toUpperCase()}
      </text>
      <text
        x={layerX + 148} y={y + 20}
        fontSize={8.5} fontFamily="sans-serif"
        fill="rgba(161,161,170,0.75)" fontStyle="italic"
      >
        {caption}
      </text>
      {children}
    </g>
  );
}

// ─── Desktop SVG (≥ 768px) ──────────────────────────────────────────────────

function DesktopDiagram() {
  const W = 960;
  const H = 580;

  const layerX = 16;
  const layerW = 700;
  const layerGap = 8;

  const rowH = [110, 124, 144, 110];
  const totalLayerH = rowH.reduce((a, b) => a + b, 0) + layerGap * 3;
  const layerY = (H - totalLayerH) / 2;

  const rowY: number[] = [];
  let curY = layerY;
  for (const h of rowH) {
    rowY.push(curY);
    curY += h + layerGap;
  }

  const bandX = layerX + layerW + 16;
  const bandW = W - bandX - 16;
  const bandH = (totalLayerH - 8) / 3;
  const bandY0 = layerY;

  const arrowId = 'arch-arrow';
  const arrowUpId = 'arch-arrow-up';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby="arch-title arch-desc"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <title id="arch-title">Reporium AI-Native Architecture</title>
      <desc id="arch-desc">
        Four AI-native layers (Agent-accessible, Intelligence, Semantic, Compounding) with three cross-cutting bands
        (Observability, Governance, Performance) mapping to real Reporium services.
      </desc>

      <defs>
        <marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(34,211,238,0.7)" />
        </marker>
        <marker id={arrowUpId} markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto">
          <path d="M8,0 L8,6 L0,3 z" fill="rgba(52,211,153,0.7)" />
        </marker>
      </defs>

      {/* ── Layer 1: Agent-accessible ──────────────────────────────────── */}
      <LayerRow
        layerX={layerX} layerW={layerW}
        y={rowY[0]} h={rowH[0]}
        label="Agent-accessible"
        caption="MCP and typed endpoints — agents call this directly"
        colors={LAYER_COLORS.agentAccessible}
      >
        <CompBox
          x={layerX + 10} y={rowY[0] + 34} w={148} h={64}
          label="Reporium Web" sublabel="Next.js · Vercel · human readers"
          accent="rgba(147,51,234,0.5)" textColor="#c084fc"
        />
        <CompBox
          x={layerX + 168} y={rowY[0] + 34} w={130} h={64}
          label="reporium-mcp" sublabel="MCP protocol · agent readers"
          accent="rgba(147,51,234,0.5)" textColor="#c084fc"
        />
        <CompBox
          x={layerX + 308} y={rowY[0] + 34} w={230} h={64}
          label="External orchestrators"
          sublabel="Workato · LangChain · Claude Desktop · custom"
          accent="rgba(147,51,234,0.4)" textColor="#c084fc"
        />
      </LayerRow>

      {/* Query path arrow: Agent-accessible → Intelligence */}
      <line
        x1={layerX + 80} y1={rowY[0] + rowH[0]}
        x2={layerX + 80} y2={rowY[1]}
        stroke="rgba(34,211,238,0.55)" strokeWidth={1.5} strokeDasharray="4 3"
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={layerX + 86} y={rowY[0] + rowH[0] + 5}
        fontSize={7.5} fontFamily="monospace" fill="rgba(34,211,238,0.6)"
      >
        query path ↓
      </text>

      {/* ── Layer 2: Intelligence ──────────────────────────────────────── */}
      <LayerRow
        layerX={layerX} layerW={layerW}
        y={rowY[1]} h={rowH[1]}
        label="Intelligence"
        caption="AI is in the decision loop"
        colors={LAYER_COLORS.intelligence}
      >
        {/* reporium-api box with sub-items */}
        <rect
          x={layerX + 10} y={rowY[1] + 34} width={200} height={78} rx={6} ry={6}
          fill="rgba(9,9,17,0.75)" stroke="rgba(217,70,239,0.5)" strokeWidth={1}
        />
        <text x={layerX + 18} y={rowY[1] + 48} fontSize={10} fontFamily="monospace" fill="#f0abfc" fontWeight="600">
          reporium-api
        </text>
        <text x={layerX + 18} y={rowY[1] + 60} fontSize={8.5} fontFamily="monospace" fill="rgba(161,161,170,0.8)">
          FastAPI · Cloud Run
        </text>
        <text x={layerX + 18} y={rowY[1] + 74} fontSize={8} fontFamily="monospace" fill="rgba(161,161,170,0.65)">
          public reads / ingest (keyed)
        </text>
        <text x={layerX + 18} y={rowY[1] + 86} fontSize={8} fontFamily="monospace" fill="rgba(161,161,170,0.65)">
          admin (keyed) / Scalar docs
        </text>
        <text x={layerX + 18} y={rowY[1] + 102} fontSize={8} fontFamily="monospace" fill="rgba(161,161,170,0.65)">
          rate-limited · Sentry-instrumented
        </text>

        <CompBox
          x={layerX + 220} y={rowY[1] + 34} w={185} h={36}
          label="LLM enrichment"
          sublabel="model-agnostic — Claude, GPT, local"
          accent="rgba(217,70,239,0.5)" textColor="#f0abfc"
        />
        <CompBox
          x={layerX + 220} y={rowY[1] + 76} w={185} h={36}
          label="Pub/Sub event bus"
          sublabel="topic: repo-ingested"
          accent="rgba(217,70,239,0.4)" textColor="#f0abfc"
        />
      </LayerRow>

      {/* Query path arrow: Intelligence → Semantic */}
      <line
        x1={layerX + 80} y1={rowY[1] + rowH[1]}
        x2={layerX + 80} y2={rowY[2]}
        stroke="rgba(34,211,238,0.55)" strokeWidth={1.5} strokeDasharray="4 3"
        markerEnd={`url(#${arrowId})`}
      />

      {/* ── Layer 3: Semantic ──────────────────────────────────────────── */}
      <LayerRow
        layerX={layerX} layerW={layerW}
        y={rowY[2]} h={rowH[2]}
        label="Semantic"
        caption="Retrieval is by meaning, not strings"
        colors={LAYER_COLORS.semantic}
      >
        <CompBox
          x={layerX + 10} y={rowY[2] + 34} w={165} h={98}
          label="Postgres + pgvector"
          sublabel="Cloud SQL · managed backups"
          accent="rgba(34,211,238,0.5)" textColor="#67e8f9"
        />
        {/* inner details rendered as plain text elements */}
        <text x={layerX + 18} y={rowY[2] + 84} fontSize={8} fontFamily="monospace" fill="rgba(103,232,249,0.7)">
          repo_embeddings
        </text>
        <text x={layerX + 18} y={rowY[2] + 95} fontSize={7.5} fontFamily="monospace" fill="rgba(161,161,170,0.6)">
          384-dim · HNSW · vector_cosine_ops
        </text>
        <text x={layerX + 18} y={rowY[2] + 107} fontSize={8} fontFamily="monospace" fill="rgba(103,232,249,0.7)">
          taxonomy_values
        </text>
        <text x={layerX + 18} y={rowY[2] + 118} fontSize={7.5} fontFamily="monospace" fill="rgba(161,161,170,0.6)">
          8 dynamic dimensions · embedded
        </text>
        <text x={layerX + 18} y={rowY[2] + 129} fontSize={7.5} fontFamily="monospace" fill="rgba(161,161,170,0.6)">
          cosine ≥ 0.65 taxonomy assignment
        </text>

        <CompBox
          x={layerX + 185} y={rowY[2] + 34} w={200} h={40}
          label="GCS snapshot"
          sublabel="read fallback for /graph/edges"
          accent="rgba(34,211,238,0.4)" textColor="#67e8f9"
        />
        <CompBox
          x={layerX + 185} y={rowY[2] + 82} w={200} h={50}
          label="Redis cache (optional)"
          sublabel="/library/full · 5-min TTL · HNSW approx-NN"
          accent="rgba(34,211,238,0.35)" textColor="#67e8f9"
        />
      </LayerRow>

      {/* Ingest flow arrow: Compounding → Semantic (up) */}
      <line
        x1={layerX + 200} y1={rowY[3]}
        x2={layerX + 200} y2={rowY[2] + rowH[2] + layerGap}
        stroke="rgba(52,211,153,0.55)" strokeWidth={1.5} strokeDasharray="4 3"
        markerEnd={`url(#${arrowUpId})`}
      />
      <text
        x={layerX + 206} y={rowY[3] - 2}
        fontSize={7.5} fontFamily="monospace" fill="rgba(52,211,153,0.6)"
      >
        ingest flow ↑
      </text>

      {/* ── Layer 4: Compounding ──────────────────────────────────────── */}
      <LayerRow
        layerX={layerX} layerW={layerW}
        y={rowY[3]} h={rowH[3]}
        label="Compounding"
        caption="Every ingest makes the next query better"
        colors={LAYER_COLORS.compounding}
      >
        <CompBox
          x={layerX + 10} y={rowY[3] + 34} w={300} h={64}
          label="reporium-ingestion"
          sublabel="Cloud Run Job · nightly: pull → LLM enrich → POST /ingest/repos → publish repo.ingested"
          accent="rgba(52,211,153,0.5)" textColor="#6ee7b7"
        />
        <CompBox
          x={layerX + 320} y={rowY[3] + 34} w={230} h={64}
          label="forksync"
          sublabel="Cloud Run Job · nightly: keeps forks aligned with upstreams"
          accent="rgba(52,211,153,0.45)" textColor="#6ee7b7"
        />
      </LayerRow>

      {/* ── Cross-cutting bands ─────────────────────────────────────────── */}

      {/* Observability */}
      <g aria-label="Observability band">
        <rect
          x={bandX} y={bandY0} width={bandW} height={bandH} rx={8} ry={8}
          fill={BAND_COLORS.observability.fill} stroke={BAND_COLORS.observability.stroke} strokeWidth={1.5}
        />
        <text
          x={bandX + bandW / 2} y={bandY0 + 16}
          fontSize={9} fontFamily="monospace"
          fill={BAND_COLORS.observability.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em"
        >
          OBSERVABILITY
        </text>
        {[
          '/health (DB, Redis, last ingestion)',
          '/admin/data-quality',
          'ingestion_log table',
          'observability/ directory',
          'Scalar API docs (/docs)',
        ].map((item, i) => (
          <text
            key={item}
            x={bandX + 10} y={bandY0 + 32 + i * 14}
            fontSize={8.5} fontFamily="monospace" fill={BAND_COLORS.observability.itemColor}
          >
            {item}
          </text>
        ))}
      </g>

      {/* Governance */}
      <g aria-label="Governance band">
        <rect
          x={bandX} y={bandY0 + bandH + 6} width={bandW} height={bandH} rx={8} ry={8}
          fill={BAND_COLORS.governance.fill} stroke={BAND_COLORS.governance.stroke} strokeWidth={1.5}
        />
        <text
          x={bandX + bandW / 2} y={bandY0 + bandH + 6 + 16}
          fontSize={9} fontFamily="monospace"
          fill={BAND_COLORS.governance.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em"
        >
          GOVERNANCE
        </text>
        {[
          'X-Ingest-Key (ingest writes)',
          'X-Admin-Key (admin ops)',
          'GCP Secret Manager',
          'SECURITY_AUDIT.md',
        ].map((item, i) => (
          <text
            key={item}
            x={bandX + 10} y={bandY0 + bandH + 6 + 32 + i * 14}
            fontSize={8.5} fontFamily="monospace" fill={BAND_COLORS.governance.itemColor}
          >
            {item}
          </text>
        ))}
      </g>

      {/* Performance */}
      <g aria-label="Performance band">
        <rect
          x={bandX} y={bandY0 + (bandH + 6) * 2} width={bandW} height={bandH} rx={8} ry={8}
          fill={BAND_COLORS.performance.fill} stroke={BAND_COLORS.performance.stroke} strokeWidth={1.5}
        />
        <text
          x={bandX + bandW / 2} y={bandY0 + (bandH + 6) * 2 + 16}
          fontSize={9} fontFamily="monospace"
          fill={BAND_COLORS.performance.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em"
        >
          PERFORMANCE
        </text>
        {[
          'Redis cache (optional)',
          '/library/full (5-min cache)',
          'HNSW approximate-NN',
          'GCS snapshot read fallback',
        ].map((item, i) => (
          <text
            key={item}
            x={bandX + 10} y={bandY0 + (bandH + 6) * 2 + 32 + i * 14}
            fontSize={8.5} fontFamily="monospace" fill={BAND_COLORS.performance.itemColor}
          >
            {item}
          </text>
        ))}
      </g>
    </svg>
  );
}

// ─── Mobile SVG (< 768px): layers stacked, bands below ─────────────────────

const MOBILE_LAYERS = [
  {
    key: 'agent',
    label: 'Agent-accessible',
    caption: 'MCP and typed endpoints — agents call this directly',
    colors: LAYER_COLORS.agentAccessible,
    items: [
      'Reporium Web (Next.js · human readers)',
      'reporium-mcp (MCP protocol · agent readers)',
      'External orchestrators',
      '  Workato · LangChain · Claude Desktop · custom',
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    caption: 'AI is in the decision loop',
    colors: LAYER_COLORS.intelligence,
    items: [
      'reporium-api (FastAPI · Cloud Run)',
      '  public reads / ingest (keyed) / admin (keyed)',
      'LLM enrichment (model-agnostic — Claude, GPT, local)',
      'Pub/Sub event bus (topic: repo-ingested)',
    ],
  },
  {
    key: 'semantic',
    label: 'Semantic',
    caption: 'Retrieval is by meaning, not strings',
    colors: LAYER_COLORS.semantic,
    items: [
      'Postgres + pgvector (Cloud SQL)',
      'repo_embeddings — 384-dim · HNSW · vector_cosine_ops',
      'taxonomy_values — 8 dynamic dimensions · embedded',
      'cosine ≥ 0.65 taxonomy assignment',
      'GCS snapshot (read fallback for /graph/edges)',
    ],
  },
  {
    key: 'compounding',
    label: 'Compounding',
    caption: 'Every ingest makes the next query better',
    colors: LAYER_COLORS.compounding,
    items: [
      'reporium-ingestion (Cloud Run Job · nightly)',
      '  pull → LLM enrich → POST /ingest/repos → publish repo.ingested',
      'forksync (Cloud Run Job · nightly)',
      '  keeps forks aligned with upstreams',
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
  const W = 480;
  const rowH = 90;
  const rowGap = 8;
  const arrowH = 20;
  const layersTotalH =
    MOBILE_LAYERS.length * rowH + (MOBILE_LAYERS.length - 1) * (rowGap + arrowH);

  const bandH = 90;
  const bandGap = 8;
  const bandsStartY = layersTotalH + 20;
  const totalH =
    bandsStartY + MOBILE_BANDS.length * bandH + (MOBILE_BANDS.length - 1) * bandGap + 10;

  return (
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      role="img"
      aria-labelledby="arch-title-m arch-desc-m"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <title id="arch-title-m">Reporium AI-Native Architecture</title>
      <desc id="arch-desc-m">
        Four AI-native layers (Agent-accessible, Intelligence, Semantic, Compounding) with three
        cross-cutting bands (Observability, Governance, Performance) mapping to real Reporium services.
      </desc>

      <defs>
        <marker id="m-arrow-down" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(34,211,238,0.7)" />
        </marker>
      </defs>

      {MOBILE_LAYERS.map((layer, li) => {
        const y = li * (rowH + rowGap + arrowH);
        return (
          <g key={layer.key} aria-label={`${layer.label} layer`}>
            <rect
              x={8} y={y} width={W - 16} height={rowH} rx={8} ry={8}
              fill={layer.colors.fill} stroke={layer.colors.stroke} strokeWidth={1.5}
            />
            {/* Badge */}
            <rect x={16} y={y + 8} width={130} height={16} rx={4} ry={4} fill={layer.colors.badge} />
            <text
              x={24} y={y + 19}
              fontSize={8.5} fontFamily="monospace"
              fill={layer.colors.text} fontWeight="700" letterSpacing="0.08em"
            >
              {layer.label.toUpperCase()}
            </text>
            {/* Caption */}
            <text
              x={154} y={y + 19}
              fontSize={8} fontFamily="sans-serif"
              fill="rgba(161,161,170,0.7)" fontStyle="italic"
            >
              {layer.caption}
            </text>
            {/* Items */}
            {layer.items.map((item, ii) => (
              <text
                key={`${layer.key}-item-${ii}`}
                x={16} y={y + 36 + ii * 13}
                fontSize={8.5} fontFamily="monospace" fill="rgba(228,228,231,0.85)"
              >
                {item}
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
      })}

      {/* Cross-cutting bands label */}
      <text
        x={W / 2} y={bandsStartY - 6}
        fontSize={8.5} fontFamily="monospace"
        fill="rgba(161,161,170,0.6)" textAnchor="middle" letterSpacing="0.12em"
      >
        CROSS-CUTTING CONCERNS
      </text>

      {MOBILE_BANDS.map((band, bi) => {
        const y = bandsStartY + bi * (bandH + bandGap);
        return (
          <g key={band.key} aria-label={`${band.label} band`}>
            <rect
              x={8} y={y} width={W - 16} height={bandH} rx={8} ry={8}
              fill={band.colors.fill} stroke={band.colors.stroke} strokeWidth={1.5}
            />
            <text
              x={W / 2} y={y + 16}
              fontSize={9} fontFamily="monospace"
              fill={band.colors.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em"
            >
              {band.label}
            </text>
            {band.items.map((item, ii) => (
              <text
                key={`${band.key}-item-${ii}`}
                x={16} y={y + 30 + ii * 14}
                fontSize={8.5} fontFamily="monospace" fill="rgba(228,228,231,0.8)"
              >
                {item}
              </text>
            ))}
          </g>
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
    // Use a callback form so we read the value once during the effect, not synchronously
    const update = (matches: boolean) => setIsMobile(matches);
    update(mq.matches);
    const handler = (e: MediaQueryListEvent) => update(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 sm:p-4"
      style={{ boxShadow: '0 0 32px rgba(34,211,238,0.06), 0 0 64px rgba(217,70,239,0.05)' }}
    >
      {isMobile ? <MobileDiagram /> : <DesktopDiagram />}
    </div>
  );
}
