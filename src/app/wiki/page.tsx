import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { LibraryData } from '@/types/repo';
import { AI_DEV_SKILLS } from '@/lib/buildTaxonomy';
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
    const p = join(process.cwd(), 'public', 'data', 'library.json');
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

  const skillNames = Object.keys(AI_DEV_SKILLS);

  return (
    <div>
      <WikiNavBar title="Overview" />
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-1">
          {data.username}&apos;s Knowledge Library
        </h1>
        <p className="text-zinc-500 text-sm">
          {data.repos.length} repos · {data.stats.total} total · generated {new Date(data.generatedAt).toLocaleDateString()}
        </p>
      </div>

      {/* AI Dev Coverage */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-3">AI Dev Skill Coverage</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {skillNames.map(skill => {
            const stat = data.aiDevSkillStats?.find(s => s.skill === skill);
            const count = stat?.repoCount ?? 0;
            const icon = count >= 10 ? '✅' : count >= 3 ? '⚠️' : '❌';
            const color = count >= 10 ? 'text-emerald-400' : count >= 3 ? 'text-yellow-400' : 'text-red-400';
            return (
              <div key={skill} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className={`text-xs font-medium ${color}`}>{skill}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{count} repos</p>
              </div>
            );
          })}
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
                <img src={b.avatarUrl} alt={b.displayName} className="w-4 h-4 rounded-full" />
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
