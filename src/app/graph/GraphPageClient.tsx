'use client';

/**
 * KAN-124: Full graph page — 3D constellation knowledge graph
 * with full controls, zoom, rotation, and info panels.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GraphEdge, NodeMeta } from '@/components/KnowledgeGraph3D';
import { API_URL as CLIENT_API_URL } from '@/lib/apiUrl';
import { loadGraphDataset } from '@/lib/graphData';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GraphFallbackPanel } from '@/components/GraphFallbackPanel';

const KnowledgeGraph = dynamic(
  () => import('@/components/KnowledgeGraph3D').then((m) => ({ default: m.KnowledgeGraph3D })),
  { ssr: false },
);

const MOBILE_QUERY = '(max-width: 767px)';

function MobileGraphFallback() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0a0a0f] p-6 space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">3D Knowledge Graph</h2>
      <p className="text-sm text-zinc-400">
        The interactive 3D visualization is desktop-optimized — open this page on a larger screen
        to explore the full graph.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link
          href="/"
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          Browse library
        </Link>
        <Link
          href="/wiki"
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          Open wiki
        </Link>
      </div>
    </div>
  );
}

export function GraphPageClient() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [nodeMetadata, setNodeMetadata] = useState<Map<string, NodeMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [totalRepos, setTotalRepos] = useState(0);
  const [totalGraphEdges, setTotalGraphEdges] = useState(0);
  const [limit, setLimit] = useState(10000);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MOBILE_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial viewport match after SSR hydration
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setStatusMessage(null);

    const controller = new AbortController();
    loadGraphDataset({
      apiUrl: CLIENT_API_URL,
      limit,
      neighbours: 5,
      minSimilarity: 0.4,
      signal: controller.signal,
    })
      .then((dataset) => {
        if (cancelled) return;

        setTotalRepos(dataset.totalRepos);
        setTotalGraphEdges(dataset.totalEdges);
        setAllEdges(dataset.edges);
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
  }, [limit, isMobile]);

  const nodeCount = useMemo(
    () => nodeMetadata.size || new Set(allEdges.flatMap((e) => [e.source, e.target])).size,
    [nodeMetadata, allEdges],
  );

  const handleNodeClick = useCallback(
    (id: string) => {
      const name = id.includes('/') ? id.split('/').pop()! : id;
      router.push(`/repo/${name}`);
    },
    [router],
  );

  if (isMobile) {
    return <MobileGraphFallback />;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-zinc-500">
          Interactive knowledge graph of your AI repo library. Scroll to zoom, drag to reposition,
          and click a node for details.
        </p>
        {/* Edge count slider — caps at actual total edges in graph (no hard cap) */}
        {totalGraphEdges > 0 && (
          <div className="flex items-center gap-3 min-w-[220px]">
            <label className="text-xs text-zinc-500 shrink-0">Edges</label>
            <input
              type="range"
              min={500}
              max={totalGraphEdges}
              step={500}
              value={Math.min(limit, totalGraphEdges)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-32 accent-zinc-400"
            />
            <span className="text-xs text-zinc-400 tabular-nums w-16 text-right">
              {Math.min(limit, totalGraphEdges).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && !error && (
        <p className="text-xs text-zinc-600">
          {nodeCount} repos &middot; {allEdges.length.toLocaleString()} edges
          {totalRepos > nodeCount ? ` \u00b7 ${totalRepos.toLocaleString()} in library` : ''}
        </p>
      )}

      {!loading && !error && statusMessage && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {statusMessage}
        </div>
      )}

      {/* Graph */}
      {loading && (
        <div className="flex items-center justify-center h-[600px] rounded-xl border border-zinc-800 bg-[#0a0a0f]">
          <span className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Loading graph...
          </span>
        </div>
      )}

      {error && (
        <GraphFallbackPanel
          title="Knowledge graph unavailable"
          message="We couldn't load the live dataset for the graph right now."
          detail={error}
          height={600}
          actionHref="/"
          actionLabel="Back to library"
        />
      )}

      {!loading && !error && (
        <ErrorBoundary
          fallback={
            <GraphFallbackPanel
              title="Knowledge graph renderer unavailable"
              message="The dataset loaded, but graph rendering failed in this browser session."
              height={600}
              actionHref="/"
              actionLabel="Back to library"
            />
          }
        >
          <KnowledgeGraph
            edges={allEdges}
            nodeMetadata={nodeMetadata}
            height={600}
            onNodeClick={handleNodeClick}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
