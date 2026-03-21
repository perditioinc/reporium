#!/usr/bin/env npx tsx
/**
 * fix-fork-info.ts
 *
 * Targeted repair script — fetches missing forkedFrom data for repos where
 * isFork is true but forkedFrom is null.
 *
 * Makes ONE API call per broken repo: GET /repos/{username}/{repoName}
 * and extracts parent.full_name from the response.
 *
 * Run: npm run fix-fork-info
 *
 * Required env vars:
 *   GH_USERNAME - whose repos to fix (default: perditioinc)
 *   GH_TOKEN    - GitHub PAT for 5000 req/hour rate limit
 */

import * as fs from 'fs';
import * as path from 'path';
import { KNOWN_ORGS, buildBuilderStats } from '../src/lib/buildTaxonomy';
import { LibraryData, Builder } from '../src/types/repo';

// Load .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

const username = process.env.GH_USERNAME || 'perditioinc';
const token = process.env.GH_TOKEN || undefined;

const libraryPath = path.join(process.cwd(), 'public', 'data', 'library.json');

if (!fs.existsSync(libraryPath)) {
  console.error('❌ public/data/library.json not found — run npm run generate first');
  process.exit(1);
}

const data: LibraryData = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));

const broken = data.repos.filter(r => r.isFork && !r.forkedFrom);
console.log(`🔍 Found ${broken.length} forked repos with null forkedFrom`);

if (broken.length === 0) {
  console.log('✅ Nothing to fix.');
  process.exit(0);
}

/** Build auth headers */
function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Accept': 'application/vnd.github+json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Fetch parent.full_name for a fork via the single-repo endpoint */
async function fetchParentFullName(repoName: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${username}/${repoName}`;
  const res = await fetch(url, { headers: headers() });

  if (res.status === 429 || res.status === 403) {
    // Rate limited — wait 30s and retry once
    console.warn(`   ⚠️  Rate limited on ${repoName} — waiting 30s...`);
    await new Promise(r => setTimeout(r, 30_000));
    const retry = await fetch(url, { headers: headers() });
    if (!retry.ok) {
      console.error(`   ❌ Retry failed for ${repoName}: ${retry.status}`);
      return null;
    }
    const retryJson = await retry.json() as { parent?: { full_name: string } };
    return retryJson.parent?.full_name ?? null;
  }

  if (!res.ok) {
    console.error(`   ❌ Failed to fetch ${repoName}: ${res.status}`);
    return null;
  }

  const json = await res.json() as { parent?: { full_name: string } };
  return json.parent?.full_name ?? null;
}

/** Build a Builder from an owner login */
function makeBuilder(login: string): Builder {
  const key = login.toLowerCase();
  const knownOrg = KNOWN_ORGS[key];
  return {
    login,
    name: knownOrg?.displayName ?? login,
    type: knownOrg ? 'organization' : 'user',
    avatarUrl: `https://avatars.githubusercontent.com/${login}`,
    isKnownOrg: !!knownOrg,
    orgCategory: knownOrg?.category ?? 'individual',
  };
}

const CONCURRENCY = 2;
const DELAY_MS = 500;

async function run(): Promise<void> {
  let fixed = 0;
  let failed = 0;

  // Build a lookup map from repo name to index in data.repos
  const repoIndexMap = new Map<string, number>();
  data.repos.forEach((r, i) => repoIndexMap.set(r.name, i));

  // Process in batches of CONCURRENCY with a delay between batches
  for (let i = 0; i < broken.length; i += CONCURRENCY) {
    const batch = broken.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (repo) => {
        const parentFullName = await fetchParentFullName(repo.name);
        return { repo, parentFullName };
      })
    );

    for (const { repo, parentFullName } of results) {
      const idx = repoIndexMap.get(repo.name);
      if (idx === undefined) continue;

      if (parentFullName) {
        const upstreamOwner = parentFullName.split('/')[0];
        data.repos[idx] = {
          ...data.repos[idx],
          forkedFrom: parentFullName,
          builders: [makeBuilder(upstreamOwner)],
        };
        fixed++;
        if (fixed % 50 === 0) {
          console.log(`   ↳ ${fixed}/${broken.length} fixed...`);
        }
      } else {
        failed++;
      }
    }

    // Delay between batches (skip delay after last batch)
    if (i + CONCURRENCY < broken.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  // Recompute builderStats from corrected data
  data.builderStats = buildBuilderStats(data.repos);

  fs.writeFileSync(libraryPath, JSON.stringify(data, null, 2));

  console.log(`\n✅ fix-fork-info complete`);
  console.log(`   · ${fixed} repos fixed`);
  console.log(`   · ${failed} repos failed (API error)`);
  console.log(`   · ${data.builderStats.length} unique builders after recompute`);
}

run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
