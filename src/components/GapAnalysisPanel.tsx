import type { Gap } from '@/types/repo';

const DIMENSION_LABELS: Record<string, string> = {
  skill_area: 'Skill Areas',
  industry: 'Industries',
  use_case: 'Use Cases',
  modality: 'Modalities',
  ai_trend: 'AI Trends',
  deployment_context: 'Deployment Context',
  dependency: 'Dependencies',
  maturity_level: 'Maturity Levels',
};

function gapTitle(gap: Gap): string {
  return gap.name ?? gap.skill ?? gap.category ?? 'Unclear';
}

function repoCount(gap: Gap): number {
  return gap.repo_count ?? gap.repoCount ?? gap.yourRepoCount ?? 0;
}

function gapScore(gap: Gap): string | null {
  const value = gap.gap_score;
  if (typeof value !== 'number') return null;
  return value.toFixed(value >= 10 ? 0 : 1);
}

export function GapAnalysisPanel({
  gaps,
  compact = false,
}: {
  gaps: Gap[];
  compact?: boolean;
}) {
  if (!gaps.length) return null;

  const overall = gaps.slice(0, compact ? 3 : 5);
  const grouped = gaps.reduce<Map<string, Gap[]>>((map, gap) => {
    if (!gap.dimension) return map;
    const key = gap.dimension;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(gap);
    return map;
  }, new Map());

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-zinc-400 mb-1.5">Portfolio Gaps</p>
        <div className="space-y-2">
          {overall.map((gap, index) => (
            <div
              key={`${gap.dimension ?? 'overall'}:${gapTitle(gap)}:${index}`}
              className="rounded-lg border border-zinc-800 p-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-zinc-300">{gapTitle(gap)}</p>
                <span className="text-xs text-zinc-500">{repoCount(gap)} repos</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{gap.description || gap.why || 'Gap surfaced by current portfolio coverage.'}</p>
            </div>
          ))}
        </div>
      </div>

      {grouped.size > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-400 mb-1.5">By Taxonomy Dimension</p>
          {[...grouped.entries()].map(([dimension, items]) => (
            <div key={dimension} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {DIMENSION_LABELS[dimension] ?? dimension.replaceAll('_', ' ')}
              </p>
              <div className="mt-2 space-y-2">
                {items.slice(0, compact ? 4 : 8).map((gap, index) => (
                  <div
                    key={`${dimension}:${gapTitle(gap)}:${index}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-zinc-200">{gapTitle(gap)}</p>
                      <p className="text-xs text-zinc-500">{repoCount(gap)} repos</p>
                    </div>
                    {gapScore(gap) ? (
                      <span className="shrink-0 rounded-full border border-amber-700/30 bg-amber-900/20 px-2 py-0.5 text-[11px] text-amber-300">
                        Gap {gapScore(gap)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
