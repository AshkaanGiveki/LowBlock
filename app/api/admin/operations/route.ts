import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { getFootballProvider } from "@/lib/football/providerRegistry";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";
import { ensureCurrentH2HLeagues, getH2HWeek, isH2HEnabled, settleH2HLeagues } from "@/lib/domain/h2h";

export const maxDuration = 60;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("rebuild-scores") }),
  z.object({ action: z.literal("set-admin"), userId: z.string().regex(/^[a-f\d]{24}$/i), enabled: z.boolean(), confirmText: z.string() }),
  z.object({ action: z.literal("revoke-sessions"), userId: z.string().regex(/^[a-f\d]{24}$/i), confirmText: z.literal("REVOKE SESSIONS") }),
  z.object({ action: z.literal("set-club-settings"), clubId: z.string().regex(/^[a-f\d]{24}$/i), name: z.string().trim().min(2).max(60), visibility: z.enum(["PUBLIC", "PRIVATE"]), discoveryMode: z.enum(["INVITE_ONLY", "RECRUITING"]), confirmText: z.literal("UPDATE CLUB") }),
  z.object({ action: z.literal("set-match-visibility"), matchId: z.string().min(1).max(120), hidden: z.boolean(), confirmText: z.literal("UPDATE MATCH VISIBILITY") }),
  z.object({ action: z.literal("retry-notification"), jobId: z.string().regex(/^[a-f\d]{24}$/i), confirmText: z.literal("RETRY JOB") }),
  z.object({ action: z.literal("cancel-notification"), jobId: z.string().regex(/^[a-f\d]{24}$/i), confirmText: z.literal("CANCEL JOB") }),
  z.object({ action: z.literal("set-award-revealed"), awardId: z.string().regex(/^[a-f\d]{24}$/i), revealed: z.boolean(), confirmText: z.literal("UPDATE AWARD") }),
  z.object({ action: z.literal("h2h-generate"), confirmText: z.literal("GENERATE CURRENT WEEK") }),
  z.object({ action: z.literal("h2h-settle"), weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), confirmText: z.string() }),
  z.object({ action: z.literal("set-team-rating"), centralTeamId: z.string().min(1).max(120), rating: z.number().int().min(1).max(100), confirmText: z.literal("UPDATE TEAM RATING") }),
]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !expectedHost) return false;
  try { return new URL(origin).host.toLowerCase() === expectedHost.split(",")[0].trim().toLowerCase(); }
  catch { return false; }
}

function phraseFor(action: string, enabled?: boolean, weekKey?: string) {
  if (action === "set-admin") return enabled ? "GRANT ADMIN" : "REVOKE ADMIN";
  if (action === "h2h-settle") return `SETTLE ${weekKey}`;
  return "";
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return NextResponse.json({ error: "SAME_ORIGIN_REQUIRED" }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if ((input.action === "set-admin" || input.action === "h2h-settle") && input.confirmText !== phraseFor(input.action, "enabled" in input ? input.enabled : undefined, "weekKey" in input ? input.weekKey : undefined)) {
    return NextResponse.json({ error: "CONFIRMATION_PHRASE_MISMATCH" }, { status: 400 });
  }
  const db = auth.db;
  const now = new Date();
  const audit = async (action: string, target: string, outcome: "SUCCESS" | "FAILED", summary: unknown) => {
    await db.collection("adminAuditLog").insertOne({ actor: { userId: auth.userId, username: auth.user.username ?? null }, action, target, outcome, summary, createdAt: new Date() });
  };
  const result = async (action: string, target: string, operation: () => Promise<unknown>) => {
    try {
      const value = await operation();
      await audit(action, target, "SUCCESS", value);
      return NextResponse.json({ ok: true, action, result: value });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OPERATION_FAILED";
      await audit(action, target, "FAILED", { error: message });
      const status = message === "RECORD_NOT_FOUND" ? 404 : message === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  };

  if (input.action === "sync" || input.action === "rebuild-scores") {
    const action = input.action;
    try {
      await db.collection<any>("adminOperationLocks").insertOne({ _id: action, actorId: auth.userId, startedAt: now, expiresAt: new Date(now.getTime() + 90_000) });
    } catch {
      const recovered = await db.collection<any>("adminOperationLocks").updateOne({ _id: action, expiresAt: { $lte: now } }, { $set: { actorId: auth.userId, startedAt: now, expiresAt: new Date(now.getTime() + 90_000) } });
      if (!recovered.modifiedCount) return NextResponse.json({ error: "OPERATION_ALREADY_RUNNING" }, { status: 409 });
    }
    try {
      const value = action === "sync" ? await getFootballProvider().sync({ deferScoring: true }) : await runLeaderboardEngine();
      await audit(action === "sync" ? "FOOTBALL_SYNC" : "SCORE_REBUILD", "system", "SUCCESS", value);
      return NextResponse.json({ ok: true, action, result: value });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OPERATION_FAILED";
      await audit(action === "sync" ? "FOOTBALL_SYNC" : "SCORE_REBUILD", "system", "FAILED", { error: message });
      return NextResponse.json({ error: message }, { status: 500 });
    } finally { await db.collection<any>("adminOperationLocks").deleteOne({ _id: action }); }
  }

  switch (input.action) {
    case "set-admin": {
      if (input.userId === auth.userId) return NextResponse.json({ error: "CANNOT_CHANGE_OWN_ADMIN_ROLE" }, { status: 409 });
      return result(input.enabled ? "USER_ADMIN_GRANTED" : "USER_ADMIN_REVOKED", input.userId, async () => {
        const target = new ObjectId(input.userId);
        if (!input.enabled) {
          const admins = await db.collection("users").countDocuments({ $or: [{ role: { $in: ["ADMIN", "admin"] } }, { isAdmin: true }] });
          if (admins <= 1) throw new Error("CANNOT_REVOKE_LAST_ADMIN");
        }
        const user = await db.collection("users").findOne({ _id: target }, { projection: { username: 1, role: 1, isAdmin: 1 } });
        if (!user) throw new Error("RECORD_NOT_FOUND");
        const update = input.enabled
          ? { $set: { role: "ADMIN", isAdmin: true, updatedAt: new Date() } }
          : { $unset: { isAdmin: "", ...(user.role === "ADMIN" || user.role === "admin" ? { role: "" } : {}) }, $set: { updatedAt: new Date() } };
        await db.collection("users").updateOne({ _id: target }, update as any);
        return { userId: input.userId, username: user.username ?? null, admin: input.enabled };
      });
    }
    case "revoke-sessions":
      if (input.userId === auth.userId) return NextResponse.json({ error: "CANNOT_REVOKE_OWN_SESSION" }, { status: 409 });
      return result("USER_SESSIONS_REVOKED", input.userId, async () => {
        const user = await db.collection("users").findOne({ _id: new ObjectId(input.userId) }, { projection: { username: 1 } });
        if (!user) throw new Error("RECORD_NOT_FOUND");
        const deleted = await db.collection("sessions").deleteMany({ userId: input.userId });
        return { userId: input.userId, username: user.username ?? null, sessionsRevoked: deleted.deletedCount };
      });
    case "set-club-settings":
      return result("CLUB_SETTINGS_UPDATED", input.clubId, async () => {
        const id = new ObjectId(input.clubId);
        const before = await db.collection("clubs").findOne({ _id: id }, { projection: { name: 1, visibility: 1, discoveryMode: 1 } });
        if (!before) throw new Error("RECORD_NOT_FOUND");
        await db.collection("clubs").updateOne({ _id: id }, { $set: { name: input.name, visibility: input.visibility, discoveryMode: input.discoveryMode, updatedAt: new Date() } });
        return { before, after: { name: input.name, visibility: input.visibility, discoveryMode: input.discoveryMode } };
      });
    case "set-match-visibility":
      return result(input.hidden ? "MATCH_HIDDEN_FROM_LIST" : "MATCH_RESTORED_TO_LIST", input.matchId, async () => {
        const match = await db.collection("matches").findOne({ providerMatchId: input.matchId }, { projection: { providerMatchId: 1, homeTeam: 1, awayTeam: 1, adminHiddenFromListings: 1 } });
        if (!match) throw new Error("RECORD_NOT_FOUND");
        await db.collection("matches").updateOne({ _id: match._id }, { $set: { adminHiddenFromListings: input.hidden, updatedAt: new Date() } });
        return { fixture: `${match.homeTeam?.name ?? "Home"} vs ${match.awayTeam?.name ?? "Away"}`, hidden: input.hidden, predictionsPreserved: true };
      });
    case "retry-notification":
      return result("NOTIFICATION_RETRY_QUEUED", input.jobId, async () => {
        const job = await db.collection("notificationJobs").findOneAndUpdate({ _id: new ObjectId(input.jobId), status: { $in: ["FAILED", "DEAD"] } }, { $set: { status: "PENDING", attempts: 0, runAt: new Date(), updatedAt: new Date() }, $unset: { leaseUntil: "", lastError: "" } }, { returnDocument: "after" });
        if (!job) throw new Error("CONFLICT");
        return { jobId: input.jobId, status: "PENDING", attempts: 0 };
      });
    case "cancel-notification":
      return result("NOTIFICATION_CANCELLED", input.jobId, async () => {
        const changed = await db.collection("notificationJobs").updateOne({ _id: new ObjectId(input.jobId), status: { $in: ["PENDING", "FAILED", "DEAD"] } }, { $set: { status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() } });
        if (!changed.modifiedCount) throw new Error("CONFLICT");
        return { jobId: input.jobId, status: "CANCELLED", recoverable: true };
      });
    case "set-award-revealed":
      return result(input.revealed ? "AWARD_MARKED_REVEALED" : "AWARD_REVEAL_RESET", input.awardId, async () => {
        const id = new ObjectId(input.awardId);
        const before = await db.collection("awards").findOne({ _id: id }, { projection: { userId: 1, type: 1, revealedAt: 1 } });
        if (!before) throw new Error("RECORD_NOT_FOUND");
        if (input.revealed) await db.collection("awards").updateOne({ _id: id }, { $set: { revealedAt: new Date(), adminRevealOverride: true } });
        else await db.collection("awards").updateOne({ _id: id }, { $unset: { revealedAt: "", adminRevealOverride: "" } });
        return { awardId: input.awardId, userId: before.userId, revealed: input.revealed };
      });
    case "h2h-generate":
      if (!isH2HEnabled()) return NextResponse.json({ error: "H2H_DISABLED" }, { status: 409 });
      return result("H2H_CURRENT_WEEK_GENERATED", getH2HWeek().key, async () => ensureCurrentH2HLeagues(db));
    case "h2h-settle":
      if (!isH2HEnabled()) return NextResponse.json({ error: "H2H_DISABLED" }, { status: 409 });
      return result("H2H_WEEK_SETTLED", input.weekKey, async () => settleH2HLeagues(db, input.weekKey));
    case "set-team-rating":
      return result("TEAM_RATING_UPDATED", input.centralTeamId, async () => {
        const before = await db.collection("centralTeams").findOne({ centralTeamId: input.centralTeamId }, { projection: { name: 1, h2hRating: 1 } });
        if (!before) throw new Error("RECORD_NOT_FOUND");
        await db.collection("centralTeams").updateOne({ centralTeamId: input.centralTeamId }, { $set: { h2hRating: input.rating, h2hRatingVersion: "manual", h2hRatingUpdatedAt: new Date() } });
        await db.collection("h2hAuditEvents").insertOne({ type: "RATING_CHANGED", centralTeamId: input.centralTeamId, rating: input.rating, createdAt: new Date() });
        return { team: before.name, previousRating: before.h2hRating ?? null, rating: input.rating };
      });
  }
}
