export const config = {
  githubUsername: process.env.GITHUB_USERNAME || process.env.NEXT_PUBLIC_GITHUB_USERNAME || 'perditioinc',
  githubToken: process.env.GITHUB_TOKEN || '',
  appTitle: process.env.NEXT_PUBLIC_APP_TITLE || 'Reporium',
  appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Your GitHub Knowledge Library',
  cacheTtlSeconds: 7200,
} as const;
