'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EnrichedRepo } from '@/types/repo';
import { RepoCard } from './RepoCard';

interface RepoGridProps {
  repos: EnrichedRepo[];
  allRepos?: EnrichedRepo[];
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (categoryId: string) => void;
}

const SYSTEM_TAGS = new Set(['Forked', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);
const PAGE_SIZE = 24;

/**
 * Count of repos in the full library that share 2+ non-system enrichedTags with the given repo.
 * Excludes the repo itself.
 */
function computeSimilarCount(repo: EnrichedRepo, allRepos: EnrichedRepo[]): number {
  const myTags = new Set(repo.enrichedTags.filter((t) => !SYSTEM_TAGS.has(t)));
  if (myTags.size === 0) return 0;
  return allRepos.filter((other) => {
    if (other.id === repo.id) return false;
    const shared = other.enrichedTags.filter((t) => !SYSTEM_TAGS.has(t) && myTags.has(t)).length;
    return shared >= 2;
  }).length;
}

/** Grid of repo cards with infinite scroll */
export function RepoGrid({ repos, allRepos, onTagClick, onCategoryClick }: RepoGridProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when repos change (new filter/sort)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [repos]);

  // Intersection Observer for infinite scroll
  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, repos.length));
  }, [repos.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (repos.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-zinc-500">
        No repositories match your filters.
      </div>
    );
  }

  const visible = repos.slice(0, visibleCount);
  const hasMore = visibleCount < repos.length;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {visible.map((repo) => (
          <RepoCard
            key={repo.id}
            repo={repo}
            similarCount={allRepos ? computeSimilarCount(repo, allRepos) : undefined}
            onTagClick={onTagClick}
            onCategoryClick={onCategoryClick}
          />
        ))}
      </div>

      {/* Scroll sentinel + status */}
      <div ref={sentinelRef} className="flex items-center justify-center py-6">
        {hasMore ? (
          <span className="text-xs text-zinc-600">
            Showing {visible.length} of {repos.length} repos
          </span>
        ) : repos.length > PAGE_SIZE ? (
          <span className="text-xs text-zinc-600">
            All {repos.length} repos loaded
          </span>
        ) : null}
      </div>
    </div>
  );
}
