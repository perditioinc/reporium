/**
 * Fetch complete library data from reporium-api /library/full endpoint.
 * Replaces the old generate-library.ts that made 800+ individual GitHub API calls.
 *
 * One API call. ~2 seconds. Returns all 826+ repos with enriched data.
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

async function main() {
  const url = `${API_URL!.replace(/\/$/, '')}/library/full`
  console.log(`Fetching library from ${url}...`)

  const startTime = Date.now()

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })

  if (!res.ok) {
    console.error(`API returned ${res.status}: ${res.statusText}`)
    const text = await res.text()
    console.error(text.slice(0, 500))
    process.exit(1)
  }

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

  // Write to public/data/library.json
  const outDir = join(process.cwd(), 'public', 'data')
  mkdirSync(outDir, { recursive: true })

  const outPath = join(outDir, 'library.json')
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8')

  console.log(`Done in ${elapsed}s`)
  console.log(`  Repos: ${data.repos.length}`)
  console.log(`  Stats: ${JSON.stringify(data.stats)}`)
  console.log(`  Categories: ${data.categories?.length ?? 0}`)
  console.log(`  Tag metrics: ${data.tagMetrics?.length ?? 0}`)
  console.log(`  Written to: ${outPath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
