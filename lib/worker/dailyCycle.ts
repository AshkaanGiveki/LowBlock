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
    // Scoring is still run against the data that is available, but the
    // worker must retry the daily cycle when any provider date failed.
    ok: (sync.failedDates?.length ?? 0) === 0,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    sync,
    scoring,
  };
}
