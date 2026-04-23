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

// 7. PRIVATE-REPO LEAK GUARDRAIL — 2026-04-23 incident.
//
// The reporium-api `/library/full` endpoint leaked 44 private perditioinc repos
// into library.json at 2026-04-23T05:03:48 UTC (served publicly for ~10 minutes
// on reporium.com before takedown). The root cause was a missing
// `WHERE is_private = false` in the API query; the API also strips the
// `isPrivate` flag from responses, so the client has no structural signal to
// filter on.
//
// This check is the HARD GUARDRAIL: if any known-private repo name appears in
// library.json, CI fails — the build does not ship. Update this list whenever
// private repos are added via:
//   gh repo list perditioinc --visibility=private -L 500 \
//     --json nameWithOwner -q '.[].nameWithOwner'
//
// A new private repo that isn't on this list would still slip through, which is
// why there's also a defensive filter in fetch-library.ts AND the primary
// WHERE-clause fix belongs in reporium-api. Three layers, because one layer
// already failed once.
const PRIVATE_REPO_BLOCKLIST = new Set<string>([
  'perditioinc/18degrees-ecom',
  'perditioinc/aa-backend-interview-template-main',
  'perditioinc/anomra',
  'perditioinc/anomra-api',
  'perditioinc/anomra-website',
  'perditioinc/didymo-ai-agent',
  'perditioinc/didymo-ai-api',
  'perditioinc/didymo-ai-auth',
  'perditioinc/didymo-ai-gcp-tts',
  'perditioinc/didymo-ai-ingest',
  'perditioinc/didymo-ai-mini',
  'perditioinc/didymo-ai-openai-stt',
  'perditioinc/didymo-ai-openai-tts',
  'perditioinc/didymo-ai-ptr',
  'perditioinc/didymo-ai-services-lab',
  'perditioinc/didymo-ai-studio',
  'perditioinc/didymo-ai-submissions-website',
  'perditioinc/didymo-ai-usage',
  'perditioinc/didymo-ai-vector',
  'perditioinc/didymo-ai-webgl',
  'perditioinc/didymo-ai-webgl-v2',
  'perditioinc/didymo-ai-website',
  'perditioinc/digital-panda-planner',
  'perditioinc/event-schedule-generator',
  'perditioinc/figma-make-perditio-website-claude',
  'perditioinc/giveaway-generator',
  'perditioinc/ideas-2026',
  'perditioinc/mind-guard-app',
  'perditioinc/perditio-figma-website',
  'perditioinc/perditio-infra',
  'perditioinc/perditio-platform-api',
  'perditioinc/perditio-services',
  'perditioinc/perditio-style-guide',
  'perditioinc/perditio-web',
  'perditioinc/perditio-web-app',
  'perditioinc/perditio-website',
  'perditioinc/perditioinc.github.io',
  'perditioinc/reporium-evals',
  'perditioinc/simon-brain',
  'perditioinc/ticket-generator',
  'perditioinc/ticket-issuer',
  'perditioinc/v0-edm-demo-submission-website',
  'perditioinc/whatsapp-template-generator',
  'perditioinc/whatsapp-webhook',
]);

const leakedPrivate = data.repos.filter(r => PRIVATE_REPO_BLOCKLIST.has(r.fullName));
if (leakedPrivate.length > 0) {
  errors.push(
    `🚨 PRIVATE REPO LEAK: ${leakedPrivate.length} private repo(s) in library.json — ` +
    `DO NOT SHIP. Names: ${leakedPrivate.map(r => r.fullName).join(', ')}. ` +
    `Cause is likely a server-side filter regression in reporium-api /library/full.`
  );
}

// 7b. Defensive: if an `isPrivate` flag survives into output at all, fail.
// The API strips this field, so presence-with-truthy means something leaked
// it back in — either a new API code path or an older cached file merged in.
const isPrivateTrue = data.repos.filter(r => (r as unknown as { isPrivate?: boolean }).isPrivate === true);
if (isPrivateTrue.length > 0) {
  errors.push(
    `🚨 isPrivate=true present on ${isPrivateTrue.length} repos — ` +
    `${isPrivateTrue.slice(0, 5).map(r => r.fullName).join(', ')}...`
  );
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
