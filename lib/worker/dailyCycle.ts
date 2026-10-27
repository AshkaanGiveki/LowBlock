import { getFootballProvider } from "@/lib/football/providerRegistry";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";

export async function runDailyFootballCycle() {
  const startedAt = new Date();
  const provider = getFootballProvider();
  const sync = await provider.sync({ deferScoring: true });
  const scoring = await runLeaderboardEngine({
    recentOnly: true,
    batchIndex: 0,
    batchSize: 5000,
  });
  return {
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    sync,
    scoring,
  };
}
