/**
 * Same-origin proxy for POST /intelligence/ask/stream (auth-hardening PR #5).
 * Streams the SSE response back unchanged. Holds REPORIUM_APP_TOKEN
 * server-side; the browser never sees it. Vercel target only (ADR-005).
 */
import { proxyIntelligencePost } from '@/lib/server/intelligenceProxy';

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  return proxyIntelligencePost(req, '/intelligence/ask/stream');
}
