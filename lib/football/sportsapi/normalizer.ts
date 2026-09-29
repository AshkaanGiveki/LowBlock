import { getLeagueCodeFromSportsApi } from "../competitionMapping";
import type {
  CanonicalMatch,
  CanonicalIncident,
  CanonicalStatus,
  CanonicalScore,
  CanonicalIncidentType,
} from "../types";

function normalizeStatus(status?: { code?: number; type?: string; description?: string }): CanonicalStatus {
  if (!status) return "SCHEDULED";

  const type = status.type?.toLowerCase();
  const desc = status.description?.toUpperCase();

  if (type === "finished" || desc === "ENDED" || desc === "AWARDED" || desc === "WO") return "FINISHED";
  if (type === "inprogress" || desc === "INPROGRESS" || desc === "1ST HALF" || desc === "2ND HALF" || desc === "HALFTIME") return "LIVE";
  if (type === "postponed" || desc === "POSTPONED") return "POSTPONED";
  if (type === "canceled" || desc === "CANCELED" || desc === "CANCELLED") return "VOID";
  if (type === "suspended" || desc === "SUSPENDED") return "SUSPENDED";
  if (type === "notstarted") return "SCHEDULED";

  return "SCHEDULED";
}

function extractGoals(scoreObj: any): number | null {
  if (!scoreObj) return null;
  if (typeof scoreObj.display === "number") return scoreObj.display;
  if (typeof scoreObj.current === "number") return scoreObj.current;
  if (typeof scoreObj.normaltime === "number") return scoreObj.normaltime;
  return null;
}

export function normalizeSportsApiMatch(rawInput: any): CanonicalMatch | null {
  if (!rawInput) return null;
  const rawEvent = rawInput.event || rawInput;

  const rawTournament =
    rawEvent.tournament ||
    (rawEvent.uniqueTournament ? { uniqueTournament: rawEvent.uniqueTournament } : null);

  const leagueCode = getLeagueCodeFromSportsApi(rawTournament);

  // If we can't map the league, we drop it (Competition filtering is strictly preserved)
  if (!leagueCode) return null;

  const rawId = rawEvent.id || rawEvent.eventId;
  if (!rawId) return null;

  const rawStart = rawEvent.startTimestamp || rawEvent.startDate || rawEvent.startTime;
  let kickoff: Date;
  if (typeof rawStart === "number") {
    kickoff = new Date(rawStart > 1e11 ? rawStart : rawStart * 1000);
  } else if (rawStart) {
    kickoff = new Date(rawStart);
  } else {
    kickoff = new Date();
  }

  const matchday = Number(rawEvent.roundInfo?.round ?? 0);

  // Derive season Start Year. e.g. "26/27" -> 2026, or "2026" -> 2026.
  let seasonYear = kickoff.getUTCFullYear();
  if (rawEvent.season?.year) {
    const parsed = parseInt(String(rawEvent.season.year).split("/")[0], 10);
    if (parsed > 1900) {
      seasonYear = parsed;
    } else if (parsed > 0 && parsed < 100) {
      seasonYear = 2000 + parsed;
    }
  }

  const homeScore: CanonicalScore = {
    current: rawEvent.homeScore?.current ?? null,
    display: rawEvent.homeScore?.display ?? null,
    period1: rawEvent.homeScore?.period1 ?? null,
    period2: rawEvent.homeScore?.period2 ?? null,
    normaltime: rawEvent.homeScore?.normaltime ?? null,
    overtime: rawEvent.homeScore?.overtime ?? null,
    penalties: rawEvent.homeScore?.penalties ?? null,
  };

  const awayScore: CanonicalScore = {
    current: rawEvent.awayScore?.current ?? null,
    display: rawEvent.awayScore?.display ?? null,
    period1: rawEvent.awayScore?.period1 ?? null,
    period2: rawEvent.awayScore?.period2 ?? null,
    normaltime: rawEvent.awayScore?.normaltime ?? null,
    overtime: rawEvent.awayScore?.overtime ?? null,
    penalties: rawEvent.awayScore?.penalties ?? null,
  };

  return {
    provider: "sportsapi",
    providerMatchId: String(rawId),
    sportsApiId: Number(rawId),
    leagueCode,
    matchday,
    seasonStartYear: seasonYear,
    roundId: `${leagueCode}:${seasonYear}:${matchday}`,
    homeTeamProviderId: String(rawEvent.homeTeam?.id || "0"),
    awayTeamProviderId: String(rawEvent.awayTeam?.id || "0"),
    homeTeam: {
      id: Number(rawEvent.homeTeam?.id || 0),
      name: rawEvent.homeTeam?.name || "Unknown",
      logoUrl: null,
      shortName: rawEvent.homeTeam?.shortName,
      code: rawEvent.homeTeam?.nameCode,
    },
    awayTeam: {
      id: Number(rawEvent.awayTeam?.id || 0),
      name: rawEvent.awayTeam?.name || "Unknown",
      logoUrl: null,
      shortName: rawEvent.awayTeam?.shortName,
      code: rawEvent.awayTeam?.nameCode,
    },
    kickoffAt: kickoff,
    status: normalizeStatus(rawEvent.status),
    elapsed: rawEvent.time?.currentPeriodStartTimestamp
      ? Math.floor((Date.now() / 1000 - rawEvent.time.currentPeriodStartTimestamp) / 60)
      : null,
    homeGoals: extractGoals(rawEvent.homeScore),
    awayGoals: extractGoals(rawEvent.awayScore),
    homeScore,
    awayScore,
    venue: rawEvent.venue
      ? {
          id: rawEvent.venue.id ?? null,
          name: rawEvent.venue.name ?? null,
          city: rawEvent.venue.city?.name ?? rawEvent.venue.city ?? null,
        }
      : null,
    availability: {
      score: { available: true, source: "rest" },
      incidents: { available: false },
      stats: { available: false },
      odds: { available: false },
      lineups: { available: false },
    },
    rawApiResponse: rawEvent,
    updatedAt: new Date(),
    createdAt: new Date(),
    lastChangeTimestamp: rawEvent.changes?.changeTimestamp ?? null,
  };
}

export function normalizeSportsApiIncident(rawIncident: any): CanonicalIncident | null {
  if (!rawIncident || !rawIncident.id) return null;

  let type: CanonicalIncidentType = "other";
  const rawType = String(rawIncident.incidentType).toLowerCase();

  if (rawType.includes("goal")) type = "goal";
  else if (rawType.includes("card")) type = "card";
  else if (rawType.includes("sub")) type = "substitution";
  else if (rawType.includes("var")) type = "var";
  else if (rawType.includes("period")) type = "period";
  else if (rawType.includes("injury")) type = "injury_time";

  let cardType: "yellow" | "red" | "yellow_red" | undefined;
  if (type === "card") {
    if (rawIncident.incidentClass === "yellow") cardType = "yellow";
    else if (rawIncident.incidentClass === "red") cardType = "red";
    else if (rawIncident.incidentClass === "yellowRed") cardType = "yellow_red";
  }

  return {
    id: String(rawIncident.id),
    type,
    time: rawIncident.time ?? 0,
    addedTime: rawIncident.addedTime ?? null,
    period: rawIncident.timeSeconds ? "live" : undefined,
    teamId: rawIncident.isHome ? rawIncident.teamId : undefined,
    playerName: rawIncident.player?.name,
    playerInName: rawIncident.playerIn?.name,
    playerOutName: rawIncident.playerOut?.name,
    cardType,
    score:
      rawIncident.homeScore !== undefined && rawIncident.awayScore !== undefined
        ? { home: rawIncident.homeScore, away: rawIncident.awayScore }
        : undefined,
    detail: rawIncident.incidentClass || rawIncident.description,
  };
}
