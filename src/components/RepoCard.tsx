'use client';

import { useState } from 'react';
import { EnrichedRepo } from '@/types/repo';
import { CATEGORIES } from '@/lib/buildCategories';
import { QualityBadge } from '@/components/QualityBadge';

/** Status tags that are not content tags — never show as clickable chips */
const SYSTEM_TAGS = new Set(['Active', 'Forked', 'Built by Me', 'Inactive', 'Archived', 'Popular']);

/**
 * Tags / keywords that identify a repo as an MCP server or Claude plugin.
 * Detection is purely client-side from enrichedTags + repo name/description.
 */
const MCP_PLUGIN_TAGS = new Set([
  'mcp', 'mcp-server', 'mcp-client', 'mcp-tool',
  'model-context-protocol', 'modelcontextprotocol',
  'claude-mcp', 'claude-plugin', 'claude-tools', 'claude-app',
]);

function detectPluginType(repo: EnrichedRepo): 'mcp-server' | null {
  const lowerName = repo.name.toLowerCase();
  const lowerDesc = (repo.description ?? '').toLowerCase();
  const lowerTags = (repo.enrichedTags ?? []).map(t => t.toLowerCase());

  const tagMatch = lowerTags.some(t => MCP_PLUGIN_TAGS.has(t));
  const nameMatch = lowerName.startsWith('mcp-') || lowerName.endsWith('-mcp') || lowerName.includes('-mcp-');
  const descMatch =
    lowerDesc.includes('model context protocol') ||
    lowerDesc.includes('mcp server') ||
    lowerDesc.includes('claude plugin');

  return tagMatch || nameMatch || descMatch ? 'mcp-server' : null;
}

// ── Trending score (0–5 🔥) ──────────────────────────────────────────────────
// Derived from commit velocity. For forks this reflects upstream activity.
function getTrendingScore(repo: EnrichedRepo): number {
  const c7  = repo.commitStats?.last7Days  ?? 0;
  const c30 = repo.commitStats?.last30Days ?? 0;
  if (c7 >= 20) return 5;   // blazing — multiple commits per day
  if (c7 >= 10) return 4;   // 1-2 commits/day
  if (c7 >=  4) return 3;   // every couple of days
  if (c7 >=  2) return 2;   // sporadic this week
  if (c7 >=  1 || c30 >= 8) return 1;
  return 0;
}

// ── Life / health status ──────────────────────────────────────────────────────
interface LifeStatus {
  emoji: string;
  label: string;
  tooltip: string;
  textColor: string;
}

function getLifeStatus(repo: EnrichedRepo): LifeStatus {
  const isArchived = repo.parentStats?.isArchived ?? false;
  const stars      = repo.parentStats?.stars ?? repo.stars ?? 0;
  const c7         = repo.commitStats?.last7Days  ?? 0;
  const c30        = repo.commitStats?.last30Days ?? 0;
  const c90        = repo.commitStats?.last90Days ?? 0;
  const daysSince  = (Date.now() - new Date(repo.lastUpdated).getTime()) / 86400000;

  if (isArchived) return {
    emoji: '📦', label: 'Archived',
    tooltip: 'Repository is archived — no new changes expected',
    textColor: 'text-zinc-500',
  };
  if (c7 >= 10 || c30 >= 30) return {
    emoji: '🚀', label: 'Hot',
    tooltip: `${c7} commits this week — very active development`,
    textColor: 'text-emerald-300',
  };
  if (c30 > 0) return {
    emoji: '💚', label: 'Active',
    tooltip: `${c30} commits in the last 30 days`,
    textColor: 'text-emerald-400',
  };
  if (c90 > 0) return {
    emoji: '💛', label: 'Stable',
    tooltip: `${c90} commits in the last 90 days — slowing but maintained`,
    textColor: 'text-amber-400',
  };
  if (stars > 500 || daysSince < 365) return {
    emoji: '🌙', label: 'Dormant',
    tooltip: `No recent commits — last activity ${Math.round(daysSince / 30)}mo ago`,
    textColor: 'text-zinc-400',
  };
  return {
    emoji: '💀', label: 'Inactive',
    tooltip: `No activity for over ${Math.round(daysSince / 365 * 10) / 10} years`,
    textColor: 'text-zinc-600',
  };
}

/** Color + label config for each risk level */
const RISK_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-950/80',    border: 'border-red-700',   text: 'text-red-300',    label: 'CRITICAL' },
  high:     { bg: 'bg-orange-950/70', border: 'border-orange-700', text: 'text-orange-300', label: 'HIGH RISK' },
  medium:   { bg: 'bg-amber-950/60',  border: 'border-amber-700',  text: 'text-amber-300',  label: 'MEDIUM RISK' },
  low:      { bg: 'bg-zinc-800/60',   border: 'border-zinc-600',   text: 'text-zinc-400',   label: 'LOW RISK' },
};

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
  const quality = repo.qualitySignals ?? repo.quality_signals;
  const sec = repo.securitySignals ?? null;
  const pluginType = detectPluginType(repo);
  const riskCfg = sec?.risk_level ? (RISK_CONFIG[sec.risk_level] ?? null) : null;
  const trendScore = getTrendingScore(repo);
  const lifeStatus = getLifeStatus(repo);

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border-t border-r border-b border-zinc-800 p-5 transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-black/20"
      style={{ borderLeftColor: catStyle.borderColor, borderLeftWidth: '4px', backgroundColor: catStyle.backgroundColor }}
    >
      {/* ── Security Incident Banner (critical-priority top-of-card alert) ── */}
      {sec?.incident_reported && (
        <div className="rounded-lg border border-red-700 bg-red-950/80 px-3 py-2 -mx-5 -mt-5 rounded-t-xl rounded-b-none mb-0">
          <div className="flex items-start gap-2">
            <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-300 uppercase tracking-wide">Security Incident Reported</p>
              {sec.incident_summary && (
                <p className="text-xs text-red-400 mt-0.5 line-clamp-2">{sec.incident_summary}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {sec.incident_date && (
                  <span className="text-[11px] text-red-500">{sec.incident_date}</span>
                )}
                {sec.incident_url && (
                  <a
                    href={sec.incident_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-red-400 hover:text-red-200 underline underline-offset-2 transition-colors"
                  >
                    View advisory →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {typeof repo.similarity === 'number' && (
            <span className="rounded-full bg-sky-900/40 border border-sky-700/40 px-2 py-0.5 text-xs font-medium text-sky-300">
              {Math.round(repo.similarity * 100)}% match
            </span>
          )}
          {/* Claude Plugin / MCP badge */}
          {pluginType && (
            <span className="rounded-full bg-violet-900/50 border border-violet-700/60 px-2 py-0.5 text-xs font-semibold text-violet-300">
              🔌 MCP
            </span>
          )}
          {/* Security risk badge (non-incident — incident gets the full banner above) */}
          {riskCfg && !sec?.incident_reported && (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${riskCfg.bg} ${riskCfg.border} ${riskCfg.text}`}>
              🛡️ {riskCfg.label}
            </span>
          )}
          {/* Compact risk badge shown alongside the incident banner */}
          {sec?.incident_reported && riskCfg && (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${riskCfg.bg} ${riskCfg.border} ${riskCfg.text}`}>
              🛡️ {riskCfg.label}
            </span>
          )}
          <QualityBadge quality={quality} />
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

      {repo.licenseSpdx && (
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-zinc-700 bg-zinc-900/70 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
            {repo.licenseSpdx}
          </span>
        </div>
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

      {/* ── Trending score + Life status ── */}
      <div className="flex items-center justify-between">
        {/* Fire scale — 0-5 fires, inactive ones faded */}
        <div
          className="flex items-center gap-0.5 select-none"
          title={trendScore > 0
            ? `Trending ${trendScore}/5 · ${repo.commitStats?.last7Days ?? 0} commits this week`
            : 'No recent commit activity'}
        >
          {[1, 2, 3, 4, 5].map(i => (
            <span
              key={i}
              style={{ opacity: i <= trendScore ? 1 : 0.12, fontSize: '13px', lineHeight: 1 }}
            >
              🔥
            </span>
          ))}
          {trendScore === 0 && (
            <span className="text-[10px] text-zinc-700 ml-1">no recent activity</span>
          )}
        </div>

        {/* Life / health status badge */}
        <span
          className={`text-xs font-medium ${lifeStatus.textColor}`}
          title={lifeStatus.tooltip}
        >
          {lifeStatus.emoji} {lifeStatus.label}
        </span>
      </div>

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

      {/* Tags — system status tags excluded, aiDevSkills rendered separately below */}
      <div className="flex flex-wrap gap-1.5">
        {[...new Set(repo.enrichedTags || [])]
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

      {/* AI Dev Skills — grouped by lifecycle, capped at 6 badges */}
      {repo.aiDevSkills && repo.aiDevSkills.length > 0 && (() => {
        const allSkills = (repo.aiDevSkills || []).slice(0, 6);
        const overflow = (repo.aiDevSkills || []).length - allSkills.length;

        // Group displayed skills by lifecycle group (comes directly from each object)
        const groupMap = new Map<string, typeof allSkills>();
        for (const skill of allSkills) {
          const group = skill.lifecycleGroup ?? 'Other';
          if (!groupMap.has(group)) groupMap.set(group, []);
          groupMap.get(group)!.push(skill);
        }
        const showGroupLabels = groupMap.size > 1;

        return (
          <div className="flex flex-col gap-1.5">
            {[...groupMap.entries()].map(([group, skills]) => (
              <div key={group} className="flex flex-col gap-1">
                {showGroupLabels && (
                  <span className="text-[10px] text-zinc-600 leading-none">{group}</span>
                )}
                <div className="flex flex-wrap gap-1">
                  {skills.map(skill =>
                    onTagClick ? (
                      <button
                        key={skill.skill}
                        onClick={() => onTagClick(skill.skill)}
                        className="rounded-full bg-sky-900/30 border border-sky-700/30 px-2 py-0.5 text-xs text-sky-400 hover:bg-sky-800/40 hover:text-sky-300 transition-colors"
                      >
                        {skill.skill}
                      </button>
                    ) : (
                      <span
                        key={skill.skill}
                        className="rounded-full bg-sky-900/30 border border-sky-700/30 px-2 py-0.5 text-xs text-sky-400"
                      >
                        {skill.skill}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
            {overflow > 0 && (
              <span className="text-xs text-zinc-600">+{overflow} more</span>
            )}
          </div>
        );
      })()}

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
        <span>Issues {(repo.isFork && ps ? ps.openIssues : (repo.openIssuesCount ?? 0)).toLocaleString()}</span>
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
        // createdAt for forks is always the parent's created_at; show it as "Project created"
        const realUpstream = repo.createdAt || null;
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
              <span className="text-zinc-600">Forked</span>
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
            <span className="text-zinc-600">Fork last synced</span>
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
