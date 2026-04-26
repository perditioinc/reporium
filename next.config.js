// @ts-check
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,

  // Per-page static-generation timeout (default 60s). Production build of
  // SHA 71a48bb1 failed because /repo/[name]/page hit 60s on /repo/rl across
  // all 3 retry attempts (Vercel deployment dpl_7Xrjrf8mQUdRLoPJvsj5Qbe1LPTJ
  // build log). Bump to 240s to absorb slow upstream API responses without
  // changing rendering strategy.
  staticPageGenerationTimeout: 240,

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

module.exports = withSentryConfig(nextConfig, {
  // Suppress Sentry build-time logs (sourcemap upload etc.)
  silent: true,
  // org/project intentionally undefined here — set via SENTRY_ORG / SENTRY_PROJECT
  // env vars in Vercel / Cloud Run once the DSN is provisioned.
  org: undefined,
  project: undefined,
  // Static export: no server-side Sentry route instrumentation needed
  autoInstrumentServerFunctions: false,
  // Disable source map upload (no auth token configured yet)
  disableSourceMapUpload: true,
});
