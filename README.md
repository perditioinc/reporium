# Reporium

[![CI](https://github.com/perditioinc/reporium/actions/workflows/test.yml/badge.svg)](https://github.com/perditioinc/reporium/actions/workflows/test.yml)
[![Vercel](https://img.shields.io/badge/deploy-Vercel-black)](https://vercel.com/)

Reporium is the frontend for the Perditio repo intelligence system. It turns the Reporium API into a browsable portfolio: repo cards, semantic search, taxonomy filters, proactive portfolio insights, repo detail pages, and MCP-linked exploration.

![Screenshot](public/screenshot-placeholder.png)

## What The Frontend Does

- Loads the live portfolio from `reporium-api`
- Shows keyword and semantic search in the same interface
- Displays cosine-similarity match percentages for semantic search results
- Filters repos by dynamic taxonomy dimensions from the API:
  - AI Trends
  - Industries
  - Use Cases
  - Modalities
  - Deployment Context
- Surfaces proactive portfolio insights on the dashboard:
  - rising taxonomy gaps
  - stale repos
  - velocity leaders
  - near-duplicate repo clusters
- Renders repo detail pages at `/repo/[name]`
- Links naturally into the MCP workflow by exposing the same underlying portfolio concepts the MCP server queries

## Architecture

This frontend is API-backed.

- Primary source of truth: `reporium-api`
- Primary dataset route: `/library/full`
- Semantic search route: `/search/semantic`
- Taxonomy routes: `/taxonomy/{dimension}`
- Intelligence feed: `/intelligence/portfolio-insights`
- Repo detail route: `/repos/{name}`

Static JSON fallback still exists for resilience and static export, but it is not the primary architecture and should not be treated as the canonical live data path.

## User Experience

### Search

- `Keyword` mode performs text search over repo content
- `Semantic` mode calls the embedding-backed semantic search API
- Semantic matches display an `NN% match` badge derived from cosine similarity

### Taxonomy Filters

The sidebar supports dynamic taxonomy browsing driven by the database-backed taxonomy model. Values are fetched on load from the API and filtered client-side against repo taxonomy assignments.

### Portfolio Insights

The dashboard now includes a proactive intelligence widget that surfaces portfolio signals without waiting for a natural-language question.

### Repo Detail Pages

Each repo has a dedicated detail page showing:

- grouped AI dev skills
- taxonomy assignments
- tags and categories
- PM skills
- builder information
- stars, forks, and open issues
- README summary
- recent activity and metadata

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

```bash
NEXT_PUBLIC_REPORIUM_API_URL=https://your-reporium-api-url
NEXT_PUBLIC_BASE_PATH=
```

## Deployment

The frontend is deployed on Vercel and targets the live `reporium-api` service.

When validating a frontend change, the important checks are:

```bash
npm run build
```

## MCP Integration

This repo is the human-facing portfolio UI.

The AI-facing query layer lives in `reporium-mcp`, which exposes the same portfolio through MCP tools for Claude Code and other agent clients. The two experiences should stay aligned:

- UI users browse and filter the portfolio visually
- MCP users query the same portfolio programmatically and semantically

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
