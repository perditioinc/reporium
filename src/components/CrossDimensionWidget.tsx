'use client';

import { useState, useMemo, useCallback } from 'react';
import type { CrossDimensionAnalytics, CrossDimensionCell } from '@/types/repo';

interface CrossDimensionWidgetProps {
  analytics: CrossDimensionAnalytics | null;
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

type ViewMode = 'radar' | 'grid';

/** Position on a circle */
function polar(index: number, total: number, cx: number, cy: number, radius: number) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
    angle,
  };
}

export function CrossDimensionWidget({ analytics }: CrossDimensionWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('radar');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Merge all unique values from both dimensions into a single ring
  const { allNodes, nodeMap, edges, peak } = useMemo(() => {
    if (!analytics) return { allNodes: [] as string[], nodeMap: new Map<string, { dim: 'dim1' | 'dim2'; index: number }>(), edges: [] as CrossDimensionAnalytics['pairs'], peak: 1 };

    const d1Set = [...new Set(analytics.pairs.map(p => p.dim1_value))];
    const d2Set = [...new Set(analytics.pairs.map(p => p.dim2_value))];

    // Interleave: dim1 values then dim2 values around the circle
    const all: string[] = [];
    const map = new Map<string, { dim: 'dim1' | 'dim2'; index: number }>();

    // Place dim1 values on the left half, dim2 on the right half
    d1Set.forEach((v, i) => {
      const idx = all.length;
      all.push(v);
      map.set(`d1:${v}`, { dim: 'dim1', index: idx });
    });
    d2Set.forEach((v, i) => {
      const idx = all.length;
      all.push(v);
      map.set(`d2:${v}`, { dim: 'dim2', index: idx });
    });

    const pk = Math.max(...analytics.pairs.map(p => p.repo_count), 1);
    return { allNodes: all, nodeMap: map, edges: analytics.pairs, peak: pk };
  }, [analytics]);

  // Radar chart dimensions
  const SIZE = 500;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const OUTER_R = SIZE * 0.38;
  const LABEL_R = SIZE * 0.46;
  const totalNodes = allNodes.length;

  // Which edges connect to the hovered node?
  const { connectedEdges, connectedNodeKeys } = useMemo(() => {
    if (!hoveredNode) return { connectedEdges: new Set<string>(), connectedNodeKeys: new Set<string>() };
    const edgeSet = new Set<string>();
    const nodeSet = new Set<string>();
    nodeSet.add(hoveredNode);
    edges.forEach((e: CrossDimensionCell) => {
      const k1 = `d1:${e.dim1_value}`;
      const k2 = `d2:${e.dim2_value}`;
      if (k1 === hoveredNode || k2 === hoveredNode) {
        edgeSet.add(`${e.dim1_value}:${e.dim2_value}`);
        nodeSet.add(k1);
        nodeSet.add(k2);
      }
    });
    return { connectedEdges: edgeSet, connectedNodeKeys: nodeSet };
  }, [hoveredNode, edges]);

  const handleNodeEnter = useCallback((key: string) => setHoveredNode(key), []);
  const handleNodeLeave = useCallback(() => setHoveredNode(null), []);

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

  // Build radar grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Get the hovered node's connected edges for tooltip
  const hoveredEdges = hoveredNode
    ? edges.filter(e => `d1:${e.dim1_value}` === hoveredNode || `d2:${e.dim2_value}` === hoveredNode)
    : [];

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
            onClick={() => setViewMode('radar')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'radar' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Radar
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'grid' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Grid
          </button>
        </div>
      </div>

      {viewMode === 'radar' ? (
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
            <span className="ml-auto">Hover nodes to explore overlaps</span>
          </div>

          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-auto" style={{ maxHeight: 500 }}>
            {/* Grid rings */}
            {rings.map(r => (
              <circle
                key={r}
                cx={CX}
                cy={CY}
                r={OUTER_R * r}
                fill="none"
                stroke="#27272a"
                strokeWidth={0.5}
                strokeDasharray={r < 1 ? '2 4' : undefined}
              />
            ))}

            {/* Grid spokes */}
            {allNodes.map((_, i) => {
              const p = polar(i, totalNodes, CX, CY, OUTER_R);
              return (
                <line
                  key={`spoke-${i}`}
                  x1={CX}
                  y1={CY}
                  x2={p.x}
                  y2={p.y}
                  stroke="#27272a"
                  strokeWidth={0.5}
                />
              );
            })}

            {/* Connection edges — curved lines through center area */}
            {edges.map(e => {
              const n1 = nodeMap.get(`d1:${e.dim1_value}`);
              const n2 = nodeMap.get(`d2:${e.dim2_value}`);
              if (!n1 || !n2) return null;

              const p1 = polar(n1.index, totalNodes, CX, CY, OUTER_R);
              const p2 = polar(n2.index, totalNodes, CX, CY, OUTER_R);
              const edgeKey = `${e.dim1_value}:${e.dim2_value}`;
              const isConnected = connectedEdges.has(edgeKey);
              const dimmed = hoveredNode && !isConnected;
              const strength = e.repo_count / peak;
              const strokeW = Math.max(1, strength * 5);

              // Curved path through a control point pulled toward center
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              // Pull control point toward center proportional to distance
              const pullFactor = 0.3;
              const cpX = midX + (CX - midX) * pullFactor;
              const cpY = midY + (CY - midY) * pullFactor;

              return (
                <path
                  key={edgeKey}
                  d={`M ${p1.x} ${p1.y} Q ${cpX} ${cpY} ${p2.x} ${p2.y}`}
                  fill="none"
                  stroke={isConnected ? 'url(#radarEdgeActive)' : 'url(#radarEdge)'}
                  strokeWidth={isConnected ? strokeW + 1.5 : strokeW}
                  strokeOpacity={dimmed ? 0.04 : isConnected ? 0.85 : 0.15}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Gradient defs */}
            <defs>
              <linearGradient id="radarEdge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d946ef" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="radarEdgeActive" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e879f9" stopOpacity={1} />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity={1} />
              </linearGradient>
            </defs>

            {/* Filled polygon for dim1 values showing their "reach" */}
            {(() => {
              // Build a polygon connecting dim1 nodes, with radius proportional to their total connections
              const dim1Entries = [...nodeMap.entries()].filter(([, v]) => v.dim === 'dim1');
              if (dim1Entries.length < 3) return null;

              const points = dim1Entries.map(([key, node]) => {
                const totalCount = edges
                  .filter(e => `d1:${e.dim1_value}` === key)
                  .reduce((sum, e) => sum + e.repo_count, 0);
                const r = OUTER_R * Math.min(totalCount / peak, 1) * 0.85;
                const p = polar(node.index, totalNodes, CX, CY, r);
                return `${p.x},${p.y}`;
              });

              return (
                <polygon
                  points={points.join(' ')}
                  fill="#d946ef"
                  fillOpacity={hoveredNode ? 0.03 : 0.06}
                  stroke="#d946ef"
                  strokeWidth={1}
                  strokeOpacity={hoveredNode ? 0.1 : 0.25}
                  className="transition-all duration-200"
                />
              );
            })()}

            {/* Filled polygon for dim2 values */}
            {(() => {
              const dim2Entries = [...nodeMap.entries()].filter(([, v]) => v.dim === 'dim2');
              if (dim2Entries.length < 3) return null;

              const points = dim2Entries.map(([key, node]) => {
                const totalCount = edges
                  .filter(e => `d2:${e.dim2_value}` === key)
                  .reduce((sum, e) => sum + e.repo_count, 0);
                const r = OUTER_R * Math.min(totalCount / peak, 1) * 0.85;
                const p = polar(node.index, totalNodes, CX, CY, r);
                return `${p.x},${p.y}`;
              });

              return (
                <polygon
                  points={points.join(' ')}
                  fill="#38bdf8"
                  fillOpacity={hoveredNode ? 0.03 : 0.06}
                  stroke="#38bdf8"
                  strokeWidth={1}
                  strokeOpacity={hoveredNode ? 0.1 : 0.25}
                  className="transition-all duration-200"
                />
              );
            })()}

            {/* Node dots + labels around the circle */}
            {[...nodeMap.entries()].map(([key, node]) => {
              const isDim1 = node.dim === 'dim1';
              const p = polar(node.index, totalNodes, CX, CY, OUTER_R);
              const lp = polar(node.index, totalNodes, CX, CY, LABEL_R);
              const isHovered = hoveredNode === key;
              const isConnectedNode = connectedNodeKeys.has(key);
              const dimmed = hoveredNode && !isConnectedNode;

              // Total repo count for this node
              const totalCount = edges
                .filter(e => (isDim1 ? `d1:${e.dim1_value}` : `d2:${e.dim2_value}`) === key)
                .reduce((sum, e) => sum + e.repo_count, 0);

              const baseR = Math.max(4, Math.min(8, (totalCount / peak) * 8));
              const r = isHovered ? baseR + 3 : baseR;

              // Text anchor based on position
              const angleDeg = (node.index / totalNodes) * 360 - 90;
              const textAnchor = angleDeg > 90 && angleDeg < 270 ? 'end' : 'start';
              // Rotate text for readability
              const textAngle = angleDeg > 90 && angleDeg < 270 ? angleDeg + 180 : angleDeg;

              const nodeLabel = allNodes[node.index];

              return (
                <g
                  key={key}
                  className="cursor-pointer"
                  onMouseEnter={() => handleNodeEnter(key)}
                  onMouseLeave={handleNodeLeave}
                >
                  {/* Glow */}
                  {isHovered && (
                    <circle cx={p.x} cy={p.y} r={r + 5} fill={isDim1 ? '#d946ef' : '#38bdf8'} opacity={0.2} />
                  )}
                  {/* Dot */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={isDim1 ? '#d946ef' : '#38bdf8'}
                    opacity={dimmed ? 0.15 : 1}
                    className="transition-all duration-200"
                  />
                  {/* Count badge on hover */}
                  {isHovered && (
                    <text
                      x={p.x}
                      y={p.y - r - 6}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={10}
                      fontWeight={700}
                    >
                      {totalCount}
                    </text>
                  )}
                  {/* Label */}
                  <text
                    x={lp.x}
                    y={lp.y}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    transform={`rotate(${textAngle}, ${lp.x}, ${lp.y})`}
                    fill={dimmed ? '#3f3f46' : isHovered ? '#fff' : '#a1a1aa'}
                    fontSize={isHovered ? 11 : 9.5}
                    fontWeight={isHovered ? 600 : 400}
                    className="transition-all duration-200 select-none pointer-events-none"
                  >
                    {nodeLabel}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip panel for hovered node */}
          {hoveredNode && hoveredEdges.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-fuchsia-800/40 bg-zinc-900/95 px-3 py-2 shadow-xl z-10">
              <p className="text-xs font-medium text-zinc-200 mb-1">
                {allNodes[nodeMap.get(hoveredNode)?.index ?? 0]} — {hoveredEdges.length} connections
              </p>
              <div className="flex flex-wrap gap-2">
                {hoveredEdges
                  .sort((a, b) => b.repo_count - a.repo_count)
                  .slice(0, 6)
                  .map(e => {
                    const isDim1 = hoveredNode.startsWith('d1:');
                    const partner = isDim1 ? e.dim2_value : e.dim1_value;
                    return (
                      <span key={`${e.dim1_value}:${e.dim2_value}`} className="text-xs text-zinc-400">
                        <span className={isDim1 ? 'text-sky-300' : 'text-fuchsia-300'}>{partner}</span>
                        <span className="ml-1 text-zinc-600">{e.repo_count}</span>
                      </span>
                    );
                  })}
                {hoveredEdges.length > 6 && (
                  <span className="text-xs text-zinc-600">+{hoveredEdges.length - 6} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grid fallback */
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
