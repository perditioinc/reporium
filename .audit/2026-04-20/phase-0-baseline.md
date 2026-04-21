# Phase 0 Baseline — 2026-04-20

## Suite inventory
15 active repos (see `phase-0-suite-inventory.tsv`):
- reporium, reporium-api, reporium-ingestion, reporium-mcp, reporium-db, reporium-events, reporium-metrics
- reporium-audit, reporium-dataset, reporium-roadmap, reporium-scoring, reporium-security, reporium-system-design, reporium-trust-score
- forksync

All default branch = `main`. None archived. Pushed-at range: 2026-04-10 → 2026-04-20.

## API probe (prod, cold single-shot)
| Endpoint | Status | Time |
|---|---|---|
| /health | 200 | 0.25s |
| /library/full?page=1&page_size=1 | 200 | 1.01s |
| /trends/report | 200 | 0.17s |
| /gaps | 200 | 0.15s |
| /taxonomy/values?dimension=tags | 200 | 0.31s |

All endpoints live. Cold start on /library/full within 10s budget. Other endpoints warm.

## reporium dev-tip validation
- `git log -1 origin/dev` = `7109853 chore: refresh library data 2026-04-19`
- `npm run type-check` = **clean, 0 errors**
- `npm run lint` = 1080 errors, 15152 warnings (pre-existing corpus; not a regression, tracked separately)
- `npm test` = running, see `phase-0-npm-test.log`

## Gate decision
Baseline acceptable. Type-check clean = safe to proceed with Phase 1+ in parallel. Lint regression would need a separate fix wave (not in this plan — not a blocker for security audit).

## Open PRs at baseline
19 open PRs targeting `dev`, all `MERGEABLE/CLEAN` except #238 (CI fail, flagged).

## Next
- Phase 1 security sweep (3 batches dispatched, Haiku, parallel)
- Phase 2 suite drift audit (dispatching next)
- Phase 4 database audit (dispatching next — read-only)
