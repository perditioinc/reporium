'use client';

import { useState, useMemo, useCallback } from 'react';
import type { CrossDimensionAnalytics } from '@/types/repo';

interface CrossDimensionWidgetProps {
  analytics: CrossDimensionAnalytics | null;
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

/** Deterministic position for a node based on index within its group, laid out in a circle */
function circleLayout(index: number, total: number, cx: number, cy: number, radius: number) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

type ViewMode = 'chart' | 'grid';

export function CrossDimensionWidget({ analytics }: CrossDimensionWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  // Extract unique dim1 and dim2 values
  const { dim1Values, dim2Values, peak } = useMemo(() => {
    if (!analytics) return { dim1Values: [] as string[], dim2Values: [] as string[], peak: 1 };
    const d1 = [...new Set(analytics.pairs.map(p => p.dim1_value))];
    const d2 = [...new Set(analytics.pairs.map(p => p.dim2_value))];
    const pk = Math.max(...analytics.pairs.map(p => p.repo_count), 1);
    return { dim1Values: d1, dim2Values: d2, peak: pk };
  }, [analytics]);

  // Build node positions — dim1 on left arc, dim2 on right arc
  const nodes = useMemo(() => {
    if (!analytics) return new Map<string, { x: number; y: number; group: 'dim1' | 'dim2'; label: string }>();
    const map = new Map<string, { x: number; y: number; group: 'dim1' | 'dim2'; label: string }>();
    const W = 800, H = 420;
    const leftCx = W * 0.25, rightCx = W * 0.75, cy = H * 0.5;
    const radius = Math.min(H * 0.38, 160);

    dim1Values.forEach((v, i) => {
      const pos = circleLayout(i, dim1Values.length, leftCx, cy, radius);
      map.set(`d1:${v}`, { ...pos, group: 'dim1', label: v });
    });
    dim2Values.forEach((v, i) => {
      const pos = circleLayout(i, dim2Values.length, rightCx, cy, radius);
      map.set(`d2:${v}`, { ...pos, group: 'dim2', label: v });
    });
    return map;
  }, [analytics, dim1Values, dim2Values]);

  // Edges with positions
  const edges = useMemo(() => {
    if (!analytics) return [];
    return analytics.pairs.map(p => {
      const from = nodes.get(`d1:${p.dim1_value}`);
      const to = nodes.get(`d2:${p.dim2_value}`);
      if (!from || !to) return null;
      return {
        key: `${p.dim1_value}:${p.dim2_value}`,
        from,
        to,
        dim1: p.dim1_value,
        dim2: p.dim2_value,
        count: p.repo_count,
        strength: p.repo_count / peak,
      };
    }).filter(Boolean) as Array<{
      key: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      dim1: string;
      dim2: string;
      count: number;
      strength: number;
    }>;
  }, [analytics, nodes, peak]);

  // Which edges connect to the hovered node?
  const connectedEdges = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    return new Set(edges.filter(e =>
      `d1:${e.dim1}` === hoveredNode || `d2:${e.dim2}` === hoveredNode
    ).map(e => e.key));
  }, [hoveredNode, edges]);

  // Connected node keys when hovering
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const set = new Set<string>();
    set.add(hoveredNode);
    edges.forEach(e => {
      if (`d1:${e.dim1}` === hoveredNode) set.add(`d2:${e.dim2}`);
      if (`d2:${e.dim2}` === hoveredNode) set.add(`d1:${e.dim1}`);
    });
    return set;
  }, [hoveredNode, edges]);

  const handleNodeEnter = useCallback((key: string) => setHoveredNode(key), []);
  const handleNodeLeave = useCallback(() => setHoveredNode(null), []);
  const handleEdgeEnter = useCallback((key: string) => setHoveredEdge(key), []);
  const handleEdgeLeave = useCallback(() => setHoveredEdge(null), []);

  if (!analytics) return null;

  if (analytics.pairs.length === 0) {
    return (
      <section className="rounded-2xl border border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-zinc-950 p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Cross-Dimension Analytics</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-100">
              {label(analytics.dim1)} × {label(analytics.dim2)}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Taxonomy data is being processed — cross-dimension pairings will appear after the next ingestion run.
        </p>
      </section>
    );
  }

  const hoveredEdgeData = hoveredEdge ? edges.find(e => e.key === hoveredEdge) : null;

  return (
    <section className="rounded-2xl border border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-zinc-950 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Cross-Dimension Analytics</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            {label(analytics.dim1)} × {label(analytics.dim2)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('chart')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'chart' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Web
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'grid' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Grid
          </button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="mt-4 relative">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-fuchsia-500" />
              {label(analytics.dim1)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
              {label(analytics.dim2)}
            </span>
            <span className="ml-auto">Hover to explore connections</span>
          </div>

          {/* SVG chart */}
          <svg viewBox="0 0 800 420" className="w-full h-auto" style={{ minHeight: 280 }}>
            {/* Edges */}
            {edges.map(e => {
              const isHoveredEdge = hoveredEdge === e.key;
              const isConnected = connectedEdges.has(e.key);
              const dimmed = (hoveredNode && !isConnected) || (hoveredEdge && !isHoveredEdge);
              const strokeWidth = Math.max(1, e.strength * 6);

              return (
                <line
                  key={e.key}
                  x1={e.from.x}
                  y1={e.from.y}
                  x2={e.to.x}
                  y2={e.to.y}
                  stroke={isHoveredEdge || isConnected ? 'url(#edgeGradientActive)' : 'url(#edgeGradient)'}
                  strokeWidth={isHoveredEdge ? strokeWidth + 2 : strokeWidth}
                  strokeOpacity={dimmed ? 0.08 : isHoveredEdge || isConnected ? 0.9 : 0.25}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => handleEdgeEnter(e.key)}
                  onMouseLeave={handleEdgeLeave}
                />
              );
            })}

            {/* Gradient defs */}
            <defs>
              <linearGradient id="edgeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d946ef" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="edgeGradientActive" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#e879f9" stopOpacity={1} />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity={1} />
              </linearGradient>
            </defs>

            {/* Nodes */}
            {Array.from(nodes.entries()).map(([key, node]) => {
              const isDim1 = node.group === 'dim1';
              const isHovered = hoveredNode === key;
              const isConnectedNode = connectedNodes.has(key);
              const dimmed = hoveredNode && !isConnectedNode;
              const baseR = 6;
              const r = isHovered ? baseR + 3 : baseR;

              return (
                <g
                  key={key}
                  className="cursor-pointer"
                  onMouseEnter={() => handleNodeEnter(key)}
                  onMouseLeave={handleNodeLeave}
                >
                  {/* Glow ring on hover */}
                  {isHovered && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 6}
                      fill={isDim1 ? '#d946ef' : '#38bdf8'}
                      opacity={0.15}
                    />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={isDim1 ? '#d946ef' : '#38bdf8'}
                    opacity={dimmed ? 0.2 : 1}
                    className="transition-all duration-200"
                  />
                  <text
                    x={node.x + (isDim1 ? -14 : 14)}
                    y={node.y + 4}
                    textAnchor={isDim1 ? 'end' : 'start'}
                    className="transition-opacity duration-200 select-none pointer-events-none"
                    fill={dimmed ? '#52525b' : '#d4d4d8'}
                    fontSize={isHovered ? 13 : 11}
                    fontWeight={isHovered ? 600 : 400}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip for hovered edge */}
          {hoveredEdgeData && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 rounded-lg border border-fuchsia-800/60 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 shadow-xl pointer-events-none z-10">
              <span className="text-fuchsia-300 font-medium">{hoveredEdgeData.dim1}</span>
              {' × '}
              <span className="text-sky-300 font-medium">{hoveredEdgeData.dim2}</span>
              <span className="ml-2 rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-1.5 py-0.5 text-fuchsia-300 font-semibold">
                {hoveredEdgeData.count}
              </span>
              <span className="ml-1 text-zinc-500">repos</span>
            </div>
          )}
        </div>
      ) : (
        /* Grid fallback — original card view */
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {analytics.pairs.map((pair) => (
            <div key={`${pair.dim1_value}:${pair.dim2_value}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">{pair.dim1_value}</p>
                  <p className="truncate text-xs text-zinc-500">{pair.dim2_value}</p>
                </div>
                <span className="rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-300">
                  {pair.repo_count}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-400"
                  style={{ width: `${Math.max((pair.repo_count / peak) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
