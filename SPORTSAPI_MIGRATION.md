# SportsAPI Pro Football V2 Migration & Architecture Guide

## 1. Overview & Architectural Goals

This document outlines the football data-fetching architecture migrated to **SportsAPI Pro Football V2**, while maintaining 100% backward compatibility with the legacy provider (**API-Sports**).

The architecture introduces a provider-neutral abstraction layer (`FootballDataProvider`) that decouples application business logic, match prediction scoring, notification triggers, and user interfaces from any provider-specific schemas or quirks.

```
                      ┌───────────────────────────────┐
                      │    LowBlock Application UI    │
                      │   (Matches, Predict, Awards)  │
                      └───────────────▲───────────────┘
                                      │
                         Canonical Match Model
                                      │
                      ┌───────────────┴───────────────┐
                      │    FootballDataProvider       │
                      │      (ProviderRegistry)       │
                      └───────▲───────────────▲───────┘
                              │               │
     FOOTBALL_DATA_PROVIDER   │               │   FOOTBALL_DATA_PROVIDER
            =current          │               │         =sportsapi
                              │               │
            ┌─────────────────┴─┐           ┌─┴─────────────────┐
            │  Current Provider │           │ SportsAPI Pro V2  │
            │   (API-Sports)    │           │     Provider      │
            └───────────────────┘           └─▲───────────────▲─┘
                                              │               │
                                        Daily REST      WebSocket
                                         Discovery     Realtime Stream
                                      (Cached, Quota)  (Sub-second Live)
```

---

## 2. Environment Isolation & Deployment Strategy

To protect production users and ensure zero disruption, the migration is strictly managed via environment variables:

### Production Environment (`main` branch)
* **Branch:** `main`
* **Domain:** `lowblock.ir` (or production domain)
* **Configuration:**
  ```env
  FOOTBALL_DATA_PROVIDER=current
  FOOTBALL_DATA_PROVIDER_SHADOW=none
  ```
* **Behavior:** Uses the existing, tested API-Sports provider. The code paths and database models remain untouched for production users.

### Develop Environment (`develop` branch)
* **Branch:** `develop`
* **Domain:** Develop preview / staging deployment
* **Configuration:**
  ```env
  FOOTBALL_DATA_PROVIDER=sportsapi
  SPORTSAPI_API_KEY=<your_sportsapi_key>
  SPORTSAPI_BASE_URL=https://api.sportsapipro.com/v2/football
  SPORTSAPI_WS_URL=wss://api.sportsapipro.com/v2/football/ws
  SPORTSAPI_WS_ENABLED=true
  ```
* **Behavior:** Uses the new SportsAPI Pro V2 provider with sub-second WebSocket updates and daily discovery.

### Instant Rollback Mechanism
If any anomaly is observed in development or when testing staging:
1. Update `FOOTBALL_DATA_PROVIDER=current` in the deployment settings.
2. Trigger a redeploy (or wait for environment reload).
3. **No git reverts or code rollbacks are required.**

---

## 3. Provider Abstraction Architecture

### `FootballDataProvider` Interface (`lib/football/types.ts`)
```typescript
export interface FootballDataProvider {
  readonly name: ProviderName; // "football-api" | "sportsapi"
  getDailyMatches(dates: string[]): Promise<CanonicalMatch[]>;
  sync(options?: SyncOptions): Promise<SyncResult>;
  syncDate(dateKey: string): Promise<SyncDateResult>;
  getMatchDetails?(matchId: string): Promise<CanonicalMatch | null>;
  startRealtime?(): void;
  stopRealtime?(): void;
  getRealtimeStatus?(): ProviderRealtimeStatus;
}
```

### Implementations:
1. **`CurrentFootballProvider` (`lib/football/current/provider.ts`)**:
   - Delegates directly to `lib/football/api-sports/sync.ts` and `client.ts`.
   - Maintains exact legacy behavior for scoring, leaderboard rebuilding, and quota management.

2. **`SportsApiFootballProvider` (`lib/football/sportsapi/provider.ts`)**:
   - Implements daily batch fixture discovery using SportsAPI Pro V2 REST schedule endpoints.
   - Enforces competition filtering through `competitionMapping.ts`.
   - Normalizes raw fixtures into canonical models and persists to MongoDB `matches` collection.
   - Triggers `rebuildRoundRecords()` and `runScoreEngine()` to ensure round states and user points are updated automatically.
   - Manages connection lifecycle to WebSocket.

3. **`ProviderRegistry` (`lib/football/providerRegistry.ts`)**:
   - Factory singleton that resolves the active provider based on `process.env.FOOTBALL_DATA_PROVIDER`.
   - Supports shadow mode if `FOOTBALL_DATA_PROVIDER_SHADOW=sportsapi`.

---

## 4. SportsAPI Pro V2 Integration Details

### REST Discovery & Quota Management (`lib/football/sportsapi/rest.ts`)
* **Endpoint:** `GET /schedule/{date}` and `GET /today`.
* **Single Shared Daily Fetch:** Rather than issuing individual per-match HTTP requests (which burn quota), the system fetches whole-day schedule snapshots (yesterday, today, tomorrow).
* **Caching:** Cached via Next.js `unstable_cache` with configurable TTL (`SPORTSAPI_DAILY_DISCOVERY_CACHE_TTL`, default: 300s).
* **Observability:** Every outbound REST request is logged to the `sportsApiRequests` collection in MongoDB, capturing duration, path, status, and errors.

### WebSocket Architecture (`lib/football/sportsapi/ws.ts`)
* **Single Shared Socket Connection:** Avoids opening multiple WebSocket connections per fixture.
* **Endpoint:** `wss://api.sportsapipro.com/v2/football/ws?x-api-key=...`
* **Heartbeat:** Outbound ping every 30 seconds; listens for pong frames.
* **Automatic Reconnect:** Implements exponential backoff:
  - Initial delay: `SPORTSAPI_RECONNECT_INITIAL_DELAY_MS` (default: 1,000ms)
  - Max delay: `SPORTSAPI_RECONNECT_MAX_DELAY_MS` (default: 30,000ms)
* **Automatic Resubscription:** Subscribed channels (`live-scores`, `match:{id}`, `match:{id}:incidents`, etc.) are tracked in memory and automatically re-registered upon reconnect.

### State Reconciliation, Storage & Drawer Integration
* **MongoDB Match Details Persistence:** Live details (timeline incidents, statistics, confirmed Starting XI/substitutes lineups, and odds) are stored in the `matchDetails` collection in MongoDB.
* **Zero Delay on Open:** Opening the Match Intelligence drawer returns data instantly from MongoDB in <10ms without waiting for WebSocket roundtrips or cold starts.
* **Match Analytics Drawer Tabs:**
  - Integrated directly into the match drawer (`components/MatchAnalytics.tsx`) below the top hero banner.
  - Tab selector designed with `motion.span` layout animations matching the Leaderboard timeframe filters:
    1. **🎯 Predictions (پیش‌بینی‌ها)**: Community score distribution, top pick, and player predictions.
    2. **⏱ Timeline (رویدادها)**: Goals (⚽), Cards (🟨 🟥), Substitutions (🔄 with In/Out players), VAR decisions (🖥️), and period markers.
    3. **📊 Stats (آمار بازی)**: Possession %, Shots, Shots on Target, Passes, Fouls, Corners, Cards with comparative progress bars.
    4. **👥 Lineups (ترکیب)**: Formations, confirmed Starting XI with jersey numbers and positions, and substitutes bench.
    5. **📈 Odds (ضرایب)**: Live match market odds.
* **Real-time Live Sync:** When a match is live, the drawer connects via Server-Sent Events (`/api/matches/[matchId]/live?stream=true`) to stream WebSocket deltas straight to the UI with zero polling.

### Competition Mapping (`lib/football/competitionMapping.ts`)
* Automatically resolves 36+ supported competitions (Premier League, La Liga, UCL, World Cup, Iran Pro League, Hazfi Cup, etc.).
* Multi-tiered matching:
  1. Primary: SportsAPI canonical `uniqueTournament.id` (stable across seasons).
  2. Secondary: `uniqueTournament.slug`.
  3. Tertiary: `tournament.slug` and name aliases.
* Unsupported tournaments are safely dropped during discovery to preserve clean competition filtering.

---

## 5. Environment Variables Reference

| Variable | Description | Default | Environment |
|---|---|---|---|
| `FOOTBALL_DATA_PROVIDER` | Active provider: `current` or `sportsapi` | `current` | Production / Develop |
| `FOOTBALL_DATA_PROVIDER_SHADOW` | Shadow comparison provider: `none` or `sportsapi` | `none` | Optional |
| `SPORTSAPI_API_KEY` | SportsAPI Pro API key | `""` | Develop / Staging |
| `SPORTSAPI_BASE_URL` | Base URL for REST endpoints | `https://api.sportsapipro.com/v2/football` | Develop |
| `SPORTSAPI_WS_URL` | WebSocket URL | `wss://api.sportsapipro.com/v2/football/ws` | Develop |
| `SPORTSAPI_WS_ENABLED` | Enable/disable WebSocket connections | `true` | Develop |
| `SPORTSAPI_STALE_MATCH_THRESHOLD_MS` | Threshold before re-subscribing to live matches | `90000` | Develop |
| `SPORTSAPI_RECONNECT_INITIAL_DELAY_MS` | Initial WebSocket reconnect backoff | `1000` | Develop |
| `SPORTSAPI_RECONNECT_MAX_DELAY_MS` | Maximum WebSocket reconnect backoff | `30000` | Develop |
| `SPORTSAPI_DAILY_DISCOVERY_CACHE_TTL` | Cache TTL in seconds for daily fixture REST requests | `300` | Develop |

---

## 6. Verification and Testing

The implementation includes full test coverage:
* `tests/competition-mapping.test.ts`: Validates uniqueTournament ID, slug, and alias resolution.
* `tests/sportsapi-normalizer.test.ts`: Tests raw event to CanonicalMatch conversion and incident parsing.
* `tests/sportsapi-state.test.ts`: Verifies partial update delta merging and timestamp deduplication.
* `tests/provider-selection.test.ts`: Validates dynamic provider switching and shadow mode activation.
* `tests/sportsapi-websocket.test.ts`: Verifies subscription tracking, listener dispatching, and heartbeat.

### Commands:
```bash
# Run unit and integration tests
npm test

# Run TypeScript typechecking
npm run lint

# Run Next.js production build
npm run build
```
