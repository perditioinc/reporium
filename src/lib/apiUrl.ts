/**
 * Canonical API base URL for client-side fetches.
 *
 * In dev mode, requests route through the Next.js dev proxy (/api/proxy/*)
 * to avoid CORS issues — the proxy is configured in next.config.js and is
 * ignored during `next export` (production static build).
 *
 * In production, the static export makes direct requests to the GCP API.
 */
export const API_URL =
  process.env.NODE_ENV === 'development'
    ? '/api/proxy'
    : (process.env.NEXT_PUBLIC_REPORIUM_API_URL ?? '');
