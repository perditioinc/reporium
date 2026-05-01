#!/usr/bin/env node
// Synthetic reproduction of the 2026-04-26 refresh failure (run 24950928219):
//   stats.total (1856) does not match repos.length (1861)
//
// Reproduces the corpus-drift scenario where page 1's stats snapshot lags
// behind the assembled repos array, then asserts that the recomputed-stats
// transform produces a payload that satisfies validate-library.ts's invariant
// `data.stats.total === data.repos.length`.
//
// Run: node scripts/__test__/refresh-integrity.repro.mjs

import assert from 'node:assert/strict'

function makeRepo(i, isFork) {
  return { fullName: `o${i}/r${i}`, isFork }
}

// --- Scenario: page 1 served stats from a snapshot of 1856 repos, but
// pagination and defensive-filter produced 1861 (corpus grew + 0 filtered).
const page1Stats = { total: 1856, built: 18, forked: 1838, languages: ['Python'], topTags: ['LLM'] }
const slimRepos = [
  ...Array.from({ length: 18 }, (_, i) => makeRepo(`b${i}`, false)),
  ...Array.from({ length: 1843 }, (_, i) => makeRepo(`f${i}`, true)),
]
assert.equal(slimRepos.length, 1861, 'fixture: 18 built + 1843 forked = 1861')

// --- BEFORE FIX (the bug we're fixing): spread page1, replace repos only.
const before = { stats: page1Stats, repos: slimRepos }
assert.notEqual(
  before.stats.total,
  before.repos.length,
  'pre-fix: stats.total stays at page-1 snapshot, mismatch repos.length',
)
console.log(`  pre-fix:  stats.total=${before.stats.total}, repos.length=${before.repos.length} → would FAIL validate-library.ts`)

// --- AFTER FIX (mirrors the patched section of fetch-library.ts).
const builtCount = slimRepos.filter((r) => !r.isFork).length
const forkedCount = slimRepos.length - builtCount
const after = {
  stats: { ...page1Stats, total: slimRepos.length, built: builtCount, forked: forkedCount },
  repos: slimRepos,
}

// --- Replicate validate-library.ts's invariant (line 83-85).
assert.equal(after.stats.total, after.repos.length, 'post-fix: stats.total === repos.length')
assert.equal(after.stats.built + after.stats.forked, after.repos.length, 'post-fix: built+forked === total')
assert.equal(after.stats.languages[0], 'Python', 'post-fix: page-1 aggregates preserved')
assert.equal(after.stats.topTags[0], 'LLM', 'post-fix: page-1 aggregates preserved')

console.log(`  post-fix: stats.total=${after.stats.total}, repos.length=${after.repos.length}, built=${after.stats.built}, forked=${after.stats.forked} → PASSES validate-library.ts`)

// --- Second scenario: defensive private-repo filter dropped 5 rows.
const reposAfterFilter = slimRepos.slice(0, slimRepos.length - 5)
const afterFilter = {
  stats: {
    ...page1Stats,
    total: reposAfterFilter.length,
    built: reposAfterFilter.filter((r) => !r.isFork).length,
    forked: reposAfterFilter.filter((r) => r.isFork).length,
  },
  repos: reposAfterFilter,
}
assert.equal(afterFilter.stats.total, afterFilter.repos.length, 'post-fix (filter scenario): stats.total === repos.length')
console.log(`  filter:   stats.total=${afterFilter.stats.total}, repos.length=${afterFilter.repos.length} → PASSES`)

console.log('\nOK — recomputed-stats transform aligns with validate-library.ts invariant in both drift and filter scenarios.')
