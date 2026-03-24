# Reporium Roadmap

## Current State (March 2026)

`reporium` is the human-facing Next.js frontend for the Reporium suite.

- The main dashboard browses the live portfolio with keyword and semantic search modes
- `/ask` provides a dedicated natural-language query page backed by the API intelligence layer
- `/runs` shows ingestion run history and operational status
- `/taxonomy` provides a Taxonomy Explorer for the live multi-dimensional taxonomy
- `/repo/[name]` renders repo detail pages with taxonomy, quality, dependencies, similar repos, and related metadata
- The dashboard surfaces portfolio insights, cross-dimension analytics, gap analysis, and a Trending This Week widget
- Repo cards show quality badges, license badges, open issues, semantic match percentages, and taxonomy-aware metadata
- Taxonomy filters are live in the sidebar across AI trends, industries, use cases, modalities, deployment context, license, skills, PM skills, tags, and builders

## Recent Platform Additions

- Ask page and lightweight ask-entry points from the main dashboard
- Run history page and reusable runs table
- Taxonomy Explorer page for the 8-dimension taxonomy model
- Similar Repos section on repo detail pages
- Gap analysis grouped by taxonomy dimension
- Trending widget and proactive portfolio insights widgets
- Quality badges and detail-page quality sections

## What Is Next

- Cloud deployment of the ingestion pipeline so the frontend depends on a fully managed refresh path
- Nightly enrichment cron so new repos and changed repos stay fresh automatically
- Scale the portfolio experience to 10K repos without losing responsiveness
- Public query UI rate limiting and abuse protection hardening
- Commit-stat refresh automation so trending and activity widgets stay current
