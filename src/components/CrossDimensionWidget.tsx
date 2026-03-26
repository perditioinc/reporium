'use client';

import { useState, useMemo } from 'react';
import type { CrossDimensionAnalytics, CrossDimensionCell } from '@/types/repo';

interface CrossDimensionWidgetProps {
  analytics: CrossDimensionAnalytics | null;
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

type ViewMode = 'radar' | 'grid';

export function CrossDimensionWidget({ analytics }: CrossDimensionWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('radar');
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  // Aggregate repo counts per dimension value
  const { dim1Data, dim2Data, maxCount } = useMemo(() => {
    if (!analytics) return { dim1Data: [] as { name: string; count: number }[], dim2Data: [] as { name: string; count: number }[], maxCount: 1 };

    const d1Map = new Map<string, number>();
    const d2Map = new Map<string, number>();
    for (const p of analytics.pairs) {
      d1Map.set(p.dim1_value, (d1Map.get(p.dim1_value) ?? 0) + p.repo_count);
      d2Map.set(p.dim2_value, (d2Map.get(p.dim2_value) ?? 0) + p.repo_count);
    }

    const d1 = [...d1Map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const d2 = [...d2Map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const mx = Math.max(...d1.map(d => d.count), ...d2.map(d => d.count), 1);

    return { dim1Data: d1, dim2Data: d2, maxCount: mx };
  }, [analytics]);

  // Combine into unified axis — industries first half, AI trends second half
  const allAxes = useMemo(() => {
    return [...dim1Data.map(d => ({ ...d, dim: 'dim1' as const })), ...dim2Data.map(d => ({ ...d, dim: 'dim2' as const }))];
  }, [dim1Data, dim2Data]);

  const peak = maxCount;

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

  // Radar geometry
  const SIZE = 560;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const OUTER_R = SIZE * 0.32;
  const LABEL_R = SIZE * 0.43;
  const totalAxes = allAxes.length;
  const rings = [0.25, 0.5, 0.75, 1.0];

  function polar(index: number, total: number, radius: number) {
    const angle = (2 * Math.PI * index) / total - Math.PI / 2;
    return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle), angle };
  }

  // Build polygon points for a specific dimension
  function buildPolygon(data: { name: string; count: number }[], dimAxes: typeof allAxes) {
    const dataMap = new Map(data.map(d => [d.name, d.count]));
    return dimAxes.map((axis, i) => {
      const count = dataMap.get(axis.name) ?? 0;
      const r = OUTER_R * (count / peak);
      const p = polar(i, totalAxes, r);
      return `${p.x},${p.y}`;
    }).join(' ');
  }

  const dim1Polygon = buildPolygon(dim1Data, allAxes);
  const dim2Polygon = buildPolygon(dim2Data, allAxes);

  // Tooltip data for hovered axis
  const hoveredInfo = hoveredAxis ? (() => {
    const axis = allAxes.find(a => a.name === hoveredAxis);
    if (!axis) return null;
    const connections = axis.dim === 'dim1'
      ? analytics.pairs.filter((p: CrossDimensionCell) => p.dim1_value === hoveredAxis).sort((a: CrossDimensionCell, b: CrossDimensionCell) => b.repo_count - a.repo_count)
      : analytics.pairs.filter((p: CrossDimensionCell) => p.dim2_value === hoveredAxis).sort((a: CrossDimensionCell, b: CrossDimensionCell) => b.repo_count - a.repo_count);
    return { axis, connections };
  })() : null;

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
            onClick={() => setViewMode('radar')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'radar' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Radar
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === 'grid' ? 'bg-fuchsia-900/40 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Grid
          </button>
        </div>
      </div>

      {viewMode === 'radar' ? (
        <div className="mt-4 relative">
          {/* Chart key / legend */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded-sm bg-fuchsia-500/30 border border-fuchsia-500/60" />
                <span className="text-xs font-medium text-fuchsia-300">{label(analytics.dim1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded-sm bg-sky-400/30 border border-sky-400/60" />
                <span className="text-xs font-medium text-sky-300">{label(analytics.dim2)}</span>
              </div>
            </div>
            <span className="text-[10px] text-zinc-600">Repo count shown by distance from center — hover labels for breakdown</span>
          </div>

          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-auto" style={{ maxHeight: 560 }}>
            {/* Grid rings */}
            {rings.map(r => (
              <circle
                key={r}
                cx={CX}
                cy={CY}
                r={OUTER_R * r}
                fill="none"
                stroke="#3f3f46"
                strokeWidth={r === 1 ? 1 : 0.5}
                strokeDasharray={r < 1 ? '3 5' : undefined}
              />
            ))}

            {/* Ring scale labels */}
            {rings.map(r => (
              <text
                key={`ring-label-${r}`}
                x={CX + 4}
                y={CY - OUTER_R * r - 2}
                fill="#52525b"
                fontSize={9}
                fontWeight={500}
                className="select-none pointer-events-none"
              >
                {Math.round(peak * r)}
              </text>
            ))}

            {/* Spokes */}
            {allAxes.map((_, i) => {
              const p = polar(i, totalAxes, OUTER_R);
              return (
                <line key={`spoke-${i}`} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#3f3f46" strokeWidth={0.5} />
              );
            })}

            {/* Dim1 polygon (industries) — fuchsia fill */}
            <polygon
              points={dim1Polygon}
              fill="#d946ef"
              fillOpacity={0.15}
              stroke="#d946ef"
              strokeWidth={2}
              strokeOpacity={0.8}
              strokeLinejoin="round"
              className="transition-all duration-300"
            />

            {/* Dim2 polygon (AI trends) — sky fill */}
            <polygon
              points={dim2Polygon}
              fill="#38bdf8"
              fillOpacity={0.15}
              stroke="#38bdf8"
              strokeWidth={2}
              strokeOpacity={0.8}
              strokeLinejoin="round"
              className="transition-all duration-300"
            />

            {/* Data point dots */}
            {allAxes.map((axis, i) => {
              const r = OUTER_R * (axis.count / peak);
              const p = polar(i, totalAxes, r);
              const isDim1 = axis.dim === 'dim1';
              const isHovered = hoveredAxis === axis.name;
              return (
                <g key={`dot-${axis.name}`}>
                  {isHovered && (
                    <circle cx={p.x} cy={p.y} r={8} fill={isDim1 ? '#d946ef' : '#38bdf8'} opacity={0.2} />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 5 : 3.5}
                    fill={isDim1 ? '#d946ef' : '#38bdf8'}
                    className="transition-all duration-200"
                  />
                  {isHovered && (
                    <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={700}>{axis.count}</text>
                  )}
                </g>
              );
            })}

            {/* Axis labels around the circle */}
            {allAxes.map((axis, i) => {
              const lp = polar(i, totalAxes, LABEL_R);
              const angleDeg = (i / totalAxes) * 360 - 90;
              const flipText = angleDeg > 90 && angleDeg < 270;
              const textAnchor = flipText ? 'end' : 'start';
              const textAngle = flipText ? angleDeg + 180 : angleDeg;
              const isDim1 = axis.dim === 'dim1';
              const isHovered = hoveredAxis === axis.name;
              const dimmed = hoveredAxis && !isHovered;

              return (
                <g
                  key={`label-${axis.name}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredAxis(axis.name)}
                  onMouseLeave={() => setHoveredAxis(null)}
                >
                  <circle cx={lp.x} cy={lp.y} r={14} fill="transparent" />
                  <text
                    x={lp.x}
                    y={lp.y}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    transform={`rotate(${textAngle}, ${lp.x}, ${lp.y})`}
                    fill={dimmed ? '#3f3f46' : isHovered ? '#ffffff' : isDim1 ? '#e9a0f0' : '#93c5fd'}
                    fontSize={isHovered ? 11 : 10}
                    fontWeight={isHovered ? 700 : 500}
                    className="transition-all duration-200 select-none"
                  >
                    {axis.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip panel */}
          {hoveredInfo && (
            <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-fuchsia-800/40 bg-zinc-900/95 px-3 py-2 shadow-xl z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${hoveredInfo.axis.dim === 'dim1' ? 'bg-fuchsia-500' : 'bg-sky-400'}`} />
                <span className="text-sm font-semibold text-zinc-100">{hoveredInfo.axis.name}</span>
                <span className="text-xs text-zinc-500">{hoveredInfo.axis.count} repos</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {hoveredInfo.connections.slice(0, 6).map((c: CrossDimensionCell) => (
                  <span key={`${c.dim1_value}:${c.dim2_value}`} className="text-xs">
                    <span className={hoveredInfo.axis.dim === 'dim1' ? 'text-sky-300' : 'text-fuchsia-300'}>
                      {hoveredInfo.axis.dim === 'dim1' ? c.dim2_value : c.dim1_value}
                    </span>
                    <span className="text-zinc-500 ml-1">{c.repo_count}</span>
                  </span>
                ))}
                {hoveredInfo.connections.length > 6 && (
                  <span className="text-xs text-zinc-600">+{hoveredInfo.connections.length - 6} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grid fallback */
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {analytics.pairs.map((pair) => (
            <div key={`${pair.dim1_value}:${pair.dim2_value}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">{pair.dim1_value}</p>
                  <p className="truncate text-xs text-zinc-500">{pair.dim2_value}</p>
                </div>
                <span className="rounded-full border border-fuchsia-700/40 bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-300">
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
          ))}
        </div>
      )}
    </section>
  );
}
