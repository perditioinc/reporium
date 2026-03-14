import type { ParentRepoStats, ForkSyncStatus, CommitSummary } from '@/types/repo';
import type { ForkInfo } from '@/lib/github';

export type CacheTier = 'permanent' | 'weekly' | 'daily' | 'realtime';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: string;
  tier: CacheTier;
  repoUpdatedAt: string;
}

export interface RepoCache {
  // Tier 1 — permanent
  upstreamCreatedAt?: CacheEntry<string | null>;
  originalOwner?: CacheEntry<string>;
  forkedFrom?: CacheEntry<string | null>;

  // Tier 2 — weekly
  parentStats?: CacheEntry<ParentRepoStats | null>;
  languageBreakdown?: CacheEntry<Record<string, number>>;
  forkInfo?: CacheEntry<ForkInfo | null>;

  // Tier 3 — daily (only if repo was active)
  forkSyncStatus?: CacheEntry<ForkSyncStatus | null>;
  recentCommits?: CacheEntry<CommitSummary[]>;
  latestRelease?: CacheEntry<{ tagName: string; publishedAt: string; url: string } | null>;
  readme?: CacheEntry<string | null>;

  // Metadata
  lastFullFetch: string;
  repoUpdatedAt: string;
}

export interface LibraryCache {
  [repoFullName: string]: RepoCache;
}

// Staleness thresholds
const THRESHOLDS = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export function isStale(entry: CacheEntry<unknown> | undefined, tier: CacheTier, force = false): boolean {
  if (!entry) return true;
  if (tier === 'permanent') return force;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  if (tier === 'weekly') return age > THRESHOLDS.weekly;
  if (tier === 'daily') return age > THRESHOLDS.daily;
  return true; // realtime always stale
}

export function makeCacheEntry<T>(data: T, tier: CacheTier, repoUpdatedAt: string): CacheEntry<T> {
  return { data, fetchedAt: new Date().toISOString(), tier, repoUpdatedAt };
}
