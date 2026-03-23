'use client';

import { LibraryData, TagMetrics } from '@/types/repo';
import { CATEGORIES } from '@/lib/buildCategories';
import { AI_DEV_SKILLS } from '@/lib/buildTaxonomy';

interface StatsBarProps {
  data: LibraryData;
  tagMetrics?: TagMetrics[];
  onTagClick?: (tag: string) => void;
}

/** Returns a relative time string like "2 months ago" */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

const SYSTEM_TAGS = new Set(['Forked', 'Fork', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

const AI_DEV_SKILL_NAMES = Object.keys(AI_DEV_SKILLS);

/** Data-rich stats panel for the library */
export function StatsBar({ data, tagMetrics, onTagClick }: StatsBarProps) {
  const { stats, repos, username, generatedAt } = data;

  // All unique tags across all repos
  const allTags = new Set<string>();
  for (const repo of repos) {
    for (const tag of repo.enrichedTags) allTags.add(tag);
  }

  // Most recently updated repo
  const mostRecent = [...repos].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  )[0];

  // Repos updated in last 30 days
  const thirtyDaysAgo = new Date(generatedAt);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeCount = repos.filter(
    (r) => new Date(r.lastUpdated) >= thirtyDaysAgo
  ).length;

  // Top 6 languages with counts
  const langCounts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.language) langCounts.set(repo.language, (langCounts.get(repo.language) ?? 0) + 1);
  }
  const topLangs = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Always exactly 21 hardcoded categories — never derived from tags
  const categoryCount = CATEGORIES.length;

  // Top builders (up to 9 known orgs by repo count)
  const topBuilders = (data.builderStats ?? [])
    .filter(b => b.category !== 'individual')
    .slice(0, 9);

  // AI Dev Coverage
  const skillStatsMap = new Map((data.aiDevSkillStats ?? []).map(s => [s.skill, s]));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      {/* Row 1: identity + core counts */}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        {/* Identity */}
        <div>
          <p className="text-xs text-zinc-500">Library</p>
          <p className="text-lg font-bold text-zinc-100">{username}</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Updated {new Date(generatedAt).toLocaleTimeString()}
          </p>
        </div>

        {/* Core counts */}
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
            <p className="text-xs text-zinc-500">Repos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400">{stats.built}</p>
            <p className="text-xs text-zinc-500">Built</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-violet-400">{stats.forked}</p>
            <p className="text-xs text-zinc-500">Forked</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">{activeCount}</p>
            <p className="text-xs text-zinc-500">Active 30d</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-100">{allTags.size}</p>
            <p className="text-xs text-zinc-500">Unique Tags</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-100">{categoryCount}</p>
            <p className="text-xs text-zinc-500">Categories</p>
          </div>
        </div>

        {/* Most recent */}
        {mostRecent && (
          <div>
            <p className="text-xs text-zinc-500">Most Recent</p>
            <p className="text-sm font-semibold text-zinc-200 truncate max-w-[160px]">
              {mostRecent.name}
            </p>
            <p className="text-xs text-zinc-500">{relativeTime(mostRecent.lastUpdated)}</p>
          </div>
        )}
      </div>

      {/* Row 2: top languages */}
      {topLangs.length > 0 && (
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Languages</p>
          <div className="flex flex-wrap gap-2">
            {topLangs.map(([lang, count]) => (
              <span key={lang} className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
                <span className="font-medium">{lang}</span>
                <span className="text-zinc-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: top builders */}
      {topBuilders.length > 0 && (
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Builders</p>
          <div className="flex flex-wrap gap-2">
            {topBuilders.map(b => (
              <button
                key={b.login}
                onClick={() => console.log('Builder filter:', b.login)}
                className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.avatarUrl} alt={b.displayName} className="w-4 h-4 rounded-full" />
                <span>{b.displayName}</span>
                <span className="text-zinc-500">{b.repoCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 4: AI Dev Coverage */}
      <div className="pt-3 border-t border-zinc-800">
        <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">AI Dev Coverage</p>
        <div className="flex flex-wrap gap-1.5">
          {AI_DEV_SKILL_NAMES.map(skill => {
            const stat = skillStatsMap.get(skill);
            const count = stat?.repoCount ?? 0;
            const icon = count >= 10 ? '✅' : count >= 3 ? '⚠️' : '❌';
            const color = count >= 10 ? 'text-emerald-400' : count >= 3 ? 'text-yellow-400' : 'text-red-400';
            return (
              <span
                key={skill}
                title={`${count} repos`}
                className={`flex items-center gap-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-1 text-xs ${color}`}
              >
                <span>{icon}</span>
                <span className="text-zinc-300">{skill}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Tag Cloud */}
      {tagMetrics && tagMetrics.length > 0 && (
        <div className="pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Tag Cloud</p>
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {(() => {
              const visibleMetrics = tagMetrics.filter((m) => !SYSTEM_TAGS.has(m.tag)).slice(0, 30);
              const maxCount = visibleMetrics[0]?.repoCount ?? 1;
              const minSize = 12;
              const maxSize = 48;
              return visibleMetrics.map((m) => {
                const fontSize = Math.round(
                  minSize + (Math.log(m.repoCount + 1) / Math.log(maxCount + 1)) * (maxSize - minSize)
                );
                const opacity = 0.4 + (m.activityScore / 100) * 0.6;
                return (
                  <button
                    key={m.tag}
                    onClick={() => onTagClick?.(m.tag)}
                    style={{ fontSize: `${fontSize}px`, opacity }}
                    className="text-zinc-300 hover:text-blue-400 transition-colors leading-tight"
                  >
                    {m.tag}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
