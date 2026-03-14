'use client';

import { EnrichedRepo } from '@/types/repo';
import { RepoCard } from './RepoCard';

interface RepoGridProps {
  repos: EnrichedRepo[];
  allRepos?: EnrichedRepo[];
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (categoryId: string) => void;
}

const SYSTEM_TAGS = new Set(['Forked', 'Built by Me', 'Active', 'Inactive', 'Archived', 'Popular']);

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

/** Grid of repo cards */
export function RepoGrid({ repos, allRepos, onTagClick, onCategoryClick }: RepoGridProps) {
  if (repos.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-zinc-500">
        No repositories match your filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {repos.map((repo) => (
        <RepoCard
          key={repo.id}
          repo={repo}
          similarCount={allRepos ? computeSimilarCount(repo, allRepos) : undefined}
          onTagClick={onTagClick}
          onCategoryClick={onCategoryClick}
        />
      ))}
    </div>
  );
}
