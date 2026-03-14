#!/usr/bin/env node
/**
 * Reporium CLI
 *
 * Usage:
 *   npx tsx src/cli/index.ts generate    — fetch and enrich all repos
 *   npx tsx src/cli/index.ts stats       — show library stats
 *   npx tsx src/cli/index.ts search <q>  — search repos
 *   npx tsx src/cli/index.ts outdated    — show outdated forks
 *   npx tsx src/cli/index.ts mcp         — start MCP server
 */

import * as fs from 'fs';
import * as path from 'path';
import { LibraryData } from '../types/repo.js';

function loadLibrary(): LibraryData {
  const p = path.join(process.cwd(), 'public', 'data', 'library.json');
  if (!fs.existsSync(p)) {
    console.error('library.json not found. Run: npm run generate');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}

const [,, command, ...rest] = process.argv;

if (command === 'stats') {
  const lib = loadLibrary();
  const syncCounts = { 'up-to-date': 0, behind: 0, ahead: 0, diverged: 0, unknown: 0 };
  for (const r of lib.repos) {
    const state = r.forkSync?.state ?? 'unknown';
    (syncCounts as Record<string, number>)[state] = ((syncCounts as Record<string, number>)[state] ?? 0) + 1;
  }
  const mostOutdated = [...lib.repos]
    .filter(r => r.forkSync?.state === 'behind')
    .sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0))
    .slice(0, 5);

  console.log(`\nReporium — ${lib.username}'s Library`);
  console.log(`   Generated: ${new Date(lib.generatedAt).toLocaleString()}\n`);
  console.log(`${lib.stats.total} repos total`);
  console.log(`  · ${lib.stats.built} built by you`);
  console.log(`  · ${lib.stats.forked} forked\n`);
  console.log('By category:');
  for (const cat of lib.categories.slice(0, 6)) {
    console.log(`  ${cat.icon} ${cat.name.padEnd(24)} ${cat.repoCount} repos`);
  }
  console.log('\nSync health:');
  console.log(`  Up to date       ${syncCounts['up-to-date']} repos`);
  console.log(`  Behind           ${syncCounts['behind']} repos`);
  console.log(`  Unknown          ${syncCounts['unknown']} repos`);
  if (mostOutdated.length > 0) {
    console.log('\nMost outdated:');
    for (const r of mostOutdated) {
      console.log(`  ${r.name.padEnd(30)} behind ${r.forkSync?.behindBy} commits`);
    }
  }
  console.log();

} else if (command === 'search') {
  const query = rest.join(' ');
  if (!query) { console.error('Usage: reporium search <query>'); process.exit(1); }
  const lib = loadLibrary();
  const q = query.toLowerCase();
  const terms = q.split(/\s+/);
  const scored = lib.repos
    .map(r => {
      let score = 0;
      for (const term of terms) {
        if (r.name.toLowerCase().includes(term)) score += 3;
        if ((r.description ?? '').toLowerCase().includes(term)) score += 2;
        if (r.enrichedTags.some(t => t.toLowerCase().includes(term))) score += 2;
        if (r.primaryCategory.toLowerCase().includes(term)) score += 1;
      }
      return { repo: r, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  console.log(`\nFound ${scored.length} repos matching "${query}":\n`);
  scored.forEach(({ repo }, i) => {
    const stars = repo.parentStats?.stars ?? repo.stars;
    console.log(`${i + 1}. ${repo.name} * ${formatStars(stars)}`);
    if (repo.description) console.log(`   ${repo.description}`);
    console.log(`   ${repo.enrichedTags.slice(0, 4).join(' · ')}`);
    const sync = repo.forkSync?.state === 'behind' ? `Behind by ${repo.forkSync.behindBy}` : repo.forkSync?.state ?? 'unknown';
    console.log(`   ${sync}\n`);
  });

} else if (command === 'outdated') {
  const lib = loadLibrary();
  const outdated = lib.repos
    .filter(r => r.forkSync?.state === 'behind' && (r.forkSync?.behindBy ?? 0) >= 50)
    .sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0));

  console.log(`\nMost outdated forks (behind 50+ commits):\n`);
  outdated.slice(0, 15).forEach((r, i) => {
    const behindBy = r.forkSync?.behindBy ?? 0;
    console.log(`${i + 1}. ${r.name.padEnd(35)} ${behindBy} commits behind`);
  });
  console.log();

} else if (command === 'mcp') {
  // Delegate to mcp index
  import('child_process').then(({ execSync }) => {
    execSync('npx tsx src/mcp/index.ts', { stdio: 'inherit', cwd: process.cwd() });
  });

} else if (command === 'generate') {
  // Delegate to generate script
  import('child_process').then(({ execSync }) => {
    execSync('npx tsx scripts/generate-library.ts', { stdio: 'inherit', cwd: process.cwd() });
  });

} else {
  console.log(`
Reporium CLI

Usage:
  npx tsx src/cli/index.ts stats              Library overview
  npx tsx src/cli/index.ts search <query>     Search your repos
  npx tsx src/cli/index.ts outdated           Show outdated forks
  npx tsx src/cli/index.ts generate           Generate/refresh library data
  npx tsx src/cli/index.ts mcp               Start MCP server
  `);
}
