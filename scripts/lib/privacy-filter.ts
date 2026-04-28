/**
 * privacy-filter.ts
 *
 * P0 hotfix (2026-04-28): final public-artifact filter for any data that lands in
 *   - public/data/library.json (and owned.json)
 *   - the synced data/ copy used by SSG
 *   - downstream artifacts (sitemap.xml, llms.txt, ai-plugin.json, generated TS)
 *
 * Background:
 *   2026-04-23: 44 perditioinc private repos leaked into library.json (#264).
 *   2026-04-27: hippo-harvest-assignment (perditioinc/hippo-harvest-assignment)
 *               leaked again because it was created AFTER the static blocklist
 *               was last synced. The reporium-api `/library/full` endpoint does
 *               not currently emit a privacy flag, so we have nothing to filter
 *               on structurally.
 *
 * Design:
 *   - This filter is FIELD-DRIVEN, not name-driven. It looks at any of three
 *     possible privacy signals on each repo: `isPrivate`, `private`, `visibility`.
 *   - If a repo has no privacy signal AT ALL, the filter FAILS CLOSED — it
 *     throws `MissingPrivacyFieldError`. That forces the API to expose privacy
 *     state rather than letting the build silently re-leak.
 *   - The legacy static blocklist is kept as belt-and-suspenders inside
 *     `LEGACY_PRIVATE_BLOCKLIST` and is also enforced even when a privacy field
 *     IS present (fail-loud if a known-private name slips through with a
 *     truthy-public flag).
 *
 * Field semantics:
 *   - `isPrivate: true`           → private (drop)
 *   - `isPrivate: false`          → public  (keep)
 *   - `private: true`             → private (drop)  [GitHub REST shape]
 *   - `private: false`            → public  (keep)
 *   - `visibility: 'private'`     → private (drop)  [GitHub GraphQL shape]
 *   - `visibility: 'internal'`    → private (drop, conservative)
 *   - `visibility: 'public'`      → public  (keep)
 *   - none of the above           → throw MissingPrivacyFieldError
 *
 * Usage (from fetch-library.ts):
 *   const { kept, dropped } = filterPrivateRepos(allRepos)
 *   // kept becomes the new repos[]; dropped is logged and counted.
 */

export class MissingPrivacyFieldError extends Error {
  readonly culprits: string[]
  constructor(culprits: string[]) {
    super(
      `Privacy field missing on ${culprits.length} repo(s) — refusing to emit ` +
        `public artifacts. The reporium-api /library/full response must expose ` +
        `at least one of: isPrivate (boolean), private (boolean), visibility ` +
        `(string). First offenders: ${culprits.slice(0, 5).join(', ')}`,
    )
    this.name = 'MissingPrivacyFieldError'
    this.culprits = culprits
  }
}

/**
 * Static fallback list. Synced on 2026-04-23 + updated 2026-04-28 with the
 * hippo-harvest-assignment incident. This list is NOT the primary defense — the
 * primary defense is the field-driven check below. The list catches repos that
 * are explicitly known-private even if the API erroneously labels them public.
 *
 * Refresh with:
 *   gh repo list perditioinc --visibility=private -L 500 \
 *     --json nameWithOwner -q '.[].nameWithOwner'
 */
export const LEGACY_PRIVATE_BLOCKLIST: ReadonlySet<string> = new Set<string>([
  'perditioinc/18degrees-ecom',
  'perditioinc/aa-backend-interview-template-main',
  'perditioinc/anomra',
  'perditioinc/anomra-api',
  'perditioinc/anomra-website',
  'perditioinc/didymo-ai-agent',
  'perditioinc/didymo-ai-api',
  'perditioinc/didymo-ai-auth',
  'perditioinc/didymo-ai-gcp-tts',
  'perditioinc/didymo-ai-ingest',
  'perditioinc/didymo-ai-mini',
  'perditioinc/didymo-ai-openai-stt',
  'perditioinc/didymo-ai-openai-tts',
  'perditioinc/didymo-ai-ptr',
  'perditioinc/didymo-ai-services-lab',
  'perditioinc/didymo-ai-studio',
  'perditioinc/didymo-ai-submissions-website',
  'perditioinc/didymo-ai-usage',
  'perditioinc/didymo-ai-vector',
  'perditioinc/didymo-ai-webgl',
  'perditioinc/didymo-ai-webgl-v2',
  'perditioinc/didymo-ai-website',
  'perditioinc/digital-panda-planner',
  'perditioinc/event-schedule-generator',
  'perditioinc/figma-make-perditio-website-claude',
  'perditioinc/giveaway-generator',
  'perditioinc/hippo-harvest-assignment',
  'perditioinc/ideas-2026',
  'perditioinc/mind-guard-app',
  'perditioinc/perditio-figma-website',
  'perditioinc/perditio-infra',
  'perditioinc/perditio-platform-api',
  'perditioinc/perditio-services',
  'perditioinc/perditio-style-guide',
  'perditioinc/perditio-web',
  'perditioinc/perditio-web-app',
  'perditioinc/perditio-website',
  'perditioinc/perditioinc.github.io',
  'perditioinc/reporium-evals',
  'perditioinc/simon-brain',
  'perditioinc/ticket-generator',
  'perditioinc/ticket-issuer',
  'perditioinc/v0-edm-demo-submission-website',
  'perditioinc/whatsapp-template-generator',
  'perditioinc/whatsapp-webhook',
])

/**
 * Loose-typed shape for a single repo entry from /library/full. Keeps only the
 * fields this filter cares about; everything else is passed through unchanged.
 */
export interface PrivacyEvaluable {
  fullName?: string
  name?: string
  isPrivate?: boolean | null
  private?: boolean | null
  visibility?: string | null
  [key: string]: unknown
}

export type PrivacyDecision = 'public' | 'private' | 'unknown'

/**
 * Pure classification of a single repo against its privacy fields.
 * Exported for unit testing.
 */
export function classifyPrivacy(repo: PrivacyEvaluable): PrivacyDecision {
  // Order matters: any single positive private signal makes the repo private.
  if (repo.isPrivate === true) return 'private'
  if (repo.private === true) return 'private'
  if (typeof repo.visibility === 'string') {
    const v = repo.visibility.toLowerCase()
    if (v === 'private' || v === 'internal') return 'private'
    if (v === 'public') return 'public'
    // Unknown visibility string — treat as ambiguous, do NOT default to public.
    return 'unknown'
  }
  // Any single explicit-public signal is enough to clear the repo.
  if (repo.isPrivate === false) return 'public'
  if (repo.private === false) return 'public'
  // No signal at all.
  return 'unknown'
}

export interface FilterResult<T extends PrivacyEvaluable> {
  /** Repos safe to emit publicly (privacy=public AND not in legacy blocklist). */
  kept: T[]
  /** Repos dropped because they were classified private. */
  dropped: T[]
  /** Repos dropped because they were on the legacy blocklist (even if classified public). */
  legacyDropped: T[]
}

/**
 * Filter an array of repo entries down to public-only. Throws
 * `MissingPrivacyFieldError` if ANY repo has no privacy signal —
 * the build MUST fail rather than guess.
 */
export function filterPrivateRepos<T extends PrivacyEvaluable>(repos: T[]): FilterResult<T> {
  const missing: string[] = []
  for (const repo of repos) {
    if (classifyPrivacy(repo) === 'unknown') {
      missing.push(String(repo.fullName ?? repo.name ?? '<unnamed>'))
    }
  }
  if (missing.length > 0) {
    throw new MissingPrivacyFieldError(missing)
  }

  const kept: T[] = []
  const dropped: T[] = []
  const legacyDropped: T[] = []

  for (const repo of repos) {
    const verdict = classifyPrivacy(repo)
    if (verdict === 'private') {
      dropped.push(repo)
      continue
    }
    // verdict === 'public' — also enforce the static blocklist as a second wall.
    if (repo.fullName && LEGACY_PRIVATE_BLOCKLIST.has(repo.fullName)) {
      legacyDropped.push(repo)
      continue
    }
    kept.push(repo)
  }

  return { kept, dropped, legacyDropped }
}
