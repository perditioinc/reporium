import type { Metadata } from 'next';
import { WikiNavBar } from '@/components/WikiNavBar';
import { RunsTable } from '@/components/RunsTable';

export const metadata: Metadata = {
  title: 'Ingestion Run History',
  description: 'Recent ingestion pipeline runs for the Reporium AI dev tool library.',
};

const API_URL =
  process.env.NEXT_PUBLIC_REPORIUM_API_URL ??
  'https://reporium-api-573778300586.us-central1.run.app';

export interface IngestionRun {
  run_id: string;
  mode: string;
  status: string;
  repos_upserted: number;
  started_at: string;
  finished_at: string | null;
  errors?: string[];
}

export default function RunsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WikiNavBar title="Run History" />

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Ingestion Run History</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Recent ingestion runs that populate the repo library.
          </p>
        </div>

        <RunsTable runs={[]} apiUrl={API_URL} showRefresh />
      </main>
    </div>
  );
}
