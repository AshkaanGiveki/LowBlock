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
