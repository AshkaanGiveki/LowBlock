import { getDb, closeMongo } from "../lib/db/mongo";
import { settleH2HLeagues } from "../lib/domain/h2h";

async function main() {
  try {
    console.log(await settleH2HLeagues(await getDb()));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeMongo().catch(() => undefined);
  }
}

void main();
