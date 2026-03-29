'use client';

/**
 * /graph — Knowledge graph edge explorer.
 * KAN-83: Knowledge graph visualization
 *
 * Ships as a table of edges with search/filter. Interactive d3 force
 * graph planned as follow-up (filed as GitHub issue).
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_REPORIUM_API_URL ?? '';

interface GraphEdge {
  edgeType: string;
  weight: number | null;
  evidence: string | null;
  source: { name: string; description: string | null; category: string | null };
  target: { name: string; description: string | null; category: string | null };
}

interface GraphData {
  total: number;
  edgeTypes: string[];
  edges: GraphEdge[];
}

const EDGE_TYPE_COLORS: Record<string, string> = {
  'ALTERNATIVE_TO':  'text-amber-400 bg-amber-950/30 border-amber-800/50',
  'COMPATIBLE_WITH': 'text-emerald-400 bg-emerald-950/30 border-emerald-800/50',
  'DEPENDS_ON':      'text-blue-400 bg-blue-950/30 border-blue-800/50',
  'SIMILAR_TO':      'text-purple-400 bg-purple-950/30 border-purple-800/50',
  'EXTENDS':         'text-cyan-400 bg-cyan-950/30 border-cyan-800/50',
};

const CATEGORY_ICONS: Record<string, string> = {
  'agents': '🤖', 'rag-retrieval': '🔍', 'llm-serving': '⚡',
  'fine-tuning': '🎯', 'evaluation': '📊', 'orchestration': '🔀',
  'vector-databases': '🗄️', 'observability': '👁️', 'security-safety': '🔒',
  'code-generation': '💻', 'data-processing': '⚙️', 'computer-vision': '👁',
  'nlp-text': '📝', 'speech-audio': '🎙️', 'generative-media': '🎨',
  'infrastructure': '🏗️',
};

function EdgeBadge({ type }: { type: string }) {
  const cls = EDGE_TYPE_COLORS[type] ?? 'text-zinc-400 bg-zinc-800/50 border-zinc-700';
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono ${cls}`}>
      {type}
    </span>
  );
}

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/graph/edges?limit=2000`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let edges = data.edges;
    if (filterType) edges = edges.filter(e => e.edgeType === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      edges = edges.filter(e =>
        e.source.name.toLowerCase().includes(q) ||
        e.target.name.toLowerCase().includes(q) ||
        (e.evidence ?? '').toLowerCase().includes(q)
      );
    }
    return edges;
  }, [data, search, filterType]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <div className="border-b border-zinc-800 px-4 sm:px-6 py-3 flex items-center gap-4 flex-wrap">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Reporium
        </Link>
        <h1 className="text-lg font-bold text-zinc-100">Knowledge Graph</h1>
        {data && (
          <span className="text-xs text-zinc-600">
            {data.total.toLocaleString()} edges
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-600 hidden sm:inline">
          Interactive force graph — follow-up planned
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-zinc-500">Loading knowledge graph...</div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
            Failed to load graph data: {error}
            <p className="mt-1 text-xs text-red-500">
              The /graph/edges API endpoint may need to be deployed.
            </p>
          </div>
        )}

        {data && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Search repos or evidence..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
              />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none"
              >
                <option value="">All edge types</option>
                {data.edgeTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-xs text-zinc-500 shrink-0">
                {filtered.length.toLocaleString()} edges
              </span>
            </div>

            {/* Edge type legend */}
            <div className="flex flex-wrap gap-2">
              {data.edgeTypes.map(t => <EdgeBadge key={t} type={t} />)}
            </div>

            {/* Edges table */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      <th className="px-4 py-2 text-left text-xs text-zinc-500 font-medium w-1/3">Source</th>
                      <th className="px-4 py-2 text-center text-xs text-zinc-500 font-medium w-40">Relationship</th>
                      <th className="px-4 py-2 text-left text-xs text-zinc-500 font-medium w-1/3">Target</th>
                      <th className="px-4 py-2 text-left text-xs text-zinc-500 font-medium">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((edge, i) => (
                      <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            {edge.source.category && (
                              <span className="text-sm">{CATEGORY_ICONS[edge.source.category] ?? '📦'}</span>
                            )}
                            <Link
                              href={`/repo/${edge.source.name}`}
                              className="text-zinc-200 hover:text-blue-400 transition-colors font-medium truncate max-w-[180px]"
                            >
                              {edge.source.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <EdgeBadge type={edge.edgeType} />
                          {edge.weight !== null && (
                            <div className="text-xs text-zinc-600 mt-0.5">{edge.weight.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            {edge.target.category && (
                              <span className="text-sm">{CATEGORY_ICONS[edge.target.category] ?? '📦'}</span>
                            )}
                            <Link
                              href={`/repo/${edge.target.name}`}
                              className="text-zinc-200 hover:text-blue-400 transition-colors font-medium truncate max-w-[180px]"
                            >
                              {edge.target.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-xs text-zinc-500">{edge.evidence ?? '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 200 && (
                <div className="px-4 py-2 text-xs text-zinc-500 border-t border-zinc-800 bg-zinc-900/30">
                  Showing first 200 of {filtered.length.toLocaleString()} edges. Use the search to narrow results.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
