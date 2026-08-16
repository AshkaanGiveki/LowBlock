import { ObjectId, type ClientSession, type Db, type Document } from "mongodb";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";
import type { MiniAppProvider, VerifiedMiniAppData } from "@/lib/auth/mini-app";
import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";

export type ExternalIdentity = {
  provider: MiniAppProvider;
  providerUserId: string;
  userId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  authDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

const identityIndexState = globalThis as typeof globalThis & { lowblockIdentityIndexes?: Promise<void> };
export async function ensureIdentityIndexes(db: Db) {
  identityIndexState.lowblockIdentityIndexes ??= Promise.all([
    db.collection("externalIdentities").createIndex({ provider: 1, providerUserId: 1 }, { unique: true }),
    db.collection("externalIdentities").createIndex({ userId: 1, provider: 1 }, { unique: true }),
  ]).then(() => undefined).catch((error) => {
    identityIndexState.lowblockIdentityIndexes = undefined;
    throw error;
  });
  await identityIndexState.lowblockIdentityIndexes;
}

export async function findIdentity(db: Db, provider: MiniAppProvider, providerUserId: string) {
  return db.collection<ExternalIdentity>("externalIdentities").findOne({ provider, providerUserId });
}

function baseUsername(data: VerifiedMiniAppData) {
  const candidate = data.user.username?.trim();
  if (candidate && isValidUsername(candidate)) return candidate;
  return `${data.provider}_${data.user.id}`.slice(0, 24);
}

async function availableUsername(db: Db, data: VerifiedMiniAppData) {
  const base = baseUsername(data);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const value = suffix ? `${base.slice(0, 21)}_${suffix}` : base;
    const exists = await db.collection("users").findOne({ normalizedUsername: normalizeUsername(value) }, { projection: { _id: 1 } });
    if (!exists) return value;
  }
  return `${data.provider.slice(0, 2)}_${new ObjectId().toHexString().slice(-16)}`;
}

function identityDocument(data: VerifiedMiniAppData, userId: string, now: Date): ExternalIdentity {
  return {
    provider: data.provider,
    providerUserId: data.user.id,
    userId,
    username: data.user.username,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    languageCode: data.user.languageCode,
    authDate: data.authDate,
    createdAt: now,
    updatedAt: now,
  };
}

export async function linkIdentity(db: Db, data: VerifiedMiniAppData, userId: string) {
  const existing = await findIdentity(db, data.provider, data.user.id);
  if (existing && existing.userId !== userId) return { ok: false as const, reason: "IDENTITY_IN_USE" as const };
  const providerOnAccount = await db.collection<ExternalIdentity>("externalIdentities").findOne({ userId, provider: data.provider });
  if (providerOnAccount && providerOnAccount.providerUserId !== data.user.id) return { ok: false as const, reason: "PROVIDER_ALREADY_LINKED" as const };
  const now = new Date();
  await db.collection<ExternalIdentity>("externalIdentities").updateOne(
    { provider: data.provider, providerUserId: data.user.id },
    { $set: { ...identityDocument(data, userId, now), createdAt: existing?.createdAt ?? now } },
    { upsert: true },
  );
  return { ok: true as const, userId };
}

export async function createPlatformUser(db: Db, data: VerifiedMiniAppData) {
  const username = await availableUsername(db, data);
  const now = new Date();
  const result = await db.collection("users").insertOne({
    username,
    normalizedUsername: normalizeUsername(username),
    passwordHash: null,
    accountOrigin: data.provider,
    createdAt: now,
    updatedAt: now,
  });
  const userId = result.insertedId.toHexString();
  try {
    await db.collection<ExternalIdentity>("externalIdentities").insertOne(identityDocument(data, userId, now));
  } catch (error) {
    await db.collection("users").deleteOne({ _id: result.insertedId, accountOrigin: data.provider });
    throw error;
  }
  return { userId, username };
}

export async function connectedProviders(db: Db, userId: string) {
  return db.collection<ExternalIdentity>("externalIdentities")
    .find({ userId }, { projection: { _id: 0, provider: 1, username: 1 } })
    .toArray();
}

export async function mergePlatformAccount(db: Db, data: VerifiedMiniAppData, targetUserId: string, session: ClientSession) {
  const identity = await db.collection<ExternalIdentity>("externalIdentities").findOne(
    { provider: data.provider, providerUserId: data.user.id },
    { session },
  );
  if (!identity) return { ok: false as const, reason: "IDENTITY_NOT_FOUND" as const };
  const sourceUserId = identity.userId;
  if (sourceUserId === targetUserId) return { ok: true as const, userId: targetUserId, merged: false };

  const [sourceIdentities, targetIdentities] = await Promise.all([
    db.collection<ExternalIdentity>("externalIdentities").find({ userId: sourceUserId }, { session }).toArray(),
    db.collection<ExternalIdentity>("externalIdentities").find({ userId: targetUserId }, { session }).toArray(),
  ]);
  const targetByProvider = new Map(targetIdentities.map((item) => [item.provider, item.providerUserId]));
  const conflict = sourceIdentities.some((item) => targetByProvider.has(item.provider) && targetByProvider.get(item.provider) !== item.providerUserId);
  if (conflict) return { ok: false as const, reason: "PROVIDER_ALREADY_LINKED" as const };

  const sourcePredictions = await db.collection<Document>("predictions").find({ userId: sourceUserId }, { session }).toArray();
  if (sourcePredictions.length) {
    await db.collection<Document>("predictions").bulkWrite(sourcePredictions.map(({ _id, userId: _source, ...prediction }) => ({
      updateOne: {
        filter: { userId: targetUserId, matchId: prediction.matchId },
        update: { $setOnInsert: { ...prediction, userId: targetUserId } },
        upsert: true,
      },
    })), { session });
  }
  await db.collection("predictions").deleteMany({ userId: sourceUserId }, { session });

  await db.collection<ExternalIdentity>("externalIdentities").updateMany({ userId: sourceUserId }, { $set: { userId: targetUserId, updatedAt: new Date() } }, { session });

  const targetPredictions = await db.collection<{ matchId: string; homeGoals: number; awayGoals: number }>("predictions").find({ userId: targetUserId }, { session }).toArray();
  const matchIds = targetPredictions.map((item) => item.matchId);
  const matches = matchIds.length ? await db.collection<{ providerMatchId: string; homeGoals: number | null; awayGoals: number | null }>("matches")
    .find({ providerMatchId: { $in: matchIds } }, { session, projection: { providerMatchId: 1, homeGoals: 1, awayGoals: 1 } }).toArray() : [];
  const byMatchId = new Map(matches.map((match) => [match.providerMatchId, match]));
  let points = 0;
  let exact = 0;
  for (const prediction of targetPredictions) {
    const match = byMatchId.get(prediction.matchId);
    if (!match) continue;
    const score = calculatePredictionScore(prediction.homeGoals, prediction.awayGoals, match.homeGoals, match.awayGoals);
    points += score.points;
    if (score.category === "EXACT_SCORE") exact += 1;
  }
  await db.collection("leaderboardStats").deleteMany({ userId: sourceUserId }, { session });
  await db.collection("leaderboardStats").deleteMany({ userId: targetUserId, scope: { $in: ["GLOBAL", "global", "all"] } }, { session });
  await db.collection("leaderboardStats").updateOne(
    { userId: targetUserId, scope: "GLOBAL" },
    { $set: { points, predictions: targetPredictions.length, exact, updatedAt: new Date() } },
    { upsert: true, session },
  );

  const [sourceUser, targetUser] = await Promise.all([
    ObjectId.isValid(sourceUserId) ? db.collection<{ avatarUrl?: string | null }>("users").findOne({ _id: new ObjectId(sourceUserId) }, { session }) : null,
    db.collection<{ avatarUrl?: string | null }>("users").findOne({ _id: new ObjectId(targetUserId) }, { session }),
  ]);
  if (!targetUser?.avatarUrl && sourceUser?.avatarUrl) {
    await db.collection("users").updateOne({ _id: new ObjectId(targetUserId) }, { $set: { avatarUrl: sourceUser.avatarUrl, updatedAt: new Date() } }, { session });
  }
  await db.collection("sessions").deleteMany({ userId: sourceUserId }, { session });
  if (ObjectId.isValid(sourceUserId)) await db.collection("users").deleteOne({ _id: new ObjectId(sourceUserId) }, { session });
  return { ok: true as const, userId: targetUserId, merged: true };
}
