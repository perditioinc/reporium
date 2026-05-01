/** @jest-environment node */

// Smoke: the /repo/[name] page can resolve a real repo from the local
// fixture, generate static params, and produce valid metadata.
//
// /repo/[name]/page.tsx is a server component that reads from
// data/library.json (synced from public/data/ at prebuild time). The page
// is hard to render in jsdom, so we exercise the two pure functions it
// exports — generateStaticParams() and generateMetadata() — which together
// cover the page's data-binding contract.

import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import { loadLibraryFixture } from './_fixtures';

const DATA_DIR = join(process.cwd(), 'data');
const SOURCE = join(process.cwd(), 'public', 'data', 'library.json');
const DEST = join(DATA_DIR, 'library.json');

// Ensure data/library.json exists — prebuild normally syncs it. In a fresh
// checkout (or `npm test` without `npm run build`) the sync hasn't run, so
// we replicate it here.
beforeAll(() => {
  if (!existsSync(DEST)) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(SOURCE)) copyFileSync(SOURCE, DEST);
  }
});

describe('smoke: repo detail page', () => {
  test('generateStaticParams returns the names from the live library', async () => {
    const lib = loadLibraryFixture();
    expect(lib.repos.length).toBeGreaterThan(0);

    const mod = require('@/app/repo/[name]/page');
    const params = await mod.generateStaticParams();

    expect(Array.isArray(params)).toBe(true);
    // Every entry must have a `name` field — that's the dynamic-route shape.
    expect(params.length).toBeGreaterThan(0);
    expect(params[0]).toHaveProperty('name');
    expect(typeof params[0].name).toBe('string');
  });

  test('generateMetadata produces a title and description for a real repo', async () => {
    const lib = loadLibraryFixture();
    const sampleName = lib.repos[0].name;

    const mod = require('@/app/repo/[name]/page');
    const metadata = await mod.generateMetadata({
      params: Promise.resolve({ name: sampleName }),
    });

    expect(metadata).toBeTruthy();
    // The page formats the title as "<owner>/<name>" — the repo name has to
    // end up in the title somewhere, otherwise we are looking at a 404 page
    // metadata, which would be the regression we want to catch.
    expect(typeof metadata.title).toBe('string');
    expect(metadata.title).toContain(sampleName);
    expect(typeof metadata.description).toBe('string');
    expect(metadata.description.length).toBeGreaterThan(0);
    // OpenGraph URL must include the encoded repo name — guards against the
    // "wrong canonical URL" regression.
    expect(metadata.openGraph?.url).toContain(encodeURIComponent(sampleName));
  });
});
