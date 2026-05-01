/**
 * probe-getrepo-hang.mjs
 *
 * Reproduces the 240 s `/repo/[name]/page` hang under `next build` outside the
 * Next.js runtime. Confirms whether the hang is in:
 *   (1) `JsonDataProvider.getLibrary()` -> `fetch('/data/library.json')` (relative URL)
 *   (2) `JsonDataProvider.getRepo(name)` (which calls getLibrary)
 *   (3) `readFileSync` (the fallback path)
 *
 * We bias the probe to time-out fast (5 s) so a hang shows up as "hung after 5s",
 * not a 240 s wait.
 */

import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise.then((v) => ({ ok: true, v })),
    new Promise((res) => setTimeout(() => res({ ok: false, label, hung: true, ms }), ms)),
  ]);
}

async function probe1_relativeFetch() {
  const t0 = performance.now();
  const result = await withTimeout(
    (async () => {
      try {
        const res = await fetch('/data/library.json');
        return { status: res.status, ok: res.ok };
      } catch (err) {
        return { error: String(err) };
      }
    })(),
    5000,
    'fetch(/data/library.json)'
  );
  const dt = performance.now() - t0;
  console.log(`[probe1] fetch('/data/library.json') after ${dt.toFixed(0)} ms ->`, result);
}

async function probe2_basePathFetch() {
  const t0 = performance.now();
  const result = await withTimeout(
    (async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const res = await fetch(`${basePath}/data/library.json`);
        return { status: res.status, ok: res.ok };
      } catch (err) {
        return { error: String(err) };
      }
    })(),
    5000,
    'fetch(`${basePath}/data/library.json`)'
  );
  const dt = performance.now() - t0;
  console.log(`[probe2] fetch(\`\${basePath}/data/library.json\`) after ${dt.toFixed(0)} ms ->`, result);
}

async function probe3_readFileSync() {
  const t0 = performance.now();
  try {
    const filePath = join(process.cwd(), 'data', 'library.json');
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    console.log(`[probe3] readFileSync OK after ${(performance.now() - t0).toFixed(0)} ms; ${parsed.repos?.length ?? '?'} repos`);
  } catch (err) {
    console.log(`[probe3] readFileSync error after ${(performance.now() - t0).toFixed(0)} ms ->`, err.message);
  }
}

async function probe4_jsonProviderGetRepo() {
  // Import the actual provider via tsx so we exercise the production code path.
  const t0 = performance.now();
  try {
    const mod = await import('../src/lib/dataProvider.ts');
    const { createDataProvider } = mod;
    const provider = createDataProvider();
    console.log(`[probe4] provider.mode = ${provider.mode}`);
    const result = await withTimeout(provider.getRepo('build-your-own-x'), 5000, 'provider.getRepo');
    const dt = performance.now() - t0;
    console.log(`[probe4] provider.getRepo('build-your-own-x') after ${dt.toFixed(0)} ms ->`, result.hung ? 'HUNG' : 'returned');
  } catch (err) {
    console.log(`[probe4] error: ${err.message}`);
  }
}

await probe1_relativeFetch();
await probe2_basePathFetch();
await probe3_readFileSync();
// probe4 needs tsx to resolve the .ts import; skip in plain node.
if (process.argv.includes('--full')) {
  await probe4_jsonProviderGetRepo();
}
