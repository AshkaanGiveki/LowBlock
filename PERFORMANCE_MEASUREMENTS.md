# Performance measurement record

## Local HTTP baseline

Measured 2026-09-07 against the local Next.js server with `curl` transfer timing. `time_starttransfer` is time to first response byte; it is not a browser LCP measurement.

| Route                | Status | TTFB (s) | Response bytes |
| -------------------- | -----: | -------: | -------------: |
| `/`                  |    200 |    2.367 |        100,759 |
| `/leagues`           |    200 |    1.779 |        139,853 |
| `/how-scoring-works` |    200 |    1.368 |         48,726 |
| `/matches`           |    200 |    1.409 |        180,016 |
| `/leaderboard`       |    200 |    1.523 |        885,029 |
| `/lowblock`          |    200 |    1.787 |        967,381 |

The first pass exposed a homepage 500 caused by MongoDB `ObjectId` values being passed into a Client Component. The match page now projects a plain public DTO before crossing the Server/Client boundary, and the homepage returns 200 in the follow-up measurement. The large leaderboard and lowblock payloads remain visible bottlenecks.

## Database execution plans

`npm run explain:performance` completed successfully against the configured database:

- `matches`: 1 ms, 317 keys/docs examined, 30 returned; the plan still performs an in-memory sort.
- `leaderboardStats`: 0 ms, 717 documents examined, 17 returned; it used a collection scan and in-memory sort because the performance indexes have not been applied to this database.
- `predictionScores`: 9 ms, 1,838 keys/docs examined, 20 returned; the season index was used but kickoff ordering still sorted in memory.
- `detailedLeaderboard`: 0 ms in the current fixture set, using the season/league compound index before grouping.
- `clubLeaderboard`: 1 ms, 717 documents examined; the configured database has not received the performance index, so this is currently a collection scan.
- `currentUserRank`: 0 ms, 717 documents examined; the configured database has not received the performance index, so this is currently a collection scan.

The Mongo client now emits one structured `lowblock.db.query` event for each non-handshake command with operation name, duration, result count (when provided), and failure status. This makes per-query timing available in deployment logs without recording query contents or credentials.

These results prove the diagnostic path works, but they are not production measurements. Run `npm run migrate:foundation` and then rerun the explain script against the deployment database after reviewing the index plan.

## Browser metrics

The application emits LCP, INP, CLS, long-task, navigation, and load telemetry to `/api/telemetry`.

Measured 2026-09-07 in the local in-app browser against the development server. These are cold/dev measurements and should not be compared directly with the production table above:

| Route       | Navigation TTFB |     LCP |    CLS | Route result                               |
| ----------- | --------------: | ------: | -----: | ------------------------------------------ |
| `/matches`  |         2.324 s | 2.508 s | 0.0000 | 200; 30 match cards rendered               |
| `/lowblock` |         5.439 s | 5.744 s | 0.0000 | 200; summary and leaderboard rows rendered |

Long-task telemetry was emitted on both routes, including initial samples of 441 ms on `/matches` and 416 ms on `/lowblock`. INP was instrumented but no interaction exceeded the browser observer threshold during this pass. The browser navigation from `/matches` to `/lowblock` also completed successfully with route content visible after navigation.

## API timing sample

`GET /api/leaderboards?limit=20` returned `200` locally with:

`Server-Timing: db=0.39 ms, leaderboard=1257.15 ms, total=1257.84 ms, serialize=1.71 ms`

The response reported `X-Response-Bytes: 331458` and `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`. This confirms the instrumentation is live and also confirms that the leaderboard query remains the dominant local bottleneck.

## Production hosting sample

Measured 2026-09-07 against `https://www.lowblock.ir` and the public Vercel deployment:

| Request                      | Status |    TTFB |   Total | Cache evidence                        |
| ---------------------------- | -----: | ------: | ------: | ------------------------------------- |
| `/`                          |    200 | 0.504 s | 1.390 s | private, `MISS`                       |
| `/leagues`                   |    200 | 0.684 s | 0.841 s | public, `HIT`                         |
| `/how-scoring-works`         |    200 | 0.620 s | 0.622 s | public, `HIT`                         |
| `/matches`                   |    200 | 0.494 s | 0.861 s | private, `MISS`                       |
| `/leaderboard`               |    200 | 0.522 s | 2.143 s | private, `MISS`                       |
| `/api/leaderboards?limit=20` |    200 | 1.481 s | 1.862 s | public header, `MISS` on two requests |

The public route responses prove the deployment is serving static/ISR-style cached content on Vercel while keeping user-sensitive pages and API responses uncached. The API response was intentionally not recorded with a body because it contains user avatar data. The preview deployment URL is Vercel-protected, so measurements use the public production domain.

## Index verification after deployment

The performance indexes were applied to the configured deployment database (`test`) with `npm run ensure:performance-indexes` and verified with `listIndexes`. The relevant indexes are `leaderboard_rank_order`, `prediction_scores_scope_time`, and `matches_public_schedule`.

After index creation, explain plans showed:

- canonical leaderboard: 17 keys and 17 documents examined, no in-memory sort;
- current-user rank: index-backed OR branches, zero documents examined for the sampled rank;
- club leaderboard: 285 keys and 20 documents examined, with the expected final sort after the scope-prefix scan;
- match schedule: 317 keys and 30 documents examined; status filtering is index-backed, but kickoff ordering still sorts in memory;
- detailed leaderboard: the season/league compound index is used before grouping.

Read-only recheck on 2026-09-07 confirmed the same index-backed plans: canonical leaderboard examined 17 keys/docs for 17 rows, club leaderboard examined 285 keys and 20 documents, and current-user rank used four OR branches over `leaderboard_rank_order` with zero documents examined for the sampled user. The match schedule and prediction-score plans still contain in-memory kickoff sorts, so those remain measured follow-up work rather than being marked fully index-supported.

The browser service was requested for real LCP, INP, CLS, long-task, and client-navigation samples, but the environment reported that no browser is available. Those metrics remain explicitly unmeasured rather than inferred from server timing.

## Validation

- `npm test`: 12 files and 33 tests passed.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm run build`: passed with valid audit environment values; 55 static pages generated.
- `npm run explain:performance`: passed against the configured database and recorded the detailed, club, and current-user plans above.
