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

module.exports = nextConfig
