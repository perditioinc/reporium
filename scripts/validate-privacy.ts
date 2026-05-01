#!/usr/bin/env npx tsx
/**
 * validate-privacy.ts — P0 hotfix 2026-04-28 (BLOCKING gate).
 *
 * Reads public/data/library.json and refuses to let the build continue if any
 * private repo could be emitted publicly. Smaller and stricter than
 * validate-library.ts: this runner has ZERO warn-only paths — every gate is
 * blocking (process.exit non-zero).
 *
 * Wired into the build chain via package.json `prebuild` so every Vercel
 * deploy (preview + production) re-validates the committed library.json
 * before next build copies it into the static export.
 *
 * Run: npx tsx scripts/validate-privacy.ts
 * Or:  npm run validate:privacy
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  classifyPrivacy,
  LEGACY_PRIVATE_BLOCKLIST,
  type PrivacyEvaluable,
} from './lib/privacy-filter';

// KAN-132: cover BOTH static-export source paths.
//   - public/data/library.json: served as a static asset, ships in the
//     Vercel/static build output. This is the primary leak surface.
//   - public/data/owned.json:  the owned-repos sidecar, same asset path.
//   - data/library.json:        synthesized by scripts/sync-data-dir.cjs
//     during prebuild and read at runtime by generateStaticParams /
//     getRepoDetail's local-fallback path. Today the sync runs AFTER
//     this validator, so the two artifacts are identical at validation
//     time, but a future re-ordering of build steps would silently
//     bypass the gate. Validating both pins the contract.
const FILES_TO_CHECK = [
  path.join(process.cwd(), 'public', 'data', 'library.json'),
  path.join(process.cwd(), 'public', 'data', 'owned.json'),
  path.join(process.cwd(), 'data', 'library.json'),
];

let hadFailure = false;

for (const filePath of FILES_TO_CHECK) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[validate-privacy] skip — ${filePath} not found`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let parsed: { repos?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[validate-privacy] FATAL: ${filePath} is not valid JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  const repos = (parsed.repos ?? []) as PrivacyEvaluable[];
  if (!Array.isArray(repos)) {
    console.error(`[validate-privacy] FATAL: ${filePath} has no repos[] array`);
    process.exit(1);
  }

  const errors: string[] = [];

  // Gate 1 — static blocklist.
  const blockListed = repos.filter(r => r.fullName && LEGACY_PRIVATE_BLOCKLIST.has(r.fullName));
  if (blockListed.length > 0) {
    errors.push(
      `STATIC-BLOCKLIST hit: ${blockListed.length} known-private repo(s) present — ` +
      `${blockListed.map(r => r.fullName).join(', ')}`,
    );
  }

  // Gate 2 — structural privacy field presence.
  const missingField = repos.filter(r => classifyPrivacy(r) === 'unknown');
  if (missingField.length > 0) {
    errors.push(
      `PRIVACY FIELD MISSING on ${missingField.length}/${repos.length} repos — ` +
      `cannot verify leak-free. Sample: ` +
      `${missingField.slice(0, 5).map(r => r.fullName ?? r.name ?? '<unnamed>').join(', ')}. ` +
      `Fix: reporium-api /library/full must emit isPrivate / private / visibility on every repo.`,
    );
  }

  // Gate 3 — private-verdict survivors.
  const privateVerdict = repos.filter(r => classifyPrivacy(r) === 'private');
  if (privateVerdict.length > 0) {
    errors.push(
      `PRIVATE-VERDICT survivors: ${privateVerdict.length} — ` +
      `${privateVerdict.slice(0, 5).map(r => r.fullName ?? r.name ?? '<unnamed>').join(', ')}`,
    );
  }

  if (errors.length > 0) {
    hadFailure = true;
    console.error(`[validate-privacy] FAIL — ${filePath}`);
    errors.forEach(e => console.error(`   · ${e}`));
  } else {
    console.log(`[validate-privacy] OK  — ${filePath} (${repos.length} repos)`);
  }
}

if (hadFailure) {
  console.error('[validate-privacy] BUILD HALTED — fix the above before shipping.');
  process.exit(1);
}

console.log('[validate-privacy] all artifacts pass privacy gates.');
