'use client';

/**
 * KAN-124: Graph page client — fetches edges from the API, extracts node
 * metadata (category, description), and renders KnowledgeGraphV2.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { KnowledgeGraphV2, type GraphEdge, type NodeMeta } from '@/components/KnowledgeGraphV2';

const EDGE_TYPES = ['ALL', 'ALTERNATIVE_TO', 'COMPATIBLE_WITH', 'DEPENDS_ON', 'SIMILAR_TO', 'EXTENDS'] as const;
type EdgeTypeFilter = (typeof EDGE_TYPES)[number];

interface ApiRepoNode {
  name: string;
  description?: string | null;
  category?: string | null;
  upstream?: string | null;
  owner?: string | null;
}

interface ApiEdge {
  source?: ApiRepoNode;
  target?: ApiRepoNode;
  source_name?: string;
  source_owner?: string;
  source_upstream?: string;
  target_name?: string;
  target_owner?: string;
  target_upstream?: string;
  edgeType?: string;
  edge_type?: string;
  weight?: number;
  evidence?: string | Record<string, unknown>;
}

interface ApiResponse {
  total?: number;
  total_edges?: number;
  edgeTypes?: string[];
  edge_types_available?: string[];
  edges: ApiEdge[];
}

interface GraphPageClientProps {
  apiUrl: string;
}

export function GraphPageClient({ apiUrl }: GraphPageClientProps) {
  const router = useRouter();
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [nodeMetadata, setNodeMetadata] = useState<Map<string, NodeMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEdges, setTotalEdges] = useState(0);
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<EdgeTypeFilter>('ALL');
  const [limit, setLimit] = useState(200);

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

        const nodeId = (
          node: ApiRepoNode | undefined,
          flatUpstream?: string,
          flatOwner?: string,
          flatName?: string,
        ): string => {
          if (node) {
            return node.upstream ?? (node.owner ? `${node.owner}/${node.name}` : node.name);
          }
          return flatUpstream ?? (flatOwner ? `${flatOwner}/${flatName ?? ''}` : flatName ?? 'unknown');
        };

        const edgeEvidence = (e: ApiEdge): string | undefined => {
          if (!e.evidence) return undefined;
          if (typeof e.evidence === 'string') return e.evidence;
          const ev = e.evidence as Record<string, unknown>;
          if (ev.category) return String(ev.category);
          const vals = Object.values(ev);
          return vals.length ? String(vals[0]) : undefined;
        };

        // Build edges
        const edges: GraphEdge[] = data.edges.map((e) => ({
          source: nodeId(e.source, e.source_upstream, e.source_owner, e.source_name),
          target: nodeId(e.target, e.target_upstream, e.target_owner, e.target_name),
          edge_type: e.edgeType ?? e.edge_type ?? 'UNKNOWN',
          weight: e.weight,
          evidence: edgeEvidence(e),
        }));

        // Extract node metadata (category, description)
        const meta = new Map<string, NodeMeta>();
        for (const e of data.edges) {
          const srcId = nodeId(e.source, e.source_upstream, e.source_owner, e.source_name);
          const tgtId = nodeId(e.target, e.target_upstream, e.target_owner, e.target_name);
          if (!meta.has(srcId) && e.source) {
            meta.set(srcId, {
              category: e.source.category ?? null,
              description: e.source.description ?? null,
            });
          }
          if (!meta.has(tgtId) && e.target) {
            meta.set(tgtId, {
              category: e.target.category ?? null,
              description: e.target.description ?? null,
            });
          }
        }

        setAllEdges(edges);
        setNodeMetadata(meta);
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

  const nodeCount = useMemo(
    () => new Set(allEdges.flatMap((e) => [e.source, e.target])).size,
    [allEdges],
  );

  const handleNodeClick = useCallback(
    (id: string) => {
      const name = id.includes('/') ? id.split('/').pop()! : id;
      router.push(`/repo/${name}`);
    },
    [router],
  );

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
              {type === 'ALL' ? 'All types' : type.replace(/_/g, ' ').toLowerCase()}
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
          <option value={500}>500 edges</option>
          <option value={1000}>1000 edges</option>
          <option value={2000}>2000 edges</option>
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
        <KnowledgeGraphV2
          edges={allEdges}
          nodeMetadata={nodeMetadata}
          height={560}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  );
}
