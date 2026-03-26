'use client';

import { useState, useMemo } from 'react';
import type { CrossDimensionAnalytics, CrossDimensionCell, EnrichedRepo } from '@/types/repo';

interface CrossDimensionWidgetProps {
  analytics: CrossDimensionAnalytics | null;
  repos?: EnrichedRepo[];
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

/* ── Quadrant bar chart ── */
function QuadrantChart({ title, subtitle, data, color, maxVal }: {
  title: string;
  subtitle: string;
  data: { name: string; count: number }[];
  color: 'fuchsia' | 'sky' | 'amber' | 'emerald';
  maxVal: number;
}) {
  const colors = {
    fuchsia: { bar: 'bg-fuchsia-500', barBg: 'bg-fuchsia-500/10', text: 'text-fuchsia-300', badge: 'border-fuchsia-700/40 bg-fuchsia-900/30 text-fuchsia-300', label: 'text-fuchsia-400' },
    sky:     { bar: 'bg-sky-400',     barBg: 'bg-sky-400/10',     text: 'text-sky-300',     badge: 'border-sky-700/40 bg-sky-900/30 text-sky-300',         label: 'text-sky-400' },
    amber:   { bar: 'bg-amber-400',   barBg: 'bg-amber-400/10',   text: 'text-amber-300',   badge: 'border-amber-700/40 bg-amber-900/30 text-amber-300',   label: 'text-amber-400' },
    emerald: { bar: 'bg-emerald-400', barBg: 'bg-emerald-400/10', text: 'text-emerald-300', badge: 'border-emerald-700/40 bg-emerald-900/30 text-emerald-300', label: 'text-emerald-400' },
  };
  const c = colors[color];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${c.label}`}>{title}</h3>
          <p className="text-[10px] text-zinc-600 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] text-zinc-600">{data.length} values</span>
      </div>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 group">
            <span className="text-[10px] text-zinc-600 w-3 text-right shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className={`text-[11px] truncate ${c.text} group-hover:text-white transition-colors`}>
                  {d.name}
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">{d.count}</span>
              </div>
              <div className={`h-1.5 rounded-full ${c.barBg}`}>
                <div
                  className={`h-1.5 rounded-full ${c.bar} transition-all duration-300`}
                  style={{ width: `${Math.max((d.count / maxVal) * 100, 4)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ViewMode = 'quadrant' | 'heatmap' | 'grid';

export function CrossDimensionWidget({ analytics, repos }: CrossDimensionWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('quadrant');
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string } | null>(null);
  const [gridPage, setGridPage] = useState(1);
  const GRID_PAGE_SIZE = 12;
  const TOP_N = 10;

  // Build dimension breakdowns from repo taxonomy
  const quadrants = useMemo(() => {
    if (!repos || repos.length === 0) return null;

    const dims: Record<string, Map<string, number>> = {
      industry: new Map(),
      ai_trend: new Map(),
      use_case: new Map(),
      modality: new Map(),
    };

    for (const repo of repos) {
      for (const t of repo.taxonomy ?? []) {
        const map = dims[t.dimension];
        if (map) {
          map.set(t.value, (map.get(t.value) ?? 0) + 1);
        }
      }
    }

    const toSorted = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_N);

    return {
      industry: toSorted(dims.industry),
      ai_trend: toSorted(dims.ai_trend),
      use_case: toSorted(dims.use_case),
      modality: toSorted(dims.modality),
    };
  }, [repos]);

  // Heatmap data from cross-dimension analytics
  const { rows, cols, matrix, maxCount, peak } = useMemo(() => {
    if (!analytics || analytics.pairs.length === 0)
      return { rows: [] as string[], cols: [] as string[], matrix: new Map<string, number>(), maxCount: 1, peak: 1 };

    const d1Map = new Map<string, number>();
    const d2Map = new Map<string, number>();
    const mtx = new Map<string, number>();

    for (const p of analytics.pairs) {
      d1Map.set(p.dim1_value, (d1Map.get(p.dim1_value) ?? 0) + p.repo_count);
      d2Map.set(p.dim2_value, (d2Map.get(p.dim2_value) ?? 0) + p.repo_count);
      mtx.set(`${p.dim1_value}|||${p.dim2_value}`, p.repo_count);
    }

    const r = [...d1Map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const c = [...d2Map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const mx = Math.max(...analytics.pairs.map(p => p.repo_count), 1);
    const pk = Math.max(...d1Map.values(), ...d2Map.values(), 1);

    return { rows: r, cols: c, matrix: mtx, maxCount: mx, peak: pk };
  }, [analytics]);

  if (!analytics && !quadrants) return null;

  const hasPairs = analytics && analytics.pairs.length > 0;

  // Heatmap helpers
  function cellColor(count: number): string {
    const t = count / maxCount;
    if (t === 0) return 'rgba(39, 39, 42, 0.3)';
    if (t < 0.15) return 'rgba(168, 85, 247, 0.15)';
    if (t < 0.3) return 'rgba(168, 85, 247, 0.3)';
    if (t < 0.5) return 'rgba(217, 70, 239, 0.4)';
    if (t < 0.7) return 'rgba(217, 70, 239, 0.6)';
    if (t < 0.85) return 'rgba(56, 189, 248, 0.5)';
    return 'rgba(56, 189, 248, 0.75)';
  }

  function cellTextColor(count: number): string {
    const t = count / maxCount;
    if (t === 0) return '#3f3f46';
    if (t < 0.3) return '#a78bfa';
    if (t < 0.6) return '#e879f9';
    return '#fff';
  }

  const hoveredPair = hoveredCell
    ? analytics?.pairs.find(
        (p: CrossDimensionCell) => p.dim1_value === hoveredCell.row && p.dim2_value === hoveredCell.col
      )
    : null;

  return (
    <section className="rounded-2xl border border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-zinc-950 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Cross-Dimension Analytics</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            Taxonomy Intelligence
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {(['quadrant', 'heatmap', 'grid'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
                viewMode === mode ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mode === 'quadrant' ? 'Overview' : mode === 'heatmap' ? 'Heatmap' : 'Grid'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'quadrant' && quadrants ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <QuadrantChart
            title="Industry"
            subtitle="Who uses it"
            data={quadrants.industry}
            color="fuchsia"
            maxVal={quadrants.industry[0]?.count ?? 1}
          />
          <QuadrantChart
            title="AI Trend"
            subtitle="What tech wave"
            data={quadrants.ai_trend}
            color="sky"
            maxVal={quadrants.ai_trend[0]?.count ?? 1}
          />
          <QuadrantChart
            title="Use Case"
            subtitle="What problem it solves"
            data={quadrants.use_case}
            color="amber"
            maxVal={quadrants.use_case[0]?.count ?? 1}
          />
          <QuadrantChart
            title="Modality"
            subtitle="What data type"
            data={quadrants.modality}
            color="emerald"
            maxVal={quadrants.modality[0]?.count ?? 1}
          />
        </div>
      ) : viewMode === 'heatmap' && hasPairs ? (
        <div className="mt-4 relative">
          {/* Legend + axis labels */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Overlap intensity</span>
              <div className="flex items-center gap-0.5">
                {[0.05, 0.2, 0.4, 0.6, 0.8, 1.0].map(t => (
                  <div key={t} className="h-3 w-5 rounded-sm" style={{ background: cellColor(t * maxCount) }} />
                ))}
              </div>
              <span className="text-[10px] text-zinc-600">0 → {maxCount}</span>
            </div>
            <span className="text-[10px] text-zinc-600">{rows.length} × {cols.length} · {analytics!.pairs.length} pairs</span>
          </div>

          {/* Axis key */}
          <div className="flex items-center gap-4 mb-3 px-1">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="text-fuchsia-400 font-semibold">Y axis</span>
              <span className="text-zinc-500">= {label(analytics!.dim1)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="text-sky-400 font-semibold">X axis</span>
              <span className="text-zinc-500">= {label(analytics!.dim2)}</span>
            </span>
          </div>

          <div className="overflow-x-auto -mx-2 px-2">
            <table className="border-collapse" style={{ marginLeft: 0 }}>
              {/* Column headers */}
              <thead>
                <tr>
                  <th style={{ width: 150, minWidth: 150 }} />
                  {cols.map((col, ci) => {
                    const isHighlighted = hoveredCell?.col === col;
                    return (
                      <th
                        key={col}
                        className="p-0 align-bottom"
                        style={{ width: 52, minWidth: 52 }}
                      >
                        <div
                          className="flex flex-col items-center gap-0.5 pb-1"
                          style={{ height: 120 }}
                        >
                          <span
                            className="text-[10px] leading-tight select-none whitespace-nowrap"
                            style={{
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              color: isHighlighted ? '#38bdf8' : '#71717a',
                              fontWeight: isHighlighted ? 700 : 400,
                              maxHeight: 110,
                              overflow: 'hidden',
                            }}
                          >
                            {col}
                          </span>
                          {/* Column index for tracing */}
                          <span className="text-[8px] text-zinc-700 tabular-nums">{ci + 1}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const isRowHighlighted = hoveredCell?.row === row;
                  return (
                    <tr key={row}>
                      {/* Row label */}
                      <td className="p-0 pr-2 text-right select-none" style={{ width: 150, minWidth: 150 }}>
                        <span
                          className="text-[11px] leading-tight"
                          style={{
                            color: isRowHighlighted ? '#e879f9' : '#a1a1aa',
                            fontWeight: isRowHighlighted ? 600 : 400,
                          }}
                        >
                          {row}
                        </span>
                      </td>
                      {/* Cells */}
                      {cols.map(col => {
                        const count = matrix.get(`${row}|||${col}`) ?? 0;
                        const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
                        const isRowOrCol = hoveredCell?.row === row || hoveredCell?.col === col;
                        return (
                          <td key={`${row}:${col}`} className="p-0">
                            <div
                              className="flex items-center justify-center cursor-pointer transition-all duration-150"
                              style={{
                                width: 50, height: 32,
                                background: cellColor(count),
                                border: isHovered
                                  ? '2px solid #fff'
                                  : isRowOrCol && hoveredCell
                                    ? '1px solid rgba(168,85,247,0.3)'
                                    : '1px solid rgba(39,39,42,0.3)',
                                borderRadius: 4,
                                margin: 1,
                                transform: isHovered ? 'scale(1.2)' : undefined,
                                zIndex: isHovered ? 10 : undefined,
                                position: 'relative',
                                opacity: hoveredCell && !isRowOrCol ? 0.4 : 1,
                              }}
                              onMouseEnter={() => setHoveredCell({ row, col })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {count > 0 && (
                                <span className="text-[10px] font-semibold tabular-nums" style={{ color: cellTextColor(count) }}>
                                  {count}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Hover tooltip */}
          {hoveredCell && (
            <div className="mt-3 rounded-lg border border-fuchsia-800/40 bg-zinc-900/95 px-4 py-2.5 shadow-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-fuchsia-500" />
                <span className="text-sm font-semibold text-fuchsia-300">{hoveredCell.row}</span>
                <span className="text-zinc-600 text-sm">×</span>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
                <span className="text-sm font-semibold text-sky-300">{hoveredCell.col}</span>
                {hoveredPair ? (
                  <span className="ml-auto rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-2.5 py-0.5 text-sm font-semibold text-fuchsia-300">
                    {hoveredPair.repo_count} repos
                  </span>
                ) : (
                  <span className="ml-auto text-xs text-zinc-600">No overlap</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'heatmap' && !hasPairs ? (
        <p className="mt-4 text-sm text-zinc-500">Heatmap requires cross-dimension data from the API.</p>
      ) : (
        /* Grid with pagination + ranking */
        (() => {
          const pairs = analytics?.pairs ?? [];
          const totalPages = Math.max(1, Math.ceil(pairs.length / GRID_PAGE_SIZE));
          const start = (gridPage - 1) * GRID_PAGE_SIZE;
          const pageItems = pairs.slice(start, start + GRID_PAGE_SIZE);
          if (pairs.length === 0) return <p className="mt-4 text-sm text-zinc-500">No cross-dimension pairings available.</p>;
          return (
            <div className="mt-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pageItems.map((pair, idx) => {
                  const rank = start + idx + 1;
                  return (
                    <div key={`${pair.dim1_value}:${pair.dim2_value}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-lg font-bold text-zinc-700 leading-none mt-0.5">#{rank}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-200">{pair.dim1_value}</p>
                            <p className="text-xs text-zinc-500">{pair.dim2_value}</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-300 shrink-0">
                          {pair.repo_count}
                        </span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-400"
                          style={{ width: `${Math.max((pair.repo_count / peak) * 100, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
                  <span className="text-xs text-zinc-500">
                    {start + 1}–{Math.min(start + GRID_PAGE_SIZE, pairs.length)} of {pairs.length} pairings
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setGridPage(p => Math.max(1, p - 1))} disabled={gridPage === 1}
                      className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors">← Prev</button>
                    {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setGridPage(p)}
                        className={`rounded px-2 py-1 text-xs transition-colors ${p === gridPage ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}>{p}</button>
                    ))}
                    {totalPages > 8 && <span className="text-xs text-zinc-600">…</span>}
                    <button onClick={() => setGridPage(p => Math.min(totalPages, p + 1))} disabled={gridPage === totalPages}
                      className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors">Next →</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}
    </section>
  );
}
