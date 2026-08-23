"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock3, Crown, Loader2, ShieldCheck, UserRound, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "@/components/LanguageProvider";

type Request = { _id: string; userId: string; createdAt: string; user: { username?: string; avatarUrl?: string | null } | null };

export default function ClubRequests({ params }: { params: Promise<{ clubId: string }> }) {
  const { t } = useLanguage();
  const [clubId, setClubId] = useState("");
  const [club, setClub] = useState<{ name: string; imageUrl: string | null } | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [switchRequest, setSwitchRequest] = useState<string | null>(null);

  async function load(id: string) {
    const response = await fetch(`/api/clubs/${id}/join-requests`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? t("دسترسی به درخواست‌ها ممکن نیست.", "You cannot access these requests.")); return; }
    setClub(data.club ?? null); setRequests(data.requests ?? []);
  }
  useEffect(() => { let active = true; params.then(({ clubId: id }) => { if (!active) return; setClubId(id); load(id).finally(() => active && setLoading(false)); }); return () => { active = false; }; }, [params]);

  async function act(requestId: string, action: "ACCEPT" | "DECLINE", confirmSwitch = false) {
    setBusy(requestId); setMessage("");
    const response = await fetch(`/api/clubs/${clubId}/join-requests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId, action, confirmSwitch }) });
    const data = await response.json();
    setBusy("");
    if (response.status === 409 && data.requiresSwitchConfirmation) { setSwitchRequest(requestId); return; }
    if (!response.ok) { setMessage(data.error ?? t("عملیات انجام نشد.", "The action could not be completed.")); return; }
    setRequests((current) => current.filter((request) => request._id !== requestId));
  }

  return <main className="min-h-screen px-4 pb-28 pt-20 md:px-8 md:pt-28"><div className="mx-auto max-w-3xl">
    <Link href="/club" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-brand"><ArrowLeft size={16} />{t("بازگشت به باشگاه", "Back to Club")}</Link>
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] border border-[#eacb70]/25 bg-[radial-gradient(circle_at_88%_0%,rgba(234,203,112,.2),transparent_38%),linear-gradient(145deg,#17291d,#09100c)] p-6 shadow-[0_24px_80px_rgba(0,0,0,.25)] sm:p-9"><div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#eacb70]/10 blur-3xl" /><div className="relative flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#eacb70]/30 bg-[#eacb70]/10 text-[#eacb70]">{club?.imageUrl ? <img src={club.imageUrl} alt="" className="h-full w-full object-cover" /> : <Crown size={25} />}</div><div><p className="flex items-center gap-2 text-[10px] font-black tracking-[.18em] text-[#eacb70]"><ShieldCheck size={14} />{t("مدیریت باشگاه", "CLUB ADMIN")}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{t("درخواست‌های عضویت", "Join requests")}</h1><p className="mt-2 max-w-xl text-sm leading-7 text-white/50">{t("بازیکنانی که می‌خواهند نماینده باشگاه شما باشند اینجا منتظر تصمیم شما هستند.", "Players who want to represent your Club are waiting for your decision here.")}</p></div></div><div className="relative mt-7 flex items-center gap-3 rounded-2xl border border-white/[.07] bg-black/20 p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eacb70]/15 text-[#eacb70]"><Clock3 size={18} /></span><span><b className="block text-sm">{requests.length} {t("درخواست در انتظار", "pending request")}{requests.length === 1 ? "" : "s"}</b><small className="text-xs text-white/40">{t("با دقت بررسی کنید؛ پذیرش ممکن است عضویت فعلی بازیکن را جابه‌جا کند.", "Review carefully; accepting may move a player from their current Club.")}</small></span></div></motion.section>
    {message && <p role="alert" className="mt-4 rounded-2xl border border-red-400/25 bg-red-950/30 p-4 text-sm text-red-200">{message}</p>}
    <section className="mt-4 space-y-3">{loading ? <RequestSkeleton /> : requests.length ? requests.map((request, index) => <RequestCard key={request._id} request={request} index={index} busy={busy === request._id} t={t} onAccept={() => act(request._id, "ACCEPT")} onDecline={() => act(request._id, "DECLINE")} />) : <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-[#101812] p-14 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-brand"><Check size={28} /></span><h2 className="mt-5 text-xl font-black">{t("همه‌چیز مرتب است", "You’re all caught up")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{t("درخواست عضویت در انتظاری وجود ندارد.", "There are no pending membership requests.")}</p></div>}</section>
    <AnimatePresence>{switchRequest && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-5 backdrop-blur-md"><motion.div initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-md rounded-[1.75rem] border border-brand/25 bg-[#101812] p-6 shadow-2xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/15 text-brand"><UserRound size={21} /></span><h2 className="mt-5 text-xl font-black">{t("تغییر باشگاه بازیکن؟", "Move this player to your Club?")}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t("با پذیرش، باشگاه فعلی این بازیکن حفظ می‌شود اما عضویت فعال او به باشگاه شما منتقل خواهد شد.", "Accepting will end the player’s current Club membership and move them to your Club.")}</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setSwitchRequest(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/70">{t("انصراف", "Cancel")}</button><button type="button" onClick={() => { const id = switchRequest; setSwitchRequest(null); void act(id, "ACCEPT", true); }} className="rounded-xl bg-brand px-4 py-3 text-sm font-black text-[#07100b]">{t("تأیید انتقال", "Confirm move")}</button></div></motion.div></motion.div>}</AnimatePresence>
  </div></main>;
}

function RequestCard({ request, index, busy, t, onAccept, onDecline }: { request: Request; index: number; busy: boolean; t: (fa: string, en: string) => string; onAccept: () => void; onDecline: () => void }) { const username = request.user?.username ?? "LowBlock Player"; return <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-[#101812] p-4 shadow-[0_12px_35px_rgba(0,0,0,.12)] sm:gap-4 sm:p-5"><Link href={`/u/${encodeURIComponent(username)}`} className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/30 bg-brand/10 text-sm font-black text-brand transition hover:border-brand">{request.user?.avatarUrl ? <img src={request.user.avatarUrl} alt={username} className="h-full w-full object-cover" /> : username.slice(0, 2).toUpperCase()}</Link><div className="min-w-0 flex-1"><Link href={`/u/${encodeURIComponent(username)}`} className="block truncate text-sm font-black hover:text-brand">{username}</Link><small className="text-xs text-[var(--muted)]">{t("درخواست ارسال شده در", "Requested")} {new Date(request.createdAt).toLocaleDateString()}</small></div><div className="flex shrink-0 items-center gap-2">{busy ? <Loader2 size={19} className="animate-spin text-brand" /> : <><button type="button" onClick={onDecline} className="grid h-10 w-10 place-items-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-300 transition hover:bg-red-400/20" aria-label={t("رد درخواست", "Decline request")}><X size={17} /></button><button type="button" onClick={onAccept} className="grid h-10 w-10 place-items-center rounded-xl border border-brand/25 bg-brand/15 text-brand transition hover:bg-brand/25" aria-label={t("پذیرش درخواست", "Accept request")}><Check size={17} /></button></>}</div></motion.article>; }
function RequestSkeleton() { return <div className="animate-pulse space-y-3">{[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4 rounded-[1.35rem] border border-white/[.06] bg-[#101812] p-5"><span className="h-12 w-12 rounded-full bg-white/[.08]" /><span className="flex-1"><span className="block h-3 w-32 rounded bg-white/[.08]" /><span className="mt-2 block h-2.5 w-24 rounded bg-white/[.05]" /></span><span className="h-10 w-20 rounded-xl bg-white/[.06]" /></div>)}</div>; }
