/**
 * generate-sitemap.ts
 * Generates public/sitemap.xml from the repo library.
 * Run: npx tsx scripts/generate-sitemap.ts
 * Or: automatically called during build via prebuild script.
 *
 * SECURITY (2026-04-28 hotfix): every repo entry passes through the shared
 * privacy filter before any URL is emitted. If fetch-library.ts is bypassed
 * for any reason — restored snapshot, manual edit, partial regeneration —
 * sitemap.xml still fails closed (throws MissingPrivacyFieldError) rather
 * than leak private repo paths.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MissingPrivacyFieldError } from './lib/privacy-filter';
import {
  publicRepoNamesFromLibrary,
  type SitemapRepoEntry,
} from './lib/sitemap';

const BASE_URL = 'https://www.reporium.com';
const OUT_FILE = join(process.cwd(), 'public', 'sitemap.xml');
const LIBRARY_FILE = join(process.cwd(), 'public', 'data', 'library.json');

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
    const data = JSON.parse(readFileSync(LIBRARY_FILE, 'utf-8')) as {
      repos: SitemapRepoEntry[];
    };
    repoNames = publicRepoNamesFromLibrary(data.repos);
    const dropped = data.repos.length - repoNames.length;
    console.log(
      `Loaded ${repoNames.length} repos from library.json` +
        (dropped > 0 ? ` (${dropped} dropped by privacy filter)` : ''),
    );
  } catch (e) {
    if (e instanceof MissingPrivacyFieldError) {
      console.error(
        '[generate-sitemap] FATAL: privacy field missing on repos in library.json — refusing to emit sitemap.',
      );
      console.error(`[generate-sitemap] ${e.message}`);
      console.error(
        '[generate-sitemap] Fix: re-run npm run generate:resilient so fetch-library.ts re-validates the API payload.',
      );
      process.exit(2);
    }
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
