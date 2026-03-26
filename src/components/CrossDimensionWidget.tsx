'use client';

import { useState, useMemo } from 'react';
import type { CrossDimensionAnalytics, CrossDimensionCell } from '@/types/repo';

interface CrossDimensionWidgetProps {
  analytics: CrossDimensionAnalytics | null;
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

type ViewMode = 'heatmap' | 'grid';

export function CrossDimensionWidget({ analytics }: CrossDimensionWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string } | null>(null);
  const [gridPage, setGridPage] = useState(1);
  const GRID_PAGE_SIZE = 12;

  // Build heatmap matrix: rows = industries (dim1), cols = AI trends (dim2)
  const { rows, cols, matrix, maxCount, peak } = useMemo(() => {
    if (!analytics || analytics.pairs.length === 0)
      return { rows: [] as string[], cols: [] as string[], matrix: new Map<string, number>(), maxCount: 1, peak: 1 };

    // Get unique values sorted by total repo count
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

  if (!analytics) return null;

  if (analytics.pairs.length === 0) {
    return (
      <section className="rounded-2xl border border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-zinc-950 p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Cross-Dimension Analytics</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-100">
              {label(analytics.dim1)} × {label(analytics.dim2)}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Taxonomy data is being processed — cross-dimension pairings will appear after the next ingestion run.
        </p>
      </section>
    );
  }

  // Heatmap color: fuchsia-to-sky gradient based on intensity
  function cellColor(count: number): string {
    const t = count / maxCount; // 0 to 1
    if (t === 0) return 'rgba(39, 39, 42, 0.3)'; // zinc-800 faded
    if (t < 0.15) return 'rgba(168, 85, 247, 0.15)'; // purple very faint
    if (t < 0.3) return 'rgba(168, 85, 247, 0.3)';
    if (t < 0.5) return 'rgba(217, 70, 239, 0.4)'; // fuchsia
    if (t < 0.7) return 'rgba(217, 70, 239, 0.6)';
    if (t < 0.85) return 'rgba(56, 189, 248, 0.5)'; // sky
    return 'rgba(56, 189, 248, 0.75)'; // sky bright
  }

  function cellTextColor(count: number): string {
    const t = count / maxCount;
    if (t === 0) return '#3f3f46';
    if (t < 0.3) return '#a78bfa';
    if (t < 0.6) return '#e879f9';
    return '#fff';
  }

  // Hovered cell info
  const hoveredPair = hoveredCell
    ? analytics.pairs.find(
        (p: CrossDimensionCell) => p.dim1_value === hoveredCell.row && p.dim2_value === hoveredCell.col
      )
    : null;

  return (
    <section className="rounded-2xl border border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/40 via-zinc-950 to-zinc-950 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Cross-Dimension Analytics</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">
            {label(analytics.dim1)} × {label(analytics.dim2)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('heatmap')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'heatmap' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Heatmap
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'grid' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Grid
          </button>
        </div>
      </div>

      {viewMode === 'heatmap' ? (
        <div className="mt-4 relative">
          {/* Legend */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Repo overlap intensity</span>
              <div className="flex items-center gap-0.5">
                {[0.05, 0.2, 0.4, 0.6, 0.8, 1.0].map(t => (
                  <div
                    key={t}
                    className="h-3 w-5 rounded-sm"
                    style={{ background: cellColor(t * maxCount) }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-zinc-600">0 → {maxCount}</span>
            </div>
            <span className="text-[10px] text-zinc-600">{rows.length} × {cols.length} · {analytics.pairs.length} pairs</span>
          </div>

          {/* Heatmap grid */}
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="inline-block min-w-full">
              {/* Column headers (AI trends) */}
              <div className="flex" style={{ paddingLeft: 140 }}>
                {cols.map(col => {
                  const isHighlighted = hoveredCell?.col === col;
                  return (
                    <div
                      key={col}
                      className="flex-shrink-0 flex items-end justify-center pb-1"
                      style={{ width: 44, height: 100 }}
                    >
                      <span
                        className="text-[9px] leading-tight select-none origin-bottom-left whitespace-nowrap"
                        style={{
                          transform: 'rotate(-55deg)',
                          transformOrigin: 'bottom left',
                          color: isHighlighted ? '#38bdf8' : '#71717a',
                          fontWeight: isHighlighted ? 700 : 400,
                        }}
                      >
                        {col}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              {rows.map(row => {
                const isRowHighlighted = hoveredCell?.row === row;
                return (
                  <div key={row} className="flex items-center">
                    {/* Row label (industry) */}
                    <div
                      className="flex-shrink-0 text-right pr-2 select-none"
                      style={{ width: 140 }}
                    >
                      <span
                        className="text-[10px] leading-tight"
                        style={{
                          color: isRowHighlighted ? '#e879f9' : '#a1a1aa',
                          fontWeight: isRowHighlighted ? 700 : 400,
                        }}
                      >
                        {row}
                      </span>
                    </div>

                    {/* Cells */}
                    {cols.map(col => {
                      const count = matrix.get(`${row}|||${col}`) ?? 0;
                      const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
                      return (
                        <div
                          key={`${row}:${col}`}
                          className="flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150"
                          style={{
                            width: 44,
                            height: 28,
                            background: cellColor(count),
                            border: isHovered ? '1.5px solid #fff' : '1px solid rgba(39,39,42,0.4)',
                            borderRadius: 3,
                            margin: 1,
                            transform: isHovered ? 'scale(1.15)' : undefined,
                            zIndex: isHovered ? 10 : undefined,
                            position: 'relative',
                          }}
                          onMouseEnter={() => setHoveredCell({ row, col })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {count > 0 && (
                            <span
                              className="text-[9px] font-medium tabular-nums"
                              style={{ color: cellTextColor(count) }}
                            >
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredCell && (
            <div className="mt-3 rounded-lg border border-fuchsia-800/40 bg-zinc-900/95 px-3 py-2 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-fuchsia-500" />
                <span className="text-sm font-semibold text-zinc-100">{hoveredCell.row}</span>
                <span className="text-zinc-600 text-xs">×</span>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
                <span className="text-sm font-semibold text-zinc-100">{hoveredCell.col}</span>
                {hoveredPair && (
                  <span className="ml-auto rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-300">
                    {hoveredPair.repo_count} repos
                  </span>
                )}
                {!hoveredPair && (
                  <span className="ml-auto text-xs text-zinc-600">No overlap</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grid with pagination + ranking */
        (() => {
          const totalPages = Math.ceil(analytics.pairs.length / GRID_PAGE_SIZE);
          const start = (gridPage - 1) * GRID_PAGE_SIZE;
          const pageItems = analytics.pairs.slice(start, start + GRID_PAGE_SIZE);
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">
                {start + 1}–{Math.min(start + GRID_PAGE_SIZE, analytics.pairs.length)} of {analytics.pairs.length} pairings
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setGridPage(p => Math.max(1, p - 1))}
                  disabled={gridPage === 1}
                  className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setGridPage(p)}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      p === gridPage ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 8 && <span className="text-xs text-zinc-600">…</span>}
                <button
                  onClick={() => setGridPage(p => Math.min(totalPages, p + 1))}
                  disabled={gridPage === totalPages}
                  className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
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
