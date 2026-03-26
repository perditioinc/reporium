'use client';

import { useMemo } from 'react';
import type { EnrichedRepo } from '@/types/repo';

interface LibraryInsightsWidgetProps {
  repos: EnrichedRepo[];
  onTagClick?: (tag: string) => void;
}

const DIMENSION_LABELS: Record<string, string> = {
  ai_trend:            'AI Trend',
  use_case:            'Use Case',
  skill_area:          'Skill Area',
  industry:            'Industry',
  deployment_target:   'Deployment Target',
  modality:            'Modality',
  integration_pattern: 'Integration Pattern',
  lifecycle_stage:     'Lifecycle Stage',
};

/** Colour for skill coverage bar based on repo count */
function coverageColour(count: number): string {
  if (count >= 10) return 'bg-emerald-500';
  if (count >= 5)  return 'bg-amber-500';
  return 'bg-red-500/70';
}

export function LibraryInsightsWidget({ repos, onTagClick }: LibraryInsightsWidgetProps) {
  const insights = useMemo(() => {
    // ── 1. AI Dev Skill coverage ────────────────────────────────────────────
    const skillCounts = new Map<string, number>();
    for (const repo of repos) {
      for (const s of repo.aiDevSkills ?? []) {
        skillCounts.set(s.skill, (skillCounts.get(s.skill) ?? 0) + 1);
      }
    }
    const sortedSkills = [...skillCounts.entries()].sort((a, b) => b[1] - a[1]);
    const maxSkillCount = sortedSkills[0]?.[1] ?? 1;
    const weakSkills = sortedSkills.filter(([, c]) => c < 3).map(([s]) => s);

    // ── 2. Taxonomy themes (top 3 values per dimension, priority dims first) ─
    const dimPriority = ['ai_trend', 'use_case', 'skill_area', 'industry'];
    const taxonomyByDim = new Map<string, Map<string, number>>();
    for (const repo of repos) {
      for (const entry of repo.taxonomy ?? []) {
        if (!entry.value) continue;
        if (!taxonomyByDim.has(entry.dimension)) taxonomyByDim.set(entry.dimension, new Map());
        const m = taxonomyByDim.get(entry.dimension)!;
        m.set(entry.value, (m.get(entry.value) ?? 0) + 1);
      }
    }
    const taxonomyThemes = [...taxonomyByDim.entries()]
      .map(([dim, valMap]) => ({
        dim,
        label: DIMENSION_LABELS[dim] ?? dim.replaceAll('_', ' '),
        values: [...valMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
        totalValues: valMap.size,
      }))
      .filter(d => d.values.length > 0)
      .sort((a, b) => {
        const pa = dimPriority.indexOf(a.dim);
        const pb = dimPriority.indexOf(b.dim);
        return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      })
      .slice(0, 3);

    // ── 3. Fallback: top enriched tags if no taxonomy data ──────────────────
    const tagCounts = new Map<string, number>();
    for (const repo of repos) {
      for (const tag of repo.enrichedTags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);

    // ── 4. Codebase quality signals ─────────────────────────────────────────
    let withTests = 0, withCI = 0, active = 0;
    for (const repo of repos) {
      const q = repo.qualitySignals ?? repo.quality_signals;
      if (q?.has_tests) withTests++;
      if (q?.has_ci)    withCI++;
      if (q?.is_active) active++;
    }

    // ── 5. Enrichment coverage stats ────────────────────────────────────────
    const reposWithSkills   = repos.filter(r => (r.aiDevSkills?.length   ?? 0) > 0).length;
    const reposWithTaxonomy = repos.filter(r => (r.taxonomy?.length      ?? 0) > 0).length;
    const reposWithRichTags = repos.filter(r => (r.enrichedTags?.length  ?? 0) >= 8).length;
    const hasQualityData    = withTests + withCI + active > 0;

    return {
      sortedSkills, maxSkillCount, weakSkills,
      taxonomyThemes, topTags,
      withTests, withCI, active,
      reposWithSkills, reposWithTaxonomy, reposWithRichTags, hasQualityData,
      total: repos.length,
    };
  }, [repos]);

  if (repos.length === 0) return null;

  const hasAnyEnrichment =
    insights.sortedSkills.length > 0 ||
    insights.taxonomyThemes.length > 0 ||
    insights.topTags.length > 0;

  const hasTaxonomy = insights.taxonomyThemes.length > 0;

  return (
    <section className="rounded-2xl border border-indigo-900/40 bg-gradient-to-br from-indigo-950/30 via-zinc-950 to-zinc-950 p-4 md:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Library Insights</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">Enrichment intelligence</h2>
        </div>
        <p className="text-xs text-zinc-500 shrink-0">
          {insights.reposWithSkills.toLocaleString()} repos AI-classified
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">

        {/* ── Enrichment pending placeholder ── */}
        {!hasAnyEnrichment && (
          <div className="xl:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex flex-col justify-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
              AI Dev Skill Coverage &amp; Taxonomy Themes
            </p>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Enrichment is processing — skill coverage bars and taxonomy themes will appear after the next ingestion run completes.
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              {insights.total.toLocaleString()} repos indexed · {insights.reposWithSkills.toLocaleString()} AI-classified so far
            </p>
          </div>
        )}

        {/* ── Skill Coverage ── */}
        {insights.sortedSkills.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
              AI Dev Skill Coverage
            </p>
            <div className="space-y-1.5">
              {insights.sortedSkills.slice(0, 9).map(([skill, count]) => {
                const pct = Math.round((count / insights.maxSkillCount) * 100);
                return (
                  <div key={skill}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <button
                        onClick={() => onTagClick?.(skill)}
                        className="text-zinc-300 hover:text-zinc-100 text-left break-words transition-colors"
                      >
                        {skill}
                      </button>
                      <span className="text-zinc-500 ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-800">
                      <div
                        className={`h-1 rounded-full transition-all ${coverageColour(count)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {insights.weakSkills.length > 0 && (
              <p className="mt-3 text-xs text-red-400/70 border-t border-zinc-800 pt-2 leading-relaxed">
                Thin coverage (&lt;3 repos): {insights.weakSkills.slice(0, 4).join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* ── Taxonomy Themes OR top enriched tags ── */}
        {hasTaxonomy ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
              Taxonomy Themes
            </p>
            <div className="space-y-4">
              {insights.taxonomyThemes.map(({ dim, label, values, totalValues }) => (
                <div key={dim}>
                  <p className="text-xs font-medium text-indigo-400/80 mb-1.5">
                    {label}
                    <span className="ml-1 text-zinc-600">({totalValues} values)</span>
                  </p>
                  <div className="space-y-0.5">
                    {values.map(([value, count]) => (
                      <div key={value} className="flex items-center justify-between text-xs">
                        <button
                          onClick={() => onTagClick?.(value)}
                          className="text-zinc-300 hover:text-zinc-100 text-left break-words transition-colors"
                        >
                          {value}
                        </button>
                        <span className="text-zinc-500 ml-2 shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : insights.topTags.length > 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
              Top AI-Classified Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {insights.topTags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => onTagClick?.(tag)}
                  className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:border-indigo-600/50 hover:text-zinc-100 transition-colors"
                >
                  {tag}
                  <span className="text-zinc-500">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Quality & Enrichment Coverage ── */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
            Codebase Quality Signals
          </p>
          {insights.hasQualityData ? (
            <div className="space-y-2">
              {([
                { label: 'Has test suite',   count: insights.withTests, icon: '🧪' },
                { label: 'CI configured',    count: insights.withCI,    icon: '⚙️' },
                { label: 'Active (30 days)', count: insights.active,    icon: '🔥' },
              ] as const).map(({ label, count, icon }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-zinc-400">{icon} {label}</span>
                    <span className="text-zinc-500">
                      {count} <span className="text-zinc-700">/ {insights.total}</span>
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800">
                    <div
                      className="h-1 rounded-full bg-indigo-500/60"
                      style={{ width: `${Math.round((count / insights.total) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 leading-relaxed">
              Quality signals pending — will populate after next ingestion run.
            </p>
          )}

          {/* Enrichment coverage stats */}
          <div className="mt-3 border-t border-zinc-800 pt-2.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Skill-classified repos</span>
              <span className="text-zinc-300">{insights.reposWithSkills.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Taxonomy-assigned repos</span>
              <span className="text-zinc-300">{insights.reposWithTaxonomy.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Repos with rich tags (8+)</span>
              <span className="text-zinc-300">{insights.reposWithRichTags.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
