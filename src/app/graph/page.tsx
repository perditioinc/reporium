import type { Metadata } from 'next';
import { WikiNavBar } from '@/components/WikiNavBar';
import { GraphPageClient } from './GraphPageClient';

export const metadata: Metadata = {
  title: 'Knowledge Graph — Reporium',
  description:
    'Interactive force-directed graph of relationships between AI repos: alternatives, dependencies, compatible tools, and similar projects.',
  openGraph: {
    title: 'Knowledge Graph — Reporium',
    description:
      'Interactive force-directed graph of relationships between AI repos: alternatives, dependencies, compatible tools, and similar projects.',
    url: 'https://www.reporium.com/graph',
  },
  twitter: {
    title: 'Knowledge Graph — Reporium',
    description:
      'Interactive force-directed graph of relationships between AI repos: alternatives, dependencies, compatible tools, and similar projects.',
  },
};

export default function GraphPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title="Knowledge Graph" />

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 sm:text-3xl">Knowledge Graph</h1>
          <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
            Force-directed visualization of relationships between AI repos. Nodes are repos;
            edges show how they relate. Click a node to see its connections.
          </p>
        </div>

        <GraphPageClient />
      </main>
    </div>
  );
}
