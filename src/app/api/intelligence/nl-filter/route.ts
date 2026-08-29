/**
 * Same-origin proxy for POST /intelligence/nl-filter (auth-hardening PR #5;
 * surface flagged in .audit/2026-04-27/auth-hardening-prereads.md §3.1).
 * Holds REPORIUM_APP_TOKEN server-side; the browser never sees it.
 * Vercel target only (ADR-005).
 */
import { proxyIntelligencePost } from '@/lib/server/intelligenceProxy';

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  return proxyIntelligencePost(req, '/intelligence/nl-filter');
}
