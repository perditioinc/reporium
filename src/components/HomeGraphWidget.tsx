'use client';

/**
 * KAN-124: 3D constellation knowledge graph widget for the home page.
 * Fetches edges from the API and renders an interactive 3D graph
 * with zoom, rotation, info bubbles, and fullscreen support.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GraphEdge, NodeMeta } from '@/components/KnowledgeGraph3D';

// Dynamic import — Three.js doesn't work with SSR/static export
const KnowledgeGraph3D = dynamic(
  () => import('@/components/KnowledgeGraph3D').then((m) => ({ default: m.KnowledgeGraph3D })),
  { ssr: false },
);

if (!process.env.NEXT_PUBLIC_REPORIUM_API_URL) {
  throw new Error('NEXT_PUBLIC_REPORIUM_API_URL environment variable is not set');
}
const API_URL = process.env.NEXT_PUBLIC_REPORIUM_API_URL;

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
  total_repos?: number;
  edges: ApiEdge[];
}

interface HomeGraphWidgetProps {
  /** When a repo card is selected externally, highlight it on the graph */
  selectedRepoName?: string | null;
  /** Callback when a node is clicked on the graph (repo name, not full id) */
  onGraphNodeSelect?: (repoName: string) => void;
}

export function HomeGraphWidget({ selectedRepoName, onGraphNodeSelect }: HomeGraphWidgetProps = {}) {
  const router = useRouter();
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [nodeMetadata, setNodeMetadata] = useState<Map<string, NodeMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEdges, setTotalEdges] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`${API_URL}/graph/edges?limit=6000&neighbours=5&min_similarity=0.40`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: ApiResponse = await res.json();
        if (cancelled) return;

        setTotalEdges(data.total ?? data.total_edges ?? 0);

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
      if (onGraphNodeSelect) {
        // Bidirectional sync: notify parent so repo card gets highlighted
        onGraphNodeSelect(name);
      } else {
        // Fallback: navigate to repo page
        router.push(`/repo/${name}`);
      }
    },
    [router, onGraphNodeSelect],
  );

  // Don't render anything if graph fails to load
  if (error) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0a0a0f] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Knowledge Graph</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loading
              ? 'Loading constellation...'
              : `${nodeCount} repos \u00b7 ${edges.length.toLocaleString()} similarity edges`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[420px]">
          <span className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Loading constellation...
          </span>
        </div>
      ) : (
        <KnowledgeGraph3D
          edges={edges}
          nodeMetadata={nodeMetadata}
          height={420}
          onNodeClick={handleNodeClick}
          compact
          selectedNodeId={selectedRepoName}
        />
      )}
    </div>
  );
}
