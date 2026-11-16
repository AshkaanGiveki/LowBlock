/**
 * Copies a LIMITED public football-data sample into an isolated preview DB.
 * Never copies accounts, sessions, predictions, private groups, notifications,
 * or any private user content. The source connection is strictly read-only.
 *
 * Requires PREVIEW_SEED_ENABLED=true and PREVIEW_TARGET_MONGODB_URI.
 */
import { MongoClient } from "mongodb";
import { refreshLocalMatchIntelligence } from "../lib/football/intelligence/history";

async function main() {
  if (process.env.PREVIEW_SEED_ENABLED !== "true") throw new Error("Preview seeding not explicitly enabled");
  const sourceUri = process.env.MONGODB_URI;
  const targetUri = process.env.PREVIEW_TARGET_MONGODB_URI;
  if (!sourceUri || !targetUri || sourceUri === targetUri || !targetUri.includes("lowblock_preview")) {
    throw new Error("Source/target DB separation check failed");
  }
  const source = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
  const target = new MongoClient(targetUri, { serverSelectionTimeoutMS: 10000 });
  try {
    await Promise.all([source.connect(), target.connect()]);
    const from = source.db();
    const to = target.db();
    if (from.databaseName === to.databaseName) throw new Error("Preview cannot share production database");
    const now = Date.now();
    // Scheduled mirror keeps CURRENT fixtures fresh with small, indexed reads.
    // A full seed is reserved for deployment, not every five-minute sync.
    const incremental = process.env.PREVIEW_SEED_LIVE_ONLY === "true";
    const cutoff = new Date(now - (incremental ? 2 : 120) * 86_400_000);
    const future = new Date(now + (incremental ? 5 : 30) * 86_400_000);
    const matchProjection = {
      _id: 0, provider: 1, providerMatchId: 1,
      leagueCode: 1, roundId: 1, matchday: 1, seasonStartYear: 1,
      featuredNationalFixture: 1,
      kickoffAt: 1, status: 1, elapsed: 1,
      homeGoals: 1, awayGoals: 1,
      homePenaltyGoals: 1, awayPenaltyGoals: 1,
      homeTeam: 1, awayTeam: 1,
      homeTeamProviderId: 1, awayTeamProviderId: 1,
      updatedAt: 1, createdAt: 1,
    };
    // Strict bounded public match-data reads; no raw provider payloads.
    const [recent, upcoming] = await Promise.all([
      from.collection("matches").find(
        { kickoffAt: { $gte: cutoff, $lt: new Date(now) }, provider: { $in: ["sportsapi", "football-api"] } },
        { projection: matchProjection },
      ).sort({ kickoffAt: -1 }).limit(incremental ? 180 : 1200).toArray(),
      from.collection("matches").find(
        { kickoffAt: { $gte: new Date(now), $lte: future }, provider: { $in: ["sportsapi", "football-api"] } },
        { projection: matchProjection },
      ).sort({ kickoffAt: 1 }).limit(incremental ? 180 : 400).toArray(),
    ]);
    const unique = new Map<string, any>();
    for (const match of [...recent, ...upcoming]) {
      const key = String(match.provider) + ":" + String(match.providerMatchId);
      if (match.providerMatchId && match.homeTeam?.name && match.awayTeam?.name) {
        // getMatchesPage/getMatch require a verified source marker. Preserve
        // the provider-derived canonical fixture metadata, never raw odds or
        // other heavyweight upstream payloads in the staging copy.
        unique.set(key, {
          ...match,
          rawApiResponse: {
            teams: {
              home: { name: match.homeTeam.name },
              away: { name: match.awayTeam.name },
            },
            previewPublicFixture: true,
          },
        });
      }
    }
    const matches = [...unique.values()];
    if (!matches.length) throw new Error("No public fixture data available: refusing empty preview seed");
    await to.collection("matches").createIndex({ provider: 1, providerMatchId: 1 }, { unique: true });
    await to.collection("matches").createIndex({ provider: 1, kickoffAt: 1 });
    await to.collection("matches").createIndex({ provider: 1, status: 1, "homeTeam.id": 1, kickoffAt: -1 });
    await to.collection("matches").createIndex({ provider: 1, status: 1, "awayTeam.id": 1, kickoffAt: -1 });
    await to.collection("footballMatchIntelligence").createIndex({ matchId: 1, provider: 1 });
    await to.collection("matchDetails").createIndex({ matchId: 1 });
    for (let i = 0; i < matches.length; i += 200) {
      await to.collection("matches").bulkWrite(matches.slice(i, i + 200).map((match) => ({
        updateOne: {
          filter: { provider: match.provider, providerMatchId: match.providerMatchId },
          update: { $set: match },
          upsert: true,
        },
      })), { ordered: false });
    }

    // Live details contain public sports events only, never odds or raw payloads.
    const sportsIds = matches.filter((m) => m.provider === "sportsapi").map((m) => String(m.providerMatchId));
    const details = sportsIds.length ? await from.collection("matchDetails")
      .find({ matchId: { $in: sportsIds }, provider: "sportsapi" }, {
        projection: { _id: 0, matchId: 1, provider: 1, score: 1, incidents: 1, stats: 1, lineups: 1, updatedAt: 1 },
      }).limit(incremental ? 260 : 450).toArray() : [];
    if (details.length) await to.collection("matchDetails").bulkWrite(details.map((detail) => ({
      updateOne: {
        filter: { matchId: detail.matchId, provider: "sportsapi" },
        update: { $set: detail },
        upsert: true,
      },
    })), { ordered: false });

    // Mirror PUBLIC provider-sourced form and H2H only. Exclude accounts,
    // predictions, user analytics, request traces and all raw credentials.
    // Keep local history untouched; provider history supplements it.
    const insightsIds = matches.filter((m) => m.provider === "sportsapi")
      .map((m) => "sportsapi:" + String(m.providerMatchId));
    const providerInsights = insightsIds.length ? await from.collection<any>("footballMatchIntelligence")
      .find({ _id: { $in: insightsIds }, provider: "sportsapi", providerHistory: { $exists: true } },
        { projection: { _id: 1, matchId: 1, provider: 1, providerHistory: 1 } })
      .limit(incremental ? 350 : 1600).toArray() : [];
    if (providerInsights.length) {
      await to.collection("footballMatchIntelligence").bulkWrite(providerInsights.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { provider: "sportsapi", matchId: row.matchId, providerHistory: row.providerHistory } },
          upsert: true,
        },
      })), { ordered: false });
    }

    const teamIds = [...new Set(matches.flatMap((m) => [m.homeTeam?.centralTeamId, m.awayTeam?.centralTeamId]).filter(Boolean))];
    const teams = !incremental && teamIds.length ? await from.collection("centralTeams")
      .find({ centralTeamId: { $in: teamIds } }, {
        projection: { _id: 0, centralTeamId: 1, numericTeamId: 1, names: 1, aliases: 1, logoUrl: 1, providerIds: 1 },
      }).limit(1000).toArray() : [];
    if (teams.length) await to.collection("centralTeams").bulkWrite(teams.map((team) => ({
      updateOne: {
        filter: { centralTeamId: team.centralTeamId },
        update: { $set: team },
        upsert: true,
      },
    })), { ordered: false });

    // Existing league metadata is public; do not import standings as a
    // "verified" table without proving fixture/season completeness.
    const leagues = incremental ? [] : await from.collection("leagues").find({}, {
      projection: { _id: 0, code: 1, kind: 1, enName: 1, faName: 1, seasonStartYear: 1, provider: 1 },
    }).limit(100).toArray();
    if (leagues.length) await to.collection("leagues").bulkWrite(leagues.filter((l) => l.code).map((l) => ({
      updateOne: { filter: { code: l.code }, update: { $set: l }, upsert: true },
    })), { ordered: false });
    const history = incremental ? { updated: 0 } : await refreshLocalMatchIntelligence(to);
    console.info(JSON.stringify({
      previewSeed: "ok", incremental, publicMatches: matches.length, publicDetails: details.length, providerHistory: providerInsights.length,
      publicTeams: teams.length, historyMaterialized: history.updated,
      sourceDb: from.databaseName, targetDb: to.databaseName,
      personalDataCopied: false, sportsApiRequests: 0,
    }));
  } finally {
    await Promise.allSettled([source.close(), target.close()]);
  }
}

main().catch((error) => {
  console.error("Preview seed failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
