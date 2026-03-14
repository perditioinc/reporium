#!/usr/bin/env npx tsx
/**
 * build-gap-analysis.ts
 *
 * Standalone script that reads library.json and outputs gap analysis.
 * The gap analysis is also embedded in library.json by generate-library.ts.
 * This script is useful for manual inspection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LibraryData } from '../src/types/repo';
import { buildGapAnalysis } from '../src/lib/buildGapAnalysis';

const libraryPath = path.join(process.cwd(), 'public', 'data', 'library.json');
if (!fs.existsSync(libraryPath)) {
  console.error('❌ library.json not found. Run: npm run generate');
  process.exit(1);
}

const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8')) as LibraryData;
const gapAnalysis = buildGapAnalysis(library.repos);

console.log(`\n🕳️  Gap Analysis for ${library.username}\n`);
for (const gap of gapAnalysis.gaps) {
  console.log(`${gap.category} (${gap.yourRepoCount} repos)`);
  console.log(`  ${gap.description}`);
  if (gap.popularMissingRepos.length > 0) {
    console.log(`  Missing: ${gap.popularMissingRepos.map(r => `${r.name} (⭐${(r.stars/1000).toFixed(0)}k)`).join(', ')}`);
  }
  console.log();
}

// Write gaps.json for the rebuild script freshness check and UI consumption
const outDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'gaps.json');
fs.writeFileSync(outPath, JSON.stringify(gapAnalysis, null, 2));
console.log(`📁 Output: ${outPath}`);
