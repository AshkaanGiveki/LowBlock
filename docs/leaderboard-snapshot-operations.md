# Leaderboard scoring, publication, and cache operations

This document describes the proposed snapshot pipeline. It is isolated on this branch until production-shaped validation is complete.

## Data flow

1. The nightly worker synchronizes the bounded football schedule window. Provider failures abort the daily operation.
2. The score engine checks recently completed fixtures. Unchanged points/results/eligibility are skipped.
3. Score changes and pending **USER** / **MATCH** rebuild markers are written in the same MongoDB transaction.
4. On each run, pending users are reconciled from the authoritative `predictionScores` ledger; the publisher then computes affected standings and atomically publishes their top 100 rows in `leaderboardPublications`.
5. Queue markers are deleted **only after** the rank aggregates and publications succeed. In the event of a crash, the next run can replay the remaining markers.
6. A rotating daily audit checks up to 100 older, already stored fixtures for scoring corrections without new football-provider requests. If a previously scored fixture becomes non-final, its credited score rows are retracted transactionally and all affected scopes are reconciled.
7. After successful publication, only affected final-round winner tables and related automatic award checks are refreshed before queued work is acknowledged.

### Exactly which ranking scopes are refreshed?

The publisher prints a `lowblock.leaderboard_publication` JSON log with `publishedScopes`, `published`, `skipped`, `changedMatchCount`, `clubPoliciesChanged` and `durationMs`. The log is authoritative for **which** scopes a given worker run published and **how many**.

| Trigger | Published scopes |
| --- | --- |
| No changed scores; no club-rule change | Only newly missing current and previous week snapshots; no rebuilt long-term rankings |
| Changed globally eligible score | Global weekly, previous weekly (only if missing or affected; see note), affected season, global history, changed tournament edition, opted-in club period/season/history |
| Changed non-global score | Changed tournament edition and affected club period/season/history where selected; global long-term totals unchanged |
| Club competition selection change | Only affected club weekly, season and historical scopes |
| First full publication | Current and previous Global weekly, all scored global seasons and history, participating tournament editions and club scopes |

The **number of legacy aggregate rows** is distinct from the number of published rankings. A single player can have many `leaderboardStats` rows; the worker's `leaderboards` count reports rebuilt aggregate rows, while `publications.published` reports published scopes.

**Note:** At present, the publisher conservatively refreshes an affected club/global weekly period whenever a qualifying score changes, even if its match belongs to a different week. This favors correctness over minimum write volume and can be optimized further by threading the changed match's kickoff week into scope selection. It never changes actual scores.

### Data retained

- `predictions`: user-entered prediction source records.
- `predictionScores`: canonical scoring ledger (one score per player/match; immutable historical membership-at-lock).
- `leaderboardStats`: existing per-user aggregates used by legacy views.
- `leaderboardRebuildQueue`: idempotent retryable dirty markers for score changes.
- `leaderboardPublications`: read-only top-100 snapshots by scope.
- `leaderboardAuditState`: historical-audit cursor.

## Bootstrap (before any production rollout)

1. Check `pnpm lint` and `pnpm test`. A failing full suite blocks broad production rollout.
2. Validate the database is reachable and indexes are created.
3. Run `pnpm rebuild:leaderboard-publications` **once** to populate current and historical snapshots. The command does not rewrite prediction scores.
4. Verify current weekly, season, all-time, club custom tournament sets and tournament edition rows against an independently queried `predictionScores` reference.
5. Confirm public responses use published rows and check `leaderboardRebuildQueue` remains empty after a successful run.
6. Test result correction, out-of-order scoring, empty week, late-discovered fixture, club competition update and concurrent worker operations.
7. Confirm public API caching does not leak personalized predictions.

Never discard `predictionScores` or lifetime totals while deploying a ranking cache.

## Cache policy

| Surface | Caching |
| --- | --- |
| Global/Club/Tournament main standings | MongoDB published top-100 per scope, queried by indexed `_id`; Next.js server cache (15 seconds where enabled) plus the leaderboard API's short CDN cache |
| Deeper leaderboards and uncommon filters | Authoritative query fallback; no false empty snapshot beyond first 100 |
| Informational user/prediction/round totals | 120-second server data cache |
| Public fixtures on matches and tournament pages | Shared 15-second server data cache |
| Private saved predictions and personalized match exclusions | Uncached; client/API responses remain private |
| Homepage rank | Read from published top-100 when possible; deep-rank fallback |
| Other app pages | Audit independently; do not blindly apply public caching to authenticated responses, match-lock checks, or rapidly changing live scores |

## Monitoring and failure behavior

- Run `pnpm worker:status` for `leaderboardHealth.pendingRebuildItems`, `globalHistoricalPublishedAt` and `publicationVersion`.
- Search worker logs for `lowblock.leaderboard_publication` to identify rebuilt scopes, counts and build time.
- On a publisher failure, dirty markers remain; previous complete published versions are retained.
- The first snapshot build can be expensive. Run once outside peak traffic; the daily path should only rebuild affected scopes.
- A weekly period rollover creates a new scope key rather than modifying the prior period's identity.
- The historical audit checks **stored** fixtures and detects score disagreements with those stored fixture results. It cannot detect provider corrections never fetched into the local fixture database. Add a separate bounded provider correction pass where the provider supports one.
- The historical audit now includes non-final fixtures and retracts previously credited scores when an already stored fixture becomes non-final. Tests against real fixture status transitions are still required before rollout.
- Automatic award *grants* are recalculated after affected results. Historical award revocation after a provider correction needs a separate explicit policy, since permanent trophies should not be deleted silently.
- Club selection updates currently recompute affected club history using present eligibility rules, matching the existing implementation. If rules must apply only prospectively, preserve and enforce eligibility snapshots per competition and change version.
- Previous week's scores, rankings, ties, and winner awards must be verified against legacy code before rollout. Existing Friday UTC boundary semantics were not changed here.
- There is no production database latency benchmark or live reconciliation yet.

## Rollback

Keep the branch unpublished until review. If it is later deployed, restore the prior application commit without deleting score/history collections. New auxiliary snapshot and dirty-queue collections do not replace canonical prediction records. Resolve pending queue entries and verify historic standings before re-enabling snapshot reads.
