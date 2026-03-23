'use client';

import { useState } from 'react';
import { EnrichedRepo } from '@/types/repo';
import { CATEGORIES } from '@/lib/buildCategories';

/** Status tags that are not content tags — never show as clickable chips */
const SYSTEM_TAGS = new Set(['Active', 'Forked', 'Built by Me', 'Inactive', 'Archived', 'Popular']);

/** Own-account logins — don't render as "builder" since the Built/Forked badge already shows ownership */
const OWN_LOGINS = new Set(['perditioinc']);

/** Normalize stale category names to current taxonomy names */
const CATEGORY_NAME_ALIASES: Record<string, string> = {
  'Audio':       'Industry: Audio & Music',
  'Fine Tuning': 'Model Training',
  'Evaluation':  'Evals & Benchmarking',
  'Deployment':  'MLOps & Infrastructure',
};

interface RepoCardProps {
  repo: EnrichedRepo;
  similarCount?: number;
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (categoryId: string) => void;
}

/** Returns a relative time string like "2 months ago" */
function relativeTime(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '—';
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return '—';

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  const months = Math.floor(diffDays / 30);
  if (diffDays < 365) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(diffDays / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** Color map for common programming languages */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#239120',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
  Dart: '#00B4AB',
};

/** Format a date string as "Mon YYYY" e.g. "Jan 2023" */
function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Calculate months between two date strings (rounded) */
function monthsBetween(fromStr: string, toStr: string): number {
  const from = new Date(fromStr).getTime();
  const to = new Date(toStr).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24 * 30));
}

/** Get sync status badge config */
function syncBadge(sync: import('@/types/repo').ForkSyncStatus): { icon: string; color: string; label: string } {
  const { state, behindBy, aheadBy } = sync;
  if (state === 'up-to-date') return { icon: '✅', color: 'text-emerald-400', label: 'Up to date' };
  if (state === 'behind') {
    if (behindBy > 100) return { icon: '⬇️', color: 'text-red-400', label: `Behind by ${behindBy} — significantly outdated` };
    if (behindBy >= 10) return { icon: '⬇️', color: 'text-amber-400', label: `Behind by ${behindBy} commits` };
    return { icon: '⬇️', color: 'text-yellow-400', label: `Behind by ${behindBy} commit${behindBy !== 1 ? 's' : ''}` };
  }
  if (state === 'ahead') return { icon: '⬆️', color: 'text-blue-400', label: `Ahead by ${aheadBy} — you've made changes` };
  if (state === 'diverged') return { icon: '↕️', color: 'text-orange-400', label: 'Diverged from upstream' };
  return { icon: '—', color: 'text-zinc-500', label: 'Sync status unavailable' };
}

/** Compute display metadata for a commit relative to now */
function commitDisplayInfo(dateStr: string): { dotColor: string; textColor: string; label: string } {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const dotColor = days < 7 ? 'bg-emerald-400' : days < 30 ? 'bg-amber-400' : 'bg-zinc-600';
  const textColor = days < 7 ? 'text-emerald-400' : days < 30 ? 'text-amber-400' : 'text-zinc-500';
  const label = days === 0 ? 'today' : days === 1 ? '1d' : `${days}d`;
  return { dotColor, textColor, label };
}

function getCategoryStyle(primaryCategory: string): { borderColor: string; backgroundColor: string } {
  const resolvedName = CATEGORY_NAME_ALIASES[primaryCategory] ?? primaryCategory;
  const cat = CATEGORIES.find(c => c.name === resolvedName);
  if (!cat) return { borderColor: '#27272a', backgroundColor: 'transparent' };
  return {
    borderColor: cat.color,
    backgroundColor: cat.color + '0d', // 5% opacity
  };
}

/** A single repo card in the library grid */
export function RepoCard({ repo, similarCount, onTagClick, onCategoryClick }: RepoCardProps) {
  const langColor = repo.language ? (LANGUAGE_COLORS[repo.language] ?? '#8b949e') : '#8b949e';
  const ps = repo.parentStats;
  const [commitsOpen, setCommitsOpen] = useState(false);
  const catStyle = getCategoryStyle(repo.primaryCategory);

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border-t border-r border-b border-zinc-800 p-5 transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-black/20"
      style={{ borderLeftColor: catStyle.borderColor, borderLeftWidth: '4px', backgroundColor: catStyle.backgroundColor }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm font-semibold text-blue-400 hover:underline"
        >
          {repo.name}
        </a>
        <div className="flex items-center gap-1.5 shrink-0">
          {repo.isFork && ps?.isArchived && (
            <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-300">
              archived
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              repo.isFork
                ? 'bg-violet-900/60 text-violet-300'
                : 'bg-emerald-900/60 text-emerald-300'
            }`}
          >
            {repo.isFork ? 'Forked' : 'Built'}
          </span>
        </div>
      </div>

      {/* Builder badge — skip if the "builder" is our own account (redundant with Built badge) */}
      {repo.builders && repo.builders.length > 0 && (() => {
        const builder = repo.builders.find(b => !OWN_LOGINS.has(b.login.toLowerCase()));
        if (!builder) return null;
        const builderColors: Record<string, string> = {
          google: 'text-blue-400',
          'google-deepmind': 'text-blue-400',
          microsoft: 'text-slate-400',
          'meta-llama': 'text-blue-400',
          facebookresearch: 'text-blue-400',
          openai: 'text-green-400',
          anthropics: 'text-orange-400',
          huggingface: 'text-yellow-400',
          nvidia: 'text-green-400',
          'deepseek-ai': 'text-cyan-400',
          mistralai: 'text-purple-400',
        };
        const color = builderColors[builder.login.toLowerCase()] ?? 'text-zinc-400';
        return (
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://avatars.githubusercontent.com/${builder.login}`}
              alt={builder.name ?? builder.login}
              className="w-4 h-4 rounded-full"
            />
            <span className={`text-xs font-medium ${color}`}>{builder.name ?? builder.login}</span>
          </div>
        );
      })()}

      {/* Description */}
      {repo.description && (
        <p className="line-clamp-2 text-xs text-zinc-400">{repo.description}</p>
      )}

      {/* Forked from */}
      {repo.isFork && repo.forkedFrom && (
        <p className="text-xs text-zinc-500">
          Forked from{' '}
          <a
            href={`https://github.com/${repo.forkedFrom}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:underline"
          >
            {repo.forkedFrom}
          </a>
        </p>
      )}

      {/* Category badges — primary prominent, secondary outlined, rest subtle */}
      {(repo.allCategories ?? []).length > 0 && (() => {
        const cats = (repo.allCategories ?? [])
          .map(n => CATEGORY_NAME_ALIASES[n] ?? n)
          .map(n => CATEGORIES.find(c => c.name === n))
          .filter(Boolean) as import('@/types/repo').Category[];
        const [primary, secondary, ...rest] = cats;
        return (
          <div className="flex flex-wrap gap-1.5">
            {/* Primary — filled pill, larger */}
            {primary && (
              <button
                key={primary.id}
                onClick={() => onCategoryClick?.(primary.id)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ backgroundColor: primary.color, color: '#fff' }}
              >
                <span>{primary.icon}</span>
                <span>{primary.name}</span>
              </button>
            )}
            {/* Secondary — outlined */}
            {secondary && (
              <button
                key={secondary.id}
                onClick={() => onCategoryClick?.(secondary.id)}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: secondary.color, border: `1px solid ${secondary.color}99`, backgroundColor: secondary.color + '1a' }}
              >
                <span>{secondary.icon}</span>
                <span>{secondary.name}</span>
              </button>
            )}
            {/* Remaining — small subtle pills */}
            {rest.map(cat => (
              <button
                key={cat.id}
                onClick={() => onCategoryClick?.(cat.id)}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: cat.color + 'cc', border: `1px solid ${cat.color}44`, backgroundColor: 'transparent' }}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* PM Skills row */}
      {repo.pmSkills && repo.pmSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {repo.pmSkills.slice(0, 3).map(skill => (
            <span key={skill} className="rounded-full bg-indigo-900/40 border border-indigo-700/40 px-2 py-0.5 text-xs text-indigo-400">
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Tags — system status tags excluded */}
      <div className="flex flex-wrap gap-1.5">
        {[...new Set([...(repo.enrichedTags || []), ...(repo.aiDevSkills || [])])]
          .filter(t => !SYSTEM_TAGS.has(t))
          .slice(0, 8)
          .map((tag) =>
          onTagClick ? (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              {tag}
            </button>
          ) : (
            <span
              key={tag}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
            >
              {tag}
            </span>
          )
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center gap-4 text-xs text-zinc-500">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: langColor }}
            />
            {repo.language}
          </span>
        )}

        {/* Stars & forks: parent stats for forks, own stats for built repos */}
        {repo.isFork ? (
          ps ? (
            <span>
              <span className="text-zinc-600">Original: </span>
              ⭐ {ps.stars.toLocaleString()} · 🍴 {ps.forks.toLocaleString()}
            </span>
          ) : (
            <span className="text-zinc-700">—</span>
          )
        ) : (
          <span>⭐ {repo.stars.toLocaleString()} · 🍴 {repo.forks.toLocaleString()}</span>
        )}

        {/* Last update date — use lastUpdated (always populated), fallback to parent */}
        <span className="ml-auto">
          {relativeTime(repo.lastUpdated) !== '—'
            ? relativeTime(repo.lastUpdated)
            : repo.isFork && ps
              ? relativeTime(ps.lastCommitDate)
              : '—'}
        </span>
      </div>

      {/* Language breakdown bar */}
      {Object.keys(repo.languagePercentages).length > 1 && (() => {
        const sorted = Object.entries(repo.languagePercentages)
          .sort(([, a], [, b]) => b - a);
        const top3 = sorted.slice(0, 3);
        const otherPct = 100 - top3.reduce((sum, [, p]) => sum + p, 0);
        const display = [...top3];
        if (otherPct > 0 && sorted.length > 3) display.push(['Other', otherPct]);
        return (
          <div className="text-xs text-zinc-500 flex flex-wrap gap-x-2 gap-y-0.5">
            {display.map(([lang, pct], i) => (
              <span key={lang}>
                {i > 0 && <span className="text-zinc-700 mr-2">·</span>}
                <span className="text-zinc-400">{lang}</span>
                <span className="text-zinc-600 ml-0.5">{pct}%</span>
              </span>
            ))}
          </div>
        );
      })()}

      {/* Timeline — fork date metadata.
          upstreamCreatedAt is only shown if it differs from createdAt (the ingestion date),
          which avoids showing the wrong "Project created" date before backfill runs. */}
      {repo.isFork && (() => {
        const realUpstream = repo.upstreamCreatedAt && repo.upstreamCreatedAt !== repo.createdAt
          ? repo.upstreamCreatedAt : null;
        const hasAnyDate = realUpstream || repo.forkedAt || repo.yourLastPushAt || repo.upstreamLastPushAt;
        if (!hasAnyDate) return null;
        return (
        <div className="border-t border-zinc-800 pt-3 space-y-1.5">
          <p className="text-xs font-medium text-zinc-500">📅 Timeline</p>
          {realUpstream && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Project created</span>
              <span className="text-zinc-400">{formatMonthYear(realUpstream)}</span>
            </div>
          )}
          {repo.forkedAt && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">You forked</span>
              <span className="text-zinc-400">
                {formatMonthYear(repo.forkedAt)}
                {realUpstream && (
                  <span className="text-zinc-600 ml-1">
                    ({monthsBetween(realUpstream, repo.forkedAt)}mo later)
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600">Your last push</span>
            <span className="text-zinc-400">
              {repo.yourLastPushAt ? relativeTime(repo.yourLastPushAt) : 'Never'}
            </span>
          </div>
          {repo.upstreamLastPushAt && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Upstream last push</span>
              <span className="text-zinc-400">{relativeTime(repo.upstreamLastPushAt)}</span>
            </div>
          )}
        </div>
        );
      })()}

      {/* Sync Status + Commit activity */}
      {(repo.forkSync || (repo.commitStats?.last30Days ?? 0) > 0) && (
        <div className="border-t border-zinc-800 pt-3 space-y-1">
          {repo.forkSync && (() => {
            const badge = syncBadge(repo.forkSync);
            return (
              <>
                <p className="text-xs font-medium text-zinc-500">🔄 Sync Status</p>
                <p className={`text-xs ${badge.color}`}>
                  {badge.icon} {badge.label}
                </p>
              </>
            );
          })()}
          {(repo.commitStats?.last7Days ?? 0) > 0 ? (
            <span className="text-xs text-emerald-400">
              {repo.commitStats!.last7Days} commits/week
            </span>
          ) : (repo.commitStats?.last30Days ?? 0) > 0 ? (
            <span className="text-xs text-zinc-400">
              {repo.commitStats!.last30Days} commits/month
            </span>
          ) : null}
        </div>
      )}

      {/* Similarity hint */}
      {similarCount !== undefined && similarCount > 0 && (
        <p className="text-xs text-zinc-600">Similar in library: {similarCount}</p>
      )}

      {/* Recent commits */}
      {repo.recentCommits.length > 0 && (
        <div className="border-t border-zinc-800 pt-2">
          <button
            onClick={() => setCommitsOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full"
          >
            <span>Recent Updates</span>
            <span>{commitsOpen ? '▴' : '▾'}</span>
          </button>
          {commitsOpen && (
            <div className="mt-2 space-y-1.5">
              {repo.recentCommits.map((commit) => {
                const { dotColor, textColor, label } = commitDisplayInfo(commit.date);
                return (
                  <div key={commit.sha} className="flex items-start gap-1.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors leading-relaxed"
                    >
                      {commit.message}
                    </a>
                    <span className={`shrink-0 text-xs ${textColor}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
