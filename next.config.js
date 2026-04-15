// @ts-check
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,

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
  // Static export: no server-side Sentry route instrumentation needed
  autoInstrumentServerFunctions: false,
  // Disable source map upload (no auth token configured yet)
  disableSourceMapUpload: true,
});
