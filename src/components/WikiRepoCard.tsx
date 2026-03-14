import type { EnrichedRepo } from '@/types/repo';

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface WikiRepoCardProps {
  repo: EnrichedRepo;
}

/** Mini repo card for wiki pages — links back to main library filtered to this repo */
export function WikiRepoCard({ repo }: WikiRepoCardProps) {
  const builder = repo.builders?.[0];
  return (
    <a
      href={`/?repo=${encodeURIComponent(repo.name)}`}
      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 hover:border-zinc-700 hover:bg-zinc-800/80 transition-colors no-underline"
    >
      {builder && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://github.com/${builder.login}.png?size=16`}
          alt={builder.name ?? builder.login}
          className="w-4 h-4 rounded-full flex-shrink-0"
        />
      )}
      <span className="text-sm font-medium text-zinc-200 flex-1 truncate">{repo.name}</span>
      {repo.parentStats?.stars && repo.parentStats.stars > 0 && (
        <span className="text-xs text-zinc-500 flex-shrink-0">⭐ {formatStars(repo.parentStats.stars)}</span>
      )}
      {repo.enrichedTags[0] && (
        <span className="text-xs text-zinc-600 flex-shrink-0 hidden sm:block">{repo.enrichedTags[0]}</span>
      )}
      <span className="text-xs text-zinc-600 flex-shrink-0">→</span>
    </a>
  );
}
