'use client';

/**
 * KAN-124: D3-force knowledge graph with category-colored nodes,
 * HTML tooltips, click-to-navigate, and cluster mode for large graphs.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import {
  getCategoryColor,
  getCategoryLabel,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '@/lib/categoryColors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface GraphEdge {
  source: string;
  target: string;
  edge_type: string;
  weight?: number;
  evidence?: string;
}

export interface NodeMeta {
  category: string | null;
  description: string | null;
}

interface GNode extends SimulationNodeDatum {
  id: string;
  label: string;
  category: string | null;
  connections: number;
}

interface GLink extends SimulationLinkDatum<GNode> {
  edge_type: string;
  weight?: number;
}

// Cluster super-node
interface ClusterNode extends SimulationNodeDatum {
  id: string;
  label: string;
  category: string;
  memberCount: number;
  connections: number;
}

interface ClusterLink extends SimulationLinkDatum<ClusterNode> {
  edge_type: string;
  weight: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Edge styling — edges are now similarity-based, color by weight
// ---------------------------------------------------------------------------
const EDGE_COLOR = '#6b7280'; // neutral gray — weight controls opacity

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CLUSTER_THRESHOLD = 500;

function nodeRadius(connections: number): number {
  return 5 + Math.min(connections * 1.5, 12);
}

function clusterRadius(memberCount: number): number {
  return 15 + Math.min(Math.sqrt(memberCount) * 3, 40);
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------
function buildNodes(
  edges: GraphEdge[],
  metadata: Map<string, NodeMeta>,
): GNode[] {
  const connCount = new Map<string, number>();
  for (const e of edges) {
    connCount.set(e.source, (connCount.get(e.source) ?? 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) ?? 0) + 1);
  }
  const nodes: GNode[] = [];
  for (const [id, count] of connCount) {
    const meta = metadata.get(id);
    nodes.push({
      id,
      label: id.includes('/') ? id.split('/').pop()! : id,
      category: meta?.category ?? null,
      connections: count,
    });
  }
  return nodes;
}

function buildLinks(edges: GraphEdge[], nodeIds: Set<string>): GLink[] {
  return edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      edge_type: e.edge_type,
      weight: e.weight,
    }));
}

function buildClusterData(
  edges: GraphEdge[],
  metadata: Map<string, NodeMeta>,
): { nodes: ClusterNode[]; links: ClusterLink[] } {
  // Count members per category
  const allNodeIds = new Set<string>();
  const connCount = new Map<string, number>();
  for (const e of edges) {
    allNodeIds.add(e.source);
    allNodeIds.add(e.target);
    connCount.set(e.source, (connCount.get(e.source) ?? 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) ?? 0) + 1);
  }

  const catMembers = new Map<string, number>();
  const catConns = new Map<string, number>();
  for (const id of allNodeIds) {
    const cat = metadata.get(id)?.category ?? 'uncategorized';
    catMembers.set(cat, (catMembers.get(cat) ?? 0) + 1);
    catConns.set(cat, (catConns.get(cat) ?? 0) + (connCount.get(id) ?? 0));
  }

  const nodes: ClusterNode[] = [];
  for (const [cat, count] of catMembers) {
    nodes.push({
      id: `cluster:${cat}`,
      label: getCategoryLabel(cat === 'uncategorized' ? null : cat),
      category: cat,
      memberCount: count,
      connections: catConns.get(cat) ?? 0,
    });
  }

  // Aggregate edges between categories
  const linkKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const linkMap = new Map<string, { source: string; target: string; weight: number; count: number; edge_type: string }>();
  for (const e of edges) {
    const srcCat = metadata.get(e.source)?.category ?? 'uncategorized';
    const tgtCat = metadata.get(e.target)?.category ?? 'uncategorized';
    if (srcCat === tgtCat) continue; // skip intra-cluster
    const key = linkKey(`cluster:${srcCat}`, `cluster:${tgtCat}`);
    const existing = linkMap.get(key);
    if (existing) {
      existing.weight += e.weight ?? 1;
      existing.count += 1;
    } else {
      linkMap.set(key, {
        source: `cluster:${srcCat}`,
        target: `cluster:${tgtCat}`,
        weight: e.weight ?? 1,
        count: 1,
        edge_type: e.edge_type,
      });
    }
  }

  return { nodes, links: Array.from(linkMap.values()) };
}

// ---------------------------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------------------------
function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GNode[],
  links: GLink[],
  W: number,
  H: number,
  hoveredId: string | null,
  dpr: number,
) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Draw edges — opacity based on similarity weight
  for (const link of links) {
    const src = link.source as GNode;
    const tgt = link.target as GNode;
    if (src.x == null || tgt.x == null) continue;
    const isHighlighted = hoveredId === src.id || hoveredId === tgt.id;
    // Weight ranges ~0.55-1.0; map to opacity 0.08-0.5
    const weight = link.weight ?? 0.6;
    const alpha = isHighlighted ? 0.7 : 0.08 + (weight - 0.5) * 0.8;
    const alphaHex = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0');

    ctx.beginPath();
    ctx.moveTo(src.x, src.y!);
    ctx.lineTo(tgt.x, tgt.y!);
    ctx.strokeStyle = isHighlighted ? '#a78bfa' : EDGE_COLOR + alphaHex;
    ctx.lineWidth = isHighlighted ? 1.8 : 0.5 + weight * 0.8;
    ctx.stroke();

    if (isHighlighted) {
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y! + tgt.y!) / 2;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#a78bfa';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(weight * 100)}%`, mx, my - 3);
    }
  }

  // Draw nodes
  for (const node of nodes) {
    if (node.x == null) continue;
    const r = nodeRadius(node.connections);
    const isHovered = hoveredId === node.id;
    const color = getCategoryColor(node.category);

    ctx.beginPath();
    ctx.arc(node.x, node.y!, r, 0, 2 * Math.PI);
    ctx.fillStyle = isHovered ? lightenColor(color, 0.3) : color;
    ctx.fill();

    if (isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Labels — only on hover to reduce clutter
    if (isHovered) {
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#f9fafb';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y! - r - 4);
    }
  }

  ctx.restore();
}

function drawClusters(
  ctx: CanvasRenderingContext2D,
  nodes: ClusterNode[],
  links: ClusterLink[],
  W: number,
  H: number,
  hoveredId: string | null,
  dpr: number,
) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Draw edges
  for (const link of links) {
    const src = link.source as ClusterNode;
    const tgt = link.target as ClusterNode;
    if (src.x == null || tgt.x == null) continue;
    const isHighlighted = hoveredId === src.id || hoveredId === tgt.id;
    const thickness = Math.min(Math.log2(link.count + 1) * 1.5, 6);

    ctx.beginPath();
    ctx.moveTo(src.x, src.y!);
    ctx.lineTo(tgt.x, tgt.y!);
    ctx.strokeStyle = isHighlighted ? '#a1a1aa' : '#52525b40';
    ctx.lineWidth = isHighlighted ? thickness + 1 : thickness * 0.6;
    ctx.stroke();

    if (isHighlighted) {
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y! + tgt.y!) / 2;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = '#d4d4d8';
      ctx.textAlign = 'center';
      ctx.fillText(`${link.count} edges`, mx, my - 5);
    }
  }

  // Draw cluster nodes
  for (const node of nodes) {
    if (node.x == null) continue;
    const r = clusterRadius(node.memberCount);
    const isHovered = hoveredId === node.id;
    const color = getCategoryColor(node.category === 'uncategorized' ? null : node.category);

    // Outer ring
    ctx.beginPath();
    ctx.arc(node.x, node.y!, r, 0, 2 * Math.PI);
    ctx.fillStyle = color + '30';
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#ffffff' : color;
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(node.x, node.y!, 6, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    ctx.font = `${isHovered ? 'bold 12px' : '11px'} system-ui, sans-serif`;
    ctx.fillStyle = isHovered ? '#f9fafb' : '#d4d4d8';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y! - r - 6);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillText(`${node.memberCount} repos`, node.x, node.y! - r - 6 + 14);
  }

  ctx.restore();
}

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Hit test
// ---------------------------------------------------------------------------
function hitTestNodes(
  nodes: { id: string; x?: number; y?: number; connections: number }[],
  mx: number,
  my: number,
  radiusFn: (n: { connections: number }) => number,
): string | null {
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const r = radiusFn(node) + 4;
    const dx = node.x - mx;
    const dy = node.y! - my;
    if (dx * dx + dy * dy <= r * r) return node.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface KnowledgeGraphV2Props {
  edges: GraphEdge[];
  nodeMetadata: Map<string, NodeMeta>;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

export function KnowledgeGraphV2({
  edges,
  nodeMetadata,
  height = 560,
  onNodeClick,
}: KnowledgeGraphV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<GNode, GLink> | Simulation<ClusterNode, ClusterLink> | null>(null);
  const nodesRef = useRef<GNode[] | ClusterNode[]>([]);
  const linksRef = useRef<GLink[] | ClusterLink[]>([]);
  const animRef = useRef<number>(0);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string } | null>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: height });
  const [mode, setMode] = useState<'auto' | 'cluster' | 'detail'>('auto');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Determine if we should cluster
  const nodeCount = useMemo(() => {
    const ids = new Set<string>();
    for (const e of edges) {
      ids.add(e.source);
      ids.add(e.target);
    }
    return ids.size;
  }, [edges]);

  const isClusterMode = mode === 'cluster' || (mode === 'auto' && nodeCount > CLUSTER_THRESHOLD);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDimensions({ w: el.clientWidth, h: height });
    });
    obs.observe(el);
    setDimensions({ w: el.clientWidth, h: height });
    return () => obs.disconnect();
  }, [height]);

  // Active categories for legend (only categories that appear in current data)
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const [, meta] of nodeMetadata) {
      if (meta.category) cats.add(meta.category);
    }
    return Array.from(cats).sort();
  }, [nodeMetadata]);

  // Build & run simulation
  useEffect(() => {
    const { w, h } = dimensions;
    if (w < 100 || edges.length === 0) return;

    // Stop previous simulation
    simRef.current?.stop();

    if (isClusterMode && !expandedCategory) {
      // Cluster mode
      const { nodes, links } = buildClusterData(edges, nodeMetadata);
      nodesRef.current = nodes;
      linksRef.current = links;

      const sim = forceSimulation<ClusterNode>(nodes)
        .force('charge', forceManyBody().strength(-800))
        .force(
          'link',
          forceLink<ClusterNode, ClusterLink>(links)
            .id((d) => d.id)
            .distance(120),
        )
        .force('center', forceCenter(w / 2, h / 2))
        .force('collide', forceCollide<ClusterNode>().radius((d) => clusterRadius(d.memberCount) + 10))
        .force('x', forceX(w / 2).strength(0.04))
        .force('y', forceY(h / 2).strength(0.04))
        .alphaDecay(0.03);

      simRef.current = sim as unknown as Simulation<GNode, GLink>;
    } else {
      // Detail mode — either all edges or filtered to expanded category
      let filteredEdges = edges;
      if (expandedCategory) {
        filteredEdges = edges.filter((e) => {
          const srcCat = nodeMetadata.get(e.source)?.category;
          const tgtCat = nodeMetadata.get(e.target)?.category;
          return srcCat === expandedCategory || tgtCat === expandedCategory;
        });
      }

      const nodes = buildNodes(filteredEdges, nodeMetadata);
      const nodeIds = new Set(nodes.map((n) => n.id));
      const links = buildLinks(filteredEdges, nodeIds);
      nodesRef.current = nodes;
      linksRef.current = links;

      const sim = forceSimulation<GNode>(nodes)
        .force('charge', forceManyBody().strength(-350))
        .force(
          'link',
          forceLink<GNode, GLink>(links)
            .id((d) => d.id)
            .distance(100),
        )
        .force('center', forceCenter(w / 2, h / 2))
        .force('collide', forceCollide<GNode>().radius((d) => nodeRadius(d.connections) + 6))
        .force('x', forceX(w / 2).strength(0.05))
        .force('y', forceY(h / 2).strength(0.05))
        .alphaDecay(0.02);

      simRef.current = sim as unknown as Simulation<GNode, GLink>;
    }

    return () => {
      simRef.current?.stop();
    };
  }, [edges, nodeMetadata, dimensions, isClusterMode, expandedCategory]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    function frame() {
      const ctx = canvas!.getContext('2d');
      if (!ctx) {
        animRef.current = requestAnimationFrame(frame);
        return;
      }
      const { w, h } = dimensions;

      if (canvas!.width !== w * dpr || canvas!.height !== h * dpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
        canvas!.style.width = `${w}px`;
        canvas!.style.height = `${h}px`;
      }

      if (isClusterMode && !expandedCategory) {
        drawClusters(
          ctx,
          nodesRef.current as ClusterNode[],
          linksRef.current as ClusterLink[],
          w,
          h,
          hoveredId,
          dpr,
        );
      } else {
        drawGraph(
          ctx,
          nodesRef.current as GNode[],
          linksRef.current as GLink[],
          w,
          h,
          hoveredId,
          dpr,
        );
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [dimensions, hoveredId, isClusterMode, expandedCategory]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const nodes = nodesRef.current;
      let hit: string | null = null;

      if (isClusterMode && !expandedCategory) {
        hit = hitTestNodes(
          (nodes as ClusterNode[]).map((n) => ({ ...n, connections: n.memberCount })),
          mx,
          my,
          (n) => clusterRadius(n.connections),
        );
      } else {
        hit = hitTestNodes(nodes as GNode[], mx, my, (n) => nodeRadius(n.connections));
      }

      setHoveredId(hit);
      if (hit) {
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: hit });
      } else {
        setTooltip(null);
      }
    },
    [isClusterMode, expandedCategory],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (isClusterMode && !expandedCategory) {
        const hit = hitTestNodes(
          (nodesRef.current as ClusterNode[]).map((n) => ({ ...n, connections: n.memberCount })),
          mx,
          my,
          (n) => clusterRadius(n.connections),
        );
        if (hit) {
          const cat = hit.replace('cluster:', '');
          setExpandedCategory(cat);
          setMode('detail');
        }
      } else {
        const hit = hitTestNodes(nodesRef.current as GNode[], mx, my, (n) => nodeRadius(n.connections));
        if (hit && onNodeClick) {
          onNodeClick(hit);
        }
      }
    },
    [isClusterMode, expandedCategory, onNodeClick],
  );

  const handleBackToOverview = useCallback(() => {
    setExpandedCategory(null);
    setMode('auto');
  }, []);

  // Tooltip content
  const tooltipContent = useMemo(() => {
    if (!tooltip) return null;
    const { id } = tooltip;

    if (id.startsWith('cluster:')) {
      const cat = id.replace('cluster:', '');
      const node = (nodesRef.current as ClusterNode[]).find((n) => n.id === id);
      return {
        name: getCategoryLabel(cat === 'uncategorized' ? null : cat),
        category: null,
        connections: node?.connections ?? 0,
        memberCount: node?.memberCount ?? 0,
        isCluster: true,
      };
    }

    const meta = nodeMetadata.get(id);
    const node = (nodesRef.current as GNode[]).find((n) => n.id === id);
    return {
      name: id.includes('/') ? id.split('/').pop()! : id,
      category: meta?.category ?? null,
      connections: node?.connections ?? 0,
      memberCount: 0,
      isCluster: false,
    };
  }, [tooltip, nodeMetadata]);

  return (
    <div className="space-y-3">
      {/* Cluster mode back button */}
      {expandedCategory && (
        <button
          onClick={handleBackToOverview}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <span>←</span> Back to overview
          <span className="text-zinc-500">
            (viewing {getCategoryLabel(expandedCategory)})
          </span>
        </button>
      )}

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />

        {edges.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
            No edges to display
          </div>
        )}

        {/* HTML Tooltip */}
        {tooltip && tooltipContent && (
          <div
            className="absolute pointer-events-none z-10 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            style={{
              left: Math.min(tooltip.x + 12, dimensions.w - 200),
              top: Math.max(tooltip.y - 60, 8),
            }}
          >
            <p className="text-sm font-medium text-zinc-100 font-mono">
              {tooltipContent.name}
            </p>
            {tooltipContent.isCluster ? (
              <>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {tooltipContent.memberCount} repos
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {tooltipContent.connections} connections
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  Click to drill in
                </p>
              </>
            ) : (
              <>
                {tooltipContent.category && (
                  <p className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: getCategoryColor(tooltipContent.category) }}
                    />
                    {getCategoryLabel(tooltipContent.category)}
                  </p>
                )}
                <p className="text-xs text-zinc-500 mt-0.5">
                  {tooltipContent.connections} connections
                </p>
              </>
            )}
          </div>
        )}

        {/* Category Legend (bottom-left) */}
        <div className="absolute bottom-3 left-3 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
          {activeCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400"
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#52525b' }}
              />
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
          ))}
        </div>

        {/* Similarity info (bottom-right) */}
        <div className="absolute bottom-3 right-3 text-[10px] text-zinc-500">
          Edges = embedding similarity
        </div>

        {/* Cluster mode indicator */}
        {isClusterMode && !expandedCategory && (
          <div className="absolute top-3 right-3 rounded-full bg-zinc-800/80 px-2.5 py-1 text-[10px] text-zinc-400 backdrop-blur-sm">
            Clustered view ({nodeCount} nodes) — click a cluster to drill in
          </div>
        )}
      </div>

      {/* Instructions */}
      {edges.length > 0 && (
        <p className="text-xs text-zinc-700">
          {isClusterMode && !expandedCategory
            ? 'Click a category cluster to see individual repos. Hover to see details.'
            : 'Click a node to open repo details. Hover to see name, category, and connections.'}
        </p>
      )}
    </div>
  );
}
