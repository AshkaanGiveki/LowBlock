# LowBlock Admin Panel

This file is the product and implementation specification for the responsive LowBlock administration console. The panel is intended for the dedicated `admin.lowblock.ir` hostname, with desktop and mobile layouts, and uses the production app's existing user/session system.

## Access and safety

- Require a signed-in administrator (`role: ADMIN/admin` or `isAdmin: true`) in every page data and mutation route. Hiding controls is never authorization.
- Keep the admin console out of search indexes and expose no secrets, password hashes, session tokens, or raw provider credentials.
- Record actor, action, target, timestamp, outcome, and a minimal before/after summary for administrative changes.
- Use preview/dry-run and explicit confirmation for high-impact operations. Never silently replace a published Super League slate or discard player predictions / Golden Picks.
- Keep destructive actions reversible where possible; use soft suspension/archive and explain dependencies before irreversible deletion.
- Bound every list, validate all input, and return only fields needed by the panel.

## Modules

1. **Operations dashboard** — app/database/provider/worker status, current Tehran football day, next fixtures, live/results counts, scoring backlog, current Super League round, recent sync and rebuild runs, API request budget, warnings, and links to the affected records.
2. **Matches and fixture control** — searchable/paginated fixtures, source/provider ID, tournament, kickoff, status, score, result freshness, and prediction counts; inspect duplicate/cancelled/stale fixture flags; safe correction workflow with linked prediction-impact preview.
3. **Provider and sync operations** — provider health, last complete/paginated sync, sync history, request usage, partial-page warnings, retries, detail-refresh queue, and an explicit sync action with result summary.
4. **Tournament catalog** — supported/unsupported state, display names in English and Persian, logo, provider competition IDs, season, and flags controlling global leaderboard, Super League eligibility, and default club leaderboard. Make score/weight behavior visible and do not imply that a stored setting is active unless scoring consumes it.
5. **Teams and identity mapping** — canonical teams, provider IDs/aliases, country, crest/federation logo, duplicate mapping review, and safe merge preview.
6. **Super League operations** — week/matchday lifecycle, eight-player eligibility, candidate fixtures with criteria/rating breakdown, preview and publish, protected published slates, match/prediction lock state, Golden Picks, result settlement, rewards, final standings, and repair history. Freeze published fixture identity once users can predict.
7. **Scoring and leaderboards** — scoring rule visibility, finished-but-unscored matches, dry-run recalculation diff, idempotent score rebuild, global/club/weekly standings, and adjustment history. Preserve prediction records and explain point changes before apply.
8. **Users and authentication** — user search, profile and account/platform links, join date/activity, prediction history, admin role grant/revoke with confirmation, session/account support, abuse flags, and suspension/reactivation. Keep role changes and account actions audited.
9. **Clubs and community** — clubs, owners, active members, capacity, visibility/discovery, join requests/invitations, tournament preferences, standings, and owner transfer/closure with membership-impact preview.
10. **Notifications and integrations** — in-app/Telegram/Bale queues, delivery status/retries, preferences, reminders, channel settings, webhook health, and masked integration configuration.
11. **Awards and rewards** — award issuance/reveal state, duplicate/idempotency checks, reward history, and safe repair workflows.
12. **Content and localization** — supported competition/team display names, Persian equivalents, help/scoring copy, logos, and localization completeness.
13. **Analytics and reports** — signups/active users, prediction participation, match page activity, Super League participation, club growth, retention, and provider/API usage, with date filters and export.
14. **System health** — web/worker/database health, job backlog and failures, request/error/performance summaries, storage/index checks, cron/webhook runs, and operator runbooks.
15. **Access and audit** — admin/role roster, least-privilege policy, searchable immutable action log, filters by actor/action/target, and export.

## Initial release sequence

The initial operational release should prioritize: (1) admin-only dashboard and audit foundation, (2) matches and provider sync visibility, (3) Super League candidate preview and publication safety, (4) scoring/leaderboard dry-run and rebuild, then (5) user/club support and analytics. Every module should be progressively connected to real data; unavailable capabilities must be visibly marked rather than simulated.

## Deployment

- Keep the feature on a branch created from `main`; do not merge it into the public app deployment branch as part of this task.
- Serve the admin build on a separate internal port and Caddy host `admin.lowblock.ir`, sharing the existing production database and session collection.
- Do not expose the admin service until the administrator guard is in place and the DNS hostname resolves to the server.
- The production deployment workflow must use an explicitly selected source ref for this separate admin instance and must not replace the public LowBlock container or worker.
