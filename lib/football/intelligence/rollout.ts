import { createHash } from "node:crypto";

/**
 * Stable, server-side cohort assignment. Production defaults to OFF, and
 * a gradual rollout is possible without database writes or per-viewer
 * SportsAPI subscriptions. Guest users join only at 100%.
 */
export function matchIntelligenceRolloutEnabled(
  userId: string | null | undefined,
  percent: number,
  preview = false,
): boolean {
  if (preview) return true;
  if (!Number.isFinite(percent)) return false;
  const bounded = Math.max(0, Math.min(100, Math.floor(percent)));
  if (bounded === 0) return false;
  if (bounded === 100) return true;
  if (!userId) return false;
  const digest = createHash("sha256")
    .update("lowblock-match-intelligence-cohort-v1:")
    .update(userId)
    .digest();
  return digest.readUInt32BE(0) % 100 < bounded;
}
