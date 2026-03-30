'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
}

interface Sim {
  nodes: Node[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Edge type styling
// ---------------------------------------------------------------------------
const EDGE_COLORS: Record<string, string> = {
  ALTERNATIVE_TO: '#f59e0b',   // amber
  COMPATIBLE_WITH: '#22c55e',  // green
  DEPENDS_ON:      '#3b82f6',  // blue
  SIMILAR_TO:      '#a78bfa',  // violet
  EXTENDS:         '#f472b6',  // pink
};

const EDGE_LABELS: Record<string, string> = {
  ALTERNATIVE_TO: 'alt',
  COMPATIBLE_WITH: 'compat',
  DEPENDS_ON:      'dep',
  SIMILAR_TO:      'similar',
  EXTENDS:         'extends',
};

// ---------------------------------------------------------------------------
// Force simulation (pure TS, no d3)
// ---------------------------------------------------------------------------
const REPEL = 3000;
const ATTRACT = 0.003;
const DAMPEN = 0.82;
const CENTER_PULL = 0.008;

function tick(sim: Sim, W: number, H: number) {
  const cx = W / 2;
  const cy = H / 2;
  const { nodes, edges } = sim;
  const N = nodes.length;

  // Repulsion between all pairs
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist2 = dx * dx + dy * dy + 1;
      const force = REPEL / dist2;
      const fx = (dx / Math.sqrt(dist2)) * force;
      const fy = (dy / Math.sqrt(dist2)) * force;
      nodes[i].vx -= fx;
      nodes[i].vy -= fy;
      nodes[j].vx += fx;
      nodes[j].vy += fy;
    }
  }

  // Edge attraction
  const idxMap = new Map(nodes.map((n, i) => [n.id, i]));
  for (const edge of edges) {
    const si = idxMap.get(edge.source);
    const ti = idxMap.get(edge.target);
    if (si == null || ti == null) continue;
    const dx = nodes[ti].x - nodes[si].x;
    const dy = nodes[ti].y - nodes[si].y;
    nodes[si].vx += dx * ATTRACT;
    nodes[si].vy += dy * ATTRACT;
    nodes[ti].vx -= dx * ATTRACT;
    nodes[ti].vy -= dy * ATTRACT;
  }

  // Center gravity
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_PULL;
    n.vy += (cy - n.y) * CENTER_PULL;
    n.vx *= DAMPEN;
    n.vy *= DAMPEN;
    n.x += n.vx;
    n.y += n.vy;
    // Clamp to canvas
    n.x = Math.max(60, Math.min(W - 60, n.x));
    n.y = Math.max(40, Math.min(H - 40, n.y));
  }
}

function buildSim(edges: GraphEdge[], W: number, H: number): Sim {
  const nodeIds = new Set<string>();
  const connCount = new Map<string, number>();
  for (const e of edges) {
    nodeIds.add(e.source);
    nodeIds.add(e.target);
    connCount.set(e.source, (connCount.get(e.source) ?? 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) ?? 0) + 1);
  }
  const nodes: Node[] = [];
  let i = 0;
  for (const id of nodeIds) {
    const angle = (i / nodeIds.size) * 2 * Math.PI;
    const r = Math.min(W, H) * 0.35;
    nodes.push({
      id,
      label: id.includes('/') ? id.split('/').pop()! : id,
      x: W / 2 + r * Math.cos(angle),
      y: H / 2 + r * Math.sin(angle),
      vx: 0,
      vy: 0,
      connections: connCount.get(id) ?? 0,
    });
    i++;
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Canvas renderer
// ---------------------------------------------------------------------------
function drawFrame(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  W: number,
  H: number,
  hoveredNode: string | null,
  selectedNode: string | null,
  devicePixelRatio: number,
) {
  ctx.clearRect(0, 0, W * devicePixelRatio, H * devicePixelRatio);

  const idxMap = new Map(sim.nodes.map((n, i) => [n.id, i]));

  // Draw edges
  for (const edge of sim.edges) {
    const si = idxMap.get(edge.source);
    const ti = idxMap.get(edge.target);
    if (si == null || ti == null) continue;
    const src = sim.nodes[si];
    const tgt = sim.nodes[ti];
    const isHighlighted =
      hoveredNode === edge.source ||
      hoveredNode === edge.target ||
      selectedNode === edge.source ||
      selectedNode === edge.target;

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = isHighlighted
      ? EDGE_COLORS[edge.edge_type] ?? '#6b7280'
      : (EDGE_COLORS[edge.edge_type] ?? '#6b7280') + '55';
    ctx.lineWidth = isHighlighted ? 1.5 : 0.8;
    ctx.stroke();

    // Edge type label at midpoint (only when highlighted)
    if (isHighlighted) {
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y + tgt.y) / 2;
      ctx.font = '9px monospace';
      ctx.fillStyle = EDGE_COLORS[edge.edge_type] ?? '#9ca3af';
      ctx.textAlign = 'center';
      ctx.fillText(EDGE_LABELS[edge.edge_type] ?? edge.edge_type, mx, my - 3);
    }
  }

  // Draw nodes
  for (const node of sim.nodes) {
    const isHovered = hoveredNode === node.id;
    const isSelected = selectedNode === node.id;
    const r = 5 + Math.min(node.connections * 1.5, 10);

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected
      ? '#f9fafb'
      : isHovered
      ? '#d4d4d8'
      : '#52525b';
    ctx.fill();

    if (isHovered || isSelected) {
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Label
    const showLabel = isHovered || isSelected || node.connections >= 3;
    if (showLabel) {
      ctx.font = `${isSelected ? '11px' : '10px'} system-ui, sans-serif`;
      ctx.fillStyle = isSelected ? '#f9fafb' : isHovered ? '#e4e4e7' : '#a1a1aa';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y - r - 4);
    }
  }
}

// ---------------------------------------------------------------------------
// Hit test — find node under mouse
// ---------------------------------------------------------------------------
function hitTest(
  sim: Sim,
  mouseX: number,
  mouseY: number,
): string | null {
  for (const node of sim.nodes) {
    const r = 5 + Math.min(node.connections * 1.5, 10) + 4; // 4px slop
    const dx = node.x - mouseX;
    const dy = node.y - mouseY;
    if (dx * dx + dy * dy <= r * r) return node.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface KnowledgeGraphProps {
  edges: GraphEdge[];
  width?: number;
  height?: number;
}

export function KnowledgeGraph({ edges, height = 520 }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const animRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: height });
  const stepsRef = useRef(0);

  // Measure container
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

  // Build simulation when edges or dimensions change
  useEffect(() => {
    const { w, h } = dimensions;
    if (w < 100 || edges.length === 0) return;
    simRef.current = buildSim(edges, w, h);
    stepsRef.current = 0;
  }, [edges, dimensions]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    function frame() {
      const sim = simRef.current;
      const ctx = canvas!.getContext('2d');
      if (!sim || !ctx) {
        animRef.current = requestAnimationFrame(frame);
        return;
      }
      const { w, h } = dimensions;

      // Size canvas
      if (canvas!.width !== w * dpr || canvas!.height !== h * dpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
        canvas!.style.width = `${w}px`;
        canvas!.style.height = `${h}px`;
        ctx.scale(dpr, dpr);
      }

      // Run physics (slow down after convergence)
      if (stepsRef.current < 300) {
        tick(sim, w, h);
        stepsRef.current++;
      }

      drawFrame(ctx, sim, w, h, hoveredNode, selectedNode, dpr);
      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [dimensions, hoveredNode, selectedNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !simRef.current) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setHoveredNode(hitTest(simRef.current, mx, my));
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredNode(null), []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !simRef.current) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(simRef.current, mx, my);
    setSelectedNode((prev) => (prev === hit ? null : hit));
  }, []);

  // Edges connected to the selected node
  const selectedEdges = selectedNode
    ? edges.filter((e) => e.source === selectedNode || e.target === selectedNode)
    : [];

  return (
    <div className="space-y-3">
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
        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 text-[10px] text-zinc-400"
            >
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ backgroundColor: color }}
              />
              {EDGE_LABELS[type]}
            </span>
          ))}
        </div>
      </div>

      {/* Selected node detail panel */}
      {selectedNode && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-200 font-mono">{selectedNode}</p>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-zinc-600 hover:text-zinc-400"
            >
              ✕
            </button>
          </div>
          {selectedEdges.length > 0 ? (
            <ul className="space-y-1">
              {selectedEdges.map((e, i) => {
                const other = e.source === selectedNode ? e.target : e.source;
                const direction = e.source === selectedNode ? '→' : '←';
                return (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium"
                      style={{
                        backgroundColor: (EDGE_COLORS[e.edge_type] ?? '#6b7280') + '30',
                        color: EDGE_COLORS[e.edge_type] ?? '#9ca3af',
                      }}
                    >
                      {e.edge_type}
                    </span>
                    <span className="text-zinc-600">{direction}</span>
                    <span className="font-mono text-zinc-400">{other}</span>
                    {e.evidence && (
                      <span className="text-zinc-600 truncate">— {e.evidence}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-zinc-600">No connections</p>
          )}
          <a
            href={`https://github.com/${selectedNode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            View on GitHub ↗
          </a>
        </div>
      )}
    </div>
  );
}
