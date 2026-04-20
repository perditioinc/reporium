import { readFileSync } from 'fs';
import { join } from 'path';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { LibraryData } from '@/types/repo';
import { CATEGORIES } from '@/lib/buildCategories';
import { WikiNavBar } from '@/components/WikiNavBar';
import { WikiRepoCard } from '@/components/WikiRepoCard';

function getLibraryData(): LibraryData | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), 'data', 'library.json'), 'utf-8')); }
  catch { return null; }
}

export async function generateStaticParams() {
  return CATEGORIES.map(c => ({ category: c.id }));
}

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) return {};

  const data = getLibraryData();
  const repoCount = data ? data.repos.filter(r => (r.allCategories ?? []).includes(cat.name)).length : 0;
  const canonical = `https://www.reporium.com/wiki/categories/${encodeURIComponent(cat.id)}`;
  const title = `${cat.name} AI Development Tools | Reporium`;
  const description = `${repoCount} curated ${cat.name.toLowerCase()} AI dev tools with deep taxonomy filtering, portfolio insights, and live repository intelligence.`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) notFound();

  const data = getLibraryData();
  if (!data) return <div className="p-8 text-zinc-400">No data. Run npm run generate.</div>;

  const repos = data.repos
    .filter(r => (r.allCategories ?? []).includes(cat.name))
    .sort((a, b) => (b.parentStats?.stars ?? 0) - (a.parentStats?.stars ?? 0));

  const canonicalUrl = `https://www.reporium.com/wiki/categories/${encodeURIComponent(cat.id)}`;

  // Dataset JSON-LD for SEO tier 2
  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${cat.name} AI development tools`,
    description: `Curated list of ${repos.length} ${cat.name.toLowerCase()} AI development tools with taxonomy filtering and portfolio insights.`,
    url: canonicalUrl,
    keywords: [
      cat.name,
      'AI development tools',
      'AI tools',
      ...(repos.slice(0, 5).flatMap(r => r.enrichedTags?.slice(0, 2) ?? [])),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20),
    creator: {
      '@type': 'Organization',
      name: 'Reporium',
      url: 'https://www.reporium.com',
    },
    spatialCoverage: 'Global',
    temporalCoverage: `${new Date().getFullYear()}/`,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd).replace(/</g, '\\u003c') }}
      />
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
