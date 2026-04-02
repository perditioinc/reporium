import type { Metadata } from 'next';
import { HomePageClient } from '@/components/HomePageClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: { absolute: 'Reporium' },
  description:
    'Search, filter, and explore 1,400+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.',
  openGraph: {
    title: 'Reporium',
    description:
      'Search, filter, and explore 1,400+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.',
    url: 'https://www.reporium.com',
  },
  twitter: {
    title: 'Reporium',
    description:
      'Search, filter, and explore 1,400+ AI development tools with taxonomy filters, portfolio insights, and live repo intelligence.',
  },
};

export default function Page() {
  return (
    <ErrorBoundary>
      <HomePageClient />
    </ErrorBoundary>
  );
}
