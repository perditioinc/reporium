/**
 * postbuild: strip-large-static-json.cjs
 *
 * After `next build` (output:export) copies public/ → out/, remove the two
 * large JSON files that must NOT be served as static assets:
 *   - out/data/library.json  (~27 MB)
 *   - out/data/owned.json    (~8.5 MB)
 *
 * These files are now fetched from the reporium-api at runtime. Serving them
 * from Vercel CDN caused ~20 s blocking downloads on first paint over 4G.
 *
 * Smaller files (gaps.json ~14 KB, trends.json ~5 KB) are kept — they are
 * still fetched by the JsonDataProvider fallback paths and are negligible.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(process.cwd(), 'out');
const LARGE_FILES = ['library.json', 'owned.json'];

// Next.js output:export puts public/ contents directly into out/ (no subdir).
// data/ files land at out/data/.
const DATA_DIR = path.join(OUT_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) {
  console.log('[strip-large-static-json] out/data/ not found — nothing to strip');
  process.exit(0);
}

let stripped = 0;
for (const file of LARGE_FILES) {
  const target = path.join(DATA_DIR, file);
  if (!fs.existsSync(target)) {
    console.log(`[strip-large-static-json] ${file} not in out/data/ — skip`);
    continue;
  }
  const size = (fs.statSync(target).size / 1024 / 1024).toFixed(1);
  fs.unlinkSync(target);
  console.log(`[strip-large-static-json] removed out/data/${file} (${size} MB)`);
  stripped++;
}

console.log(`[strip-large-static-json] done — stripped ${stripped} file(s) from static output`);
