import type { Metadata } from 'next';
import { WikiNavBar } from '@/components/WikiNavBar';
import { EcosystemStackCard } from '@/components/EcosystemStackCard';
import { ECOSYSTEM_STACKS } from '@/data/ecosystemStacks';

export const metadata: Metadata = {
  title: 'Ecosystem Stacks — Reporium',
  description:
    'Curated AI/ML tool combinations for common use cases: RAG pipelines, agent systems, fine-tuning, observability, security, and MLOps.',
  openGraph: {
    title: 'Ecosystem Stacks — Reporium',
    description:
      'Curated AI/ML tool combinations for common use cases: RAG pipelines, agent systems, fine-tuning, observability, security, and MLOps.',
    url: 'https://www.reporium.com/stacks',
  },
  twitter: {
    title: 'Ecosystem Stacks — Reporium',
    description:
      'Curated AI/ML tool combinations for common use cases: RAG pipelines, agent systems, fine-tuning, observability, security, and MLOps.',
  },
};

export default function StacksPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title="Ecosystem Stacks" />

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Ecosystem Stacks</h1>
          <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
            Curated tool combinations for common AI/ML use cases. Each stack shows repos that work
            well together — click to see what each tool does and why it belongs in the stack.
          </p>
        </div>

        {/* Stack cards */}
        <div className="space-y-4">
          {ECOSYSTEM_STACKS.map((stack, index) => (
            <EcosystemStackCard
              key={stack.id}
              stack={stack}
              defaultExpanded={index === 0}
            />
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-zinc-600 border-t border-zinc-800 pt-6">
          Stacks are curated based on knowledge graph compatibility edges and community usage patterns.
          Star counts are approximate.{' '}
          <a href="/ask" className="text-zinc-500 hover:text-zinc-300 underline">
            Ask Reporium
          </a>{' '}
          to explore alternatives or get personalized stack recommendations.
        </p>
      </main>
    </div>
  );
}
