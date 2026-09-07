# Performance measurement record

## Local HTTP baseline

Measured 2026-09-07 against the local Next.js server with `curl` transfer timing. `time_starttransfer` is time to first response byte; it is not a browser LCP measurement.

| Route | Status | TTFB (s) | Response bytes |
| --- | ---: | ---: | ---: |
| `/` | 200 | 2.367 | 100,759 |
| `/leagues` | 200 | 1.779 | 139,853 |
| `/how-scoring-works` | 200 | 1.368 | 48,726 |
| `/matches` | 200 | 1.409 | 180,016 |
| `/leaderboard` | 200 | 1.523 | 885,029 |
| `/lowblock` | 200 | 1.787 | 967,381 |

The first pass exposed a homepage 500 caused by MongoDB `ObjectId` values being passed into a Client Component. The match page now projects a plain public DTO before crossing the Server/Client boundary, and the homepage returns 200 in the follow-up measurement. The large leaderboard and lowblock payloads remain visible bottlenecks.

## Database execution plans

`npm run explain:performance` completed successfully against the configured database:

- `matches`: 1 ms, 317 keys/docs examined, 30 returned; the plan still performs an in-memory sort.
- `leaderboardStats`: 0 ms, 717 documents examined, 17 returned; it used a collection scan and in-memory sort because the performance indexes have not been applied to this database.
- `predictionScores`: 9 ms, 1,838 keys/docs examined, 20 returned; the season index was used but kickoff ordering still sorted in memory.

These results prove the diagnostic path works, but they are not production measurements. Run `npm run migrate:foundation` and then rerun the explain script against the deployment database after reviewing the index plan.

## Browser metrics

The application now emits LCP, INP, CLS, long-task, navigation, and load telemetry to `/api/telemetry`. The configured in-app browser was unavailable during this audit, so no browser-vitals sample is claimed here. Production logs must be sampled after deployment.

## API timing sample

`GET /api/leaderboards?limit=20` returned `200` locally with:

`Server-Timing: db=0.39 ms, leaderboard=1257.15 ms, total=1257.84 ms, serialize=1.71 ms`

The response reported `X-Response-Bytes: 331458` and `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`. This confirms the instrumentation is live and also confirms that the leaderboard query remains the dominant local bottleneck.
