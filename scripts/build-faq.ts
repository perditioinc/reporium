/**
 * Pre-compute /faq answers at refresh time and emit public/data/faq.json.
 *
 * Why: the FAQ questions are static, curated literals (scripts/faq-questions.json).
 * Calling /intelligence/ask live from the browser per-card-expand spends per-visitor
 * rate-limit budget on content the operator already knows the answer to, couples /faq
 * uptime to the API, and (post-auth) would consume authenticated users' personal /ask
 * quotas just to render a marketing page. Pre-computing once per refresh shifts cost
 * from per-visitor to per-build (≤$0.05/day at 16 questions; ≤$1/day at 100).
 *
 * Usage:
 *   npx tsx scripts/build-faq.ts
 *
 * Environment:
 *   NEXT_PUBLIC_REPORIUM_API_URL  — required
 *   NEXT_PUBLIC_APP_API_TOKEN     — required (X-App-Token for /intelligence/ask)
 *
 * Output: public/data/faq.json shape:
 *   {
 *     generatedAt: ISO8601,
 *     sections: [...identical to scripts/faq-questions.json...],
 *     answers: { [question]: { answer, sources, model, generatedAt } | { error } }
 *   }
 *
 * On per-question failure (network error, 5xx, or 429 after retries) the previous
 * answer from the existing public/data/faq.json is retained so the build never
 * regresses live content. If no prior answer exists, the question is recorded with
 * { error } and the FAQPanel renders an inline "answer unavailable" state.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

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
const APP_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN

if (!API_URL || !APP_TOKEN) {
  console.error('ERROR: NEXT_PUBLIC_REPORIUM_API_URL and NEXT_PUBLIC_APP_API_TOKEN are required.')
  process.exit(1)
}

interface SourceRepo {
  name: string
  owner: string
  forked_from: string | null
  description: string | null
  stars: number | null
  relevance_score: number
  problem_solved: string | null
  integration_tags: string[]
}

interface FAQAnswer {
  answer: string
  sources: SourceRepo[]
  model: string
  generatedAt: string
}

interface FAQError {
  error: string
  generatedAt: string
}

interface FAQSection {
  title: string
  blurb: string
  questions: string[]
}

interface FAQQuestionsFile {
  sections: FAQSection[]
}

interface FAQOutput {
  generatedAt: string
  sections: FAQSection[]
  answers: Record<string, FAQAnswer | FAQError>
}

const QUESTIONS_FILE = join(process.cwd(), 'scripts', 'faq-questions.json')
const OUTPUT_FILE = join(process.cwd(), 'public', 'data', 'faq.json')

// Server limit on /intelligence/ask is 6/minute per IP. Pace at 11s/call to stay
// under it with margin. At 16 questions that's ~3 minutes; at 100 it's ~18 minutes.
const PACE_MS = 11_000
const MAX_RETRIES = 3
// Retry delay must exceed the 60s rate-limit window so a 429 retry doesn't
// immediately hit the same ceiling.
const RETRY_DELAYS_MS = [15_000, 35_000, 65_000] as const

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function askOnce(question: string): Promise<FAQAnswer | { _retryable: true; status: number } | { _permanent: string }> {
  try {
    const res = await fetch(`${API_URL}/intelligence/ask`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-App-Token': APP_TOKEN as string,
      },
      body: JSON.stringify({ question, top_k: 8 }),
    })
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      return { _retryable: true, status: res.status }
    }
    if (!res.ok) {
      return { _permanent: `HTTP ${res.status}` }
    }
    const body = (await res.json()) as {
      answer: string
      sources: SourceRepo[]
      model: string
    }
    return {
      answer: body.answer,
      sources: body.sources ?? [],
      model: body.model,
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { _retryable: true, status: 0 }
  }
}

async function ask(question: string): Promise<FAQAnswer | FAQError> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const r = await askOnce(question)
    if ('answer' in r) return r
    if ('_permanent' in r) {
      return { error: r._permanent, generatedAt: new Date().toISOString() }
    }
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[attempt - 1]
      console.warn(`  retry ${attempt}/${MAX_RETRIES - 1} after ${delay}ms (status=${r.status})`)
      await sleep(delay)
    } else {
      return { error: `failed after ${MAX_RETRIES} attempts (last status=${r.status})`, generatedAt: new Date().toISOString() }
    }
  }
  return { error: 'exhausted retries', generatedAt: new Date().toISOString() }
}

function loadPrevious(): FAQOutput | null {
  if (!existsSync(OUTPUT_FILE)) return null
  try {
    return JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8')) as FAQOutput
  } catch {
    return null
  }
}

async function main() {
  const raw = readFileSync(QUESTIONS_FILE, 'utf-8')
  const cfg = JSON.parse(raw) as FAQQuestionsFile
  const questions = cfg.sections.flatMap((s) => s.questions)
  console.log(`[build-faq] ${questions.length} questions across ${cfg.sections.length} sections`)
  console.log(`[build-faq] target: ${API_URL}`)
  console.log(`[build-faq] pacing: ${PACE_MS}ms between calls`)

  const previous = loadPrevious()
  const previousAnswers = previous?.answers ?? {}
  const answers: Record<string, FAQAnswer | FAQError> = {}

  let okCount = 0
  let retainedCount = 0
  let errorCount = 0

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const t0 = Date.now()
    const r = await ask(q)
    const ms = Date.now() - t0

    if ('error' in r) {
      // Retain previous answer if we had one; otherwise record the error.
      const prior = previousAnswers[q]
      if (prior && 'answer' in prior) {
        answers[q] = prior
        retainedCount++
        console.log(`[${i + 1}/${questions.length}] RETAINED prior answer (${ms}ms) — ${r.error} | ${q}`)
      } else {
        answers[q] = r
        errorCount++
        console.log(`[${i + 1}/${questions.length}] ERROR (${ms}ms) — ${r.error} | ${q}`)
      }
    } else {
      answers[q] = r
      okCount++
      console.log(`[${i + 1}/${questions.length}] OK (${ms}ms) ${r.model} | ${q}`)
    }

    if (i < questions.length - 1) await sleep(PACE_MS)
  }

  const output: FAQOutput = {
    generatedAt: new Date().toISOString(),
    sections: cfg.sections,
    answers,
  }

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true })
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n')

  console.log('\n=== build-faq summary ===')
  console.log(`  fresh:    ${okCount}/${questions.length}`)
  console.log(`  retained: ${retainedCount}/${questions.length}`)
  console.log(`  errored:  ${errorCount}/${questions.length}`)
  console.log(`  output:   ${OUTPUT_FILE}`)

  // Build is a hard failure ONLY if we have a question with no fresh and no prior
  // answer. Retaining prior is success; partial freshness is success.
  if (errorCount > 0) {
    console.error(`\n[build-faq] FAIL: ${errorCount} question(s) have neither a fresh nor a prior answer.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[build-faq] uncaught error:', err)
  process.exit(1)
})
