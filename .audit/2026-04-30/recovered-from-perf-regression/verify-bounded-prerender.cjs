#!/usr/bin/env node
/**
 * verify-bounded-prerender.cjs
 *
 * Static verification of ADR-005 bounded-pre-render. Replicates the exact sort
 * + slice logic used in src/app/repo/[name]/page.tsx::generateStaticParams,
 * and prints the route-count delta for both deploy targets. Run without
 * NEXT_RUNTIME so Next.js bookkeeping does not interfere.
 *
 * Usage:
 *   REPORIUM_DEPLOY_TARGET=vercel       node scripts/verify-bounded-prerender.cjs
 *   REPORIUM_DEPLOY_TARGET=github-pages node scripts/verify-bounded-prerender.cjs
 */

const fs = require('fs');
const path = require('path');

const TOP_N_REPOS_FOR_BUILD = Number(process.env.REPORIUM_TOP_N_PREBUILD ?? 250);
const IS_STATIC_EXPORT = (process.env.REPORIUM_DEPLOY_TARGET ?? '') === 'github-pages';

function loadLibrary() {
  const candidates = [
    path.join(process.cwd(), 'data', 'library.json'),
    path.join(process.cwd(), 'public', 'data', 'library.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      return { path: p, data: JSON.parse(raw) };
    }
  }
  throw new Error('library.json not found in data/ or public/data/');
}

function generateStaticParams(repos) {
  if (IS_STATIC_EXPORT) {
    return repos.map((repo) => ({ name: repo.name }));
  }
  const ranked = [...repos].sort((a, b) => {
    const aStars = (a.parentStats && a.parentStats.stars) ?? a.stars ?? 0;
    const bStars = (b.parentStats && b.parentStats.stars) ?? b.stars ?? 0;
    if (bStars !== aStars) return bStars - aStars;
    const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return bTime - aTime;
  });
  return ranked.slice(0, TOP_N_REPOS_FOR_BUILD).map((repo) => ({ name: repo.name }));
}

function summarize(label, params) {
  console.log(`[${label}] route count = ${params.length}`);
  if (params.length === 0) return;
  const head = params.slice(0, 5).map((p) => p.name).join(', ');
  const tail = params.slice(-5).map((p) => p.name).join(', ');
  console.log(`         head: ${head}`);
  console.log(`         tail: ${tail}`);
}

function main() {
  const { path: libPath, data } = loadLibrary();
  const repos = data.repos ?? [];
  console.log(`library: ${libPath}`);
  console.log(`total repos in library: ${repos.length}`);
  console.log(`REPORIUM_DEPLOY_TARGET: ${process.env.REPORIUM_DEPLOY_TARGET || '(unset)'}`);
  console.log(`IS_STATIC_EXPORT: ${IS_STATIC_EXPORT}`);
  console.log(`TOP_N_REPOS_FOR_BUILD: ${TOP_N_REPOS_FOR_BUILD}`);
  console.log('');

  // Show both branches for the report
  const target = process.env.REPORIUM_DEPLOY_TARGET ?? '(unset/default→vercel)';
  process.env.REPORIUM_DEPLOY_TARGET = '';
  const vercelParams = (function () {
    const ranked = [...repos].sort((a, b) => {
      const aStars = (a.parentStats && a.parentStats.stars) ?? a.stars ?? 0;
      const bStars = (b.parentStats && b.parentStats.stars) ?? b.stars ?? 0;
      if (bStars !== aStars) return bStars - aStars;
      const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
      const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      return bTime - aTime;
    });
    return ranked.slice(0, TOP_N_REPOS_FOR_BUILD).map((repo) => ({ name: repo.name }));
  })();
  const githubParams = repos.map((r) => ({ name: r.name }));
  process.env.REPORIUM_DEPLOY_TARGET = target === '(unset/default→vercel)' ? '' : target;

  summarize('vercel       ', vercelParams);
  summarize('github-pages ', githubParams);

  console.log('');
  console.log('Cost-shape collapse (per ADR-005):');
  console.log(`  before:  O(${repos.length} × api_latency × 3)  = ~${repos.length * 3} server fetches/build`);
  console.log(`  after:   O(${vercelParams.length} × api_latency × 1) = ~${vercelParams.length} server fetches/build`);
  console.log(`  delta:   ${repos.length * 3} → ${vercelParams.length} build-time server calls (${Math.round((1 - vercelParams.length / (repos.length * 3)) * 100)}% reduction)`);
  console.log(`  long tail (${repos.length - vercelParams.length} repos) served via on-demand ISR (revalidate=3600 s)`);
}

main();
