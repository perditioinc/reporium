// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// ADR-005: deployment-target conditional rendering.
// - REPORIUM_DEPLOY_TARGET=github-pages keeps full static export for forks.
// - Vercel/default uses managed output so repo detail pages can render on demand.
const DEPLOY_TARGET = process.env.REPORIUM_DEPLOY_TARGET || '';
const IS_STATIC_EXPORT = DEPLOY_TARGET === 'github-pages';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: IS_STATIC_EXPORT ? 'export' : undefined,
  trailingSlash: true,

  // Explicitly expose NEXT_PUBLIC_* vars. Sentry's process polyfill can prevent
  // the default build-time inlining of `process.env.NEXT_PUBLIC_*`, leaving
  // the literal key in the bundle (resolves to undefined at runtime). Declaring
  // them here forces Next.js's DefinePlugin to replace the references.
  env: {
    NEXT_PUBLIC_APP_API_TOKEN: process.env.NEXT_PUBLIC_APP_API_TOKEN ?? '',
    NEXT_PUBLIC_REPORIUM_API_URL: process.env.NEXT_PUBLIC_REPORIUM_API_URL ?? '',
    NEXT_PUBLIC_GITHUB_USERNAME: process.env.NEXT_PUBLIC_GITHUB_USERNAME ?? '',
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
    REPORIUM_DEPLOY_TARGET: DEPLOY_TARGET,
  },

  // Dev-only: proxy /api/* to the Reporium API to avoid CORS issues.
  // In production the static export makes direct client-side calls instead.
  // Note: `rewrites` are ignored during `next export` but active in `next dev`.
  async rewrites() {
    const apiUrl =
      process.env.NEXT_PUBLIC_REPORIUM_API_URL ||
      'https://reporium-api-573778300586.us-central1.run.app';
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
}

module.exports = withBundleAnalyzer(
  withSentryConfig(nextConfig, {
    // Suppress Sentry build-time logs (sourcemap upload etc.)
    silent: true,
    // org/project intentionally undefined here — set via SENTRY_ORG / SENTRY_PROJECT
    // env vars in Vercel / Cloud Run once the DSN is provisioned.
    org: undefined,
    project: undefined,
    // Static export: no server-side Sentry route instrumentation needed.
    // Re-enable for the Vercel target in a follow-up if server tracing is desired.
    autoInstrumentServerFunctions: false,
    // Disable source map upload (no auth token configured yet)
    disableSourceMapUpload: true,
  }),
);
