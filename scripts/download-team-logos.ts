import { closeMongo } from "../lib/db/mongo";
import { downloadMissingTeamLogos } from "../lib/football/teamLogos";

async function main() {
  const report = await downloadMissingTeamLogos(6);
  console.log(JSON.stringify({ teamLogos: report }));
  if (report.failed.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error("team_logo_download_failed", error);
  process.exitCode = 1;
}).finally(() => closeMongo());
