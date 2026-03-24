import Link from 'next/link';
import { WikiNavBar } from '@/components/WikiNavBar';

const API_URL =
  process.env.NEXT_PUBLIC_REPORIUM_API_URL ??
  'https://reporium-api-573778300586.us-central1.run.app';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaxonomyEntry {
  dimension: string;
  value: string;
  repo_count?: number;
  count?: number;
}

interface GapEntry {
  dimension: string;
  value: string;
  repo_count: number;
  gap_score?: number;
}

interface GapResponse {
  gaps?: GapEntry[];
}

// ---------------------------------------------------------------------------
// The 8 canonical taxonomy dimensions
// ---------------------------------------------------------------------------

const DIMENSIONS = [
  { key: 'skill_area',          label: 'Skill Areas',         color: 'border-sky-700/40 bg-sky-900/20 text-sky-300',          badge: 'border-sky-700/30 bg-sky-900/30 text-sky-300' },
  { key: 'industry',            label: 'Industries',          color: 'border-amber-700/40 bg-amber-900/20 text-amber-300',     badge: 'border-amber-700/30 bg-amber-900/30 text-amber-300' },
  { key: 'use_case',            label: 'Use Cases',           color: 'border-fuchsia-700/40 bg-fuchsia-900/20 text-fuchsia-300', badge: 'border-fuchsia-700/30 bg-fuchsia-900/30 text-fuchsia-300' },
  { key: 'modality',            label: 'Modalities',          color: 'border-teal-700/40 bg-teal-900/20 text-teal-300',        badge: 'border-teal-700/30 bg-teal-900/30 text-teal-300' },
  { key: 'ai_trend',            label: 'AI Trends',           color: 'border-cyan-700/40 bg-cyan-900/20 text-cyan-300',        badge: 'border-cyan-700/30 bg-cyan-900/30 text-cyan-300' },
  { key: 'deployment_context',  label: 'Deployment Context',  color: 'border-orange-700/40 bg-orange-900/20 text-orange-300',  badge: 'border-orange-700/30 bg-orange-900/30 text-orange-300' },
  { key: 'tags',                label: 'Tags',                color: 'border-zinc-700 bg-zinc-800/40 text-zinc-300',           badge: 'border-zinc-700 bg-zinc-800/70 text-zinc-200' },
  { key: 'maturity_level',      label: 'Maturity Level',      color: 'border-emerald-700/40 bg-emerald-900/20 text-emerald-300', badge: 'border-emerald-700/30 bg-emerald-900/30 text-emerald-300' },
] as const;

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getTaxonomyValues(): Promise<TaxonomyEntry[]> {
  try {
    const res = await fetch(`${API_URL}/taxonomy/values?limit=500`, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data as TaxonomyEntry[];
    if (data && Array.isArray((data as { values?: unknown }).values)) {
      return (data as { values: TaxonomyEntry[] }).values;
    }
    return [];
  } catch {
    return [];
  }
}

async function getGapSummary(): Promise<GapEntry[]> {
  try {
    const res = await fetch(`${API_URL}/gaps/taxonomy?min_repos=1`, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data: GapResponse = await res.json();
    return data.gaps ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TaxonomyPage() {
  const [allValues, gaps] = await Promise.all([getTaxonomyValues(), getGapSummary()]);

  // Group values by dimension
  const byDimension = new Map<string, TaxonomyEntry[]>();
  for (const entry of allValues) {
    if (!byDimension.has(entry.dimension)) byDimension.set(entry.dimension, []);
    byDimension.get(entry.dimension)!.push(entry);
  }

  // Sort each dimension's values by repo count descending
  for (const [, entries] of byDimension) {
    entries.sort((a, b) => ((b.repo_count ?? b.count ?? 0) - (a.repo_count ?? a.count ?? 0)));
  }

  // Gap summary by dimension
  const gapByDimension = new Map<string, GapEntry[]>();
  for (const gap of gaps) {
    if (!gapByDimension.has(gap.dimension)) gapByDimension.set(gap.dimension, []);
    gapByDimension.get(gap.dimension)!.push(gap);
  }

  const totalValues = allValues.length;
  const totalGaps = gaps.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title="Taxonomy Explorer" />

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Taxonomy Dimension Explorer</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Browse all 8 taxonomy dimensions and filter the library by any value.
          </p>
        </div>

        {/* Gap analysis summary */}
        {totalGaps > 0 && (
          <section className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-base font-semibold text-amber-300">Gap Analysis Summary</h2>
              <span className="text-xs text-amber-400/70">{totalGaps} underserved values · {totalValues} total values</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gaps.slice(0, 20).map((gap) => {
                const dim = DIMENSIONS.find((d) => d.key === gap.dimension);
                return (
                  <Link
                    key={`${gap.dimension}:${gap.value}`}
                    href={`/?taxonomyDimension=${encodeURIComponent(gap.dimension)}&taxonomyValue=${encodeURIComponent(gap.value)}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-zinc-500 hover:text-white ${dim?.badge ?? 'border-zinc-700 bg-zinc-800/70 text-zinc-200'}`}
                  >
                    <span>{gap.value}</span>
                    <span className="opacity-60">({gap.repo_count})</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Dimension cards grid */}
        <div className="grid gap-5 md:grid-cols-2">
          {DIMENSIONS.map((dim) => {
            const entries = byDimension.get(dim.key) ?? [];
            const top5 = entries.slice(0, 5);
            const total = entries.length;

            return (
              <div
                key={dim.key}
                className={`rounded-xl border p-5 space-y-4 ${dim.color}`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{dim.label}</h2>
                  <span className="text-xs opacity-70">{total} value{total !== 1 ? 's' : ''}</span>
                </div>

                {/* Top 5 values */}
                {top5.length > 0 ? (
                  <div className="space-y-1.5">
                    {top5.map((entry) => {
                      const count = entry.repo_count ?? entry.count ?? 0;
                      return (
                        <Link
                          key={entry.value}
                          href={`/?taxonomyDimension=${encodeURIComponent(dim.key)}&taxonomyValue=${encodeURIComponent(entry.value)}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-transparent bg-black/20 px-3 py-2 text-xs hover:border-white/10 hover:bg-black/30 transition-colors"
                        >
                          <span className="truncate">{entry.value}</span>
                          <span className="shrink-0 opacity-60">{count} repo{count !== 1 ? 's' : ''}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs opacity-50">No values indexed yet.</p>
                )}

                {/* Gap warnings for this dimension */}
                {(gapByDimension.get(dim.key) ?? []).length > 0 && (
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-[11px] uppercase tracking-[0.15em] opacity-60 mb-1.5">Under-served</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(gapByDimension.get(dim.key) ?? []).slice(0, 5).map((gap) => (
                        <Link
                          key={gap.value}
                          href={`/?taxonomyDimension=${encodeURIComponent(dim.key)}&taxonomyValue=${encodeURIComponent(gap.value)}`}
                          className="rounded-full border border-amber-700/40 bg-amber-900/30 px-2 py-0.5 text-[11px] text-amber-300 hover:border-amber-500/60 transition-colors"
                        >
                          {gap.value}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
