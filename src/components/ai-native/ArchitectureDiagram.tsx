'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

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

// ─── SVG sub-components (all at module level — required by react-hooks/static-components) ──

interface CompBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel?: string;
  accent: string;
  textColor: string;
  animDelay?: number;
  shouldReduce: boolean;
}

function CompBox({ x, y, w, h, label, sublabel, accent, textColor, animDelay = 0, shouldReduce }: CompBoxProps) {
  if (shouldReduce) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={6} ry={6} fill="rgba(9,9,17,0.75)" stroke={accent} strokeWidth={1} />
        <text x={x + 8} y={y + 15} fontSize={10.5} fontFamily="monospace" fill={textColor} fontWeight="600">
          {label}
        </text>
        {sublabel && (
          <text x={x + 8} y={y + 29} fontSize={9} fontFamily="monospace" fill="rgba(200,200,210,0.9)">
            {sublabel}
          </text>
        )}
      </g>
    );
  }

  const variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3, delay: animDelay } },
  };

  return (
    <motion.g variants={variants} initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0 }}>
      <rect x={x} y={y} width={w} height={h} rx={6} ry={6} fill="rgba(9,9,17,0.75)" stroke={accent} strokeWidth={1} />
      <text x={x + 8} y={y + 15} fontSize={10.5} fontFamily="monospace" fill={textColor} fontWeight="600">
        {label}
      </text>
      {sublabel && (
        <text x={x + 8} y={y + 29} fontSize={9} fontFamily="monospace" fill="rgba(200,200,210,0.9)">
          {sublabel}
        </text>
      )}
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
}

function LayerRow({ layerX, layerW, y, h, label, caption, colors, children, rowDelay, shouldReduce }: LayerRowProps) {
  if (shouldReduce) {
    return (
      <g aria-label={`${label} layer`}>
        <rect x={layerX} y={y} width={layerW} height={h} rx={10} ry={10} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
        <rect x={layerX + 10} y={y + 8} width={138} height={20} rx={4} ry={4} fill={colors.badge} />
        <text x={layerX + 18} y={y + 22} fontSize={9.5} fontFamily="monospace" fill={colors.text} fontWeight="700" letterSpacing="0.08em" textAnchor="start">
          {label.toUpperCase()}
        </text>
        <text x={layerX + 156} y={y + 22} fontSize={10} fontFamily="sans-serif" fill="rgba(210,210,220,0.9)" fontStyle="italic">
          {caption}
        </text>
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
    <g aria-label={`${label} layer`}>
      <motion.rect
        x={layerX} y={y} width={layerW} height={h} rx={10} ry={10}
        fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5}
        style={{ transformOrigin: `${layerX + layerW / 2}px ${y + h / 2}px` }}
        variants={bandVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0 }}
      />
      <motion.g variants={labelVariants} initial="hidden" whileInView="visible" viewport={{ once: false, amount: 0 }}>
        <rect x={layerX + 10} y={y + 8} width={138} height={20} rx={4} ry={4} fill={colors.badge} />
        <text x={layerX + 18} y={y + 22} fontSize={9.5} fontFamily="monospace" fill={colors.text} fontWeight="700" letterSpacing="0.08em" textAnchor="start">
          {label.toUpperCase()}
        </text>
        <text x={layerX + 156} y={y + 22} fontSize={10} fontFamily="sans-serif" fill="rgba(210,210,220,0.9)" fontStyle="italic">
          {caption}
        </text>
      </motion.g>
      {children}
    </g>
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
  if (shouldReduce) {
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={1.5} strokeDasharray="4 3" markerEnd={`url(#${markerId})`} />
        {labelText && <text x={labelX} y={labelY} fontSize={8} fontFamily="monospace" fill={labelFill}>{labelText}</text>}
      </g>
    );
  }
  const pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
  return (
    <g>
      <motion.path
        d={pathD}
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        fill="none"
        markerEnd={`url(#${markerId})`}
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: false, amount: 0 }}
        transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      />
      {labelText && (
        <motion.text
          x={labelX} y={labelY}
          fontSize={8} fontFamily="monospace" fill={labelFill}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false, amount: 0 }}
          transition={{ duration: 0.25, delay: delay + 0.35 }}
        >
          {labelText}
        </motion.text>
      )}
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
      viewport={{ once: false, amount: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.g>
  );
}

// ─── Desktop SVG (≥ 768px) ──────────────────────────────────────────────────

function DesktopDiagram() {
  const shouldReduce = !!useReducedMotion();

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
    <motion.svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby="arch-title arch-desc"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      variants={containerVariants}
      initial={shouldReduce ? false : 'hidden'}
      whileInView={shouldReduce ? undefined : 'visible'}
      viewport={{ once: false, amount: 0.4 }}
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
        rowDelay={layerBaseDelay}
        shouldReduce={shouldReduce}
      >
        <CompBox
          x={layerX + 10} y={rowY[0] + 36} w={148} h={64}
          label="Reporium Web" sublabel="Next.js · Vercel · human readers"
          accent="rgba(147,51,234,0.5)" textColor="#c084fc"
          animDelay={layerBaseDelay + 0.15}
          shouldReduce={shouldReduce}
        />
        <CompBox
          x={layerX + 168} y={rowY[0] + 36} w={130} h={64}
          label="reporium-mcp" sublabel="MCP protocol · agent readers"
          accent="rgba(147,51,234,0.5)" textColor="#c084fc"
          animDelay={layerBaseDelay + 0.15 + compBoxStagger}
          shouldReduce={shouldReduce}
        />
        <CompBox
          x={layerX + 308} y={rowY[0] + 36} w={230} h={64}
          label="External orchestrators"
          sublabel="Workato · LangChain · Claude Desktop · custom"
          accent="rgba(147,51,234,0.4)" textColor="#c084fc"
          animDelay={layerBaseDelay + 0.15 + compBoxStagger * 2}
          shouldReduce={shouldReduce}
        />
      </LayerRow>

      {/* Query path arrow: Agent-accessible → Intelligence */}
      <ArrowPath
        x1={layerX + 80} y1={rowY[0] + rowH[0]}
        x2={layerX + 80} y2={rowY[1]}
        stroke="rgba(34,211,238,0.55)"
        delay={arrowDelay}
        markerId={arrowId}
        labelX={layerX + 86} labelY={rowY[0] + rowH[0] + 6}
        labelText="query path ↓"
        labelFill="rgba(34,211,238,0.6)"
        shouldReduce={shouldReduce}
      />

      {/* ── Layer 2: Intelligence ──────────────────────────────────────── */}
      <LayerRow
        layerX={layerX} layerW={layerW}
        y={rowY[1]} h={rowH[1]}
        label="Intelligence"
        caption="AI is in the decision loop"
        colors={LAYER_COLORS.intelligence}
        rowDelay={layerBaseDelay + rowStagger}
        shouldReduce={shouldReduce}
      >
        <CompBox
          x={layerX + 10} y={rowY[1] + 36} w={200} h={78}
          label="reporium-api" sublabel="FastAPI · Cloud Run"
          accent="rgba(217,70,239,0.5)" textColor="#f0abfc"
          animDelay={layerBaseDelay + rowStagger + 0.15}
          shouldReduce={shouldReduce}
        />
        {/* Additional detail lines inside the API box */}
        <text x={layerX + 18} y={rowY[1] + 78} fontSize={8.5} fontFamily="monospace" fill="rgba(161,161,170,0.7)">
          public reads / ingest (keyed)
        </text>
        <text x={layerX + 18} y={rowY[1] + 90} fontSize={8.5} fontFamily="monospace" fill="rgba(161,161,170,0.7)">
          admin (keyed) / Scalar docs
        </text>
        <text x={layerX + 18} y={rowY[1] + 103} fontSize={8.5} fontFamily="monospace" fill="rgba(161,161,170,0.7)">
          rate-limited · Sentry-instrumented
        </text>

        <CompBox
          x={layerX + 220} y={rowY[1] + 36} w={185} h={36}
          label="LLM enrichment"
          sublabel="model-agnostic — Claude, GPT, local"
          accent="rgba(217,70,239,0.5)" textColor="#f0abfc"
          animDelay={layerBaseDelay + rowStagger + 0.15 + compBoxStagger}
          shouldReduce={shouldReduce}
        />
        <CompBox
          x={layerX + 220} y={rowY[1] + 78} w={185} h={36}
          label="Pub/Sub event bus"
          sublabel="topic: repo-ingested"
          accent="rgba(217,70,239,0.4)" textColor="#f0abfc"
          animDelay={layerBaseDelay + rowStagger + 0.15 + compBoxStagger * 2}
          shouldReduce={shouldReduce}
        />
      </LayerRow>

      {/* Query path arrow: Intelligence → Semantic */}
      <ArrowPath
        x1={layerX + 80} y1={rowY[1] + rowH[1]}
        x2={layerX + 80} y2={rowY[2]}
        stroke="rgba(34,211,238,0.55)"
        delay={arrowDelay + 0.1}
        markerId={arrowId}
        shouldReduce={shouldReduce}
      />

      {/* ── Layer 3: Semantic ──────────────────────────────────────────── */}
      <LayerRow
        layerX={layerX} layerW={layerW}
        y={rowY[2]} h={rowH[2]}
        label="Semantic"
        caption="Retrieval is by meaning, not strings"
        colors={LAYER_COLORS.semantic}
        rowDelay={layerBaseDelay + rowStagger * 2}
        shouldReduce={shouldReduce}
      >
        <CompBox
          x={layerX + 10} y={rowY[2] + 36} w={165} h={98}
          label="Postgres + pgvector"
          sublabel="Cloud SQL · managed backups"
          accent="rgba(34,211,238,0.5)" textColor="#67e8f9"
          animDelay={layerBaseDelay + rowStagger * 2 + 0.15}
          shouldReduce={shouldReduce}
        />
        {/* inner details */}
        <text x={layerX + 18} y={rowY[2] + 90} fontSize={8.5} fontFamily="monospace" fill="rgba(103,232,249,0.75)">
          repo_embeddings
        </text>
        <text x={layerX + 18} y={rowY[2] + 102} fontSize={8} fontFamily="monospace" fill="rgba(161,161,170,0.65)">
          384-dim · HNSW · vector_cosine_ops
        </text>
        <text x={layerX + 18} y={rowY[2] + 114} fontSize={8.5} fontFamily="monospace" fill="rgba(103,232,249,0.75)">
          taxonomy_values
        </text>
        <text x={layerX + 18} y={rowY[2] + 126} fontSize={8} fontFamily="monospace" fill="rgba(161,161,170,0.65)">
          8 dynamic dimensions · embedded
        </text>
        <text x={layerX + 18} y={rowY[2] + 138} fontSize={8} fontFamily="monospace" fill="rgba(161,161,170,0.65)">
          cosine ≥ 0.65 taxonomy assignment
        </text>

        <CompBox
          x={layerX + 185} y={rowY[2] + 36} w={200} h={40}
          label="GCS snapshot"
          sublabel="read fallback for /graph/edges"
          accent="rgba(34,211,238,0.4)" textColor="#67e8f9"
          animDelay={layerBaseDelay + rowStagger * 2 + 0.15 + compBoxStagger}
          shouldReduce={shouldReduce}
        />
        <CompBox
          x={layerX + 185} y={rowY[2] + 84} w={200} h={50}
          label="Redis cache (optional)"
          sublabel="/library/full · 5-min TTL · HNSW approx-NN"
          accent="rgba(34,211,238,0.35)" textColor="#67e8f9"
          animDelay={layerBaseDelay + rowStagger * 2 + 0.15 + compBoxStagger * 2}
          shouldReduce={shouldReduce}
        />
      </LayerRow>

      {/* Ingest flow arrow: Compounding → Semantic (up) */}
      <ArrowPath
        x1={layerX + 200} y1={rowY[3]}
        x2={layerX + 200} y2={rowY[2] + rowH[2] + layerGap}
        stroke="rgba(52,211,153,0.55)"
        delay={arrowDelay + 0.2}
        markerId={arrowUpId}
        labelX={layerX + 206} labelY={rowY[3] - 2}
        labelText="ingest flow ↑"
        labelFill="rgba(52,211,153,0.6)"
        shouldReduce={shouldReduce}
      />

      {/* ── Layer 4: Compounding ──────────────────────────────────────── */}
      <LayerRow
        layerX={layerX} layerW={layerW}
        y={rowY[3]} h={rowH[3]}
        label="Compounding"
        caption="Every ingest makes the next query better"
        colors={LAYER_COLORS.compounding}
        rowDelay={layerBaseDelay + rowStagger * 3}
        shouldReduce={shouldReduce}
      >
        <CompBox
          x={layerX + 10} y={rowY[3] + 36} w={300} h={64}
          label="reporium-ingestion"
          sublabel="Cloud Run Job · nightly: pull → LLM enrich → POST /ingest/repos → publish repo.ingested"
          accent="rgba(52,211,153,0.5)" textColor="#6ee7b7"
          animDelay={layerBaseDelay + rowStagger * 3 + 0.15}
          shouldReduce={shouldReduce}
        />
        <CompBox
          x={layerX + 320} y={rowY[3] + 36} w={230} h={64}
          label="forksync"
          sublabel="Cloud Run Job · nightly: keeps forks aligned with upstreams"
          accent="rgba(52,211,153,0.45)" textColor="#6ee7b7"
          animDelay={layerBaseDelay + rowStagger * 3 + 0.15 + compBoxStagger}
          shouldReduce={shouldReduce}
        />
      </LayerRow>

      {/* ── Cross-cutting bands ─────────────────────────────────────────── */}

      {/* Observability */}
      <BandGroup delay={bandDelay} shouldReduce={shouldReduce}>
        <g aria-label="Observability band">
          <rect x={bandX} y={bandY0} width={bandW} height={bandH} rx={8} ry={8} fill={BAND_COLORS.observability.fill} stroke={BAND_COLORS.observability.stroke} strokeWidth={1.5} />
          <text x={bandX + bandW / 2} y={bandY0 + 17} fontSize={9.5} fontFamily="monospace" fill={BAND_COLORS.observability.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em">
            OBSERVABILITY
          </text>
          {[
            '/health (DB, Redis, last ingestion)',
            '/admin/data-quality',
            'ingestion_log table',
            'observability/ directory',
            'Scalar API docs (/docs)',
          ].map((item, i) => (
            <text key={item} x={bandX + 10} y={bandY0 + 34 + i * 15} fontSize={9} fontFamily="monospace" fill={BAND_COLORS.observability.itemColor}>
              {item}
            </text>
          ))}
        </g>
      </BandGroup>

      {/* Governance */}
      <BandGroup delay={bandDelay + 0.12} shouldReduce={shouldReduce}>
        <g aria-label="Governance band">
          <rect x={bandX} y={bandY0 + bandH + 6} width={bandW} height={bandH} rx={8} ry={8} fill={BAND_COLORS.governance.fill} stroke={BAND_COLORS.governance.stroke} strokeWidth={1.5} />
          <text x={bandX + bandW / 2} y={bandY0 + bandH + 6 + 17} fontSize={9.5} fontFamily="monospace" fill={BAND_COLORS.governance.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em">
            GOVERNANCE
          </text>
          {[
            'X-Ingest-Key (ingest writes)',
            'X-Admin-Key (admin ops)',
            'GCP Secret Manager',
            'SECURITY_AUDIT.md',
          ].map((item, i) => (
            <text key={item} x={bandX + 10} y={bandY0 + bandH + 6 + 34 + i * 15} fontSize={9} fontFamily="monospace" fill={BAND_COLORS.governance.itemColor}>
              {item}
            </text>
          ))}
        </g>
      </BandGroup>

      {/* Performance */}
      <BandGroup delay={bandDelay + 0.24} shouldReduce={shouldReduce}>
        <g aria-label="Performance band">
          <rect x={bandX} y={bandY0 + (bandH + 6) * 2} width={bandW} height={bandH} rx={8} ry={8} fill={BAND_COLORS.performance.fill} stroke={BAND_COLORS.performance.stroke} strokeWidth={1.5} />
          <text x={bandX + bandW / 2} y={bandY0 + (bandH + 6) * 2 + 17} fontSize={9.5} fontFamily="monospace" fill={BAND_COLORS.performance.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em">
            PERFORMANCE
          </text>
          {[
            'Redis cache (optional)',
            '/library/full (5-min cache)',
            'HNSW approximate-NN',
            'GCS snapshot read fallback',
          ].map((item, i) => (
            <text key={item} x={bandX + 10} y={bandY0 + (bandH + 6) * 2 + 34 + i * 15} fontSize={9} fontFamily="monospace" fill={BAND_COLORS.performance.itemColor}>
              {item}
            </text>
          ))}
        </g>
      </BandGroup>
    </motion.svg>
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
      { text: 'Reporium Web (Next.js · human readers)', sub: false },
      { text: 'reporium-mcp (MCP protocol · agent readers)', sub: false },
      { text: 'External orchestrators', sub: false },
      { text: 'Workato · LangChain · Claude Desktop · custom', sub: true },
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
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
    label: 'Semantic',
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
    label: 'Compounding',
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
  const shouldReduce = !!useReducedMotion();

  const W = 480;
  const rowH = 100;
  const rowGap = 8;
  const arrowH = 20;
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
        const animDelay = li * 0.15;

        const inner = (
          <g>
            <rect x={8} y={y} width={W - 16} height={rowH} rx={8} ry={8} fill={layer.colors.fill} stroke={layer.colors.stroke} strokeWidth={1.5} />
            {/* Badge */}
            <rect x={16} y={y + 8} width={140} height={18} rx={4} ry={4} fill={layer.colors.badge} />
            <text x={24} y={y + 20} fontSize={9} fontFamily="monospace" fill={layer.colors.text} fontWeight="700" letterSpacing="0.08em">
              {layer.label.toUpperCase()}
            </text>
            {/* Caption — legibility improved */}
            <text x={164} y={y + 20} fontSize={9} fontFamily="sans-serif" fill="rgba(210,210,220,0.9)" fontStyle="italic">
              {layer.caption}
            </text>
            {/* Items — primary vs sub-detail differentiated */}
            {layer.items.map((item, ii) => (
              <text
                key={`${layer.key}-item-${ii}`}
                x={item.sub ? 22 : 16} y={y + 36 + ii * 14}
                fontSize={item.sub ? 8 : 9}
                fontFamily="monospace"
                fill={item.sub ? 'rgba(180,180,190,0.75)' : 'rgba(228,228,231,0.9)'}
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
            viewport={{ once: false, amount: 0.1 }}
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
            <text x={W / 2} y={y + 17} fontSize={9.5} fontFamily="monospace" fill={band.colors.text} fontWeight="700" textAnchor="middle" letterSpacing="0.1em">
              {band.label}
            </text>
            {band.items.map((item, ii) => (
              <text key={`${band.key}-item-${ii}`} x={16} y={y + 33 + ii * 15} fontSize={9} fontFamily="monospace" fill="rgba(228,228,231,0.85)">
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
            viewport={{ once: false, amount: 0.1 }}
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
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 sm:p-4"
      style={{ boxShadow: '0 0 32px rgba(34,211,238,0.06), 0 0 64px rgba(217,70,239,0.05)' }}
    >
      {isMobile ? <MobileDiagram /> : <DesktopDiagram />}
    </div>
  );
}
