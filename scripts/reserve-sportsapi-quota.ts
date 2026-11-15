import { createHash } from "node:crypto";
import { closeMongo } from "../lib/db/mongo";
import { env } from "../lib/env";
import { reserveSportsApiQuotaBatch } from "../lib/football/sportsapi/rest";

/**
 * Called by the self-hosted quota preflight BEFORE a GitHub-hosted fetch job.
 * Reserve its entire maximum call budget in the same Mongo document as the
 * LowBlock REST client. No network request is made to SportsAPI here.
 */
async function main() {
  const attempts = Number(process.argv[2]);
  // One hosted daily job can request at most three dates x two pages.
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 6) {
    throw new Error("Hosted sync must reserve between 1 and 6 REST attempts");
  }
  const key = env.SPORTSAPI_API_KEY;
  const expected = process.env.SPORTSAPI_EXPECTED_KEY_FINGERPRINT;
  const actual = createHash("sha256").update(key).digest("hex").slice(0, 16);
  if (!key || !expected || expected !== actual) {
    throw new Error("Hosted and worker SportsAPI keys do not match; quota reservation refused");
  }
  const result = await reserveSportsApiQuotaBatch(attempts, "github-hosted-daily");
  console.log(JSON.stringify({
    type: "lowblock.sportsapi.hosted_quota_preflight",
    day: result.day,
    accepted: result.allowed,
    reserved: result.allowed ? attempts : 0,
    sharedLimit: result.limit,
    sharedUsed: result.used,
  }));
  if (!result.allowed) throw new Error("Shared SportsAPI REST budget exhausted or unavailable");
}

main().catch((error) => {
  console.error("lowblock_hosted_quota_reservation_failed", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => closeMongo());
