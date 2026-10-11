import { NextResponse } from "next/server";
import { requireH2HAdmin } from "@/lib/auth/h2h-admin";
import { getH2HWeek, settleH2HLeagues } from "@/lib/domain/h2h";

export async function POST(request: Request) {
  const auth = await requireH2HAdmin();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await settleH2HLeagues(auth.db, typeof body.weekKey === "string" ? body.weekKey : getH2HWeek().key));
}
