import { notFound } from "next/navigation";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import { currentUserId } from "@/lib/auth/session";
import { T } from "@/components/LanguageProvider";
import { DetailedLeaderboard } from "@/components/DetailedLeaderboard";
import { ArrowLeft, BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Complete Club Football Prediction Standings", description: "Detailed LowBlock club standings with prediction accuracy, points, rank movement, and awards." };

export default async function ClubStandingsPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params; const userId = await currentUserId(); if (!userId || !ObjectId.isValid(clubId)) notFound();
  const db = await getDb(); const membership = await db.collection("clubMemberships").findOne({ clubId, userId, leftAt: null }); if (!membership) notFound();
  const club = await db.collection<any>("clubs").findOne({ _id: new ObjectId(clubId) }, { projection: { name: 1 } }); if (!club) notFound();
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-7xl"><Link href="/club" className="inline-flex items-center gap-2 text-xs font-black text-brand"><ArrowLeft size={15}/><T fa="بازگشت به باشگاه" en="Back to club"/></Link><section className="mt-4 rounded-[2rem] border border-brand/20 bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.26),transparent_38%),linear-gradient(145deg,#14251c,#0a0f0c)] p-6 shadow-[0_28px_90px_rgba(0,0,0,.24)] sm:p-10"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand"><BarChart3 size={24}/></span><div><p className="text-[10px] font-black tracking-[.22em] text-brand">COMPLETE CLUB STANDINGS</p><h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">{club.name}</h1><p className="mt-3 text-sm text-white/55"><T fa="جدول کامل عملکرد اعضای باشگاه" en="Complete member performance table"/></p></div></div></section><DetailedLeaderboard clubId={clubId} clubName={club.name}/></div></main>;
}
