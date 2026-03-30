'use client';

import { useState, useEffect } from 'react';
import { KnowledgeGraph, type GraphEdge } from '@/components/KnowledgeGraph';

const EDGE_TYPES = ['ALL', 'ALTERNATIVE_TO', 'COMPATIBLE_WITH', 'DEPENDS_ON', 'SIMILAR_TO', 'EXTENDS'] as const;
type EdgeTypeFilter = (typeof EDGE_TYPES)[number];

interface ApiEdge {
  source_name: string;
  source_owner?: string;
  source_upstream?: string;
  target_name: string;
  target_owner?: string;
  target_upstream?: string;
  edge_type: string;
  weight?: number;
  evidence?: string;
}

interface ApiResponse {
  total_edges: number;
  edge_types_available: string[];
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

        setTotalEdges(data.total_edges);

        // Normalise edges: use upstream (owner/repo) as the node ID when available
        const edges: GraphEdge[] = data.edges.map((e) => ({
          source: e.source_upstream ?? `${e.source_owner ?? ''}/${e.source_name}`.replace(/^\//, e.source_name),
          target: e.target_upstream ?? `${e.target_owner ?? ''}/${e.target_name}`.replace(/^\//, e.target_name),
          edge_type: e.edge_type,
          weight: e.weight,
          evidence: e.evidence,
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
