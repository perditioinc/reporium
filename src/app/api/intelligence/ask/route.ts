/**
 * Same-origin proxy for POST /intelligence/ask (auth-hardening PR #5).
 * Holds REPORIUM_APP_TOKEN server-side; the browser never sees it.
 * Vercel target only — the github-pages static export has no server
 * (ADR-005), so Ask surfaces degrade gracefully there.
 */
import { proxyIntelligencePost } from '@/lib/server/intelligenceProxy';

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  return proxyIntelligencePost(req, '/intelligence/ask');
}
