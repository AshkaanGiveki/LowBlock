import { NextResponse } from "next/server";
import { requireH2HAdmin } from "@/lib/auth/h2h-admin";
import { ensureCurrentH2HLeagues } from "@/lib/domain/h2h";

export async function POST() {
  const auth = await requireH2HAdmin();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await ensureCurrentH2HLeagues(auth.db));
}
