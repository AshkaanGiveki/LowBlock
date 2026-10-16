import { NextResponse } from "next/server";
import { isH2HEnabled } from "@/lib/domain/h2h";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ enabled: isH2HEnabled() }); }
