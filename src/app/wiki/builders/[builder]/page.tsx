import { readFileSync } from 'fs';
import { join } from 'path';
import { notFound } from 'next/navigation';
import type { LibraryData } from '@/types/repo';
import { KNOWN_ORGS } from '@/lib/buildTaxonomy';
import { WikiNavBar } from '@/components/WikiNavBar';
import { WikiRepoCard } from '@/components/WikiRepoCard';

function getLibraryData(): LibraryData | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'library.json'), 'utf-8')); }
  catch { return null; }
}

export async function generateStaticParams() {
  return Object.keys(KNOWN_ORGS).map(login => ({ builder: login }));
}

export default async function BuilderPage({ params }: { params: Promise<{ builder: string }> }) {
  const { builder } = await params;
  const orgInfo = KNOWN_ORGS[builder.toLowerCase()];
  // Allow unknown builders too — they just won't have extra info

  const data = getLibraryData();
  if (!data) return <div className="p-8 text-zinc-400">No data.</div>;

  const builderStat = data.builderStats?.find(b => b.login.toLowerCase() === builder.toLowerCase());
  if (!builderStat && !orgInfo) notFound();

  const repos = data.repos
    .filter(r => (r.builders ?? []).some(b => b.login.toLowerCase() === builder.toLowerCase()))
    .sort((a, b) => (b.parentStats?.stars ?? 0) - (a.parentStats?.stars ?? 0));

  const displayName = orgInfo?.displayName ?? builderStat?.displayName ?? builder;

  return (
    <div>
      <WikiNavBar title={displayName} />
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://avatars.githubusercontent.com/${builder}`}
            alt={displayName}
            className="w-16 h-16 rounded-full border border-zinc-700"
          />
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Builder</p>
            <h1 className="text-2xl font-bold text-zinc-100">{displayName}</h1>
            {orgInfo && (
              <span className="text-xs text-zinc-500 capitalize">{orgInfo.category}</span>
            )}
          </div>
        </div>

        <p className="text-sm text-zinc-400">{repos.length} repos in your library from {displayName}</p>

        <div className="space-y-2">
          {repos.map(repo => (
            <WikiRepoCard key={repo.name} repo={repo} />
          ))}
          {repos.length === 0 && <p className="text-zinc-500 text-sm">No repos from this builder in your library.</p>}
        </div>
      </div>
    </div>
  );
}
