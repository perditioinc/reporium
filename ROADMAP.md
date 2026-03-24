# Reporium Roadmap

## What Worked At The 2026-03-21 Snapshot

This document captures a frontend/platform planning snapshot from 2026-03-21.
Counts below reflect that point-in-time view and should not be read as the current live suite totals.

- **831 repos tracked** across the perditioinc GitHub organization
- **826 repos enriched** with AI-generated summaries, problem descriptions, and integration tags via Claude Sonnet ($2.52 total)
- **826 semantic embeddings** (384-dim, all-MiniLM-L6-v2) enabling natural language search
- **5,418 knowledge graph edges** (COMPATIBLE_WITH, ALTERNATIVE_TO, DEPENDS_ON)
- **POST /intelligence/query** endpoint live on Cloud Run — ask natural language questions, get answers citing real repos
- **reporium.com** reads from live API (`/library/full`) with static JSON fallback
- **Database fully backfilled**: 14K tags, 2K pmSkills, 918 industries, 825 builders, 29 categories
- **Nightly pipeline**: reporium-db syncs at 5am UTC, forksync at 6am UTC, all downstream jobs cascade
- **Rate limiting**: 100/min public, 30/min search, 10/min ingest
- **Redis cache enabled**: Memorystore via VPC connector — /library/full cached 5 min, 2.4x faster
- **Commit stats populated**: 395 repos with monthly commit activity from GitHub API
- **CI on all repos**: every repo in the suite has a green GitHub Actions workflow

## What Is Next

### Taxonomy Expansion — 12 → 28 Skill Areas (Issue #17)
- **Branch**: `feature/taxonomy-expansion`
- **Spec**: [docs/TAXONOMY.md](docs/TAXONOMY.md)
- **Goal**: Expand from 12 AI Dev Coverage badges to 28 skill areas (6 lifecycle groups), 58 categories, ~200 curated tags
- **Phase 1** (Week 1): DB schema migration — add `lifecycleGroup`, expand `skillAreas` enum
- **Phase 2** (Week 2): Re-enrich all 1,406 repos with updated Claude prompt (~$4.20)
- **Phase 3** (Week 3): Frontend — 28-badge grid grouped by lifecycle, 58-category sidebar, curated tag cloud
- **Phase 4** (Week 4): Prune ~440 noise tags, update API endpoints, add tests, deploy to production

### Public Query UI
- Add a search box to reporium.com that calls `/intelligence/query`
- Requires prompt injection protection before exposing to public traffic
- Display answers with source repos and relevance scores inline

### Nightly Enrichment for New Repos
- When reporium-db adds new repos, automatically run Claude enrichment on them
- Estimated cost: ~$0.003/repo, so 100 new repos/night = $0.30/night
- Add to the nightly pipeline after reporium-db sync completes

### Scale to 10K Repos
- Current bottleneck: GitHub GraphQL rate limit (5,000 points/hour)
- At 10K repos: ~105 GraphQL calls/night, well within limits
- At 10K repos: embedding generation takes ~2 minutes (still local sentence-transformers)
- At 10K repos: knowledge graph edges grow to ~50K — still fits in PostgreSQL easily
- Mac Mini consideration: when local GPU inference becomes a bottleneck for embeddings

### Cost Model at Scale

| Scale | Enrichment (one-time) | Nightly new repos | Embeddings | Query endpoint |
|-------|----------------------|-------------------|------------|----------------|
| 826 repos | $2.52 (done) | ~$0.01/night | $0 (local) | ~$0.01/query |
| 10K repos | ~$30 | ~$0.30/night | $0 (local) | ~$0.01/query |
| 100K repos | ~$300 | ~$3/night | $0 (local) | ~$0.01/query |

Reference: [COST_REPORT.md](https://github.com/perditioinc/reporium-ingestion/blob/main/COST_REPORT.md)

## Not Yet Working

- **reporium-ingestion cloud deployment**: enrichment pipeline runs locally, not on Cloud Run yet
- **Nightly commit stats refresh**: commit stats fetcher exists but not yet in nightly cron
