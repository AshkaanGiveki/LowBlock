# SportsAPI Pro WebSocket validation

Run the opt-in live probe with a real account key and a live or recently-live football event id:

```powershell
$env:SPORTSAPI_TEST_MATCH_ID="<event id>"
npm run probe:sportsapi-ws
```

The probe connects once and subscribes to live scores plus match score, incidents, statistics, lineups, and odds channels. It prints a redacted capability report. A non-zero exit means the socket rejected the connection/subscription or produced no frame before the timeout.

This is deliberately a probe, not proof of lossless delivery. To prove that no event is missed, the provider must document sequence numbers, replay/resume, or an authoritative snapshot after reconnect. The official docs describe WebSocket as a real-time stream, while the endpoint catalog is REST. The app therefore keeps REST for discovery and on-demand resources, and uses WebSocket for realtime updates. Arbitrary REST paths are not sent over the socket.

## Free-plan operating mode

The application defaults to `SPORTSAPI_TOURNAMENT_DISCOVERY_ENABLED=false`. REST is used only for yesterday, today, and tomorrow fixture-list discovery (today may also try `/today`); match scores, incidents, statistics, lineups, odds, and replay state are received through WebSocket ingestion and persisted in MongoDB. WebSocket score deltas are expanded and merged into the local match state before persistence; rich snapshots update only the category they contain, so empty snapshots do not erase previously collected data.

Official references:

- https://docs.sportsapipro.com/introduction
- https://sportsapipro.com/pricing
- https://sportsapipro.com/faq
