import { closeMongo, getDb } from "../lib/db/mongo";
import { reviewedPersianTeamName } from "../lib/football/persian-team-names";
import { repairPersianText, teamName } from "../lib/football/team-names";

function isEnglishFallback(en: string, fa: string | undefined) {
  return !fa || fa.trim() === en.trim();
}

async function main() {
  const db = await getDb();
  const central = await db.collection<any>("centralTeams").find().toArray();
  const faByCentral = new Map<string, string>();
  let centralUpdated = 0;

  for (const row of central) {
    const en = String(row.names?.en || row.providerNames?.sportsapi || row.providerNames?.["football-api"] || "").trim();
    if (!en) continue;
    let fa = reviewedPersianTeamName(en);
    if (!fa) {
      for (const provider of ["sportsapi", "football-api"] as const) {
        const id = row.providerIds?.[provider];
        const source = row.providerNames?.[provider] || en;
        if (!id) continue;
        const candidate = repairPersianText(teamName("fa", Number(id), source, provider));
        if (candidate !== source) {
          fa = candidate;
          break;
        }
      }
    }
    if (!fa || isEnglishFallback(en, fa)) continue;
    faByCentral.set(row.centralTeamId, fa);
    if (row.names?.fa !== fa) {
      await db.collection("centralTeams").updateOne(
        { _id: row._id },
        { $set: { "names.fa": fa, updatedAt: new Date() } },
      );
      centralUpdated++;
    }
  }

  const matches = await db.collection<any>("matches").find({}).project({ _id: 1, homeTeam: 1, awayTeam: 1 }).toArray();
  let matchesUpdated = 0;
  for (const match of matches) {
    const homeFa = faByCentral.get(match.homeTeam?.centralTeamId);
    const awayFa = faByCentral.get(match.awayTeam?.centralTeamId);
    const set: Record<string, string> = {};
    if (homeFa && match.homeTeam?.faName !== homeFa) set["homeTeam.faName"] = homeFa;
    if (awayFa && match.awayTeam?.faName !== awayFa) set["awayTeam.faName"] = awayFa;
    if (Object.keys(set).length) {
      await db.collection("matches").updateOne({ _id: match._id }, { $set: { ...set, updatedAt: new Date() } });
      matchesUpdated++;
    }
  }

  console.log(JSON.stringify({ centralTeams: central.length, centralUpdated, matchesUpdated, mapped: faByCentral.size }, null, 2));
  await closeMongo();
}

main().catch(async (error) => { console.error(error); await closeMongo(); process.exitCode = 1; });
