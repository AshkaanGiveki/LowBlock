import { runScoreEngine } from "../lib/scoring/scoreEngine";
import { closeMongo } from "../lib/db/mongo";

try {
  const result = await runScoreEngine();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeMongo();
}
