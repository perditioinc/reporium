/**
 * KAN-172 prebuild: build-repo-slugs.cjs
 *
 * Extracts the public-repo slug allowlist from public/data/library.json into a
 * slim JSON file (data/repo-slugs.json) consumed by middleware.ts. The full
 * library.json is ~28 MB; the Edge Runtime has a hard ~1 MB bundle limit, so
 * middleware can't import it directly. We pre-compute the minimal data the
 * middleware needs — just an array of allowed slug strings.
 *
 * Privacy guard: only repos with isPrivate === false land in the allowlist.
 * This pairs with reporium-api#450 (centralized public_repo_filter) and
 * reporium#278 (static-artifact validator) — KAN-172 closes the gap that
 * unknown / private slugs were getting HTTP 200 from Vercel's dynamic
 * prerender fallback.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(process.cwd(), 'public', 'data', 'library.json');
const DST = path.join(process.cwd(), 'data', 'repo-slugs.json');

if (!fs.existsSync(SRC)) {
  console.error(`[build-repo-slugs] FATAL: ${SRC} not found. Did generate:resilient run first?`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
const repos = Array.isArray(data?.repos) ? data.repos : [];

if (repos.length === 0) {
  console.error('[build-repo-slugs] FATAL: library.json has zero repos. Refusing to write empty allowlist.');
  process.exit(1);
}

// Privacy guard: only public repos. Treat missing isPrivate as private (fail-closed).
const slugs = repos
  .filter((r) => r && typeof r.name === 'string' && r.isPrivate === false)
  .map((r) => r.name)
  .sort();

const skipped = repos.length - slugs.length;
if (skipped > 0) {
  console.warn(`[build-repo-slugs] skipped ${skipped} repo(s) (private or malformed)`);
}

if (!fs.existsSync(path.dirname(DST))) {
  fs.mkdirSync(path.dirname(DST), { recursive: true });
}

fs.writeFileSync(DST, JSON.stringify(slugs), 'utf-8');
const sizeKb = (fs.statSync(DST).size / 1024).toFixed(1);
console.log(`[build-repo-slugs] wrote ${slugs.length} public slug(s) to ${DST} (${sizeKb} KB)`);
