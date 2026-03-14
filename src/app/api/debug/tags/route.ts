import { NextResponse } from 'next/server';
import { cacheGet } from '@/lib/cache';
import { LibraryData } from '@/types/repo';
import { config } from '@/config';

/**
 * GET /api/debug/tags
 * Returns tag quality diagnostics for the cached library data.
 * Uses the cached data for the default username — hit /api/repos/{username} first.
 */
export async function GET() {
  const username = config.githubUsername;
  const cacheKey = `repos:${username.toLowerCase()}`;
  const data = cacheGet<LibraryData>(cacheKey);

  if (!data) {
    return NextResponse.json(
      { error: `No cached data for "${username}". Hit /api/repos/${username} first.` },
      { status: 404 }
    );
  }

  const tagCounts = new Map<string, number>();
  for (const repo of data.repos) {
    for (const tag of repo.enrichedTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tagSummary = Object.fromEntries(
    [...tagCounts.entries()].sort((a, b) => b[1] - a[1])
  );

  const reposWithFewerThan3Tags = data.repos
    .filter((r) => r.enrichedTags.length < 3)
    .map((r) => r.name);

  const topTaggedRepos = [...data.repos]
    .sort((a, b) => b.enrichedTags.length - a.enrichedTags.length)
    .slice(0, 10)
    .map((r) => ({ name: r.name, tagCount: r.enrichedTags.length, tags: r.enrichedTags }));

  return NextResponse.json({
    totalRepos: data.repos.length,
    tagSummary,
    reposWithFewerThan3Tags,
    topTaggedRepos,
  });
}
