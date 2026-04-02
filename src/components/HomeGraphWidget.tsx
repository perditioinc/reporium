'use client';

/**
 * KAN-124: Compact knowledge graph preview for the home page.
 * Fetches a small subset of edges and renders KnowledgeGraphV2 at reduced height.
 * Links to /graph for the full interactive experience.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KnowledgeGraphV2, type GraphEdge, type NodeMeta } from '@/components/KnowledgeGraphV2';

const API_URL =
  process.env.NEXT_PUBLIC_REPORIUM_API_URL ??
  'https://reporium-api-573778300586.us-central1.run.app';

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
  edges: ApiEdge[];
}

export function HomeGraphWidget() {
  const router = useRouter();
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [nodeMetadata, setNodeMetadata] = useState<Map<string, NodeMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEdges, setTotalEdges] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`${API_URL}/graph/edges?limit=100`, {
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

        const edgesList: GraphEdge[] = data.edges.map((e) => ({
          source: nodeId(e.source, e.source_upstream, e.source_owner, e.source_name),
          target: nodeId(e.target, e.target_upstream, e.target_owner, e.target_name),
          edge_type: e.edgeType ?? e.edge_type ?? 'UNKNOWN',
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

        setEdges(edgesList);
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
  }, []);

  const nodeCount = useMemo(
    () => new Set(edges.flatMap((e) => [e.source, e.target])).size,
    [edges],
  );

  const handleNodeClick = useCallback(
    (id: string) => {
      const name = id.includes('/') ? id.split('/').pop()! : id;
      router.push(`/repo/${name}`);
    },
    [router],
  );

  // Don't render anything if graph fails to load — it's not critical on the home page
  if (error) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Knowledge Graph</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loading
              ? 'Loading relationships...'
              : `${nodeCount} repos \u00b7 ${edges.length} of ${totalEdges.toLocaleString()} edges`}
          </p>
        </div>
        <Link
          href="/graph"
          className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
        >
          Explore full graph
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <span className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Loading graph...
          </span>
        </div>
      ) : (
        <KnowledgeGraphV2
          edges={edges}
          nodeMetadata={nodeMetadata}
          height={360}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  );
}
