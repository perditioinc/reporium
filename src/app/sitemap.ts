import { readFileSync } from 'fs';
import { join } from 'path';
import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.reporium.com';

function getRepoNames(): string[] {
  try {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), 'public', 'data', 'library.json'), 'utf-8')
    ) as { repos: Array<{ name: string }> };
    return data.repos.map((r) => r.name);
  } catch {
    return [];
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const repoNames = getRepoNames();
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/ask`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/stacks`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/graph`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/wiki`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/wiki/roadmap`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/taxonomy`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/runs`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.4,
    },
  ];

  // Repo detail pages — one per repo in the library
  const repoPages: MetadataRoute.Sitemap = repoNames.map((name) => ({
    url: `${BASE_URL}/repo/${encodeURIComponent(name)}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...repoPages];
}
