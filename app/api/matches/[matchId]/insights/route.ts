import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const db = await getDb();
  const insights = await db.collection<any>("matchInsights").findOne({ matchId }, { projection: { _id: 0 } });
  if (!insights) return NextResponse.json({ error: "Insights are being prepared for the next scheduled sync." }, { status: 404 });
  return NextResponse.json(insights);
}
