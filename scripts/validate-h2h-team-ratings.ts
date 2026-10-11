import ratings from "../data/h2h-team-ratings-review.json";
const rows = ratings.teams as Array<{ centralTeamId?: string; rating: number }>;
const invalid = rows.filter((row) => !row.centralTeamId || !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 100);
if (invalid.length) { console.error(JSON.stringify({ invalid: invalid.length })); process.exitCode = 1; } else console.log(JSON.stringify({ approvedTeams: rows.length, valid: true }));
