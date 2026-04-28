import { readFileSync, statSync } from 'fs';
import { join } from 'path';

interface LibraryArtifact {
  generatedAt?: string;
  repos: Array<Record<string, unknown>>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf-8')) as T;
}

describe('stability: generated public artifacts', () => {
  test('library repos all carry an explicit privacy indicator', () => {
    const library = readJson<LibraryArtifact>('public/data/library.json');
    const missing = library.repos.filter((repo) =>
      repo.isPrivate === undefined &&
      repo.private === undefined &&
      repo.visibility === undefined
    );

    expect(missing).toHaveLength(0);
  });

  test('known private repo is absent from public artifacts', () => {
    const library = readFileSync(join(process.cwd(), 'public/data/library.json'), 'utf-8');
    const owned = readFileSync(join(process.cwd(), 'public/data/owned.json'), 'utf-8');
    const sitemap = readFileSync(join(process.cwd(), 'public/sitemap.xml'), 'utf-8');

    expect(library).not.toContain('hippo-harvest-assignment');
    expect(owned).not.toContain('hippo-harvest-assignment');
    expect(sitemap).not.toContain('hippo-harvest-assignment');
  });

  test('sitemap lastmod dates are not older than the library generation date', () => {
    const library = readJson<LibraryArtifact>('public/data/library.json');
    const generatedDate = new Date(library.generatedAt ?? '');
    expect(Number.isNaN(generatedDate.getTime())).toBe(false);

    const generatedDay = generatedDate.toISOString().slice(0, 10);
    const sitemap = readFileSync(join(process.cwd(), 'public/sitemap.xml'), 'utf-8');
    const lastmods = [...sitemap.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map((match) => match[1]);

    expect(lastmods.length).toBeGreaterThan(0);
    expect(lastmods.every((day) => day >= generatedDay)).toBe(true);
  });

  test('full library source artifact stays under the current emergency budget', () => {
    const bytes = statSync(join(process.cwd(), 'public/data/library.json')).size;
    expect(bytes).toBeLessThan(30 * 1024 * 1024);
  });
});
