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
const wrongBuilders = data.repos.filter(r =>
  r.isFork && r.builders[0]?.login === data.username
);
if (wrongBuilders.length > 0) {
  errors.push(`${wrongBuilders.length} forked repos showing wrong builder (${data.username}): ${wrongBuilders.slice(0, 3).map(r => r.name).join(', ')}...`);
}

// 1b. Forked repos must have forkedFrom populated (null = fork info fetch failed)
const nullForkedFrom = data.repos.filter(r => r.isFork && !r.forkedFrom);
if (nullForkedFrom.length > 10) {
  errors.push(`${nullForkedFrom.length} forked repos have null forkedFrom — fork info fetch likely failed. Run npm run generate:full`);
} else if (nullForkedFrom.length > 0) {
  warnings.push(`${nullForkedFrom.length} forked repos have null forkedFrom`);
}

// 2. Forked repos should have forkedAt date
const missingForkedAt = data.repos.filter(r => r.isFork && !r.forkedAt);
if (missingForkedAt.length > 5) {
  errors.push(`${missingForkedAt.length} forked repos missing forkedAt date`);
} else if (missingForkedAt.length > 0) {
  warnings.push(`${missingForkedAt.length} forked repos missing forkedAt date`);
}

// 3. No repo should have zero tags (more than 10 is a sign of a pipeline bug)
const noTags = data.repos.filter(r => r.enrichedTags.length === 0);
if (noTags.length > 10) {
  errors.push(`${noTags.length} repos have no enriched tags`);
} else if (noTags.length > 0) {
  warnings.push(`${noTags.length} repos have no enriched tags`);
}

// 4. Stats sanity check
if (data.stats.total !== data.repos.length) {
  errors.push(`stats.total (${data.stats.total}) does not match repos.length (${data.repos.length})`);
}

// 5. Categories must be <= 21
if (data.categories.length > 21) {
  errors.push(`${data.categories.length} categories found — must be ≤ 21`);
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
