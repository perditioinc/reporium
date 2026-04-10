'use client';

/**
 * KAN-124: Full graph page — 3D constellation knowledge graph
 * with full controls, zoom, rotation, and info panels.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GraphEdge, NodeMeta } from '@/components/KnowledgeGraph3D';
import { API_URL as CLIENT_API_URL } from '@/lib/apiUrl';

const KnowledgeGraph3D = dynamic(
  () => import('@/components/KnowledgeGraph3D').then((m) => ({ default: m.KnowledgeGraph3D })),
  { ssr: false },
);

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
  total_repos?: number;
  total_edges?: number;
  total_knowledge_graph_edges?: number;
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
  const [totalRepos, setTotalRepos] = useState(0);
  const [totalGraphEdges, setTotalGraphEdges] = useState(0);
  const [limit, setLimit] = useState(2000);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(limit),
      neighbours: '5',
      min_similarity: '0.5',
    });

    fetch(`${CLIENT_API_URL}/graph/edges?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: ApiResponse = await res.json();
        if (cancelled) return;

        setTotalRepos(data.total_repos ?? 0);
        setTotalGraphEdges(data.total_knowledge_graph_edges ?? data.total ?? 0);

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

        const edges: GraphEdge[] = data.edges.map((e) => ({
          source: nodeId(e.source, e.source_upstream, e.source_owner, e.source_name),
          target: nodeId(e.target, e.target_upstream, e.target_owner, e.target_name),
          edge_type: e.edgeType ?? e.edge_type ?? 'SIMILAR_TO',
          weight: e.weight,
        }));

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
  }, [limit]);

  const nodeCount = useMemo(
    () => new Set(allEdges.flatMap((e) => [e.source, e.target])).size,
    [allEdges],
  );

  const handleNodeClick = useCallback(
    (id: string) => {
      router.push(`/repo/${id}`);
    },
    [router],
  );

  // Keyboard: [ / ] to cycle edge limit for graph navigation
  useEffect(() => {
    const LIMITS = [500, 1000, 2000, 5000, 10000];
    const handler = (e: KeyboardEvent) => {
      if (e.key === ']') {
        setLimit((prev) => {
          const i = LIMITS.indexOf(prev);
          return LIMITS[Math.min(i + 1, LIMITS.length - 1)];
        });
      } else if (e.key === '[') {
        setLimit((prev) => {
          const i = LIMITS.indexOf(prev);
          return LIMITS[Math.max(i - 1, 0)];
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          3D constellation of your AI repo library. Scroll to zoom, drag to rotate, right-drag to pan.
          Click a node for details. Use <kbd className="font-mono bg-zinc-800 px-1 rounded">[</kbd> / <kbd className="font-mono bg-zinc-800 px-1 rounded">]</kbd> to adjust edge count.
        </p>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value={500}>500 edges</option>
          <option value={1000}>1,000 edges</option>
          <option value={2000}>2,000 edges</option>
          <option value={5000}>5,000 edges</option>
          <option value={10000}>10,000 edges</option>
        </select>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <p className="text-xs text-zinc-600">
          {nodeCount} repos &middot; {allEdges.length.toLocaleString()} edges shown
          {totalGraphEdges > allEdges.length ? ` of ${totalGraphEdges.toLocaleString()} total` : ''}
          {totalRepos > nodeCount ? ` \u00b7 ${totalRepos.toLocaleString()} in library` : ''}
        </p>
      )}

      {/* Graph */}
      {loading && (
        <div className="flex items-center justify-center h-[600px] rounded-xl border border-zinc-800 bg-[#0a0a0f]">
          <span className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Loading constellation...
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          Failed to load knowledge graph: {error}
        </div>
      )}

      {!loading && !error && (
        <KnowledgeGraph3D
          edges={allEdges}
          nodeMetadata={nodeMetadata}
          height={600}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  );
}
