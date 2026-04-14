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
import { loadGraphDataset } from '@/lib/graphData';

// Dynamic import — Three.js doesn't work with SSR/static export
const KnowledgeGraph3D = dynamic(
  () => import('@/components/KnowledgeGraph3D').then((m) => ({ default: m.KnowledgeGraph3D })),
  { ssr: false },
);

import { API_URL } from '@/lib/apiUrl';

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setStatusMessage(null);

    loadGraphDataset({
      apiUrl: API_URL,
      limit: 800,
      neighbours: 5,
      minSimilarity: 0.4,
      signal: controller.signal,
    })
      .then((dataset) => {
        if (cancelled) return;

        setTotalEdges(dataset.totalEdges);
        setEdges(dataset.edges);
        setNodeMetadata(dataset.nodeMetadata);
        setStatusMessage(dataset.message);
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

  // Don't render anything if graph fails to load (logged for debugging)
  if (error) {
    if (typeof window !== 'undefined') console.warn('[HomeGraphWidget] Graph load failed:', error);
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0a0a0f] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Knowledge Graph</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loading
              ? 'Loading constellation...'
              : `${nodeCount} repos \u00b7 ${(totalEdges || edges.length).toLocaleString()} connections`}
          </p>
          {!loading && statusMessage && (
            <p className="text-[11px] text-amber-300 mt-1">{statusMessage}</p>
          )}
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
