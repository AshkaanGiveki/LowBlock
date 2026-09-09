# LowBlock Security and Reliability TODO

## Phase 1 — Critical security controls

- [ ] Add shared rate limiting infrastructure.
- [ ] Rate-limit login attempts by IP and username.
- [ ] Rate-limit signup requests.
- [ ] Rate-limit guest prediction submissions.
- [ ] Rate-limit platform authentication and account-linking endpoints.
- [ ] Rate-limit telemetry ingestion.
- [ ] Add request-size limits for all public API routes.
- [ ] Validate and limit telemetry metadata, metric names, paths, and values.
- [ ] Require authentication and award ownership when creating award share links.
- [ ] Revoke the server-side session during logout.
- [ ] Revoke all active sessions when a password is changed.
- [ ] Add security tests for unauthorized award access and session revocation.

## Phase 2 — Security headers and browser protection

- [ ] Add `Content-Security-Policy`.
- [ ] Add `X-Content-Type-Options: nosniff`.
- [ ] Add `Referrer-Policy`.
- [ ] Add `Permissions-Policy`.
- [ ] Add clickjacking protection using CSP `frame-ancestors` or `X-Frame-Options`.
- [ ] Restrict Telegram’s external script and required origins in CSP.
- [ ] Review whether Subresource Integrity can be used for third-party scripts.
- [ ] Verify all security headers on production responses.

## Phase 3 — Input validation and API hardening

- [ ] Add Zod schemas for all API query parameters.
- [ ] Validate all MongoDB ObjectId parameters before database access.
- [ ] Validate `seasonStartYear`.
- [ ] Validate leaderboard cursors against an explicit schema.
- [ ] Bound all pagination parameters.
- [ ] Bound leaderboard page and page-size values.
- [ ] Return `400` for malformed parameters instead of allowing `500` errors.
- [ ] Add consistent API error codes.
- [ ] Stop returning raw internal error messages to clients.
- [ ] Log detailed errors only on the server.

## Phase 4 — API routing correctness

- [ ] Prevent localized catch-all routes from matching `/api/*`.
- [ ] Add explicit `405 Method Not Allowed` responses for unsupported API methods.
- [ ] Test every API route with unsupported HTTP methods.
- [ ] Verify that API endpoints always return JSON instead of HTML fallback pages.
- [ ] Add automated route smoke tests for representative API endpoints.

## Phase 5 — Query and performance hardening

- [ ] Refactor public profile predictions so they do not load every prediction ID into memory.
- [ ] Implement database-level pagination for public prediction history.
- [ ] Add appropriate indexes for public profile prediction queries.
- [ ] Add limits to award history queries.
- [ ] Review match analytics query limits for high-volume matches.
- [ ] Add query timeouts or defensive limits where appropriate.
- [ ] Review all public endpoints for unbounded database work.
- [ ] Measure response size and database time after optimization.

## Phase 6 — Authentication improvements

- [ ] Add account lockout or progressive delay after repeated login failures.
- [ ] Normalize login error timing where practical.
- [ ] Add protection against username enumeration.
- [ ] Review session expiration and renewal behavior.
- [ ] Add active-session management for users.
- [ ] Rotate sessions after login and password changes.
- [ ] Ensure account-link tokens are single-use under concurrent requests.
- [ ] Add tests for expired, reused, and conflicting platform-link tokens.

## Phase 7 — Encoding and product correctness

- [ ] Fix mojibake in `lib/football/leagues.ts`.
- [ ] Fix mojibake in page metadata.
- [ ] Fix mojibake in API error messages.
- [ ] Fix mojibake in Telegram/Bale bot messages.
- [ ] Fix mojibake in remaining UI components.
- [ ] Verify Persian text with UTF-8 source files and database values.
- [ ] Test Persian rendering across homepage, leagues, matches, profile, clubs, and bot messages.
- [ ] Add a test preventing common mojibake sequences from entering production strings.

## Phase 8 — Canonical URLs and SEO

- [ ] Choose one canonical production host: `lowblock.ir` or `www.lowblock.ir`.
- [ ] Update `metadataBase`.
- [ ] Update sitemap URLs.
- [ ] Update award share URLs.
- [ ] Update Telegram and Bale links.
- [ ] Update Open Graph URLs.
- [ ] Configure one permanent redirect strategy.
- [ ] Verify canonical URLs and redirects in production.

## Phase 9 — Security and reliability testing

- [ ] Run the full TypeScript check.
- [ ] Run the complete unit test suite.
- [ ] Run the production build.
- [ ] Run `npm audit --omit=dev`.
- [ ] Add unauthorized-access tests for every protected API route.
- [ ] Add IDOR tests for clubs, awards, profiles, and invitations.
- [ ] Add rate-limit tests.
- [ ] Add malformed-input tests.
- [ ] Add session-revocation tests.
- [ ] Add API method and route-fall-through tests.
- [ ] Test CSP and all security headers in production.
- [ ] Re-run the production HTTP header audit.
- [ ] Perform authenticated browser testing for major user flows.
- [ ] Document any accepted residual risks.
