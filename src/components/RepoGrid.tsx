'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
 * Pre-build a Map<repoId, similarCount> using an inverted tag index.
 * O(repos * avgTags) instead of O(repos^2).
 */
function buildSimilarCountMap(allRepos: EnrichedRepo[]): Map<string | number, number> {
  // Inverted index: tag → set of repo ids
  const tagToRepos = new Map<string, Set<string | number>>();
  const repoTags = new Map<string | number, string[]>();

  for (const repo of allRepos) {
    const tags = repo.enrichedTags.filter(t => !SYSTEM_TAGS.has(t));
    repoTags.set(repo.id, tags);
    for (const tag of tags) {
      let set = tagToRepos.get(tag);
      if (!set) { set = new Set(); tagToRepos.set(tag, set); }
      set.add(repo.id);
    }
  }

  const result = new Map<string | number, number>();
  for (const repo of allRepos) {
    const myTags = repoTags.get(repo.id);
    if (!myTags || myTags.length === 0) { result.set(repo.id, 0); continue; }

    // Count how many times each other repo shares a tag with this one
    const sharedCounts = new Map<string | number, number>();
    for (const tag of myTags) {
      const peers = tagToRepos.get(tag);
      if (!peers) continue;
      for (const peerId of peers) {
        if (peerId === repo.id) continue;
        sharedCounts.set(peerId, (sharedCounts.get(peerId) ?? 0) + 1);
      }
    }

    let count = 0;
    for (const shared of sharedCounts.values()) {
      if (shared >= 2) count++;
    }
    result.set(repo.id, count);
  }

  return result;
}

/** Grid of repo cards with infinite scroll */
export function RepoGrid({ repos, allRepos, onTagClick, onCategoryClick }: RepoGridProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Pre-compute similar counts once when allRepos changes (not per-card)
  const similarCountMap = useMemo(
    () => allRepos ? buildSimilarCountMap(allRepos) : null,
    [allRepos]
  );

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
            similarCount={similarCountMap?.get(repo.id)}
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
