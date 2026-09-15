/**
 * Server-only proxy helper for token-gated reporium-api intelligence endpoints.
 *
 * Auth-hardening lane (.audit/2026-04-27/auth-hardening-plan.md, PR #5):
 * the browser must never see the app token. Route handlers under
 * src/app/api/intelligence/* call this helper, which attaches
 * `X-App-Token: ${REPORIUM_APP_TOKEN}` server-side and forwards the request
 * to `${REPORIUM_API_URL}` unchanged. The token value and the env-var name
 * are NEVER logged and NEVER sent to the client.
 *
 * Env (server-only — intentionally NOT prefixed with NEXT_PUBLIC_):
 *   REPORIUM_API_URL   — reporium-api base URL (Cloud Run). Falls back to
 *                        NEXT_PUBLIC_REPORIUM_API_URL during the migration
 *                        window so preview deploys keep working until the
 *                        operator adds the server-side var.
 *   REPORIUM_APP_TOKEN — the app token formerly exposed as
 *                        NEXT_PUBLIC_APP_API_TOKEN. Server-side only.
 *
 * Deploy targets (ADR-005): route handlers only exist on the Vercel
 * (server-capable) target. The github-pages static export ships no server,
 * so Ask/Smart-Filter surfaces degrade gracefully there (client components
 * check REPORIUM_DEPLOY_TARGET before fetching).
 */

const UPSTREAM_TIMEOUT_MS = 55_000;

/** Response headers worth passing back to the browser. Everything else
 *  (incl. any upstream auth echoes) is dropped. */
const PASSTHROUGH_HEADERS = ['content-type', 'retry-after', 'cache-control'] as const;

function apiBaseUrl(): string {
  const url =
    process.env.REPORIUM_API_URL || process.env.NEXT_PUBLIC_REPORIUM_API_URL || '';
  return url.replace(/\/$/, '');
}

function jsonError(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Forward a POST request body to a token-gated reporium-api endpoint and
 * stream the response (JSON or SSE) back unchanged.
 */
export async function proxyIntelligencePost(
  req: Request,
  upstreamPath: string,
): Promise<Response> {
  const base = apiBaseUrl();
  const token = process.env.REPORIUM_APP_TOKEN || '';

  if (!base) {
    return jsonError(503, 'Upstream API is not configured on this deployment.');
  }
  if (!token) {
    // Do not name the env var in client-visible text.
    return jsonError(503, 'Ask is not configured on this deployment. Contact the site owner.');
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return jsonError(400, 'Unable to read request body.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Token': token,
  };
  // Preserve the caller's IP chain so upstream per-IP rate limiting keeps
  // distinguishing visitors instead of seeing one Vercel egress IP.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) headers['X-Forwarded-For'] = xff;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}${upstreamPath}`, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Timeout / network failure. Never include token material in errors.
    return jsonError(504, 'Upstream API did not respond. Please try again.');
  }

  const responseHeaders = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  if (!responseHeaders.has('cache-control')) {
    responseHeaders.set('cache-control', 'no-store');
  }

  // Stream the body through unchanged — required for the SSE endpoint
  // (/intelligence/ask/stream) and harmless for plain JSON.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
