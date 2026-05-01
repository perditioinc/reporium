import type { Metadata } from 'next';
import { WikiNavBar } from '@/components/WikiNavBar';
import { FAQPanel } from '@/components/FAQPanel';

export const metadata: Metadata = {
  title: 'Reporium FAQ — Suggested questions, grounded answers',
  description:
    'Every suggested question the Ask bar offers, answered against the Reporium knowledge base. Grounded in indexed repos, no hallucinations.',
  openGraph: {
    title: 'Reporium FAQ — Suggested questions, grounded answers',
    description:
      'Every suggested question the Ask bar offers, answered against the Reporium knowledge base.',
    url: 'https://www.reporium.com/faq',
  },
  twitter: {
    title: 'Reporium FAQ — Suggested questions, grounded answers',
    description:
      'Every suggested question the Ask bar offers, answered against the Reporium knowledge base.',
  },
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title="FAQ" />

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-zinc-100 sm:text-3xl">FAQ</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Every question the Ask bar suggests, answered against the Reporium
            knowledge base. Open a card to see the grounded answer and its source repos.
          </p>
        </header>

        <FAQPanel />
      </main>
    </div>
  );
}
