import { getDb } from "@/lib/db/mongo";
import { ensureCurrentH2HLeagues, getH2HWeek, isH2HEnabled, refreshActiveH2HResults } from "@/lib/domain/h2h";
import { getFootballProvider } from "@/lib/football/providerRegistry";
import { appDateKey, providerDateKeys } from "@/lib/football/scheduleWindow";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";

/**
 * The single, complete football recovery operation used by both the nightly
 * worker and manual operations. Every phase is idempotent and the operation
 * fails if any provider date could not be fetched, so a partial run cannot be
 * recorded as a successful night.
 */
export async function runCompleteDailyFootballCycle() {
  const startedAt = new Date();
  const dates = providerDateKeys(startedAt);
  const provider = getFootballProvider();

  console.info(JSON.stringify({ type: "lowblock.daily_recovery.started", provider: provider.name, dates, startedAt: startedAt.toISOString() }));
  const sync = await provider.sync({ deferScoring: true });
  const failedDates = sync.failedDates ?? [];
  if (failedDates.length) {
    throw new Error(`FOOTBALL_SYNC_INCOMPLETE: ${failedDates.join(", ")}`);
  }

  const db = await getDb();
  let h2h: unknown = { enabled: false };
  if (isH2HEnabled()) {
    const tomorrow = appDateKey(new Date(startedAt.getTime() + 86_400_000));
    const schedule = await ensureCurrentH2HLeagues(db, { sourceDate: tomorrow, batchIndex: 0, batchSize: 1000 });
    const results = await refreshActiveH2HResults(db, getH2HWeek().key);
    h2h = { enabled: true, tomorrow, schedule, results };
  }

  const scoring = await runLeaderboardEngine({ recentOnly: true, batchIndex: 0, batchSize: 5000 });
  const result = { ok: true, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), dates, sync, h2h, scoring };
  console.info(JSON.stringify({ type: "lowblock.daily_recovery.finished", ...result }));
  return result;
}
