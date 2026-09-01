import type { MetadataRoute } from "next";
import { getMatches } from "@/lib/football/data";
import { LEAGUES } from "@/lib/football/leagues";

const siteUrl = "https://lowblock.ir";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths = ["", "/football-predictions", "/how-scoring-works", "/telegram-football-predictions", "/bale-football-predictions", "/lowblock", "/leaderboard", "/help", "/fa", "/en", ...["fa", "en"].flatMap((locale) => ["football-predictions", "how-scoring-works", "telegram-football-predictions", "bale-football-predictions"].map((slug) => `/${locale}/${slug}`))];
  const staticPages = staticPaths.map((path) => ({ url: `${siteUrl}${path}`, lastModified: now, changeFrequency: path === "" || path === "/fa" || path === "/en" ? "daily" as const : "weekly" as const, priority: path === "" ? 1 : .7 }));
  const leaguePages = LEAGUES.map((league) => ({ url: `${siteUrl}/leagues/${league.code}`, lastModified: now, changeFrequency: "daily" as const, priority: .8 }));
  const matches = await getMatches({ limit: 500 });
  const matchPages = matches.map((match) => ({ url: `${siteUrl}/matches/${encodeURIComponent(match.providerMatchId)}`, lastModified: new Date(match.kickoffAt), changeFrequency: "hourly" as const, priority: .65 }));
  return [...staticPages, ...leaguePages, ...matchPages];
}
