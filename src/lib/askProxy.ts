/**
 * Client-side constants for the same-origin intelligence proxy
 * (auth-hardening PR #5 — .audit/2026-04-27/auth-hardening-plan.md).
 *
 * Token-gated endpoints (/intelligence/ask, /ask/stream, /nl-filter) are no
 * longer called directly from the browser with a bundled public token.
 * Clients call these same-origin routes; the route handlers attach the
 * server-held app token (see src/lib/server/intelligenceProxy.ts).
 *
 * ADR-005 dual deploy target: the github-pages static export
 * (REPORIUM_DEPLOY_TARGET=github-pages) ships no server, so the proxy routes
 * do not exist there. Surfaces must check IS_STATIC_DEPLOY before fetching
 * and degrade with ASK_UNAVAILABLE_STATIC_MESSAGE instead.
 */

/** True when this bundle was built for the github-pages static export. */
export const IS_STATIC_DEPLOY =
  process.env.REPORIUM_DEPLOY_TARGET === 'github-pages';

export const ASK_PROXY_PATH = '/api/intelligence/ask';
export const ASK_STREAM_PROXY_PATH = '/api/intelligence/ask/stream';
export const NL_FILTER_PROXY_PATH = '/api/intelligence/nl-filter';

export const ASK_UNAVAILABLE_STATIC_MESSAGE =
  'Ask is not available on this static deployment — it requires the server-hosted version of Reporium.';

export const NL_FILTER_UNAVAILABLE_STATIC_MESSAGE =
  'Smart Filter is not available on this static deployment — it requires the server-hosted version of Reporium.';
