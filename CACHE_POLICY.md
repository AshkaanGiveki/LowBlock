# LowBlock Cache Policy

| Resource | Visibility | Freshness | Invalidation | Transport |
| --- | --- | --- | --- | --- |
| `/api/matches` | authenticated/no-store because predictions are included | request fresh | match sync | `Cache-Control: no-store` |
| public match data in `lib/football/data.ts` | public | 60 seconds | `matches` tag | Next data cache |
| `/api/leaderboards` | public | 30 seconds at the edge | `leaderboards`, `leaderboard-summary` | short `s-maxage` |
| `/api/leaderboards/detailed` | public rows plus optional viewer row | request fresh | leaderboard sync | dynamic route |
| tournament/league catalog | public | 30 minutes | `tournaments`, `seasons` | ISR/static |
| latest season lookup | public | 15 minutes | `seasons` and `matches` | `unstable_cache` |
| club overview API | authenticated | request fresh | `clubs`, `club-memberships`, `leaderboards` | no shared cache |
| profile history | public route-specific | cursor response | `profiles` after scoring | dynamic API |
| match analysis | authenticated/club-scoped | request fresh | match result sync | no-store |

Authenticated responses and club-scoped responses must never use a shared public cache. Match and scoring syncs call `invalidateCompetitionCaches()` so stale public data is removed by tag rather than requiring a full deployment.
