/**
 * prebuild: sync-data-dir.cjs
 *
 * Copies public/data/{library,owned,gaps,trends}.json → data/ so that
 * SSG readFileSync calls (wiki, repo pages, cli, mcp) can find the files
 * at process.cwd()/data/ without those files being auto-served as static
 * assets by Next.js output:export.
 *
 * The generate scripts continue writing to public/data/ as the canonical
 * source; this script bridges the gap at build time.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(process.cwd(), 'public', 'data');
const DST_DIR = path.join(process.cwd(), 'data');

const FILES = ['library.json', 'owned.json', 'gaps.json', 'trends.json'];

if (!fs.existsSync(DST_DIR)) {
  fs.mkdirSync(DST_DIR, { recursive: true });
}

let copied = 0;
for (const file of FILES) {
  const src = path.join(SRC_DIR, file);
  const dst = path.join(DST_DIR, file);
  if (!fs.existsSync(src)) {
    console.warn(`[sync-data-dir] skipping ${file} — not found in public/data/`);
    continue;
  }
  fs.copyFileSync(src, dst);
  const size = (fs.statSync(src).size / 1024 / 1024).toFixed(1);
  console.log(`[sync-data-dir] copied ${file} (${size} MB) → data/`);
  copied++;
}

console.log(`[sync-data-dir] done — ${copied}/${FILES.length} files synced`);
