"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles, Users } from "lucide-react";

type Translator = (fa: string, en: string) => string;
type PendingRequest = { club: { name: string; imageUrl: string | null } };

export function OwnerRequestsBanner({ clubId, count, t }: { clubId: string; count: number; t: Translator }) {
  return <Link href={`/club/${clubId}/requests`} className="group mt-4 flex items-center gap-4 rounded-[1.35rem] border border-[#eacb70]/25 bg-[linear-gradient(135deg,rgba(234,203,112,.13),rgba(16,24,18,.9))] p-4 transition hover:-translate-y-0.5 hover:border-[#eacb70]/50"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eacb70]/15 text-[#eacb70]"><Users size={20} /></span><span className="min-w-0 flex-1"><b className="block text-sm">{t("درخواست‌های عضویت", "Join requests")}</b><small className="text-xs text-white/50">{count ? t(`${count} درخواست در انتظار بررسی`, `${count} request${count === 1 ? "" : "s"} waiting for review`) : t("درخواست جدیدی ندارید", "No new requests right now")}</small></span><ArrowUpRight size={18} className="text-[#eacb70] transition group-hover:translate-x-0.5" /></Link>;
}

export function PendingSwitchBanner({ request, t }: { request: PendingRequest; t: Translator }) {
  return <div className="mt-4 flex items-center gap-4 rounded-[1.35rem] border border-[#eacb70]/25 bg-[#eacb70]/[.08] p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eacb70]/15 text-[#eacb70]"><Sparkles size={18} /></span><span className="min-w-0"><b className="block text-sm">{t("درخواست عضویت در انتظار بررسی", "Join request awaiting review")}</b><small className="text-xs text-white/50">{t(`درخواست شما برای ${request.club.name} هنوز بررسی نشده است.`, `Your request to join ${request.club.name} is still pending.`)}</small></span></div>;
}
