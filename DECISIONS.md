# Architecture Decision Log

## ADR-001: Next.js with static export
**Date:** 2026-03-12
**Decision:** Next.js App Router with `output: 'export'`
**Reasoning:** API routes proxy GitHub API cleanly. Static export enables free GitHub Pages hosting for all forked instances with zero configuration.

## ADR-002: No AI for tag generation
**Date:** 2026-03-12
**Decision:** Pure logic-based tagging from GitHub metadata
**Reasoning:** Zero cost, zero latency, fully deterministic. GitHub topics + language provide sufficient signal. AI enrichment is a future optional enhancement.

## ADR-003: GitHub Pages for fork deployment
**Date:** 2026-03-12
**Decision:** Forked instances auto-deploy to GitHub Pages via Actions
**Reasoning:** One secret to set, everything else automatic. Zero cost, zero friction for users.

## ADR-004: Vercel for primary instance
**Date:** 2026-03-12
**Decision:** reporium.com hosted on Vercel
**Reasoning:** Free tier sufficient, zero-config Next.js, auto-deploys from main.

## ADR-005: Rendering strategy split by deployment target
**Date:** 2026-04-26
**Decision:** Vercel primary uses top-N prerender + ISR fallback; GitHub Pages fork target retains `output: 'export'` with full-corpus pre-render. Gated by `REPORIUM_DEPLOY_TARGET` env var. Per-page build-time API budget: 1 call (down from 3 today).
**Reasoning:** ADR-001 coupled both deployment targets to one rendering strategy. Build cost is `O(N × api_latency × 3)` and unbounded; corpus growth and API tail latency caused a silent prod-stays-on-prior-SHA failure (Vercel `dpl_7Xrjrf8mQUdRLoPJvsj5Qbe1LPTJ`, 2026-04-25). Amends ADR-001 for the Vercel target only; ADR-001 stands for the fork target.
**Full ADR:** [docs/adr/ADR-005-rendering-strategy.md](docs/adr/ADR-005-rendering-strategy.md)
