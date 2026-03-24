/**
 * Fetch complete library data from reporium-api /library/full endpoint.
 * Replaces the old generate-library.ts that made 800+ individual GitHub API calls.
 *
 * One API call. Fetches the current enriched corpus from the API.
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

async function main() {
  const url = `${API_URL!.replace(/\/$/, '')}/library/full`
  console.log(`Fetching library from ${url}...`)

  const startTime = Date.now()

  const res = await fetchWithRetry(url)

  const data = await res.json()
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Validate shape
  if (!data.repos || !Array.isArray(data.repos)) {
    console.error('ERROR: Response does not contain repos array')
    process.exit(1)
  }

  if (!data.stats || typeof data.stats.total !== 'number') {
    console.error('ERROR: Response does not contain valid stats')
    process.exit(1)
  }

  const outDir = join(process.cwd(), 'public', 'data')
  mkdirSync(outDir, { recursive: true })

  // Write full library
  const outPath = join(outDir, 'library.json')
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8')

  // Write owned-only subset for progressive loading.
  // Keeps full stats/categories so header counts stay accurate on first paint.
  const ownedRepos = data.repos.filter((r: { isFork?: boolean }) => !r.isFork)
  const ownedData = { ...data, repos: ownedRepos }
  const ownedPath = join(outDir, 'owned.json')
  writeFileSync(ownedPath, JSON.stringify(ownedData, null, 2), 'utf-8')

  console.log(`Done in ${elapsed}s`)
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
