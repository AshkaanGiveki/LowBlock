import { NextResponse } from "next/server"; import { env } from "@/lib/env"; import { syncFootballApi } from "@/lib/football/api-sports/sync";
export const maxDuration=300;
export async function POST(req:Request){if(!env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${env.CRON_SECRET}`)return NextResponse.json({error:"unauthorized"},{status:401}); try{return NextResponse.json({ok:true,...await syncFootballApi()});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"sync failed"},{status:500});}}
export const GET=POST;
