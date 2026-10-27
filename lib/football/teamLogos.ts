import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/mongo";

const LOGO_DIR = process.env.TEAM_LOGO_DIR || "/app/assets/team-logos";
const sofaScoreUrl = (id: string) => `https://img.sofascore.com/api/v1/team/${id}/image`;

export function cleanSportsApiTeamId(value: unknown): string | null {
  const id = String(value ?? "").replace(/\.png$/i, "").trim();
  return /^\d+$/.test(id) && id !== "0" ? id : null;
}

export function teamLogoFile(id: unknown): string | null {
  const clean = cleanSportsApiTeamId(id);
  return clean ? path.join(LOGO_DIR, `${clean}.png`) : null;
}

export function teamLogoUrl(id: unknown): string | null {
  const clean = cleanSportsApiTeamId(id);
  return clean ? `/api/team-logo/${clean}` : null;
}

async function fileExists(file: string) {
  try { await access(file, constants.R_OK); return true; } catch { return false; }
}

export async function downloadTeamLogo(id: unknown, attempts = 3): Promise<"downloaded" | "exists" | "failed"> {
  const clean = cleanSportsApiTeamId(id);
  const target = teamLogoFile(clean);
  if (!clean || !target) return "failed";
  if (await fileExists(target)) return "exists";
  await mkdir(LOGO_DIR, { recursive: true });
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    try {
      const response = await fetch(sofaScoreUrl(clean), {
        headers: { Accept: "image/*", "User-Agent": "LowBlock team-logo-cache/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
        throw new Error(`logo response ${response.status} ${contentType}`);
      }
      await writeFile(temporary, Buffer.from(await response.arrayBuffer()), { flag: "wx" });
      await rename(temporary, target);
      return "downloaded";
    } catch (error) {
      try { await unlink(temporary); } catch {}
      if (attempt === attempts) {
        console.warn("team_logo_download_failed", { teamId: clean, error: error instanceof Error ? error.message : String(error) });
        return "failed";
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  return "failed";
}

export async function downloadMissingTeamLogos(concurrency = 6) {
  const db = await getDb();
  const ids = (await db.collection("centralTeams").distinct("providerIds.sportsapi"))
    .map(cleanSportsApiTeamId).filter((id): id is string => Boolean(id));
  const unique = [...new Set(ids)];
  const report = { total: unique.length, downloaded: 0, existing: 0, failed: [] as string[] };
  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      const id = unique[cursor++];
      const result = await downloadTeamLogo(id);
      if (result === "downloaded") report.downloaded += 1;
      else if (result === "exists") report.existing += 1;
      else report.failed.push(id);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length || 1) }, worker));
  return report;
}
