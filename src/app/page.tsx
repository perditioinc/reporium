import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { HomePageClient } from '@/components/HomePageClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { REPOS_INDEXED_LABEL } from '@/lib/corpusConstants.generated';

export const metadata: Metadata = {
  title: { absolute: 'Reporium' },
  description:
    'Search, filter, and explore 1,400+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.',
  alternates: {
    canonical: 'https://www.reporium.com',
  },
  openGraph: {
    title: 'Reporium',
    description:
      'Search, filter, and explore 1,400+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.',
    url: 'https://www.reporium.com',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reporium',
    description:
      'Search, filter, and explore 1,400+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.',
    images: ['/opengraph-image.png'],
  },
};

function getTopRepos(): Array<{ name: string; owner: string; parentStats?: { stars: number } }> {
  try {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), 'public', 'data', 'library.json'), 'utf-8')
    ) as { repos: Array<{ name: string; owner?: string; parentStats?: { stars: number }; fullName?: string }> };
    return data.repos
      .slice(0, 10)
      .map(repo => ({
        name: repo.name,
        owner: repo.parentStats?.stars ? '' : (repo.fullName?.split('/')[0] || 'unknown'),
        parentStats: repo.parentStats,
      }));
  } catch {
    return [];
  }
}

export default function Page() {
  const topRepos = getTopRepos();

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Reporium',
    description:
      'Search, filter, and explore AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.',
    url: 'https://www.reporium.com',
    applicationCategory: 'DeveloperApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Top AI Development Tools',
    description: `Top ${Math.min(10, topRepos.length)} AI development tools in the Reporium library.`,
    numberOfItems: Math.min(10, topRepos.length),
    itemListElement: topRepos.map((repo, index) => ({
      '@type': 'SoftwareSourceCode',
      position: index + 1,
      name: repo.name,
      url: `https://www.reporium.com/repo/${encodeURIComponent(repo.name)}`,
    })),
  };

  return (
    <ErrorBoundary>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <HomePageClient />
    </ErrorBoundary>
  );
}
