/**
 * generate-sitemap.ts
 * Generates public/sitemap.xml from the repo library.
 * Run: npx tsx scripts/generate-sitemap.ts
 * Or: automatically called during build via prebuild script.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://www.reporium.com';
const OUT_FILE = join(process.cwd(), 'public', 'sitemap.xml');
const LIBRARY_FILE = join(process.cwd(), 'public', 'data', 'library.json');

interface LibraryEntry {
  name: string;
}

function escape(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function urlEntry(url: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${escape(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function main() {
  const today = new Date().toISOString().split('T')[0];

  let repoNames: string[] = [];
  try {
    const data = JSON.parse(readFileSync(LIBRARY_FILE, 'utf-8')) as { repos: LibraryEntry[] };
    repoNames = data.repos.map((r) => r.name);
    console.log(`Loaded ${repoNames.length} repos from library.json`);
  } catch (e) {
    console.warn('Could not read library.json — sitemap will only include static pages:', e);
  }

  const staticEntries = [
    urlEntry(BASE_URL, today, 'daily', '1.0'),
    urlEntry(`${BASE_URL}/ask`, today, 'weekly', '0.8'),
    urlEntry(`${BASE_URL}/stacks`, today, 'weekly', '0.8'),
    urlEntry(`${BASE_URL}/graph`, today, 'weekly', '0.7'),
    urlEntry(`${BASE_URL}/wiki`, today, 'weekly', '0.7'),
    urlEntry(`${BASE_URL}/wiki/roadmap`, today, 'monthly', '0.5'),
    urlEntry(`${BASE_URL}/taxonomy`, today, 'weekly', '0.6'),
    urlEntry(`${BASE_URL}/runs`, today, 'daily', '0.4'),
  ];

  const repoEntries = repoNames.map((name) =>
    urlEntry(
      `${BASE_URL}/repo/${encodeURIComponent(name)}`,
      today,
      'weekly',
      '0.6',
    )
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...repoEntries].join('\n')}
</urlset>`;

  writeFileSync(OUT_FILE, xml, 'utf-8');
  console.log(`Wrote ${OUT_FILE} (${staticEntries.length + repoEntries.length} URLs)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
