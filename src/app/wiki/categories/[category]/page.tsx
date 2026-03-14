import { readFileSync } from 'fs';
import { join } from 'path';
import { notFound } from 'next/navigation';
import type { LibraryData } from '@/types/repo';
import { CATEGORIES } from '@/lib/buildCategories';
import { WikiNavBar } from '@/components/WikiNavBar';
import { WikiRepoCard } from '@/components/WikiRepoCard';

function getLibraryData(): LibraryData | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'library.json'), 'utf-8')); }
  catch { return null; }
}

export async function generateStaticParams() {
  return CATEGORIES.map(c => ({ category: c.id }));
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) notFound();

  const data = getLibraryData();
  if (!data) return <div className="p-8 text-zinc-400">No data. Run npm run generate.</div>;

  const repos = data.repos
    .filter(r => (r.allCategories ?? []).includes(cat.name))
    .sort((a, b) => (b.parentStats?.stars ?? 0) - (a.parentStats?.stars ?? 0));

  return (
    <div>
      <WikiNavBar title={cat.name} />
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Categories</p>
          <h1 className="text-2xl font-bold text-zinc-100">
            <span className="mr-2">{cat.icon}</span>{cat.name}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{repos.length} repos</p>
        </div>
        <p className="text-sm text-zinc-400">{cat.description}</p>

        <div className="space-y-2">
          {repos.map(repo => (
            <WikiRepoCard key={repo.name} repo={repo} />
          ))}
        </div>
      </div>
    </div>
  );
}
