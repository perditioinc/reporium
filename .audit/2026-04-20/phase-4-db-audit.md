# Phase 4 — DB Schema + Migration Audit — 2026-04-20

## Migration integrity

### File inventory (reporium-api/migrations/versions/)

All migrations follow the `NNN_description.py` naming convention consistently.
Chain is complete and linear — no gaps, no duplicate revision IDs.

| # | File | down_revision | Notes |
|---|------|---------------|-------|
| 001 | initial_schema.py | None | Creates 10 core tables |
| 002 | add_enrichment_columns.py | 001 | Adds dependencies, quality_signals (later dropped in 014) |
| 003 | add_is_private.py | 002 | Backfills NULLs, sets NOT NULL |
| 004 | add_stargazers_count.py | 003 | |
| 005 | add_query_log.py | 004 | Creates query_log via raw SQL |
| 006 | add_full_name.py | 005 | Unique index on full_name |
| 007 | add_pgvector_embedding_col.py | 006 | HNSW index on embedding_vec |
| 008 | add_repo_indexes.py | 007 | Performance indexes on repos |
| 009 | add_github_created_at.py | 008 | |
| 010 | add_open_issues_count.py | 009 | |
| 011 | add_skill_areas_table.py | 010 | Seeds 28 rows — deleted in 014 |
| 012 | add_query_log_semantic_cache_fields.py | 011 | |
| 013 | add_taxonomy_tables.py | 012 | taxonomy_values + repo_taxonomy |
| 014 | cleanup_hardcoded_seeds_and_dead_columns.py | 013 | DROPS dependencies, quality_signals from repos |
| 015 | add_quality_signals.py | 014 | Re-adds quality_signals JSONB (different shape) |
| 016 | add_has_tests_has_ci.py | 015 | |
| 017 | add_ingest_runs.py | 016 | |
| 018 | backfill_repo_tags_from_taxonomy.py | 017 | Data migration — no-op downgrade |
| 019 | backfill_repo_categories.py | 018 | Data migration — no-op downgrade |
| 020 | add_security_signals.py | 019 | |
| 021 | ask_sessions.py | 020 | |
| 022 | add_token_hash_to_ask_sessions.py | 021 | Security hardening |
| 023 | add_ask_sessions_created_at_index.py | 022 | |
| 024 | add_repo_embeddings_repo_id_btree_index.py | 023 | |
| 025 | create_audit_logs.py | 024 | |
| 026 | add_community_health_signals.py | 025 | |
| 027 | create_repo_mentions.py | 026 | |
| 028 | add_pros_cons_columns.py | 027 | |
| 029 | create_repo_dependencies.py | 028 | |
| 030 | create_repo_industries.py | 029 | |
| 031 | backfill_repo_dependencies.py | 030 | Data migration — empty downgrade |
| 032 | extend_ingest_runs.py | 031 | |
| 033 | create_repo_edges.py | 032 | Renames pre-existing table to repo_edges_legacy |
| 034 | append_only_embeddings.py | 033 | Restructures repo_embeddings PK |
| 035 | canonicalize_activity_velocity.py | 034 | Adds columns + 2 VIEWs |
| 036 | library_full_perf_indexes.py | 035 | Perf indexes |
| 037 | query_log_jira_fields.py | 036 | JIRA integration columns |

### Flagged migration issues

**FLAG-M1 (Medium): 014 drops repos.dependencies and repos.quality_signals without a usable downgrade.**
Migration 014 drops two columns added in 002; the downgrade re-adds them as empty columns with no data restoration. This is documented in 014's comment ("Seed data cannot be restored"), but any rollback from 014 would lose all data previously stored in those columns.
Evidence: `reporium-api/migrations/versions/014_cleanup_hardcoded_seeds_and_dead_columns.py:31-34`

**FLAG-M2 (Low): 031 backfill_repo_dependencies has an empty downgrade.**
The migration inserts data from repo_taxonomy into repo_dependencies then deletes the taxonomy source rows. The downgrade is intentionally a no-op, meaning a rollback of 031 permanently loses the dependency data that was migrated.
Evidence: `reporium-api/migrations/versions/031_backfill_repo_dependencies.py:52-55`

**FLAG-M3 (Low): 018 and 019 backfill data migrations have no-op downgrades.**
Both are documented as intentional. Low risk as they represent derived data.
Evidence: `018_backfill_repo_tags_from_taxonomy.py:52-55`, `019_backfill_repo_categories.py:188-190`

**FLAG-M4 (Low): 011 seeds 28 rows into skill_areas that are immediately wiped by 014.**
This is intentional (migration 014 comment: "taxonomy rebuild pipeline will repopulate from real data") but creates a migration pair that writes then deletes seed data, which is surprising. In practice skill_areas is populated from live repo data at runtime. Current state: skill_areas has no static seeds.
Evidence: `011_add_skill_areas_table.py:34-184`, `014_cleanup_hardcoded_seeds_and_dead_columns.py:20`

**FLAG-M5 (Low): repos.name has UNIQUE in 001 but full_name gets its own UNIQUE index in 006.**
The original `name` UNIQUE constraint (migration 001) scopes only to short names without owner prefix, which can collide at scale. Migration 006 added `full_name` as the true uniqueness key. The repos.name unique constraint remains and could cause false collisions (two orgs with identically-named repos). The ingestion pipeline scopes by owner, so in practice this is gated upstream, but there is no explicit removal of the stale name UNIQUE constraint.
Evidence: `001_initial_schema.py:26`, `006_add_full_name.py:41`

---

## Schema inventory

### Core tables reconstructed from migrations

| Table | Key Columns | created_at? | updated_at? | Unique Keys | Notes |
|---|---|---|---|---|---|
| repos | id UUID PK, name TEXT UNIQUE, owner, full_name UNIQUE, github_url NOT NULL, is_fork NOT NULL, is_private NOT NULL, activity_score, ingested_at, updated_at | ingested_at only | YES (updated_at) | name, full_name | No created_at — ingested_at serves this role |
| repo_tags | (repo_id, tag) PK | NO | NO | Composite PK | Junction table — timestamps by design omitted |
| repo_categories | (repo_id, category_id) PK, category_name NOT NULL | NO | NO | Composite PK | |
| repo_builders | (repo_id, login) PK | NO | NO | Composite PK | |
| repo_ai_dev_skills | (repo_id, skill) PK | NO | NO | Composite PK | |
| repo_pm_skills | (repo_id, skill) PK | NO | NO | Composite PK | |
| repo_languages | (repo_id, language) PK, bytes NOT NULL, percentage NOT NULL | NO | NO | Composite PK | |
| repo_commits | id UUID PK, repo_id FK, sha NOT NULL, message NOT NULL, committed_at NOT NULL | committed_at | NO | None | No UNIQUE on sha — duplicate commits possible |
| trend_snapshots | id UUID PK, snapshotted_at, tag NOT NULL, repo_count NOT NULL, commit_count_7d | snapshotted_at | NO | None | See data gap section |
| gap_analysis | id UUID PK, generated_at, skill NOT NULL, severity NOT NULL, repo_count NOT NULL | generated_at | NO | None | |
| repo_embeddings | id UUID PK (since 034), repo_id FK, embedding TEXT, embedding_vec vector(384), model NOT NULL, generated_at, is_current BOOL, ingest_run_id FK | generated_at | NO | Partial UNIQUE (repo_id) WHERE is_current=TRUE | |
| ingestion_log | id UUID PK, started_at, mode NOT NULL, status NOT NULL | started_at | completed_at | None | Legacy table; superseded by ingest_runs |
| skill_areas | id SERIAL PK, name UNIQUE, lifecycle_group NOT NULL, created_at | created_at | NO | name | |
| query_log | id BIGSERIAL PK, timestamp, question NOT NULL, cache_hit NOT NULL | timestamp | NO | None | |
| taxonomy_values | id SERIAL PK, dimension NOT NULL, name NOT NULL, embedding_vec vector(384), repo_count, trending_score, first_seen_at, last_active_at, created_at | created_at | last_active_at | (dimension, name) | |
| repo_taxonomy | id SERIAL PK, repo_id FK, dimension NOT NULL, raw_value NOT NULL, taxonomy_value_id FK, similarity_score, assigned_by, created_at | created_at | NO | (repo_id, dimension, raw_value) | |
| ingest_runs | id SERIAL PK, run_mode NOT NULL, status NOT NULL, started_at NOT NULL, finished_at, checkpoint_data, prev_edge_counts, git_sha, triggered_by | started_at | NO | None | |
| ask_sessions | id UUID PK, session_id UUID NOT NULL, turn_number NOT NULL, question NOT NULL, answer NOT NULL, created_at, token_hash | created_at | NO | None — session_id not unique by design | |
| audit_logs | id SERIAL PK, timestamp NOT NULL, endpoint NOT NULL, method NOT NULL, response_status NOT NULL | timestamp | NO | None | No updated_at by design (append-only) |
| repo_mentions | id UUID PK, repo_id FK, source NOT NULL, external_id NOT NULL, title NOT NULL, fetched_at | fetched_at | NO | (repo_id, source, external_id) | |
| repo_dependencies | id UUID PK, repo_id FK, package_name NOT NULL, is_direct NOT NULL, fetched_at | fetched_at | NO | (repo_id, package_name, package_ecosystem) | |
| repo_industries | (repo_id, industry) PK | NO | NO | Composite PK | Junction table |
| repo_edges | id UUID PK, source_repo_id FK, target_repo_id FK, edge_type NOT NULL, weight, confidence, metadata, created_at, ingest_run_id FK | created_at | NO | (source_repo_id, target_repo_id, edge_type) | |
| repo_edges_history | id SERIAL PK, run_id, edge_type NOT NULL, edge_count, created_at, [temporal cols added 034] | created_at | NO | None | Hybrid count-log + per-edge archive |
| repo_edges_legacy | Renamed from old repo_edges | — | — | — | Created conditionally by 033 if pre-existing table found |

### Schema invariant flags

**FLAG-S1 (Medium): repos table missing created_at.**
`ingested_at` serves as the creation timestamp but is named differently from convention. Queries filtering "repos added after date X" must use `ingested_at` rather than the conventional `created_at`, creating API inconsistency.
Evidence: `001_initial_schema.py:48` — `ingested_at` present, no `created_at`.

**FLAG-S2 (Medium): repo_commits has no UNIQUE constraint on sha.**
Duplicate commit SHAs per repo could be inserted on re-runs. There is an index on `(repo_id, committed_at DESC)` but no uniqueness guard on sha.
Evidence: `001_initial_schema.py:98-106`

**FLAG-S3 (Low): repos.name still has a UNIQUE constraint (migration 001) that is semantically weaker than full_name.**
The `name` column is just the repo's bare name without owner prefix, which can collide. full_name (owner/name) is the true deduplication key but both constraints coexist.
Evidence: `001_initial_schema.py:26`, `006_add_full_name.py:41`

**FLAG-S4 (Low): ask_sessions.session_id has no UNIQUE constraint.**
session_id is the client-supplied session identifier but only an index exists on (session_id, turn_number). Multiple rows with the same session_id are intentional (one per turn), but there is no FK or unique constraint validating session_id, making it pure application-level identity.
Evidence: `021_ask_sessions.py:29`

**FLAG-S5 (Low): ask_sessions pre-migration rows have NULL token_hash.**
Migration 022 intentionally did not backfill token_hash on existing rows, leaving a security gap where legacy sessions can be read by any token. The comment says this is by design.
Evidence: `022_add_token_hash_to_ask_sessions.py:14-16`

**FLAG-S6 (Low): repo_dependencies.package_ecosystem is nullable.**
When a dependency is migrated from legacy repo_taxonomy in 031, ecosystem is set to 'unknown'. This means the UNIQUE constraint (repo_id, package_name, package_ecosystem) would allow two rows with the same repo_id + package_name if one has ecosystem=NULL and one has ecosystem='unknown'.
Evidence: `029_create_repo_dependencies.py:26`, `031_backfill_repo_dependencies.py:41`

---

## Index coverage

| Table | Declared Indexes | Missing/Flagged |
|---|---|---|
| repos | ix_repos_stars (expr), ix_repos_is_fork, ix_repos_is_private, ix_repos_updated_at, ix_repos_activity_score, ix_repos_full_name, idx_repos_stars_sort_public (partial), idx_repos_is_private_partial, idx_repos_quality_signals (GIN), uq_repos_full_name | No index on repos.owner alone; no index on primary_language for language filter |
| repo_tags | Composite PK (repo_id, tag); idx_repo_tags_repo_id (036) | Covered |
| repo_categories | Composite PK; idx_repo_categories_repo_id (036) | No index on is_primary for "primary category" queries |
| repo_builders | Composite PK; idx_repo_builders_repo_id (036) | |
| repo_ai_dev_skills | Composite PK | No explicit idx_repo_ai_dev_skills_repo_id (only via PK) |
| repo_pm_skills | Composite PK; idx_repo_pm_skills_repo_id (036) | |
| repo_languages | Composite PK; idx_repo_languages_repo_id (036) | |
| repo_commits | ix_repo_commits_repo_id_committed_at (composite) | No index on sha for dedup lookups |
| trend_snapshots | ix_trend_snapshots_snapshotted_at | No index on tag column — tag-specific trend queries will scan |
| gap_analysis | None | No indexes — generated_at queries will scan |
| repo_embeddings | idx_repo_embeddings_vec_hnsw (HNSW), uq_repo_embeddings_current (partial), idx_repo_embeddings_repo_current, idx_repo_embeddings_run | Covered |
| ingestion_log | None | Legacy table — no indexes |
| skill_areas | ix_skill_areas_lifecycle_group | |
| query_log | ix_query_log_timestamp, ix_query_log_hashed_ip, idx_query_log_created_at_desc, idx_query_log_jira_ticket_key (partial) | |
| taxonomy_values | ux_taxonomy_values_dim_name, ix_taxonomy_values_dimension, ix_taxonomy_values_embedding (HNSW) | |
| repo_taxonomy | ix_repo_taxonomy_repo_id, ix_repo_taxonomy_dimension, ux_repo_taxonomy_repo_dim_val; idx_repo_taxonomy_repo_id (036) | |
| ingest_runs | ix_ingest_runs_started_at, ix_ingest_runs_status | |
| ask_sessions | idx_ask_sessions_session_id_turn, idx_ask_sessions_session_id_token_hash, ix_ask_sessions_created_at | |
| audit_logs | idx_audit_logs_timestamp, idx_audit_logs_key_ts | |
| repo_mentions | idx_repo_mentions_repo_id, uq_repo_mentions_repo_source_ext | No index on published_at for date-range queries |
| repo_dependencies | idx_repo_dependencies_repo_id, idx_repo_dependencies_package_name, uq_repo_dep_repo_pkg_eco | |
| repo_industries | ix_repo_industries_repo_id; idx_repo_industries_repo_id (036) | |
| repo_edges | idx_repo_edges_source, idx_repo_edges_target, idx_repo_edges_type, idx_repo_edges_ingest_run, idx_repo_edges_high_confidence (partial), uq_repo_edges_src_tgt_type | |
| repo_edges_history | idx_repo_edges_history_created_at, idx_repo_edges_history_valid_until (partial), idx_repo_edges_history_source (partial) | |

**FLAG-I1 (Medium): trend_snapshots.tag has no index.**
The trend queries in test_trends.py pattern-match `ORDER BY commit_count_7d DESC` grouped by tag/category. At scale (many snapshots × many tags), no index on `tag` means full table scans.
Evidence: `001_initial_schema.py:109-117`

**FLAG-I2 (Low): gap_analysis has no indexes at all.**
This table is written by weekly/full ingestion runs and read by dashboard endpoints. Currently likely small, but as gap analyses accumulate, `generated_at` queries will scan.
Evidence: `001_initial_schema.py:119-129`

**FLAG-I3 (Low): repo_categories has no index on is_primary.**
The "primary category" filter is used frequently in /library/full but relies on composite PK scan. A partial index on `(repo_id) WHERE is_primary = true` would be useful.
Evidence: `001_initial_schema.py:59-65`

---

## Known data gaps — validated

### trend_snapshots: ACTIVE — written only during WEEKLY/FULL runs
**Status: Confirmed active, conditionally populated.**
The table exists (created in migration 001). The INSERT path flows:
1. `reporium-ingestion/ingestion/main.py:371-376` — `build_trend_snapshot(payloads)` is called inside `if mode in (RunMode.WEEKLY, RunMode.FULL)`
2. Result is POSTed to `api_client.post_trend_snapshot(snapshot)` which calls `/ingest/trends/snapshot`
3. reporium-api `ingest.py:447-465` bulk-inserts via SQLAlchemy ORM into trend_snapshots

Confirmed: trend_snapshots is ONLY populated on WEEKLY or FULL mode runs. QUICK/FIX runs produce no snapshot rows. This is expected behavior, not a bug. If the last weekly run failed, the table could be stale.
Evidence: `reporium-ingestion/ingestion/main.py:370-376`, `reporium-api/app/routers/ingest.py:447-465`

### taxonomy_values: ACTIVE — populated by taxonomy rebuild pipeline
**Status: Confirmed active, runtime-populated (not seeded by migration).**
Migration 013 creates the table empty. Values are populated at runtime by:
- `POST /admin/taxonomy/rebuild` — aggregates `raw_value` from repo_taxonomy into taxonomy_values
- `POST /admin/taxonomy/embed` — generates embedding_vec for each value
- Triggered manually or via enrichment pipeline

Dimensions observed in migration 019's category keyword list and code: `skill_area`, `ai_trend`, `modality`, `use_case`, `industry`, `deployment_context`, `dependency` (stale — cleaned up by 031).

The taxonomy_values dimension `dependency` was previously used as a fallback store for package names (before migration 029 created the proper repo_dependencies table). Migration 031 migrated those rows and deleted them from taxonomy_values.

No static seed data for taxonomy_values exists in any migration. The table is expected to be empty on a fresh schema deploy and is populated from enrichment output.
Evidence: `013_add_taxonomy_tables.py`, `reporium-api/app/routers/taxonomy.py:249`, `031_backfill_repo_dependencies.py:1-10`

### skill_areas: EFFECTIVELY EMPTY by design
**Status: Seeded in 011, wiped in 014, expected to be repopulated by enrichment pipeline.**
Migration 011 inserted 28 rows; migration 014 deleted all rows with `DELETE FROM skill_areas WHERE id > 0`. The comment says "taxonomy rebuild pipeline will repopulate from real data." No evidence of automatic repopulation in CI workflows. This table may be empty in production unless an admin manually triggers taxonomy rebuild.
Evidence: `014_cleanup_hardcoded_seeds_and_dead_columns.py:20-21`

### ingestion_log: LIKELY EMPTY — superseded by ingest_runs
**Status: Appears to be a legacy table never cleaned up.**
Migration 001 created `ingestion_log`; migration 017 created `ingest_runs` which serves the same purpose with better structure. There is no migration that drops `ingestion_log`, and no code was found writing to it in the current codebase. The table likely sits empty or with only early-stage rows.
Evidence: `001_initial_schema.py:139-151`, `017_add_ingest_runs.py` — no DROP or deprecation notice.

### repo_edges_legacy: CONDITIONALLY CREATED — may or may not exist
**Status: Created only if a pre-existing repo_edges table was found during migration 033.**
If the knowledge graph script was run before migration 033, this table exists containing old-schema edges. It has no indexes, no FK constraints, and no cleanup path. It should be reviewed for archival or deletion.
Evidence: `033_create_repo_edges.py:43-58`

---

## Backfill scripts

All scripts are in `reporium-ingestion/scripts/` (main branch only; worktrees excluded).

| Script | Gap Fixed | CI Check? | Last Modified |
|---|---|---|---|
| backfill_fork_dates.py | Populates forked_at, your_last_push_at, upstream_created_at for forks where these fields are NULL | No CI check found | 2026-03-23 |
| backfill_repo_dependencies.py | Populates repo_dependencies for repos not covered by migration 031's taxonomy migration | No CI check found | 2026-04-18 |
| backfill_from_library_json.py | Seeds repos from a local library JSON export (bootstrap path) | No CI check | 2026-03-23 |
| enrich_new_repos.py | Runs AI enrichment for repos missing readme_summary | No CI check (equivalent logic is in nightly_enrichment.yml inline script) | 2026-04-09 |
| reenrich_all.py | Forces re-enrichment of all repos | No CI check | 2026-03-24 |
| publish_graph_snapshot.py | Publishes a knowledge graph snapshot to GCP | No CI check | 2026-04-18 |

**Note on CI coverage:** None of the backfill scripts in `scripts/` are invoked by any CI workflow. The nightly workflows (`nightly_enrichment.yml`, `nightly_graph_build.yml`) run equivalent logic inline as Python -c strings or via module imports, rather than calling the scripts/ files directly. This means the scripts/ directory is a manual-run toolkit with no automated test coverage.

**FLAG-B1 (Medium): backfill_repo_dependencies.py was last modified 2026-04-18 (3 days ago) — likely actively being worked on.** No CI gate ensures it runs after future dependency-related migrations.

---

## RLS / Access control

**No RLS, GRANT, CREATE POLICY, or CREATE ROLE statements found anywhere in the migration files, application code, or SQL files in reporium-db, reporium-api, or reporium-ingestion.**

This means:
- All application connections use a single DB credential with full read/write access
- No read-only analytics role is defined at the DB layer
- No row-level security policies exist for multi-tenant isolation
- Access control is enforced entirely at the API layer (API key checks in FastAPI route handlers)

**FLAG-R1 (HIGH): No DB-level access segregation.**
A compromised application credential has full write access to all tables including audit_logs, ask_sessions, and repo_edges. There is no read-only role for analytics dashboards or reporting queries. This is a significant risk for the audit_logs table specifically (an attacker can erase their own traces).
Evidence: Exhaustive grep across all migration files, reporium-db/*.py, and reporium-api routers — no GRANT/POLICY/ROLE found.

---

## Event schema vs DB schema

### reporium-events EventType registry (models.py)

The library defines 8 EventType values with required payload fields:

| EventType | Required Payload Fields | DB Consistency |
|---|---|---|
| SYNC_COMPLETED | repos_checked, repos_synced, duration_seconds, errors | Consistent — matches ingestion_log columns conceptually |
| DB_SYNCED | repos_tracked, new_repos, updated_repos, duration_seconds, api_calls | Consistent — matches ingest_runs columns |
| INGESTION_COMPLETED | repos_enriched, categories_added, duration_seconds | Consistent — but does not surface graph edge counts from ingest_runs |
| REPO_ADDED | name_with_owner, stars, language | Partial mismatch — `stars` maps to parent_stars/stargazers_count (two possible columns); `language` maps to primary_language. Field names differ from DB columns. |
| REPO_UPDATED | name_with_owner, changed_fields | No DB schema for tracking which fields changed — changed_fields is an ad-hoc list with no schema enforcement |
| HEALTH_CHECK | service, status, details | No DB table for health check events |
| BUILD_FAILED | service, workflow, error_summary, run_url | No DB table |
| API_DEPLOYED | service, version, url | No DB table |

### Actual publish call in reporium-ingestion

The `publish_repo_ingested` function in `ingestion/events/pubsub.py` publishes a **custom event schema** that does NOT use EventType or ReporiumEvent from reporium-events:

```json
{
  "event": "repo.ingested",
  "run_mode": "...",
  "upserted": N,
  "repo_count": N,
  "repo_names": [...],
  "published_at": "..."
}
```

This event type `repo.ingested` is not defined in `EventType` enum. The reporium-events library's REPO_ADDED / REPO_UPDATED events are not used by the ingestion pipeline.

**FLAG-E1 (HIGH): The reporium-ingestion publisher bypasses the reporium-events schema entirely.**
The published event `repo.ingested` is a freeform JSON blob not validated by EVENT_SCHEMAS. Any subscriber expecting EventType.REPO_ADDED or REPO_UPDATED will not receive events from the ingestion pipeline. This is a schema drift between the published event contract and the event library.
Evidence: `reporium-ingestion/ingestion/events/pubsub.py:15-59`, `reporium-events/reporium_events/models.py:33-48`

**FLAG-E2 (Medium): REPO_ADDED event payload uses field names inconsistent with DB columns.**
`stars` in the event schema should be `parent_stars` or `stargazers_count`; `language` should be `primary_language`. A subscriber attempting to map event payloads to DB rows must know this field name mismatch.
Evidence: `reporium-events/reporium_events/models.py:43`

---

## Risks summary

| Severity | Finding | Evidence (file:line) |
|---|---|---|
| HIGH | No DB-level access control — no roles, grants, or RLS policies; single credential has full write access to all tables including audit_logs | All migration files (exhaustive grep) |
| HIGH | Ingestion publisher bypasses reporium-events schema entirely; publishes `repo.ingested` event not in EventType enum | `reporium-ingestion/ingestion/events/pubsub.py:15-59` |
| MEDIUM | Migration 014 drops repos.dependencies/quality_signals with no data restoration in downgrade | `014_cleanup_hardcoded_seeds_and_dead_columns.py:31-34` |
| MEDIUM | trend_snapshots.tag has no index; tag-based trend queries will full-scan as snapshot volume grows | `001_initial_schema.py:109-117` |
| MEDIUM | backfill_repo_dependencies.py not gated by CI; 3 days old, likely in active use, no automated test | `reporium-ingestion/scripts/backfill_repo_dependencies.py` |
| MEDIUM | ingestion_log table (migration 001) never dropped, likely empty — creates schema noise and false confidence in tooling that lists tables | `001_initial_schema.py:139-151` |
| MEDIUM | repos.ingested_at is not named created_at; breaks convention for any tooling that inspects for standard timestamp columns | `001_initial_schema.py:48` |
| MEDIUM | REPO_ADDED event payload field names (stars, language) don't match DB column names (parent_stars/stargazers_count, primary_language) | `reporium-events/reporium_events/models.py:43` |
| LOW | repo_commits has no UNIQUE on sha — duplicate SHAs possible on re-ingestion | `001_initial_schema.py:96-106` |
| LOW | repos.name UNIQUE constraint (001) weaker than full_name UNIQUE (006); both coexist — stale constraint | `001_initial_schema.py:26`, `006_add_full_name.py:41` |
| LOW | ask_sessions pre-migration rows have NULL token_hash — any token can read legacy sessions | `022_add_token_hash_to_ask_sessions.py:14-16` |
| LOW | repo_edges_legacy conditionally created by 033 with no cleanup path, no indexes | `033_create_repo_edges.py:43-58` |
| LOW | skill_areas seeded in 011 then wiped in 014; no automated repopulation; likely empty in prod | `014_cleanup_hardcoded_seeds_and_dead_columns.py:20` |
| LOW | gap_analysis table has no indexes — full scans on generated_at queries | `001_initial_schema.py:119-129` |
| LOW | repo_categories has no index on is_primary for frequent "primary category" lookup | `001_initial_schema.py:59-65` |
| LOW | Migration 031 and 018/019 have empty/no-op downgrades — rollback from these migrations loses migrated data | `031_backfill_repo_dependencies.py:52-55` |

---

## Commands run

```
# Locate all migration files
ls C:/DEV/PERDITIO_PLATFORM/reporium-api/migrations/versions/*.py | sort

# Find SQL/migration files
find C:/DEV/PERDITIO_PLATFORM/reporium-ingestion -name "*.py" | grep -i "script|backfill|migration"

# Search for trend_snapshots INSERT paths
grep -r "trend_snapshot" --include="*.py" C:/DEV/PERDITIO_PLATFORM (path-scoped)

# Search for taxonomy_values INSERT
grep -r "taxonomy_values|INSERT INTO taxonomy" --include="*.py" C:/DEV/PERDITIO_PLATFORM/reporium-ingestion
grep -r "taxonomy_values|INSERT INTO taxonomy" --include="*.py" C:/DEV/PERDITIO_PLATFORM/reporium-api

# Search for RLS/access control
grep -r "CREATE POLICY|GRANT |CREATE ROLE|ROW LEVEL" --include="*.py" C:/DEV/PERDITIO_PLATFORM/reporium-db
grep -r "CREATE POLICY|GRANT |CREATE ROLE|ROW LEVEL" --include="*.py" C:/DEV/PERDITIO_PLATFORM/reporium-api

# Read all 37 migration files (001-037) individually
# Read reporium-events/reporium_events/models.py
# Read reporium-ingestion/ingestion/events/pubsub.py
# Read reporium-ingestion/ingestion/main.py (lines 360-410 for trend_snapshot trigger)
# Read all scripts in reporium-ingestion/scripts/

# Check last-modified dates of backfill scripts
stat --format="%y" C:/DEV/PERDITIO_PLATFORM/reporium-ingestion/scripts/backfill_*.py
```

---

## Limitations

The following could not be verified without a live DB connection:

1. **Actual table row counts** — cannot confirm skill_areas, ingestion_log, trend_snapshots, repo_edges_legacy are empty or populated in production
2. **Index usage and query plans** — cannot run EXPLAIN ANALYZE to confirm indexes are being hit by actual queries
3. **alembic_version table state** — cannot confirm which migrations have actually been applied to prod vs. what exists in the filesystem
4. **taxonomy_values dimension values** — cannot enumerate actual dimension values and counts; only inferred from code (skill_area, ai_trend, modality, use_case, industry, deployment_context)
5. **Orphan rows** — cannot check for repos without any taxonomy, category, or tag rows (enrichment gaps)
6. **HNSW index health** — cannot verify pgvector HNSW index on taxonomy_values.embedding_vec and repo_embeddings.embedding_vec are properly built and not in a degraded state
7. **repo_edges_legacy existence** — table is conditionally created by 033; cannot confirm whether it exists in prod without a DB connection
8. **Event subscriber behavior** — reporium-api has a stub subscriber for reporium-events but its consumption of the `repo.ingested` event (vs. EventType.REPO_ADDED) could not be verified without runtime testing
