# Reporium — Claude Code & Codex Guidelines

This file is automatically read by Claude Code and Codex agents at session start.
Follow these rules on every task, no exceptions.

## Git & JIRA Process

### GitFlow
- Feature branches off main: `claude/feature/KAN-XX-description` or `codex/feature/KAN-XX-description`
- PRs always target **main** (no develop branch)
- Every commit must reference a JIRA ticket: `KAN-XX: description`
- One feature/fix per branch, one branch per ticket

### JIRA (perditio.atlassian.net, KAN project)
- Create a ticket BEFORE starting work
- Link PRs to tickets
- Move tickets through: To Do → In Progress → In Review → Done

### Enrichment Rules
- Additive only — never DELETE before verifying replacement works
- 16-category fixed taxonomy (see ENRICHMENT_PROMPT_V2.md)
- Data quality gates: categories >= 10, tags >= 50, classified >= 90%

### Key Facts
- perditioinc is a USER account, not an org (never use --org flag with gh)
- $0/month infra budget — use cron ping over min-instances
- Frontend: Next.js on Vercel | API: FastAPI on GCP Cloud Run | DB: Neon PostgreSQL + pgvector
