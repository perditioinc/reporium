// Smoke-test fixture loader.
//
// Smoke tests use the live generated library at public/data/library.json so we
// never hand-author repo names. Refreshes daily (chore: refresh library data
// commits) — tests pick whatever is real today.

import { readFileSync } from 'fs';
import { join } from 'path';
import type { LibraryData, EnrichedRepo } from '@/types/repo';

const LIBRARY_PATH = join(process.cwd(), 'public', 'data', 'library.json');

let cached: LibraryData | null = null;

export function loadLibraryFixture(): LibraryData {
  if (cached) return cached;
  const raw = readFileSync(LIBRARY_PATH, 'utf-8');
  cached = JSON.parse(raw) as LibraryData;
  return cached;
}

// Pick a stable repo for tests that need a single sample. We use the first
// item in the array — which has a deterministic position within a given
// generated build — and validate it has the minimum fields needed for the
// surfaces under test.
export function pickSmokeRepo(): EnrichedRepo {
  const lib = loadLibraryFixture();
  const repo = lib.repos[0];
  if (!repo) {
    throw new Error('library.json contains no repos — fixture cannot be picked');
  }
  if (!repo.name) {
    throw new Error('library.json repos[0] has no name field');
  }
  return repo;
}
