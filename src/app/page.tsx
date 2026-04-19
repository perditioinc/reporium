import type { Metadata } from 'next';
import { HomePageClient } from '@/components/HomePageClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { REPOS_INDEXED_LABEL } from '@/lib/corpusConstants.generated';

// Rounds down to the nearest 100 for marketing copy ("1,800+" not "1,825+").
// Sourced from generated constants so meta stays fresh as corpus grows.
function marketingCount(label: string): string {
  const n = parseInt(label.replace(/,/g, ''), 10);
  if (!Number.isFinite(n)) return label;
  const rounded = Math.floor(n / 100) * 100;
  return rounded.toLocaleString();
}

const description = `Search, filter, and explore ${marketingCount(REPOS_INDEXED_LABEL)}+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.`;

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

export default function Page() {
  return (
    <ErrorBoundary>
      <HomePageClient />
    </ErrorBoundary>
  );
}
