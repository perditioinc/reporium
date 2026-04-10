import type { Metadata } from 'next';
import { WikiNavBar } from '@/components/WikiNavBar';
import { AskPanel } from '@/components/AskPanel';

if (!process.env.NEXT_PUBLIC_REPORIUM_API_URL) {
  throw new Error('NEXT_PUBLIC_REPORIUM_API_URL environment variable is not set');
}
const API_URL = process.env.NEXT_PUBLIC_REPORIUM_API_URL;

export const metadata: Metadata = {
  title: 'Ask Reporium - Natural language search',
  description:
    'Ask natural-language questions against the Reporium AI development tool library and review grounded source repos.',
  openGraph: {
    title: 'Ask Reporium - Natural language search',
    description:
      'Ask natural-language questions against the Reporium AI development tool library and review grounded source repos.',
    url: 'https://www.reporium.com/ask',
  },
  twitter: {
    title: 'Ask Reporium - Natural language search',
    description:
      'Ask natural-language questions against the Reporium AI development tool library and review grounded source repos.',
  },
};

export default function AskPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title="Ask Reporium" />

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Ask Reporium</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Query the AI dev tool library with natural language. Answers are grounded in your indexed repos.
          </p>
        </div>

        <AskPanel apiUrl={API_URL} />
      </main>
    </div>
  );
}
