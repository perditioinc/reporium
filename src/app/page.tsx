import type { Metadata } from 'next';
import { HomePageClient } from '@/components/HomePageClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { REPOS_INDEXED_LABEL, CORPUS_STATS } from '@/lib/corpusConstants.generated';
import { MARKETING_REPOS_LABEL } from '@/lib/corpusLabels';

const description = `Search, filter, and explore ${MARKETING_REPOS_LABEL}+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.`;

export const metadata: Metadata = {
  title: { absolute: 'Reporium' },
  description,
  openGraph: {
    title: 'Reporium',
    description,
    url: 'https://www.reporium.com',
  },
  twitter: {
    title: 'Reporium',
    description,
  },
};

// JSON-LD for crawlers/agents — built from the same generated corpus constants
// as the visible UI, so counts can never drift between the two surfaces.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://www.reporium.com/#website',
      url: 'https://www.reporium.com',
      name: 'Reporium',
      description,
      publisher: { '@id': 'https://www.reporium.com/#org' },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://www.reporium.com/?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.reporium.com/#org',
      name: 'Reporium',
      url: 'https://www.reporium.com',
      sameAs: ['https://github.com/perditioinc/reporium'],
    },
    {
      '@type': 'Dataset',
      '@id': 'https://www.reporium.com/#corpus',
      name: 'Reporium AI Dev Tools Corpus',
      description: `${REPOS_INDEXED_LABEL} indexed open-source AI development tools across ${CORPUS_STATS.categories} categories.`,
      url: 'https://www.reporium.com',
      keywords: 'AI development tools, open-source repositories, knowledge graph',
      isAccessibleForFree: true,
      creator: { '@id': 'https://www.reporium.com/#org' },
      variableMeasured: [
        { '@type': 'PropertyValue', name: 'Repositories indexed', value: CORPUS_STATS.reposIndexed },
        { '@type': 'PropertyValue', name: 'Categories', value: CORPUS_STATS.categories },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <ErrorBoundary>
        <HomePageClient />
      </ErrorBoundary>
    </>
  );
}
