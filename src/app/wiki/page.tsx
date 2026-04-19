import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { LibraryData } from '@/types/repo';
import { GapAnalysisPanel } from '@/components/GapAnalysisPanel';
import { WikiNavBar } from '@/components/WikiNavBar';

export const metadata: Metadata = {
  title: 'Wiki',
  description: 'Browse AI dev tool categories, builders, and skill areas.',
  openGraph: {
    title: 'Wiki',
    description: 'Browse AI dev tool categories, builders, and skill areas.',
    url: 'https://www.reporium.com/wiki',
  },
  twitter: {
    title: 'Wiki',
    description: 'Browse AI dev tool categories, builders, and skill areas.',
  },
};

function getLibraryData(): LibraryData | null {
  try {
    const p = join(process.cwd(), 'data', 'library.json');
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch { return null; }
}

export default function WikiPage() {
  const data = getLibraryData();
  if (!data) return (
    <div className="p-8 text-zinc-400">
      No library data found. Run <code className="bg-zinc-800 px-1 rounded">npm run generate</code> first.
    </div>
  );

  // Group AI dev skills by lifecycleGroup for hierarchical display.
  // The data shape comes from generate-library.ts via buildSkillStats() and
  // already includes lifecycleGroup per skill. Display every skill present in
  // the data — the previous implementation iterated a stale frontend constant
  // (AI_DEV_SKILLS) whose names did not match the generated stats, so only 2/15
  // skills rendered with non-zero counts.
  const allSkillStats = data.aiDevSkillStats ?? [];
  const skillsByLifecycle = allSkillStats.reduce<Record<string, typeof allSkillStats>>((acc, s) => {
    const group = s.lifecycleGroup ?? 'Other';
    (acc[group] ||= []).push(s);
    return acc;
  }, {});
  // Stable lifecycle ordering: foundation → inference → application → eval → other
  const LIFECYCLE_ORDER = [
    'Foundation & Training',
    'Inference & Deployment',
    'LLM Application Layer',
    'Eval / Safety / Ops',
  ];
  const orderedGroups = [
    ...LIFECYCLE_ORDER.filter(g => skillsByLifecycle[g]),
    ...Object.keys(skillsByLifecycle).filter(g => !LIFECYCLE_ORDER.includes(g)),
  ];

  return (
    <div>
      <WikiNavBar title="Overview" />
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-1 sm:text-3xl">
          {data.username}&apos;s Knowledge Library
        </h1>
        <p className="text-zinc-500 text-sm">
          {data.repos.length} repos · {data.stats.total} total · generated {new Date(data.generatedAt).toLocaleDateString()}
        </p>
      </div>

      {/* AI Dev Coverage — grouped by lifecycle stage */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-1">AI Dev Skill Coverage</h2>
        <p className="text-xs text-zinc-500 mb-4">
          {allSkillStats.length} skill areas across {orderedGroups.length} lifecycle stages
        </p>
        <div className="space-y-5">
          {orderedGroups.map(group => (
            <div key={group}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                {group}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {skillsByLifecycle[group].map(stat => {
                  const count = stat.repoCount;
                  const icon = count >= 50 ? '✅' : count >= 10 ? '⚠️' : count >= 1 ? '◐' : '❌';
                  const color =
                    count >= 50 ? 'text-emerald-400' :
                    count >= 10 ? 'text-yellow-400' :
                    count >= 1 ? 'text-zinc-300' : 'text-red-400';
                  return (
                    <div key={stat.skill} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                      <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <span className={`text-xs font-medium ${color}`}>{stat.skill}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{count} repos</p>
                      {stat.topRepos && stat.topRepos.length > 0 && (
                        <p className="text-[10px] text-zinc-600 mt-1.5 truncate" title={stat.topRepos.join(', ')}>
                          {stat.topRepos.slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top builders */}
      {data.builderStats && data.builderStats.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-200 mb-3">Top Builders</h2>
          <div className="flex flex-wrap gap-2">
            {data.builderStats.slice(0, 15).map(b => (
              <a
                key={b.login}
                href={`/wiki/builders/${b.login}`}
                className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.avatarUrl} alt={b.displayName} className="w-4 h-4 rounded-full" width={16} height={16} />
                {b.displayName}
                <span className="text-zinc-500">({b.repoCount})</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Gap analysis */}
      {data.gapAnalysis?.gaps && data.gapAnalysis.gaps.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-200 mb-3">Library Gaps</h2>
          <GapAnalysisPanel gaps={data.gapAnalysis.gaps} />
        </section>
      )}
    </div>
    </div>
  );
}
