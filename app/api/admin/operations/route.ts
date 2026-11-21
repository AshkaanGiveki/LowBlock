import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/auth/admin";
import { getFootballProvider } from "@/lib/football/providerRegistry";
import { runLeaderboardEngine } from "@/lib/scoring/scoreEngine";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const action = body?.action;
  if (!new Set(["sync", "rebuild-scores", "set-admin"]).has(action)) return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  if (action === "set-admin" && (!ObjectId.isValid(String(body.userId ?? "")) || body.userId === auth.userId || typeof body.enabled !== "boolean")) {
    return NextResponse.json({ error: "INVALID_ROLE_CHANGE" }, { status: 400 });
  }
  const db = auth.db;
  const now = new Date();
  try {
    await db.collection("adminOperationLocks").insertOne({ _id: action, actorId: auth.userId, startedAt: now, expiresAt: new Date(now.getTime() + 90_000) });
  } catch {
    const recovered = await db.collection("adminOperationLocks").updateOne(
      { _id: action, expiresAt: { $lte: now } },
      { $set: { actorId: auth.userId, startedAt: now, expiresAt: new Date(now.getTime() + 90_000) } },
    );
    if (!recovered.modifiedCount) return NextResponse.json({ error: "OPERATION_ALREADY_RUNNING" }, { status: 409 });
  }
  let outcome: "SUCCESS" | "FAILED" = "SUCCESS";
  let result: any;
  try {
    if (action === "sync") {
      result = await getFootballProvider().sync({ deferScoring: true });
    } else if (action === "rebuild-scores") {
      result = await runLeaderboardEngine();
    } else {
      const target = new ObjectId(String(body.userId));
      const update = body.enabled
        ? { $set: { role: "ADMIN", isAdmin: true, updatedAt: new Date() } }
        : { $unset: { role: "", isAdmin: "" }, $set: { updatedAt: new Date() } };
      const changed = await db.collection("users").updateOne({ _id: target }, update as any);
      if (!changed.matchedCount) throw new Error("USER_NOT_FOUND");
      result = { userId: String(target), admin: body.enabled };
    }
  } catch (error) {
    outcome = "FAILED";
    result = { error: error instanceof Error ? error.message : "OPERATION_FAILED" };
  } finally {
    await db.collection("adminOperationLocks").deleteOne({ _id: action });
  }
  await db.collection("adminAuditLog").insertOne({
    actor: { userId: auth.userId, username: auth.user.username ?? null },
    action: action === "set-admin" ? (body.enabled ? "USER_ADMIN_GRANTED" : "USER_ADMIN_REVOKED") : action === "sync" ? "FOOTBALL_SYNC" : "SCORE_REBUILD",
    target: action === "set-admin" ? String(body.userId) : "system",
    outcome,
    summary: result,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: outcome === "SUCCESS", action, result }, { status: outcome === "SUCCESS" ? 200 : 500 });
}
