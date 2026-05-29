# Reporium Roadmap

## Current State

`reporium` is the human-facing Next.js frontend for the Reporium suite.

- The main dashboard browses the live portfolio with keyword and semantic search modes
- `/ask` provides a dedicated natural-language query page backed by the API intelligence layer
- `/taxonomy` provides a Taxonomy Explorer for the live multi-dimensional taxonomy
- `/trends` shows trending/emerging/cooling activity across the library
- `/insights` surfaces portfolio insights, cross-dimension analytics, and gap analysis
- `/graph` renders the knowledge-graph visualization of the library
- `/stacks`, `/wiki`, `/ai-native`, and `/architecture` provide curated browse experiences over the taxonomy
- `/repo/[name]` renders repo detail pages with taxonomy, quality, dependencies, similar repos, and related metadata
- `/faq` documents how the library and forking workflow work
- Repo cards show quality badges, license badges, open issues, semantic match percentages, and taxonomy-aware metadata
- Taxonomy filters are live in the sidebar across AI trends, industries, use cases, modalities, deployment context, license, skills, PM skills, tags, and builders

## Recent Platform Additions

- Ask page and lightweight ask-entry points from the main dashboard
- Trends page with trending/emerging/cooling signals and a staleness banner
- Taxonomy Explorer page for the multi-dimension taxonomy model
- Knowledge-graph visualization page
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
