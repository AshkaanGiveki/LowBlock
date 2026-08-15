import { NextResponse } from "next/server"; import { env } from "@/lib/env";
export async function POST(req:Request){if(!env.CRON_SECRET||req.headers.get("authorization")!==`Bearer ${env.CRON_SECRET}`)return NextResponse.json({error:"غیرمجاز"},{status:401});return NextResponse.json({ok:true,processed:0,message:"صف آماده‌ی پردازش است؛ RabbitMQ پس از اتصال پردازش می‌شود"});}
