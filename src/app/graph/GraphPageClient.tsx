'use client';

import { useState, useEffect } from 'react';
import { KnowledgeGraph, type GraphEdge } from '@/components/KnowledgeGraph';

const EDGE_TYPES = ['ALL', 'ALTERNATIVE_TO', 'COMPATIBLE_WITH', 'DEPENDS_ON', 'SIMILAR_TO', 'EXTENDS'] as const;
type EdgeTypeFilter = (typeof EDGE_TYPES)[number];

interface ApiRepoNode {
  name: string;
  description?: string | null;
  category?: string | null;
  /** If present, the upstream owner/repo path (e.g. "langchain-ai/langchain") */
  upstream?: string | null;
  owner?: string | null;
}

interface ApiEdge {
  /** Nested object form from the API */
  source?: ApiRepoNode;
  target?: ApiRepoNode;
  /** Flat form (legacy / MCP remapped) */
  source_name?: string;
  source_owner?: string;
  source_upstream?: string;
  target_name?: string;
  target_owner?: string;
  target_upstream?: string;
  /** API uses camelCase edgeType; flat form uses edge_type */
  edgeType?: string;
  edge_type?: string;
  weight?: number;
  evidence?: string | Record<string, unknown>;
}

interface ApiResponse {
  /** API uses "total"; MCP remaps to "total_edges" */
  total?: number;
  total_edges?: number;
  /** API uses "edgeTypes"; MCP remaps to "edge_types_available" */
  edgeTypes?: string[];
  edge_types_available?: string[];
  edges: ApiEdge[];
}

interface GraphPageClientProps {
  apiUrl: string;
}

export function GraphPageClient({ apiUrl }: GraphPageClientProps) {
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEdges, setTotalEdges] = useState(0);
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<EdgeTypeFilter>('ALL');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(limit) });
    if (edgeTypeFilter !== 'ALL') params.set('edge_type', edgeTypeFilter);

    fetch(`${apiUrl}/graph/edges?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: ApiResponse = await res.json();
        if (cancelled) return;

        setTotalEdges(data.total_edges ?? data.total ?? 0);

        // Normalise edges — API returns nested source/target objects;
        // legacy/MCP path returns flat source_name etc.
        const nodeId = (node: ApiRepoNode | undefined, flatUpstream?: string, flatOwner?: string, flatName?: string): string => {
          if (node) {
            return node.upstream ?? (node.owner ? `${node.owner}/${node.name}` : node.name);
          }
          return flatUpstream ?? (flatOwner ? `${flatOwner}/${flatName ?? ''}` : flatName ?? 'unknown');
        };

        const edgeEvidence = (e: ApiEdge): string | undefined => {
          if (!e.evidence) return undefined;
          if (typeof e.evidence === 'string') return e.evidence;
          // Object evidence — extract category or stringify first value
          const ev = e.evidence as Record<string, unknown>;
          if (ev.category) return String(ev.category);
          const vals = Object.values(ev);
          return vals.length ? String(vals[0]) : undefined;
        };

        const edges: GraphEdge[] = data.edges.map((e) => ({
          source: nodeId(e.source, e.source_upstream, e.source_owner, e.source_name),
          target: nodeId(e.target, e.target_upstream, e.target_owner, e.target_name),
          edge_type: e.edgeType ?? e.edge_type ?? 'UNKNOWN',
          weight: e.weight,
          evidence: edgeEvidence(e),
        }));

        setAllEdges(edges);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        setError(err.message ?? 'Failed to load graph');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiUrl, edgeTypeFilter, limit]);

  const nodeCount = new Set(allEdges.flatMap((e) => [e.source, e.target])).size;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Edge type filter */}
        <div className="flex flex-wrap gap-1.5">
          {EDGE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setEdgeTypeFilter(type)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                edgeTypeFilter === type
                  ? 'bg-zinc-200 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {type === 'ALL' ? 'All types' : type.replace('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>

        {/* Limit selector */}
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="ml-auto rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value={50}>50 edges</option>
          <option value={100}>100 edges</option>
          <option value={200}>200 edges</option>
        </select>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <p className="text-xs text-zinc-600">
          {nodeCount} nodes · {allEdges.length} edges shown
          {totalEdges > allEdges.length ? ` · ${totalEdges} total` : ''}
        </p>
      )}

      {/* Graph */}
      {loading && (
        <div className="flex items-center justify-center h-64 rounded-xl border border-zinc-800 bg-zinc-900/60">
          <span className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Loading graph…
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          Failed to load knowledge graph: {error}
        </div>
      )}

      {!loading && !error && (
        <KnowledgeGraph edges={allEdges} height={560} />
      )}

      {/* Instructions */}
      {!loading && !error && allEdges.length > 0 && (
        <p className="text-xs text-zinc-700">
          Click a node to see its connections. Hover to highlight edges. Nodes sized by connection count.
        </p>
      )}
    </div>
  );
}
