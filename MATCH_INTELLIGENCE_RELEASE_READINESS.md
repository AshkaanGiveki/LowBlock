# LowBlock Match Intelligence | Release gate (develop)

**Status:** code-complete behind a production-off cohort gate; **NOT authorized to merge or release**. This document records what the code and tests establish, not a claim that live SportsAPI coverage or 500-viewer capacity has been proven.

## Scope now implemented

| Section | Source | Expected UI behavior | Verification |
| --- | --- | --- | --- |
| Score, minute, match status | Bounded SportsAPI WebSocket, Mongo canonical fixture and optional Redis snapshot | Live values while supplied; stale/final label; no fictional minute | Normalizer, state and websocket unit tests |
| Goal/card/substitution/VAR timeline | Persisted structured WS incidents | Structured incidents only, not unsupported written commentary | WS incident regression tests |
| Live statistics | WS stat groups | Show only provided fields, otherwise unavailable | WS statistics regression tests |
| Formation, starting XI, substitutes | WS lineups | Render available player and formation fields, otherwise unavailable | WS lineup regression tests |
| Team last-five form | Local completed fixtures of identical provider | Partial-import coverage disclosure | Local history regression tests |
| Actual team-vs-team H2H | Local completed fixtures of identical provider | Up to ten imported meetings; never prediction H2H | Local history regression tests |
| Football league standings | Official provider response strictly parsed, cached by competition/season | Only verified official table; disabled until provider response validated | Strict standings parser tests, account coverage **unverified** |

## Read/ingestion architecture
- One Mongo-lease owner for upstream WebSocket; no WS per browser. Bounded active/near-kickoff subscriptions, removal of obsolete subscriptions, no odds.
- Cached-only match intelligence API with ETag / 304, plus legacy live endpoint via JSON polling, never browser SSE.
- Browser polling only when tab is visible; jittered; ends when fixture finishes.
- Optional Upstash Redis live snapshots with short TTL; Mongo is durable fallback. Index-backed bounded local history and materialized competition standings.
- Global WS feed ignored for matches beyond subscribed worker fixture set; dormant snapshots pruned to avoid unbounded memory.
- Debounced Mongo persistence always flushes trailing final scores. Distributed scoring lease retries contention and renews for long passes.
- Worker health heartbeat records socket connection, subscription count, pending writes and RSS.

## Provider quota boundary
- Every LowBlock REST call reserves **one** Mongo atomic attempt before fetching, across multiple workers.
- Hard local budget **60 attempts of 100 daily**; tests cover 100 simultaneous callers, fail-closed Mongo outages, six prebooked hosted attempts plus 54 app attempts.
- `server-deploy/develop` nightly hosted workflow prebooks six attempts for three dates x up to two pages each **before** any GitHub-hosted direct curl. Reject if the hosted secret's fingerprint differs from the production worker key.
- Legacy one-time direct-curl workflow also prebooks three attempts and requires the identical provider key.
- Other older one-off recovery workflows that import from the shared REST client inherit its quota; manually spawned/unregistered external consumers **must not** call the same provider key unless they use this reservation boundary. Provider-side usage should be cross-checked prior to rollout.
- Do **not** activate the hosted-workflow preflight on `main` until the compatible `LowBlock` app image with `scripts/reserve-sportsapi-quota.ts` is deployed. Failing closed is safer than unreserved fetches.
- The hosted job currently always reserves the worst-case six attempts, even if fewer pages exist.

## Release switches
- Production **defaults off**: `MATCH_INTELLIGENCE_ROLLOUT_PERCENT` missing/0 hides the Match Intelligence panel.
- Set 1–99 for deterministic signed-in user cohorts; guests remain off. Set 100 for everybody including guests.
- `NEXT_PUBLIC_LOWBLOCK_PREVIEW=true` shows the feature on the isolated preview regardless of cohort.
- `SPORTSAPI_STANDINGS_SYNC_ENABLED` remains false until actual account coverage and strict official standings payload are confirmed.
- Only the dedicated worker may set `LOWBLOCK_LIVE_INGESTION_WORKER=true`, after Mongo lease acquisition. Keep provider WS disabled on Vercel and on staging without credentials.
- To disable the user-facing feature, reset `MATCH_INTELLIGENCE_ROLLOUT_PERCENT=0` and restart the app; stopping the ingestion worker separately is possible without losing cached history.

## Required release validation
1. LowBlock `develop` CI: TypeScript, Vitest (including concurrent quota/scoring/persistence/rollout), and Next.js production build **must pass on latest commit**.
2. Isolated `develop` preview deployment: copied public fixtures only, no user or prediction data, no provider credentials or provider calls.
3. Preview API and conditional ETag validation: correct response, stable 304, provider collision isolation.
4. Public preview smoke: match-list page and individual match route must render fully over HTTPS; identify any long-lived streaming response.
5. Isolated 50 concurrent / 200 request cached-intelligence load run with p95 ≤4 seconds and zero non-200/304 responses. Larger 100–500 cohorts require an agreed safe test window.
6. Validate **actual** SportsAPI WS account feed: sample scores, incidents, stats, lineup availability by competition, staleness/reconnect and missing-data states. Do not consume additional provider REST calls for this test.
7. Validate the official standings REST schema/account coverage before enabling its opt-in worker fetch, respecting existing quota.
8. Check production operational readiness: production Mongo indexes, Upstash credentials if used, worker ownership, HTTP memory, durable score outcomes, rollback process, provider usage and no unrelated code merged.
9. Only after these pass, propose explicit approved merge/deployment sequence; do not alter `main` automatically.

## Safe rollout order (requires explicit authorization)
1. Deploy compatible LowBlock app with production rollout percent 0, provider worker disabled until monitored.
2. Deploy updated `server-deploy` hosted job with shared quota preflight; confirm key match and budget without triggering provider calls.
3. Bring up one leased worker under monitoring, verify actual WS payloads and scoring.
4. Enable small signed-in cohort (e.g. 5%) and review latency, Mongo writes, RAM, Redis, 304 ratio and errors; advance percentages only after checks.
5. Keep ability to turn rollout back to 0 immediately. Avoid a second unleased WS owner.

## Evidence and limits
- Source of feature requirements: user's 15 Nov 2026 `LowBlock Match Intelligence: Technical Feasibility & Architecture Report`.
- Local fixtures and unit tests verify **behavior of code and contract**. They do not certify universal coverage of SportsAPI live statistics, lineups, historical fixtures or commentary.
- Some competitions may have no standings or incident data even when implementation is correct. Show those sections as unavailable, not zeros.
- `main` and production app remain untouched by these `develop` changes.
