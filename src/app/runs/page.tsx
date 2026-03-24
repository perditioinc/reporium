import { WikiNavBar } from '@/components/WikiNavBar';
import { RunsTable } from '@/components/RunsTable';

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

async function getRuns(): Promise<IngestionRun[]> {
  try {
    const res = await fetch(`${API_URL}/admin/runs`, {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) return [];
    if (!res.ok) return [];
    const data = await res.json();
    // API may return array directly or wrapped under `runs`
    if (Array.isArray(data)) return data as IngestionRun[];
    if (data && Array.isArray((data as { runs?: unknown }).runs)) {
      return (data as { runs: IngestionRun[] }).runs;
    }
    return [];
  } catch {
    return [];
  }
}

export default async function RunsPage() {
  const runs = await getRuns();

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

        <RunsTable runs={runs} apiUrl={API_URL} showRefresh />
      </main>
    </div>
  );
}
