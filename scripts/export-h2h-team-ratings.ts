import { writeFile } from "node:fs/promises";
import { isImportantNationalTeam, LEAGUES } from "../lib/football/leagues";
import { env } from "../lib/env";
import { closeMongo, getDb } from "../lib/db/mongo";

const H2H_CODES = new Set([
  "GB1", "ES1", "L1", "IT1", "FR1", "IR1", "SA1", "GB2", "TR1",
  "UCL", "UEL", "FRIENDLY", "NATIONS", "ACLE",
]);

const explicitWeights: Record<string, number> = {
  // Requested H2H hierarchy.
  UCL: 1.20,
  GB1: 1.18,
  ES1: 1.16,
  IT1: 1.14,
  L1: 1.12,
  UEL: 1.12,
  FR1: 1.10,
  // Other supported H2H competitions, intentionally distinct.
  SA1: 1.08,
  ACLE: 1.08,
  TR1: 1.07,
  NATIONS: 1.07,
  GB2: 1.05,
  IR1: 1.04,
  FRIENDLY: 1.00,
  // Other configured competitions, retained for the complete reference table.
  WC: 1.18,
  EURO: 1.16,
  GB_FA: 1.08,
  ES_COPA: 1.08,
  DE_CUP: 1.08,
  IT_CUP: 1.08,
  FR_CUP: 1.07,
  TR_CUP: 1.06,
  IR_CUP: 1.05,
  SA_CUP: 1.05,
  UECL: 1.06,
  WCQ_EU: 1.04,
  WCQ_SAM: 1.04,
  WCQ_ASIA: 1.03,
  WCQ_AFRICA: 1.03,
  WCQ_CONCACAF: 1.03,
  WCQ_OCEANIA: 1.02,
  EUROQ: 1.03,
  AFCON: 1.10,
  AFC_ASIAN_CUP: 1.08,
  GOLD_CUP: 1.06,
  UEFA_SC: 1.04,
  DE_SC: 1.04,
  IT_SC: 1.04,
  ES_SC: 1.04,
  FR_SC: 1.04,
  TR_SC: 1.03,
  IR_SC: 1.03,
  SA_SC: 1.03,
  GB_CS: 1.03,
};

type TeamAgg = {
  providerIds: Set<string>;
  name: string;
  faName: string | null;
  logoUrl: string | null;
  centralTeamId: string | null;
  appearances: number;
  finishedMatches: number;
  points: number;
  goalDifference: number;
  competitions: Set<string>;
  bestTournamentWeight: number;
  isNational: boolean;
};

function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Football-history/current-strength anchors. These are intentionally the
// primary signal; database form is only a small adjustment below.
const MANUAL_RATINGS: Record<string, number> = {
  "brazil": 96, "argentina": 96, "france": 94, "spain": 92, "germany": 91,
  "england": 90, "italy": 89, "portugal": 89, "netherlands": 88,
  "belgium": 87, "croatia": 86, "uruguay": 86, "colombia": 84,
  "japan": 81, "mexico": 80, "morocco": 82, "senegal": 80,
  "switzerland": 79, "denmark": 80, "austria": 78, "serbia": 77,
  "ukraine": 76, "turkiye": 76, "turkey": 76, "iran": 73,
  "south korea": 75, "australia": 72, "usa": 76, "chile": 78,
  "ecuador": 76, "paraguay": 74, "peru": 72, "nigeria": 76,
  "cameroon": 74, "ghana": 72, "algeria": 75, "egypt": 73,
  "cote d ivoire": 74, "ivory coast": 74, "greece": 70, "scotland": 70,
  "poland": 75, "czechia": 72, "romania": 69, "sweden": 72,
  "norway": 75, "russia": 74, "wales": 70, "ireland": 66,
  "real madrid": 97, "barcelona": 95, "bayern munchen": 95, "bayern munich": 95,
  "liverpool": 94, "manchester city": 93, "paris saint germain": 91,
  "inter": 91, "arsenal": 90, "atletico madrid": 89, "chelsea": 89,
  "borussia dortmund": 88, "juventus": 87, "ac milan": 87, "napoli": 86,
  "bayer leverkusen": 86, "rb leipzig": 84, "tottenham": 84,
  "manchester united": 84, "aston villa": 82, "newcastle united": 81,
  "roma": 81, "as roma": 81, "lazio": 79, "fiorentina": 78,
  "real betis": 80, "real sociedad": 79, "villarreal": 80,
  "sevilla": 80, "athletic club": 79, "monaco": 82, "lyon": 80,
  "marseille": 79, "lille": 78, "benfica": 84, "fc porto": 84,
  "sporting cp": 83, "psv eindhoven": 80, "feyenoord": 78,
  "ajax": 78, "club brugge kv": 76, "galatasaray": 79,
  "fenerbahce": 77, "besiktas": 73, "trabzonspor": 70,
  "al hilal": 80, "al hilal saudi fc": 80, "al nassr": 76,
  "al ittihad": 74, "al ittihad fc": 74, "al ahli": 72,
  "al ahli jeddah": 72, "al sadd": 70, "persepolis fc": 70,
  "esteghlal fc": 69, "tractor sazi": 66, "sepahan fc": 64,
  "shabab al ahli dubai": 65, "johor darul tazim": 66,
  "kashima antlers": 65, "jeonbuk motors": 65, "buriram united": 63,
  "celtic": 76, "rangers": 74, "red bull salzburg": 77,
  "dinamo zagreb": 74, "shakhtar donetsk": 76, "olympiakos piraeus": 76,
  "anderlecht": 70, "bodo glimt": 69,
  "sparta praha": 69, "slavia praha": 70,
};

function manualRating(name: string) {
  return MANUAL_RATINGS[normalizeName(name)];
}

function isNationalName(name: string) {
  const key = normalizeName(name);
  return isImportantNationalTeam(name) ||
    MANUAL_RATINGS[key] !== undefined && [
      "brazil", "argentina", "france", "spain", "germany", "england", "italy",
      "portugal", "netherlands", "belgium", "croatia", "uruguay", "colombia",
      "japan", "mexico", "morocco", "senegal", "switzerland", "denmark", "austria",
      "serbia", "ukraine", "turkiye", "turkey", "iran", "south korea", "australia",
      "usa", "chile", "ecuador", "paraguay", "peru", "nigeria", "cameroon", "ghana",
      "algeria", "egypt", "cote d ivoire", "ivory coast", "greece", "scotland", "poland",
      "czechia", "romania", "sweden", "norway", "russia", "wales", "ireland",
    ].includes(key);
}

function fallbackRating(team: TeamAgg) {
  if (team.isNational) return 55;
  if (team.bestTournamentWeight >= 1.2) return 62;
  if (team.bestTournamentWeight >= 1.15) return 57;
  if (team.bestTournamentWeight >= 1.1) return 52;
  if (team.bestTournamentWeight >= 1.08) return 48;
  return 42;
}

function tournamentWeight(code: string) {
  if (explicitWeights[code] !== undefined) return explicitWeights[code];
  const item = LEAGUES.find((league) => league.code === code);
  if (!item) return 1;
  if (item.kind === "INTERNATIONAL") return 1.05;
  if (item.kind === "TOURNAMENT") return 1.05;
  return 1.0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function teamFrom(match: any, side: "home" | "away") {
  const team = match[`${side}Team`] ?? {};
  return {
    id: team.id == null ? null : String(team.id),
    name: String(team.name ?? "Unknown team"),
    faName: team.faName ? String(team.faName) : null,
    logoUrl: team.logoUrl ? String(team.logoUrl) : null,
    centralTeamId: team.centralTeamId ? String(team.centralTeamId) : null,
  };
}

async function main() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  const db = await getDb();
  const codes = [...H2H_CODES];
  const matches = await db.collection<any>("matches").find({
    leagueCode: { $in: codes },
  }, {
    projection: {
      leagueCode: 1, homeTeam: 1, awayTeam: 1, homeGoals: 1, awayGoals: 1,
      status: 1, kickoffAt: 1,
    },
  }).toArray();
  const centralIds = [...new Set(matches.flatMap((match) => [match.homeTeam?.centralTeamId, match.awayTeam?.centralTeamId]).filter(Boolean))];
  const centralRows = await db.collection<any>("centralTeams").find({ centralTeamId: { $in: centralIds } }, { projection: { centralTeamId: 1, isNational: 1 } }).toArray();
  const nationalByCentralId = new Map(centralRows.map((row) => [String(row.centralTeamId), Boolean(row.isNational)]));

  const teams = new Map<string, TeamAgg>();
  const getTeam = (team: ReturnType<typeof teamFrom>) => {
    const key = team.centralTeamId ?? team.id ?? `name:${team.name.toLowerCase()}`;
    let row = teams.get(key);
    if (!row) {
      row = {
        name: team.name,
        faName: team.faName,
        logoUrl: team.logoUrl,
        centralTeamId: team.centralTeamId,
        providerIds: new Set<string>(),
        appearances: 0,
        finishedMatches: 0,
        points: 0,
        goalDifference: 0,
        competitions: new Set<string>(),
        bestTournamentWeight: 1,
        isNational: Boolean((team.centralTeamId && nationalByCentralId.get(team.centralTeamId)) || isNationalName(team.name)),
      };
      teams.set(key, row);
    }
    if (team.id) row.providerIds.add(team.id);
    if (team.name.length > row.name.length && row.appearances === 0) row.name = team.name;
    if (!row.faName && team.faName) row.faName = team.faName;
    if (!row.logoUrl && team.logoUrl) row.logoUrl = team.logoUrl;
    if (!row.centralTeamId && team.centralTeamId) row.centralTeamId = team.centralTeamId;
    return row;
  };

  for (const match of matches) {
    const code = String(match.leagueCode);
    const weight = tournamentWeight(code);
    const home = getTeam(teamFrom(match, "home"));
    const away = getTeam(teamFrom(match, "away"));
    home.appearances++;
    away.appearances++;
    home.competitions.add(code);
    away.competitions.add(code);
    home.bestTournamentWeight = Math.max(home.bestTournamentWeight, weight);
    away.bestTournamentWeight = Math.max(away.bestTournamentWeight, weight);

    const hg = Number.isFinite(Number(match.homeGoals)) ? Number(match.homeGoals) : null;
    const ag = Number.isFinite(Number(match.awayGoals)) ? Number(match.awayGoals) : null;
    if (match.status !== "FINISHED" || hg === null || ag === null) continue;
    home.finishedMatches++;
    away.finishedMatches++;
    home.goalDifference += hg - ag;
    away.goalDifference += ag - hg;
    if (hg > ag) home.points += 3;
    else if (hg < ag) away.points += 3;
    else {
      home.points++;
      away.points++;
    }
  }

  const rows = [...teams.values()].map((team) => {
    const base = manualRating(team.name) ?? fallbackRating(team);
    if (!team.finishedMatches) return { ...team, rating: base, ratingBasis: manualRating(team.name) !== undefined ? "Curated football-strength baseline; no finished result in extracted data" : "Conservative category baseline; no finished result in extracted data" };
    const pointsPerGame = team.points / team.finishedMatches;
    const goalDifferencePerMatch = team.goalDifference / team.finishedMatches;
    const formSignal = clamp(((pointsPerGame / 3) - 0.5) * 4 + goalDifferencePerMatch * 0.5, -2, 2);
    const formAdjustment = team.finishedMatches >= 3 ? formSignal : formSignal * 0.35;
    const rating = Math.round(clamp(base + formAdjustment, 1, 100));
    return {
      ...team,
      rating: clamp(rating, 1, 100),
      ratingBasis: manualRating(team.name) !== undefined ? "Curated football-strength baseline + small current-form adjustment" : "Category baseline + small current-form adjustment",
    };
  }).sort((a, b) => b.rating - a.rating || b.finishedMatches - a.finishedMatches || a.name.localeCompare(b.name));

  const tournamentRows = LEAGUES.map((league) => ({
    code: league.code,
    name: league.enName,
    kind: league.kind,
    h2hSelected: H2H_CODES.has(league.code),
    weight: tournamentWeight(league.code),
  })).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));

  const lines = [
    "# H2H Team Rating Review",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Source matches: ${matches.length}`,
    `Distinct teams: ${rows.length}`,
    "",
    "## Important review note",
    "",
    "These ratings are provisional football-strength ratings for review. Teams are consolidated by the repository's canonical centralTeamId. The primary signal is a curated football-history/current-strength baseline; extracted results are only a small form adjustment. National teams are rated as national teams, not as club teams. Every identifiable team has a nonzero rating; no-finished-result teams keep their baseline.",
    "",
    "## Team ratings",
    "",
    "| Rank | Team | Type | Canonical team ID | Persian name | Rating | Finished matches | Appearances | Competitions | Rating basis |",
    "|---:|---|---|---|---|---:|---:|---:|---|---|",
    ...rows.map((row, index) => `| ${index + 1} | ${row.name.replaceAll("|", "\\|")} | ${row.isNational ? "National" : "Club"} | ${row.centralTeamId ?? "—"} | ${(row.faName ?? "—").replaceAll("|", "\\|")} | ${row.rating} | ${row.finishedMatches} | ${row.appearances} | ${[...row.competitions].sort().join(", ")} | ${row.ratingBasis} |`),
    "",
    "## Tournament weights",
    "",
    "| Code | Tournament | Kind | Selected for H2H | Weight |",
    "|---|---|---|:---:|---:|",
    ...tournamentRows.map((row) => `| ${row.code} | ${row.name.replaceAll("|", "\\|")} | ${row.kind} | ${row.h2hSelected ? "Yes" : "No"} | ${row.weight.toFixed(2)} |`),
    "",
    "## Proposed match formula",
    "",
    "```text",
    "matchScore = (homeTeamRating + awayTeamRating) × tournamentWeight",
    "eligible when matchScore > 0",
    "```",
    "",
    "The next step after approval is to replace the provisional rating source with the final approved team-rating table and build the unique-fixture slate selector around it.",
    "",
  ];
  await writeFile("data/h2h-team-ratings-review.md", lines.join("\n"), "utf8");
  await writeFile("data/h2h-team-ratings-review.json", JSON.stringify({ generatedAt: new Date().toISOString(), sourceMatches: matches.length, teams: rows.map(({ competitions, providerIds, centralTeamId, ...row }) => ({ ...row, teamId: centralTeamId, competitions: [...competitions].sort() })), tournaments: tournamentRows }, null, 2), "utf8");
  console.log(JSON.stringify({ sourceMatches: matches.length, teams: rows.length, output: ["data/h2h-team-ratings-review.md", "data/h2h-team-ratings-review.json"] }, null, 2));
  await closeMongo();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongo();
  process.exit(1);
});
