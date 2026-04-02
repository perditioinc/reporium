/**
 * Fetch complete library data from reporium-api /library/full endpoint.
 * Replaces the old generate-library.ts that made 800+ individual GitHub API calls.
 *
 * One API call. ~2 seconds. Returns all 1,400+ repos with enriched data.
 *
 * Usage:
 *   npx tsx scripts/fetch-library.ts
 *
 * Environment:
 *   NEXT_PUBLIC_REPORIUM_API_URL — required (e.g. https://reporium-api-573778300586.us-central1.run.app)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Load .env.local if it exists (tsx doesn't auto-load Next.js env files)
const envPath = join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  }
}

const API_URL = process.env.NEXT_PUBLIC_REPORIUM_API_URL

if (!API_URL) {
  console.error('ERROR: NEXT_PUBLIC_REPORIUM_API_URL is not set.')
  console.error('Set it in .env.local or pass it as an environment variable.')
  console.error('Example: NEXT_PUBLIC_REPORIUM_API_URL=https://reporium-api-573778300586.us-central1.run.app')
  process.exit(1)
}

const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [2000, 5000, 10000] as const

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status <= 599
}

class PermanentFetchError extends Error {}

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (res.ok) return res

      const bodyPreview = (await res.text()).slice(0, 200)
      const retryable = isRetryableStatus(res.status)

      if (!retryable) {
        throw new PermanentFetchError(
          `HTTP ${res.status} ${res.statusText}${bodyPreview ? ` - ${bodyPreview}` : ''}`
        )
      }

      const retryDelayMs = RETRY_DELAYS_MS[attempt - 1]
      console.warn(
        `[fetch-library] attempt ${attempt}/${MAX_RETRIES} failed with ${res.status}; retrying in ${retryDelayMs / 1000}s`
      )

      if (attempt === MAX_RETRIES) {
        throw new Error(`HTTP ${res.status} ${res.statusText}${bodyPreview ? ` - ${bodyPreview}` : ''}`)
      }

      await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof PermanentFetchError) {
        console.error(`[fetch-library] final failure: ${message}`)
        throw error
      }

      const retryDelayMs = RETRY_DELAYS_MS[attempt - 1]

      if (attempt === MAX_RETRIES) {
        console.error(`[fetch-library] final failure after ${attempt} attempts: ${message}`)
        throw error
      }

      console.warn(
        `[fetch-library] attempt ${attempt}/${MAX_RETRIES} failed with network/error condition; retrying in ${retryDelayMs / 1000}s`
      )
      await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    }
  }

  throw new Error('Retry loop exhausted unexpectedly')
}

const PAGE_SIZE = 500

async function main() {
  const baseUrl = `${API_URL!.replace(/\/$/, '')}/library/full`
  const startTime = Date.now()

  // Fetch page 1 to get totalPages and corpus-wide aggregates
  const page1Url = `${baseUrl}?page=1&pageSize=${PAGE_SIZE}`
  console.log(`Fetching page 1 from ${page1Url}...`)
  const res1 = await fetchWithRetry(page1Url)
  const page1 = await res1.json()

  // Validate shape
  if (!page1.repos || !Array.isArray(page1.repos)) {
    console.error('ERROR: Response does not contain repos array')
    process.exit(1)
  }
  if (!page1.stats || typeof page1.stats.total !== 'number') {
    console.error('ERROR: Response does not contain valid stats')
    process.exit(1)
  }

  const totalPages: number = page1.totalPages ?? 1
  console.log(`  Page 1/${totalPages}: ${page1.repos.length} repos (totalRepos=${page1.totalRepos ?? '?'})`)

  // Accumulate repos across all pages
  let allRepos = [...page1.repos]

  for (let page = 2; page <= totalPages; page++) {
    const pageUrl = `${baseUrl}?page=${page}&pageSize=${PAGE_SIZE}`
    console.log(`Fetching page ${page}/${totalPages} from ${pageUrl}...`)
    const res = await fetchWithRetry(pageUrl)
    const pageData = await res.json()
    if (!pageData.repos || !Array.isArray(pageData.repos)) {
      console.error(`ERROR: Page ${page} response does not contain repos array`)
      process.exit(1)
    }
    console.log(`  Page ${page}/${totalPages}: ${pageData.repos.length} repos`)
    allRepos = allRepos.concat(pageData.repos)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Strip heavy fields not needed for card rendering to reduce JSON size.
  // commitsLast7/30/90Days are full commit arrays — commitStats has the counts.
  // recentCommits trimmed to 3. problemSolved, latestRelease, weeklyCommitCount,
  // totalCommitsFetched, similarityScore not used by any component.
  const STRIP_FIELDS = new Set([
    'commitsLast7Days', 'commitsLast30Days', 'commitsLast90Days',
    'problemSolved', 'latestRelease', 'weeklyCommitCount',
    'totalCommitsFetched',
  ])

  const slimRepos = allRepos.map((repo: Record<string, unknown>) => {
    const slim: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(repo)) {
      if (STRIP_FIELDS.has(key)) continue
      // Trim recentCommits to 3 entries max
      if (key === 'recentCommits' && Array.isArray(val)) {
        slim[key] = val.slice(0, 3)
        continue
      }
      // Strip similarityScore from taxonomy entries (always null, wastes space)
      if (key === 'taxonomy' && Array.isArray(val)) {
        slim[key] = val.map((t: Record<string, unknown>) => {
          const { similarityScore: _, ...rest } = t
          return rest
        })
        continue
      }
      slim[key] = val
    }
    return slim
  })

  // Build combined result: use stats/categories/tagMetrics from page 1 (corpus-wide aggregates)
  const data = {
    ...page1,
    repos: slimRepos,
  }

  const outDir = join(process.cwd(), 'public', 'data')
  mkdirSync(outDir, { recursive: true })

  // Write minified JSON (no pretty-print — saves ~40% file size)
  const outPath = join(outDir, 'library.json')
  writeFileSync(outPath, JSON.stringify(data), 'utf-8')

  // Write owned-only subset for progressive loading.
  // Keeps full stats/categories so header counts stay accurate on first paint.
  const ownedRepos = data.repos.filter((r: { isFork?: boolean }) => !r.isFork)
  const ownedData = { ...data, repos: ownedRepos }
  const ownedPath = join(outDir, 'owned.json')
  writeFileSync(ownedPath, JSON.stringify(ownedData), 'utf-8')

  console.log(`Done in ${elapsed}s`)
  console.log(`  Pages fetched: ${totalPages}`)
  console.log(`  Repos: ${data.repos.length} (${ownedRepos.length} owned)`)
  console.log(`  Stats: ${JSON.stringify(data.stats)}`)
  console.log(`  Categories: ${data.categories?.length ?? 0}`)
  console.log(`  Tag metrics: ${data.tagMetrics?.length ?? 0}`)
  console.log(`  Written to: ${outPath}`)
  console.log(`  Owned subset: ${ownedPath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
