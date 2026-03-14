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
