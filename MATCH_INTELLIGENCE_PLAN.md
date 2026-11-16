# Match Intelligence delivery plan (develop only)

## Product scope
One football match experience with score/status, incident timeline, statistics, lineups/formation/substitutions, recent form, real team-vs-team H2H, competition standings and commentary when genuinely available. Prediction H2H and prediction leaderboards are separate products.

## Non-negotiable limits
- Never modify or deploy main as part of development. No production database writes from develop.
- SportsAPI free plan: maximum 60 REST attempts per provider day **across every caller**, preserving 40/100. The existing Mongo reservation protects only callers that use the shared REST client. Audit all independent scheduled jobs before claiming global enforcement.
- One upstream WebSocket ingestion owner; viewers read cached Mongo snapshots through a bounded fan-out. Do not open a provider socket per viewer. No odds or gambling integrations.
- Do not assume SportsAPI supplies historical H2H, standings, form or commentary over WebSocket. Verify provider capabilities without spending REST quota; unsupported fields must be labelled unavailable.
- A finished match must be scored idempotently; batch work and avoid full global rebuild per match.
- Do not invent data or substitute prediction rankings for football standings.

## Governing specification
Implement according to the user-provided **LowBlock Match Intelligence: Technical Feasibility & Architecture Report** (15 November 2026). This report supersedes conflicting suggestions in this plan.

- **Dedicated worker**: exactly one SportsAPI upstream WebSocket owner, no provider subscriptions initiated by page views; bounded live/near-kickoff subscriptions and removal of stale channels, no odds.
- **Redis**: latest score, clock and stats with short TTL; MongoDB: durable incidents, lineups, final results and historical data. Coalesce writes on meaningful changes.
- **Delivery**: cache-first LowBlock REST endpoints with ETag/304; visible-tab-only, jittered browser polling; adaptive 15–30s scores/incidents, 30–60s stats, 1–5m lineups near kickoff, 15–60m standings, 1–6h form, daily H2H, no polling after final.
- **Historical integrity**: local last-five form and last-ten H2H only with coverage disclosure; real league tables require verified complete fixtures or provider standings, never prediction rankings.
- **UI**: mobile-first progressive disclosure, pre-match context, score, events, stats, lineups, form, H2H, standings; distinguish structured event descriptions from unverified narrative commentary.
- **Observability**: sockets, channels, events/minute, writes/minute, cache hit rate, p95 response latency, memory, reconnects and stale-data alerts.
- **Rollout**: baseline and provider capability matrix first, staging-only integration and replay, then measured 50–500 viewer load test, gated small-cohort rollout; no production rollout without authorization.
- **No assumption of SportsAPI account coverage**: confirm actual payloads and quota costs before promising any section.

## Architecture and delivery gates
1. **Data contract and read API**: read canonical matches, persisted live matchDetails and matchInsights in one bounded Mongo query set. No provider requests. Expose per-section availability. DONE: /api/matches/[matchId]/intelligence (initial contract).
2. **Provider capability inventory**: map documented WS payloads and existing DB fields to each requested section; identify missing history ingestion. Add fixture replay tests using stored examples, no provider calls.
3. **Read-side UI**: one responsive match drawer/page with tabs Overview, Timeline, Stats, Lineups, Form, H2H, Standings. Render explicit unavailable/awaiting-data states; never fake scores, formations or rankings.
4. **Ingestion**: one managed WS connection, persisted canonical snapshots, deduplication, reconnect/recovery checks and backpressure. Reuse existing matchMonitor, no per-viewer sockets.
5. **Historical sections**: derive recent form and H2H from indexed canonical completed matches (limited bounded queries); calculate real standings only from verified season fixtures or a documented provider source. Never extrapolate from incomplete coverage.
6. **Scoring**: idempotent completed-match queue and incremental affected-user updates; verify global and club aggregates.
7. **Quotas and jobs**: inventory server-deploy runner, sync commands, bot and cron; enforce one shared reservation boundary. Verify UTC/provider-day semantics and 100-concurrent-request race test.
8. **Staging**: isolated database and credentials, disabled production jobs, no live REST requests for CI. Typecheck, tests, build, fixture replay, browser smoke tests and load tests must pass before requesting a merge.

## Performance targets to verify in staging
- One match intelligence read uses at most three indexed Mongo lookups and zero provider requests.
- No browser view creates a provider WebSocket.
- Historic queries are bounded (e.g. last 5 fixtures per team, last 10 meetings).
- Explicit cache freshness and fallback state on each section.
- No unbounded scans, full-season recomputations per viewer, or duplicate provider calls.

## Progress
- Phase 1 consolidated read endpoint committed to develop.
- All subsequent phases remain open until tested. Passing CI does not certify provider coverage, live data correctness, or production readiness.
