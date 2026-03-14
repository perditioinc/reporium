'use client';

import { useEffect, useRef } from 'react';
import { TagMetrics } from '@/types/repo';

interface TagExplorerPanelProps {
  metrics: TagMetrics | null;
  onClose: () => void;
  onTagClick: (tag: string) => void;
  onRepoClick: (repoName: string) => void;
  onViewAll: (tag: string) => void;
}

/** Returns a relative time string */
function relativeTime(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/** Slide-in panel showing detailed metrics for a selected tag */
export function TagExplorerPanel({
  metrics,
  onClose,
  onTagClick,
  onRepoClick,
  onViewAll,
}: TagExplorerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    if (metrics) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [metrics, onClose]);

  if (!metrics) return null;

  const activityColor =
    metrics.activityScore > 60
      ? 'bg-emerald-500'
      : metrics.activityScore > 30
      ? 'bg-amber-500'
      : 'bg-zinc-500';

  const topLangs = Object.entries(metrics.languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-[380px] overflow-y-auto border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-sm shadow-2xl"
      >
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-100">{metrics.tag}</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                {metrics.repoCount} repos · {metrics.percentage}% of library
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Activity score */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-zinc-500">Activity Score</span>
              <span className="text-xs font-semibold text-zinc-300">{metrics.activityScore}/100</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800">
              <div
                className={`h-2 rounded-full transition-all ${activityColor}`}
                style={{ width: `${metrics.activityScore}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-zinc-500">
              <span className="text-emerald-400">{metrics.updatedLast30Days} active</span>
              <span className="text-amber-400">{metrics.updatedLast90Days} recent</span>
              <span>{metrics.olderThan90Days} older</span>
            </div>
          </div>

          {/* Top languages */}
          {topLangs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Top Languages
              </p>
              <div className="flex flex-wrap gap-2">
                {topLangs.map(([lang, count]) => (
                  <span
                    key={lang}
                    className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {lang} <span className="text-zinc-500">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related tags */}
          {metrics.relatedTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Related Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metrics.relatedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onTagClick(tag)}
                    className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-blue-400 hover:bg-zinc-700 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Most recent */}
          {metrics.mostRecentRepo && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
                Most Recent
              </p>
              <button
                onClick={() => onRepoClick(metrics.mostRecentRepo)}
                className="text-sm text-zinc-200 hover:text-blue-400 transition-colors"
              >
                {metrics.mostRecentRepo}
              </button>
              <span className="text-xs text-zinc-500 ml-2">
                {relativeTime(metrics.mostRecentDate)}
              </span>
            </div>
          )}

          {/* Repo list */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Repos in this tag
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {metrics.repos.slice(0, 20).map((name) => (
                <button
                  key={name}
                  onClick={() => onRepoClick(name)}
                  className="block w-full truncate text-sm text-zinc-300 hover:text-blue-400 transition-colors text-left py-0.5"
                >
                  • {name}
                </button>
              ))}
              {metrics.repos.length > 20 && (
                <p className="text-xs text-zinc-600 pt-1">
                  +{metrics.repos.length - 20} more
                </p>
              )}
            </div>
          </div>

          {/* View all button */}
          <button
            onClick={() => onViewAll(metrics.tag)}
            className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:border-blue-500 hover:text-blue-400 transition-colors"
          >
            View all {metrics.repoCount} repos →
          </button>
        </div>
      </div>
    </>
  );
}
