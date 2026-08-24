"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Loader2, Settings2, UserMinus, Users } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "@/components/LanguageProvider";

type Member = { _id: string; userId: string; role: string; joinedAt: string; user?: { username?: string; avatarUrl?: string | null } };
type Club = { _id: string; name: string; imageUrl: string | null; state: "FORMING" | "ACTIVE" };
type Viewer = { username: string; avatarUrl: string | null };

export default function ClubMembers({ params }: { params: Promise<{ clubId: string }> }) {
  const { t } = useLanguage();
  const [clubId, setClubId] = useState("");
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [knownMemberCount, setKnownMemberCount] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    params.then(({ clubId: id }) => {
      if (cancelled) return;
      setClubId(id);
      Promise.all([
        fetch("/api/clubs").then((response) => response.json()),
        fetch(`/api/clubs/${id}/members`).then((response) => response.json()),
      ]).then(([overview, data]) => {
        if (cancelled) return;
        if (overview.members != null) setKnownMemberCount(Number(overview.members));
        setClub(data.club ?? overview.club ?? null);
        setMembers(data.members ?? []);
        setIsOwner(Boolean(data.isOwner));
      }).catch(() => { if (!cancelled) setMessage(t("بارگذاری اعضای باشگاه انجام نشد.", "We could not load the Club members.")); }).finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [params, t]);

  async function remove(userId: string) {
    const response = await fetch(`/api/clubs/${clubId}/members`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? t("حذف عضو انجام نشد.", "Could not remove this member."));
    setMembers((current) => current.filter((member) => member.userId !== userId));
    setKnownMemberCount((count) => count == null ? count : Math.max(0, count - 1));
  }

  const memberCount = loading ? (knownMemberCount ?? members.length) : members.length;
  return <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32"><div className="mx-auto max-w-2xl">
    <Link href="/club" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-brand"><ArrowLeft size={16} />{t("باشگاه من", "Your Club")}</Link>
    <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_100%_0%,rgba(32,184,121,.24),transparent_40%),linear-gradient(145deg,#14251c,#0a0f0c)] p-6 shadow-[0_22px_70px_rgba(0,0,0,.2)] sm:p-8"><div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-brand/10 blur-3xl" /><div className="relative flex items-center gap-4"><ClubAvatar club={club} /><div className="min-w-0"><div className="flex items-center gap-2 text-brand"><Users size={17} /><span className="text-[10px] font-black tracking-[.18em]">{t("اعضای باشگاه", "CLUB MEMBERS")}</span></div><h1 className="mt-2 truncate text-3xl font-black">{club?.name ?? t("باشگاه", "Club")}</h1><p className="mt-2 text-sm text-white/55">{memberCount} {t("عضو در باشگاه", "members in the Club")}{loading && <Loader2 size={14} className="ms-2 inline animate-spin text-brand" />}</p></div>{isOwner && <Link href={`/club/${clubId}/settings`} aria-label={t("مدیریت باشگاه", "Manage Club")} className="ms-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.05] text-[var(--muted)] transition hover:border-brand/50 hover:text-brand"><Settings2 size={17} /></Link>}</div></section>
    <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101512] p-4 shadow-[0_18px_55px_rgba(0,0,0,.16)] sm:p-5"><div className="mb-3 flex items-center justify-between px-2"><div><h2 className="font-black">{t("اعضای تیم", "Team members")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{loading ? t("در حال دریافت فهرست اعضا…", "Loading the member list…") : t("اعضای فعلی باشگاه", "Current Club members")}</p></div>{isOwner && <span className="rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-black text-brand">{t("مدیر باشگاه", "Club admin")}</span>}</div>{loading ? <MemberSkeleton count={Math.max(4, Math.min(8, knownMemberCount ?? 5))} /> : members.length ? <div className="space-y-1">{members.map((member, index) => <motion.div key={member.userId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .035 }} className="flex items-center gap-3 border-t border-white/[.06] px-2 py-3.5 first:border-t-0"><Avatar member={member} /><div className="min-w-0 flex-1"><b className="block truncate">{member.user?.username ?? t("بازیکن LowBlock", "LowBlock Player")}</b><small className="text-[var(--muted)]">{member.role === "OWNER" ? t("مالک باشگاه", "Club owner") : t("عضو باشگاه", "Club member")}</small></div>{member.role === "OWNER" && <Crown size={17} className="text-[#e8c66a]" />}{isOwner && member.role !== "OWNER" && <button type="button" onClick={() => remove(member.userId)} className="rounded-xl p-2 text-red-300 transition hover:bg-red-400/10" aria-label={t("حذف عضو", "Remove member")}><UserMinus size={16} /></button>}</motion.div>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-[var(--muted)]">{t("هنوز عضوی در باشگاه نیست.", "There are no Club members yet.")}</div>}</section>{message && <p className="mt-4 rounded-xl bg-red-950/30 p-3 text-sm text-red-200">{message}</p>}
  </div></main>;
}

function ClubAvatar({ club }: { club: Club | null }) { return <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-brand/50 bg-brand/10 p-1 shadow-[0_0_0_6px_rgba(32,184,121,.08)]">{club?.imageUrl ? <img src={club.imageUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="text-lg font-black text-brand">{club?.name?.slice(0, 2).toUpperCase() ?? "?"}</span>}</div>; }
function Avatar({ member }: { member: Member }) { const [viewer, setViewer] = useState<Viewer | null>(null); useEffect(() => { if (member.role !== "OWNER" || member.user?.avatarUrl) return; fetch("/api/auth/me").then((response) => response.json()).then((data) => setViewer(data.user ?? null)).catch(() => undefined); }, [member.role, member.user?.avatarUrl]); const username = member.user?.username ?? viewer?.username ?? "Player"; const avatarUrl = member.user?.avatarUrl ?? viewer?.avatarUrl; return <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/20 bg-brand/10 text-xs font-black text-brand">{avatarUrl ? <img src={avatarUrl} alt={username} className="h-full w-full object-cover" /> : username.slice(0, 2).toUpperCase()}</div>; }
function MemberSkeleton({ count }: { count: number }) { return <div className="animate-pulse space-y-1">{Array.from({ length: count }, (_, index) => <div key={index} className="flex items-center gap-3 border-t border-white/[.06] px-2 py-3.5 first:border-t-0"><span className="h-11 w-11 shrink-0 rounded-full bg-white/[.08]" /><span className="flex-1"><span className="block h-3 w-32 rounded bg-white/[.08]" /><span className="mt-2 block h-2.5 w-20 rounded bg-white/[.05]" /></span><span className="h-7 w-7 rounded-lg bg-white/[.06]" /></div>)}</div>; }
