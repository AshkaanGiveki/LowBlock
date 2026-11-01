import { getFootballProvider } from "@/lib/football/providerRegistry";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";
import { providerDateKeys } from "@/lib/football/scheduleWindow";

export async function runDailyFootballCycle() {
  const startedAt = new Date();
  const provider = getFootballProvider();
  const dates = providerDateKeys(startedAt);
  console.info(JSON.stringify({ type: "lowblock.worker.daily_phase_started", phase: "provider_sync", provider: provider.name, dates, startedAt: startedAt.toISOString() }));
  const sync = await provider.sync({ deferScoring: true });
  console.info(JSON.stringify({ type: "lowblock.worker.daily_phase_finished", phase: "provider_sync", provider: provider.name, dates, result: sync }));
  console.info(JSON.stringify({ type: "lowblock.worker.daily_phase_started", phase: "score_and_leaderboard", dates }));
  const scoring = await runLeaderboardEngine({
    recentOnly: true,
    batchIndex: 0,
    batchSize: 5000,
  });
  console.info(JSON.stringify({ type: "lowblock.worker.daily_phase_finished", phase: "score_and_leaderboard", dates, result: scoring }));
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
