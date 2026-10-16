# H2H Mode - Complete Implementation Checklist

All implementation requirements for the H2H beta are checked below. The mode is additive and disabled by default with H2H_ENABLED=false.

## Product and qualification

- [x] Friday-through-Thursday week in APP_TIMEZONE.
- [x] Eight players per group and seven matchdays; every pair faces once.
- [x] Previous H2H winner first; next seven distinct eligible users from previous normal Club leaderboard.
- [x] Opt-out applies next week and deterministically replaces the user.
- [x] Larger Clubs receive additional independent groups.
- [x] Cancelled weeks produce no winner and no qualification/ticket carryover.
- [x] H2H is isolated from normal leaderboards.

## Competitions, teams, ratings

- [x] Allowlist is GB1, ES1, L1, IT1, FR1, IR1, SA1, GB2, TR1, UCL, UEL, FRIENDLY, NATIONS, ACLE.
- [x] The generic league.h2h flag and other LEAGUES entries cannot expand H2H.
- [x] Canonical centralTeamId is the only team identity; provider IDs are mappings.
- [x] Every Central Team has immutable unique numericTeamId.
- [x] New numeric IDs use an atomic counter and assigned IDs are never reused.
- [x] Reviewed JSON/Markdown files are the complete approved rating source.
- [x] All reviewed teams receive exact integer ratings from 1 to 100.
- [x] Missing reviewed mappings block synchronization; no silent automatic rating.
- [x] Youth/senior identity separation, aliases, provider reconciliation, and duplicate checks are covered.
- [x] Tournament weights are explicit, versioned, audited, and range-validated from 1.00 to 1.20.
- [x] Validation reports cover canonical IDs, numeric IDs, ratings, classifications, codes, aliases, and missing data.

## Fixture scoring and schedule

- [x] Match score is (home rating + away rating) multiplied by tournament weight.
- [x] Unapproved, missing-rating, missing-weight, invalid-kickoff, cancelled, postponed, abandoned, and non-canonical fixtures are excluded.
- [x] Approved fixtures are sorted deterministically by score, kickoff, and stable match ID.
- [x] The full week is scheduled in advance.
- [x] Each slate targets five fixtures; future-day fixtures may fill an earlier slate.
- [x] Four fixtures are the valid fallback; fewer than four cancels the complete week.
- [x] A football fixture can occur in only one slate per week.
- [x] Later matchdays are globally reserved before assignments are accepted.
- [x] Candidate buffers, replacement fixtures, selection reasons, rating/weight/version snapshots, and failure candidate pools are recorded.
- [x] Draft schedules are private; validation is required before publish; published/completed schedules are immutable by default.
- [x] Generation, validation, publication, rebuild, correction, and cancellation are idempotent and audited.

## Predictions, Gold, scoring, privacy

- [x] One canonical prediction is reused by all H2H consumers.
- [x] A prediction remains editable until its fixture kickoff.
- [x] Opponent prediction values and submission status are hidden before kickoff and revealed after kickoff.
- [x] One Gold fixture is selected per player per slate before the slate's first kickoff.
- [x] Gold doubles only that fixture's football-prediction points.
- [x] Server-side deadlines do not trust client timestamps.
- [x] Base points, Gold bonus, final fixture points, slate totals, pair scores, provisional/final state, and corrected-result rebuilds are persisted.
- [x] H2H results use 3/1/0 points and deterministic tie ordering.
- [x] Standings store played, wins, draws, losses, H2H points, total slate points, normalized averages, score difference, exact predictions, Gold selections, Gold wins, rank, and qualification status.

## Persistence and indexes

- [x] h2hWeeks, h2hLeagues, h2hLeagueMembers, h2hSlateFixtures, h2hMatchResults, h2hStandings, h2hRewards, and h2hAuditEvents are durable.
- [x] Matchdays are represented by durable league slate projections.
- [x] Unique indexes prevent duplicate leagues, members, fixtures, results, standings, rewards, and audit events.
- [x] centralTeams.numericTeamId has a unique sparse index.
- [x] H2H indexes are created only when the feature is enabled.
- [x] Historical schedules preserve all original values.

## Player APIs

- [x] GET /api/h2h/config
- [x] GET /api/h2h/current
- [x] GET /api/h2h/week/[weekId]
- [x] GET /api/h2h/league/[leagueId]
- [x] GET /api/h2h/league/[leagueId]/standings
- [x] GET /api/h2h/league/[leagueId]/schedule
- [x] GET /api/h2h/matchday/[matchdayId]
- [x] POST /api/h2h/predictions
- [x] PUT /api/h2h/gold
- [x] GET/PUT /api/h2h/preferences
- [x] GET /api/h2h/history
- [x] GET /api/h2h/rewards
- [x] Existing authentication, club membership, guest rules, prediction uniqueness, and feature-gate behavior remain compatible.

## Admin, operations, and notifications

- [x] Schedule preview, generation, publication, cancellation, settlement, and data-quality endpoints exist.
- [x] Team-rating and tournament-weight editors exist and audit changes.
- [x] Cron generation and settlement are protected.
- [x] H2H roster publication creates deduplicated in-app notification deliveries.
- [x] Roster, start, opponent, Gold deadline, kickoff, result, rank, qualification, champion, cancellation, and opt-out event types are represented for delivery/audit.
- [x] Existing Telegram/Bale preference and delivery infrastructure remains compatible.
- [x] API authentication, admin authorization, deadline validation, provider-ID isolation, replay-safe upserts, audit logging, and rate-limit/timing extension points are covered.
- [x] Health, quality, latency, lock-violation, duplicate-fixture, and generation-failure reporting scripts exist.
- [x] Feature flag, safe migration, staging preview, gradual rollout, and rollback behavior are documented.

## UI and UX

- [x] H2H is a top-level desktop/mobile mode.
- [x] Week, group, roster, opponent, rank, qualification, standings, fixtures, kickoff times, and Gold deadline are available.
- [x] Four-fixture fallback, live/final states, lock states, opponent reveal, cancelled-week state, and unavailable state are represented.
- [x] Responsive desktop/mobile layout and English/Persian/RTL translation primitives are preserved.
- [x] Profile opt-out is visible and effective from the next week.

## Scripts and tests

- [x] Rating export, inspection, validation, synchronization, numeric-ID migration, schedule generation, schedule validation, result rebuild, and health-report scripts exist.
- [x] H2H tests cover ratings, weights, IDs, eligibility, selection, timezone boundaries, seven-day scheduling, future-day fill, four-fixture fallback, duplicate prevention, scoring, Gold, privacy, cancellation, rebuild idempotence, and multiple groups.
- [x] Production build and TypeScript validation pass.
- [x] Existing normal game modes remain unchanged when H2H_ENABLED=false.

## Definition of done

- [x] Canonical identities, numeric IDs, approved ratings, approved competitions, deterministic player selection, advance scheduling, no duplicate fixtures, 5/4 slate rules, cancellation without carryover, kickoff privacy, Gold deadlines, persisted standings/results, admin controls, UI entry points, operational scripts, and feature-gated compatibility are complete.

