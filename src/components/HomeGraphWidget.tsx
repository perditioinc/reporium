'use client';

/**
 * KAN-124: Stable knowledge graph widget for the home page.
 * Fetches edges from the API and renders a lightweight canvas graph
 * that stays visible even when WebGL is flaky on the client.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GraphEdge, NodeMeta } from '@/components/KnowledgeGraph3D';
import { loadGraphDataset } from '@/lib/graphData';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GraphFallbackPanel } from '@/components/GraphFallbackPanel';
import { useIsMobile } from '@/lib/useIsMobile';

// Dynamic import — Three.js doesn't work with SSR/static export
const KnowledgeGraph = dynamic(
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
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [nodeMetadata, setNodeMetadata] = useState<Map<string, NodeMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEdges, setTotalEdges] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Defer graph fetch until the widget scrolls into view — prevents loading
  // the graph (and its fallback library data) on pages where the user never
  // scrolls below the fold (saves up to ~27 MB on mobile).
  // KAN-153: also short-circuit on mobile so the IntersectionObserver never
  // attaches to the (mobile) link card.
  useEffect(() => {
    if (isMobile) return;
    const el = containerRef.current;
    if (!el) { setIsVisible(true); return; }
    if (!('IntersectionObserver' in window)) { setIsVisible(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile]);

  useEffect(() => {
    // KAN-153: skip the 10k-edge fetch entirely on mobile.
    if (isMobile || !isVisible) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setStatusMessage(null);

    loadGraphDataset({
      apiUrl: API_URL,
      limit: 10000,
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
  }, [isVisible, isMobile]);

  const nodeCount = useMemo(
    () => nodeMetadata.size || new Set(edges.flatMap((e) => [e.source, e.target])).size,
    [nodeMetadata, edges],
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

  // KAN-153 (KAN-121 design): on mobile, replace the heavy 3D widget with a
  // static link card. Skips the 10k-edge fetch and the Three.js + d3-force-3d
  // chunks entirely. SSR renders the desktop tree (isMobile=false initial),
  // hydration corrects post-mount; the placeholder height matches the
  // desktop widget's 420px so layout settles without a perceptible jump.
  if (isMobile) {
    return (
      <Link
        href="/graph"
        data-testid="home-graph-mobile-cta"
        className="flex h-[420px] flex-col justify-center rounded-xl border border-zinc-800 bg-[#0a0a0f] p-6 text-center transition-colors hover:border-cyan-500/40 hover:bg-zinc-900/40"
      >
        <h2 className="text-base font-semibold text-zinc-200">Knowledge Graph</h2>
        <p className="mx-auto mt-2 max-w-xs text-xs text-zinc-500">
          The interactive 3D graph is desktop-optimized. Open the full graph to explore every repo
          and its connections.
        </p>
        <span className="mx-auto mt-4 inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-100">
          View graph <span aria-hidden>→</span>
        </span>
      </Link>
    );
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-zinc-800 bg-[#0a0a0f] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Knowledge Graph</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loading
              ? 'Loading graph...'
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
            Loading graph...
          </span>
        </div>
      ) : error ? (
        <GraphFallbackPanel
          title="Knowledge graph temporarily unavailable"
          message="The homepage preview could not load, but the graph route is still available."
          detail={error}
          compact
          height={420}
        />
      ) : (
        <ErrorBoundary
          fallback={
            <GraphFallbackPanel
              title="Knowledge graph preview unavailable"
              message="Graph rendering failed in this browser session. You can still open the dedicated graph page."
              compact
              height={420}
            />
          }
        >
          <KnowledgeGraph
            edges={edges}
            nodeMetadata={nodeMetadata}
            height={420}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedRepoName}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
