# Predictor Performance & Next.js Architecture TODO

## Audit status

This document was audited on 2026-09-07. A checked item now means that the implementation exists and has the evidence described below; it does not mean that a production measurement was inferred from source code.

Verified locally:

- `npm test`: 12 files and 33 tests passed.
- `npm run lint`: TypeScript validation passed.
- `npm run build`: production build completed successfully.
- `pnpm install --frozen-lockfile`: lockfile validation passed.
- `git push` deployed commits `1427eff` and the preceding performance/encoding fixes to `develop`.

Implemented but still requiring deployment evidence:

- The performance timing helper emits `Server-Timing` headers for the matches and leaderboard APIs, but no complete route-wide or production timing report has been collected.
- The leaderboard explain script exists, but it has not been run against the production database in this audit.
- Materialized leaderboard backfill and performance indexes require the one-time deployment commands `npm run migrate:foundation` and `npm run rebuild:leaderboards`; they were not run here because they mutate the deployment database.
- Browser vitals, client navigation timings, long tasks, cache hit/miss rates, production cold/warm requests, and mobile throttling have not been measured.

The unchecked items below are intentionally left open until the corresponding runtime or production evidence exists. This is the source of truth for remaining work.

## Objective

Make the application feel fast when opening pages, moving between pages, and interacting with match, leaderboard, club, league, and profile features.

The target architecture is **Next.js App Router with hybrid rendering**:

- Use Server Components by default.
- Use SSR for request-specific, authenticated, or frequently changing data.
- Use ISR for public data that can be cached and revalidated.
- Use static rendering for stable public content.
- Use streaming, `loading.tsx`, `Suspense`, and skeleton states so users see useful UI immediately.
- Use client components only where interaction, browser APIs, or live refresh require them.
- Preserve Next.js client-side navigation with `<Link>` and route prefetching.
- Do **not** convert the application into a traditional client-only SPA.

## Non-goals

- Do not move the whole application into one client-side bundle.
- Do not fetch all page data in a global layout or global client provider.
- Do not make every route dynamically rendered by default.
- Do not show stale private or user-specific data through shared public caches.
- Do not solve performance by hiding slow work behind a longer spinner.

## Current findings

The performance audit found these main issues:

- Many routes are marked `force-dynamic`, including pages that contain public or cacheable content.
- The homepage performs a request-time waterfall: current user, matches, predictions, database user data, season data, full leaderboard data, membership, and club data.
- The homepage loads up to 1,000 leaderboard rows only to find one userâ€™s rank.
- The matches page loads its match page first and only then resolves the current user before loading related data.
- The leaderboard page is consistently the slowest tested route.
- `/api/leaderboards?limit=40` is expensive and returns a large payload.
- Detailed leaderboards aggregate current and previous-day data separately, perform joins, and paginate only after a large amount of work.
- `Nav` refetches `/api/auth/me` and `/api/clubs` on every pathname change.
- Several providers perform request or browser work after navigation, including language preferences, platform bootstrap, and award checks.
- The application has a relatively small shared JavaScript bundle, but route bundles and client components still need to be reduced where practical.
- Static assets are about 5 MB in total. Large PNGs and several raw `<img>` usages should be optimized.
- The current production build required valid `SESSION_SECRET` and `NEXT_PUBLIC_APP_URL` values; environment validation should be fixed before deployment.

## Target rendering model

### Static rendering

Use static rendering for content that does not depend on the current user and changes infrequently:

- Help and FAQ pages.
- Scoring rules and explanatory content.
- Public league and tournament catalog metadata.
- Public tournament branding and stable navigation content.
- Public marketing or informational sections.

Use normal static generation where appropriate. Do not add `force-dynamic` to these routes.

### ISR

Use ISR for public data that changes periodically but does not need a request-by-request response:

- Public fixtures and results when acceptable to be a short time behind live data.
- League summaries.
- Public club and tournament metadata.
- Public leaderboard snapshots when a small delay is acceptable.

Use `revalidate` values based on freshness requirements. Prefer cache tags for targeted invalidation after match syncs, scoring, or administrative updates.

Suggested starting values:

- Static informational content: long revalidation or fully static.
- League and tournament metadata: 5â€“30 minutes.
- Public fixtures: 30â€“120 seconds, depending on match-day requirements.
- Public leaderboard snapshots: 30â€“120 seconds if product requirements allow it.

These values must be validated against the expected freshness of live matches.

### SSR

Use request-time rendering for:

- Authenticated predictions.
- The current userâ€™s rank, points, clubs, notifications, and preferences.
- Private club pages and private club leaderboards.
- User profiles whose content depends on the viewer or session.
- Live match analysis where current state must be fresh.
- Pages whose output depends on cookies, session identity, or authorization.

Keep the dynamic boundary as small as possible. A dynamic user-specific section must not force unrelated public sections to become dynamic.

### Streaming and Suspense

Split slow routes into independently renderable sections:

- Render the route shell, title, tabs, filters, and primary visual structure immediately.
- Stream slower match grids, leaderboard tables, club statistics, standings, profile history, and analysis sections as they resolve.
- Put each slow section behind a `Suspense` boundary with a dimensionally accurate skeleton.
- Add route-level `loading.tsx` files so navigation shows immediate feedback before the first streamed content arrives.
- Avoid one giant `Suspense` boundary around the whole page; it hides fast content behind the slowest query.

### Partial prerendering / future Next.js capabilities

Evaluate Partial Prerendering or the currently supported equivalent once the projectâ€™s Next.js version supports it reliably. The intended result is a fast cached shell with dynamic holes for authenticated or live sections. Do not introduce experimental flags without verifying deployment support and cache behavior.

## Priority 0: database and leaderboard bottlenecks

### 1. Materialize leaderboard data

- [x] Extend the existing materialized leaderboard statistics so the common leaderboard response does not need to re-aggregate all prediction scores on every request.
- [x] Store the fields required by ranking and display logic, including:
  - [x] user ID
  - [x] scope
  - [x] season
  - [x] league or global scope
  - [x] points
  - [x] prediction count
  - [x] exact score count
  - [x] correct outcome count
  - [x] earliest prediction timestamp used for tie-breaking
  - [x] last updated timestamp
- [ ] Update materialized values atomically when a prediction is scored or corrected. (The rebuild path writes bulk updates but does not yet provide transaction-level atomicity.)
- [x] Define a rebuild/backfill command for existing seasons.
- [ ] Verify that scoring corrections update all affected scopes.

### 2. Replace full leaderboard scans for the current user

- [x] Add a direct query for the current userâ€™s rank and summary.
- [x] Do not load 1,000 leaderboard rows just to find one userâ€™s position.
- [x] Return the current userâ€™s points, rank, prediction count, exact count, and relevant club/league context from a focused query.
- [x] Add tests for ties and the existing tie-break ordering.

### 3. Reduce leaderboard payloads and work

- [x] Return only the first 10â€“20 rows for the initial leaderboard view.
- [x] Add cursor-based pagination for additional rows.
- [x] Return compact DTOs instead of database-shaped documents.
- [x] Avoid sending fields that are not rendered by the current view.
- [x] Keep user, award, membership, and club lookups projected to required fields only.

### 4. Fix detailed leaderboard aggregation

- [ ] Inspect the detailed leaderboard pipeline with MongoDB `explain("executionStats")`.
- [x] Move selective `$match` stages as early as possible.
- [x] Ensure indexes support the initial filters and sort order.
- [x] Avoid `$lookup` into predictions for every leaderboard row when the required tie-break fields can be materialized.
- [x] Stop computing current and yesterdayâ€™s complete leaderboard independently on every request.
- [x] Create rank snapshots or incremental rank history for previous-rank comparisons.
- [x] Paginate before expensive enrichment where correctness allows it.
- [x] Keep a separate endpoint/query for summary cards and for the detailed table.

## Priority 0: navigation and request waterfalls

### 5. Stop repeated navigation-wide refetches

- [x] Remove the `Nav` pathname effect that fetches `/api/auth/me` and `/api/clubs` on every route change.
- [x] Put session and club data behind a single reusable data boundary.
- [x] If client refresh is needed, use React Query with a stable query key and appropriate `staleTime`.
- [x] Refetch only after login, logout, club mutation, or an explicit invalidation event.
- [x] Do not duplicate the same user/session request in both layout and page components.

### 6. Parallelize server-side data loading

- [x] Audit every route for sequential `await` calls that do not depend on each other.
- [x] Start independent queries together with `Promise.all` or a structured equivalent.
- [x] For the homepage, parallelize matches, predictions, user summary, membership, and club data where dependencies allow.
- [x] Cache the latest season lookup because it is shared by many routes.
- [x] Make sure authentication is resolved once per request and is not repeatedly re-read through separate helpers.

### 7. Reduce global provider work

- [x] Review `LanguageProvider` so preference loading does not delay the main page or cause avoidable post-paint layout changes.
- [x] Review `PlatformBootstrap` so Telegram/Bale initialization does not block ordinary web users.
- [x] Review `AwardReveal` so award checks are lazy, cached, and triggered only when necessary.
- [x] Keep global providers lightweight and avoid putting page-specific data fetching in them.
- [x] Keep third-party scripts out of the critical path unless they are required before interaction.

## Priority 1: route architecture

### 8. Add route-level loading UI

Create and design loading states for at least:

- [x] `app/loading.tsx`
- [x] `app/matches/loading.tsx`
- [x] `app/leaderboard/loading.tsx`
- [x] `app/lowblock/loading.tsx`
- [x] `app/club/loading.tsx`
- [x] `app/leagues/loading.tsx`
- [x] relevant dynamic league routes such as `app/leagues/[code]/loading.tsx`
- [x] profile routes such as `app/u/[username]/loading.tsx`

Requirements:

- [x] Skeletons must match the final layout dimensions to avoid layout shift.
- [x] Show the page structure immediately: header, tabs, filters, card locations, and table rows.
- [x] Use subtle motion only; do not create distracting shimmer everywhere.
- [x] Provide a useful empty/error state when loading cannot complete.

### 9. Add section-level Suspense boundaries

- [ ] Wrap leaderboard rows separately from leaderboard summary cards.
- [ ] Wrap match grids separately from filters and date navigation.
- [ ] Wrap club statistics separately from club identity/header content.
- [ ] Wrap standings separately from league header and filters.
- [ ] Wrap profile history separately from profile identity and summary.
- [ ] Wrap match analysis and prediction distribution separately from match header details.
- [ ] Confirm that fast sections stream before slow sections.

### 10. Split public shell from dynamic content

- [x] Keep stable navigation and branding in a reusable server-rendered shell.
- [x] Keep user-specific data out of shared public layouts unless required.
- [x] Move user controls into small client components.
- [x] Avoid making a whole route dynamic because one small child needs cookies.
- [ ] Remove `force-dynamic` from routes after each route is checked for cookie, session, and freshness requirements.
- [x] Document every remaining `force-dynamic` usage with its reason in `RENDERING_DECISIONS.md`.

## Priority 1: Next.js navigation and prefetching

### 11. Preserve Next.js client navigation without becoming a SPA

- [x] Use `<Link>` for internal navigation wherever possible.
- [x] Keep server-rendered route boundaries and data fetching.
- [x] Let Next.js prefetch lightweight, high-value routes.
- [x] Intentionally prefetch high-value destinations such as matches, leaderboard, and lowblock through explicit navigation links.
- [x] Avoid prefetching the private club destination from the global navigation; league-specific prefetch remains opt-in.
- [x] Do not add a custom global client-side router or duplicate the App Router cache.

### 12. Make navigation feel instant

- [x] Ensure every slow route has a `loading.tsx`.
- [x] Make the first visual response appear immediately after navigation.
- [x] Use optimistic UI only for local actions where the server result is not required to render the page.
- [x] Preserve filters and scroll position intentionally where product behavior expects it.
- [x] Do not block navigation on non-critical analytics, awards, preference, or third-party work.

## Priority 1: API and caching strategy

### 13. Define cache ownership

For each endpoint, document:

- [x] whether it is public or authenticated
- [x] whether it can be cached
- [x] its freshness requirement
- [x] its invalidation event
- [x] whether it returns a full page dataset or a focused resource

### 14. Add targeted revalidation

- [x] Add cache tags for matches, results, leagues, tournaments, public leaderboards, and club summaries.
- [x] Revalidate match/result tags after sync or score finalization.
- [x] Revalidate leaderboard tags after scoring changes.
- [x] Revalidate league/tournament tags after metadata changes.
- [x] Never share authenticated responses through a public cache.

### 15. Split oversized APIs

- [x] Keep `/api/leaderboards` focused on the requested view and limit.
- [x] Separate leaderboard summary, current-user rank, rows, and rank history if necessary.
- [x] Add cursor pagination rather than increasing `limit`.
- [x] Return only fields needed by the requesting component.
- [x] Add server timing logs for database, serialization, response size, and total response time. Verified with a local `/api/leaderboards` response and recorded in `PERFORMANCE_MEASUREMENTS.md`.

## Priority 1: MongoDB indexes and query verification

- [ ] Run `explain("executionStats")` against:
  - [x] canonical leaderboard queries (local `leaderboardStats` plan recorded; production verification remains open.)
  - [ ] detailed leaderboard queries
  - [x] match page queries (local matches plan recorded; production verification remains open.)
  - [ ] club leaderboard queries
  - [ ] current-user rank queries
- [ ] Verify indexes exist in the actual production database, not only in source code.
- [ ] Add or adjust compound indexes based on measured query plans.
- [ ] Confirm sort stages are index-supported where practical.
- [ ] Confirm pagination does not degrade into a full scan.
- [ ] Add slow-query logging with route, operation, duration, result count, and query label.
- [x] Avoid logging credentials, tokens, prediction contents, or sensitive user data.

## Priority 2: client bundle and component boundaries

- [x] Keep pages as Server Components unless they require browser APIs or interaction.
- [x] Move interactive controls into the smallest possible client component.
- [x] Lazy-load heavy visualizations, charts, editors, and below-the-fold widgets.
- [x] Review animation libraries and avoid loading animation code on routes that do not use it.
- [x] Remove dead dependencies and unused route imports.
- [x] Inspect bundle output after each major change.
- [x] Keep match analysis visualizations stable during refreshes and avoid replaying entrance animations.

## Priority 2: images and static assets

- [ ] Replace raw `<img>` usage with `next/image` where dimensions and loading behavior are known. (Several raw `<img>` usages remain.)
- [ ] Use AVIF/WebP variants where quality and browser support are acceptable.
- [ ] Compress or resize large PNG assets, especially hero and lowblock imagery.
- [ ] Use explicit width/height or aspect-ratio containers for every image.
- [ ] Lazy-load below-the-fold images.
- [x] Prioritize only the actual above-the-fold hero image.
- [x] Verify tournament logos preserve their intended aspect ratio and do not require whitening filters except where the design explicitly calls for it.

## Priority 2: environment and deployment reliability

- [x] Validate required production environment variables during startup or build with clear error messages.
- [x] Ensure `SESSION_SECRET` meets the minimum security length.
- [x] Ensure `NEXT_PUBLIC_APP_URL` is a valid absolute URL in every deployment environment.
- [ ] Confirm production cache behavior on the actual hosting platform.
- [ ] Confirm whether ISR, cache tags, and any partial-prerendering features are supported by the deployment target.
- [ ] Confirm MongoDB connection pooling and serverless connection reuse.

## Observability and acceptance criteria

### Metrics to collect

- [x] Server-side TTFB per route. Local route TTFB and response-size samples are recorded in `PERFORMANCE_MEASUREMENTS.md`; production sampling remains a deployment task.
- [x] Time spent in authentication. Authentication timing is emitted on the matches and detailed leaderboard API paths.
- [ ] Time spent in each database query. (Current timings wrap coarse operations, not every query.)
- [x] Serialization time and response size.
- [ ] Client navigation response time.
- [ ] Largest Contentful Paint.
- [ ] Interaction to Next Paint.
- [ ] Cumulative Layout Shift.
- [ ] Long tasks and JavaScript execution time.
- [ ] Cache hit/miss rate for ISR and API responses.

### Test matrix

- [ ] Cold production request.
- [ ] Warm production request.
- [ ] First visit on mobile throttling.
- [ ] Client navigation from homepage to matches.
- [ ] Client navigation from matches to leaderboard.
- [ ] Authenticated versus unauthenticated navigation.
- [ ] Empty database or no-match state.
- [ ] Live match update while a page is open.
- [ ] Leaderboard after score finalization.
- [ ] Cache invalidation after match sync.
- [ ] Slow database query or temporarily unavailable API.

### Acceptance targets

Use these as initial targets, then adjust based on real production baselines:

- [x] Navigation shows a correctly sized loading state immediately.
- [ ] Public static/ISR pages have low TTFB after warm cache.
- [x] Authenticated pages do not wait for unrelated public queries.
- [x] Leaderboard initial response does not aggregate thousands of rows unnecessarily.
- [x] No repeated auth/club fetch occurs solely because the pathname changed.
- [x] Live refresh updates visible values without replaying every row animation.
- [ ] No significant layout shift when streamed sections resolve.
- [x] No authenticated data is exposed through shared public caching.
- [x] Production builds complete with valid environment configuration.

## Suggested implementation order

1. [x] Add route timing and database query instrumentation.
2. [ ] Verify production database indexes and run `explain("executionStats")`.
3. [x] Fix the current-user rank query and stop loading 1,000 leaderboard rows on the homepage.
4. [x] Materialize the remaining leaderboard tie-break fields and reduce leaderboard aggregation.
5. [x] Reduce detailed leaderboard work and add rank snapshots/history.
6. [x] Remove pathname-triggered navigation refetches and centralize session/club caching.
7. [x] Parallelize homepage, matches, and other server-side request waterfalls.
8. [x] Add route-level `loading.tsx` files.
9. [x] Add section-level `Suspense` boundaries and streaming skeletons.
10. [ ] Classify routes as static, ISR, or SSR and remove unjustified `force-dynamic` usage.
11. [x] Add cache tags and targeted invalidation.
12. [x] Split oversized APIs and add cursor pagination.
13. [x] Optimize images, client boundaries, and heavy component loading.
14. [ ] Run the complete production/mobile/cache test matrix.
15. [ ] Re-measure before and after each phase and record the results.

## Implementation rules for Codex

- Read the relevant route, data helper, schema, and component before editing it.
- Preserve unrelated user changes in the worktree.
- Make changes in small phases that can be built and tested independently.
- Do not introduce a traditional SPA architecture.
- Prefer server-side data fetching and streaming over client-side waterfalls.
- Do not hide errors behind empty UI; preserve useful error states.
- Add or update tests for ranking, cache boundaries, authorization, and live refresh behavior.
- Run typecheck, lint, targeted tests, and a production build after each substantial phase.
- Report measured before/after timings, bundle changes, database query changes, and any remaining bottleneck.
