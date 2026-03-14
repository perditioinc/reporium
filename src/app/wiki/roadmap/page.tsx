import { WikiNavBar } from '@/components/WikiNavBar';

export default function RoadmapPage() {
  const phases = [
    { version: '0.1.0 – 0.8.0', title: 'Foundation', status: 'done', items: ['GitHub API integration', 'Enriched tagging', 'Filter & search UI', 'Fork sync status', 'MCP server'] },
    { version: '0.9.0', title: 'Categories & MCP CLI', status: 'done', items: ['8-category system', 'CLI tool', 'Category filter bar', 'Commit stats today/7d/30d/90d'] },
    { version: '1.0.0', title: 'Taxonomy Overhaul', status: 'done', items: ['21 hardcoded categories', '85+ new tags', 'Active filter bar', 'Rankings panel'] },
    { version: '1.1.0', title: 'Trend Intelligence', status: 'done', items: ['detect-trends.ts', 'Release Radar', 'Gap Analysis', 'Daily Digest', 'Intelligence sidebar section'] },
    { version: '1.2.0', title: 'Multi-Dimensional Taxonomy & Wiki', status: 'done', items: ['AI Dev Skills / PM Skills / Industries dimensions', 'Builder profiles', 'Wiki with 40+ pages', '6-tab filter bar', 'Expanded tag dictionary (300+ tags)'] },
    { version: '1.3.0', title: 'Gap Analysis v2 & Wiki Enhancements', status: 'current', items: ['ESSENTIAL_TOOLKIT_2026 with 10 skill areas', 'Severity tiers (missing/weak/moderate/strong)', 'Wiki skill pages with teaching content', 'WikiNavBar on all wiki pages', 'WikiRepoCard linking back to library', '?repo= and ?tag= URL params', 'GitHub Actions CI workflow'] },
  ];

  return (
    <div>
      <WikiNavBar title="Roadmap" />
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Reporium Roadmap</h1>
          <p className="text-sm text-zinc-500 mt-1">Development phases and upcoming features</p>
        </div>
        <div className="space-y-4">
          {phases.map(phase => (
            <div
              key={phase.version}
              className={`rounded-xl border p-4 ${
                phase.status === 'done' ? 'border-zinc-800 bg-zinc-900/50' :
                phase.status === 'current' ? 'border-blue-800 bg-blue-950/20' :
                'border-zinc-800 bg-zinc-950 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                  phase.status === 'done' ? 'bg-emerald-900/50 text-emerald-400' :
                  phase.status === 'current' ? 'bg-blue-900/50 text-blue-400' :
                  'bg-zinc-800 text-zinc-500'
                }`}>
                  {phase.version}
                </span>
                <span className="font-semibold text-zinc-200">{phase.title}</span>
                {phase.status === 'current' && <span className="text-xs text-blue-400">← current</span>}
              </div>
              <ul className="space-y-1">
                {phase.items.map(item => (
                  <li key={item} className="text-xs text-zinc-500 flex gap-2">
                    <span>{phase.status === 'done' ? '✓' : phase.status === 'current' ? '◉' : '○'}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
