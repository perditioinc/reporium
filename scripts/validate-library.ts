#!/usr/bin/env npx tsx
/**
 * validate-library.ts
 * Validates public/data/library.json for data quality regressions.
 * Exits with code 1 if validation fails — use before committing generated data.
 *
 * Run: npx tsx scripts/validate-library.ts
 * Or via npm: npm run validate
 */

import * as fs from 'fs';
import * as path from 'path';
import { LibraryData } from '../src/types/repo';

const libraryPath = path.join(process.cwd(), 'public', 'data', 'library.json');

if (!fs.existsSync(libraryPath)) {
  console.error('❌ library.json not found — run npm run generate first');
  process.exit(1);
}

const data: LibraryData = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
const errors: string[] = [];
const warnings: string[] = [];

// 1. Forked repos must not show the library owner as builder
// Only check repos where forkedFrom is known — null forkedFrom means we have no data to derive the right builder (DB gap).
const wrongBuilders = data.repos.filter(r =>
  r.isFork && r.forkedFrom && r.builders[0]?.login === data.username
);
if (wrongBuilders.length > 0) {
  errors.push(`${wrongBuilders.length} forked repos showing wrong builder (${data.username}): ${wrongBuilders.slice(0, 3).map(r => r.name).join(', ')}...`);
}

// 1b. Forked repos must have forkedFrom populated (null = fork info fetch failed)
// Threshold is generous because the DB-driven fetch (fetch-library.ts) relies on
// forked_from being backfilled in the DB — some repos may legitimately be missing it.
// Run scripts/backfill_forked_from.py (reporium-ingestion) to fix DB gaps.
const nullForkedFrom = data.repos.filter(r => r.isFork && !r.forkedFrom);
if (nullForkedFrom.length > 100) {
  errors.push(`${nullForkedFrom.length} forked repos have null forkedFrom — fork info fetch likely failed. Run npm run generate:full`);
} else if (nullForkedFrom.length > 0) {
  warnings.push(`${nullForkedFrom.length} forked repos have null forkedFrom (run backfill_forked_from.py to fix DB gaps)`);
}

// 2. Forked repos should have forkedAt date.
// Percentage-based threshold (not absolute) — bulk-imported forks may legitimately
// lack forkedAt if the GraphQL parentage hydration didn't run. The absolute
// "raise the number" approach fails as the corpus grows: 200 out of 1000 is 20%
// (degraded) but 200 out of 1500 is 13% (fine). Use fork-relative percentages:
//   · 0 %        → silent pass
//   · 0 < x ≤ 15% → warning (expected DB backfill lag)
//   · 15 < x ≤ 20% → warning (flag; backfill getting behind)
//   · x > 20%    → error (pipeline regression — fetch-library.ts skipping forkedAt)
// Backfill with scripts/backfill_forked_from.py (reporium-ingestion). Raising an
// absolute cap is a tempting shortcut but hides the real signal: "what % of forks
// in this dataset are missing forkedAt right now?"
const totalForks = data.repos.filter(r => r.isFork).length;
const missingForkedAt = data.repos.filter(r => r.isFork && !r.forkedAt);
const missingForkedAtPct = totalForks === 0 ? 0 : missingForkedAt.length / totalForks;
if (missingForkedAtPct > 0.20) {
  errors.push(`${missingForkedAt.length}/${totalForks} forked repos missing forkedAt date (${(missingForkedAtPct * 100).toFixed(1)}% — above 20% error threshold; likely pipeline regression)`);
} else if (missingForkedAtPct > 0.15) {
  warnings.push(`${missingForkedAt.length}/${totalForks} forked repos missing forkedAt date (${(missingForkedAtPct * 100).toFixed(1)}% — above 15% warn threshold; schedule backfill)`);
} else if (missingForkedAt.length > 0) {
  warnings.push(`${missingForkedAt.length}/${totalForks} forked repos missing forkedAt date (${(missingForkedAtPct * 100).toFixed(1)}% — within tolerance, run backfill_forked_from.py when convenient)`);
}

// 3. Enriched-tags coverage check. Enrichment is an async background
// pipeline that naturally lags behind ingestion (newly added repos take
// a tier to get classified). Only treat this as a hard error when the
// gap crosses 25% of the corpus — a true pipeline break — otherwise warn
// so the nightly refresh cron can still commit fresh data.
const noTags = data.repos.filter(r => r.enrichedTags.length === 0);
const noTagsPct = data.repos.length === 0 ? 0 : noTags.length / data.repos.length;
if (noTagsPct > 0.25) {
  errors.push(`${noTags.length}/${data.repos.length} repos have no enriched tags (${(noTagsPct * 100).toFixed(1)}% — likely pipeline break)`);
} else if (noTags.length > 0) {
  warnings.push(`${noTags.length}/${data.repos.length} repos have no enriched tags (${(noTagsPct * 100).toFixed(1)}% — enrichment lag, not blocking)`);
}

// 4. Stats sanity check
if (data.stats.total !== data.repos.length) {
  errors.push(`stats.total (${data.stats.total}) does not match repos.length (${data.repos.length})`);
}

// 5. Categories must be <= 70 (buildCategories.ts defines 68 categories)
if (data.categories.length > 70) {
  errors.push(`${data.categories.length} categories found — must be ≤ 70`);
}

// 6. Every repo must have a fullName
const missingFullName = data.repos.filter(r => !r.fullName);
if (missingFullName.length > 0) {
  errors.push(`${missingFullName.length} repos missing fullName`);
}

// Report
if (warnings.length > 0) {
  console.warn('⚠️  Warnings:');
  warnings.forEach(w => console.warn(`   · ${w}`));
}

if (errors.length > 0) {
  console.error('❌ Validation failed:');
  errors.forEach(e => console.error(`   · ${e}`));
  process.exit(1);
}

console.log(`✅ Library validation passed — ${data.repos.length} repos, ${data.categories.length} categories`);
