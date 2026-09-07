# Rendering decisions

The application deliberately uses a hybrid App Router model.

Static/ISR routes:

- `/how-scoring-works`: static with one-day revalidation.
- `/leagues`: ISR with 30-minute revalidation.
- Locale marketing routes: static generation.

Request-time routes and reasons:

- `/`: authenticated summary, club membership, and current-user data.
- `/matches`, `/matches/[matchId]`: predictions, preferences, and live analysis.
- `/leaderboard`, `/lowblock`, `/lowblock/standings`: current-user rank and frequently changing standings.
- `/leagues/[code]` and round views: live fixture state and prediction authorization.
- `/club/**`: private membership and club authorization.
- `/u/[username]`: viewer-sensitive profile and prediction visibility.
- `/predictions`, `/award/[token]`, `/s/[token]`, and `/discover`: session/token-dependent content.
- API routes: request-time by default because authentication, authorization, live state, or mutations are involved.

The remaining dynamic routes should only be converted after their session and freshness requirements are measured in deployment. This document is the review record for every current `force-dynamic` usage.
