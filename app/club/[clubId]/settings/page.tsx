"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Crown, ImagePlus, Loader2, Save, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { ClubInvitePanel } from "@/components/ClubInvitePanel";
import { ClubLifecycleActions } from "@/components/ClubLifecycleActions";
import { ConfirmModal } from "@/components/ConfirmModal";
import { BackButton } from "@/components/BackButton";
import { DEFAULT_CLUB_LEAGUE_CODES, LEAGUES } from "@/lib/football/leagues";

type Member = { userId: string; role: string; user?: { username?: string } };
type Club = { name: string; imageUrl: string | null; leaderboardCompetitionCodes?: string[] };

export default function ClubSettings({ params }: { params: Promise<{ clubId: string }> }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [clubId, setClubId] = useState("");
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [competitionCodes, setCompetitionCodes] = useState<string[]>(DEFAULT_CLUB_LEAGUE_CODES);

  useEffect(() => {
    let active = true;
    params.then(({ clubId: id }) => {
      setClubId(id);
      fetch(`/api/clubs/${id}/members`).then((response) => response.json()).then((data) => {
        if (!active) return;
        setClub(data.club ?? null);
        setMembers(data.members ?? []);
        setImage(data.club?.imageUrl ?? null);
        setCompetitionCodes(Array.isArray(data.club?.leaderboardCompetitionCodes) ? data.club.leaderboardCompetitionCodes : DEFAULT_CLUB_LEAGUE_CODES);
        setIsOwner(Boolean(data.isOwner));
      });
    });
    return () => { active = false; };
  }, [params]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type) || file.size > 2 * 1024 * 1024) {
      setMessage(t("تصویر باید PNG، JPG یا WEBP و کمتر از ۲ مگابایت باشد.", "Choose a PNG, JPEG or WebP image under 2 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function saveCompetitions() {
    setBusy(true);
    const response = await fetch(`/api/clubs/${clubId}/settings`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ leaderboardCompetitionCodes: competitionCodes }) });
    setBusy(false);
    setMessage(response.ok ? t("تنظیمات رقابت ذخیره شد.", "Competition settings saved.") : t("ذخیره تنظیمات انجام نشد.", "Could not save competition settings."));
  }

  async function saveImage(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/clubs/${clubId}/settings`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageData: image }) });
    setBusy(false);
    setMessage(response.ok ? t("تصویر باشگاه ذخیره شد.", "Club image saved.") : t("ذخیره تصویر انجام نشد.", "Could not save Club image."));
    if (response.ok) router.refresh();
  }

  async function performTransfer(userId: string) {
    if (!isOwner) return;
    const response = await fetch(`/api/clubs/${clubId}/members`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "TRANSFER", userId }) });
    if (response.ok) router.replace("/club");
    else setMessage((await response.json()).error ?? t("انتقال مالکیت انجام نشد.", "Could not transfer ownership."));
  }

  function transfer(userId: string) { setTransferTarget(userId); }

  return <main className="min-h-screen px-4 pb-28 pt-20 md:px-8 md:pt-28"><div className="mx-auto max-w-3xl"><ConfirmModal open={Boolean(transferTarget)} title={t("مالکیت منتقل شود؟", "Transfer ownership?")} description={t("این عضو مالک جدید باشگاه می‌شود و شما به عضو عادی تبدیل می‌شوید.", "This member will become the Club owner and you will become a regular member.")} confirmLabel={t("انتقال مالکیت", "Transfer ownership")} cancelLabel={t("انصراف", "Cancel")} onConfirm={() => { const target = transferTarget; setTransferTarget(null); if (target) performTransfer(target); }} onCancel={() => setTransferTarget(null)}/>
    <BackButton label={t("بازگشت به باشگاه", "Back to Club")} />
    <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.24),transparent_40%),linear-gradient(145deg,#142a1e,#08100b)] p-6"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/15 text-brand"><UserRoundCog size={24} /></div><div><p className="text-xs font-black tracking-[.2em] text-brand">{t("تنظیمات باشگاه", "CLUB SETTINGS")}</p><h1 className="mt-1 text-3xl font-black">{club?.name ?? t("باشگاه", "Club")}</h1></div></div></section>
    <form onSubmit={saveImage} className="mt-4 rounded-[1.75rem] border border-white/10 bg-[#101812] p-5 sm:p-7"><div className="flex items-center gap-2 text-brand"><ImagePlus size={18} /><h2 className="font-black">{t("نشان باشگاه", "Club crest")}</h2></div><div className="mt-5 flex items-center gap-5"><div className="relative h-28 w-28 shrink-0 rounded-full border-2 border-brand/60 bg-[#102119] p-1"><div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-brand/10 text-2xl font-black">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : club?.name?.slice(0, 2).toUpperCase()}</div>{isOwner && <label className="absolute bottom-0 end-0 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-brand text-[#07100b]"><ImagePlus size={15} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} className="sr-only" /></label>}</div><div><p className="text-sm text-[var(--muted)]">{t("یک تصویر مربعی انتخاب کنید؛ تصویر به شکل دایره نمایش داده می‌شود.", "Choose a square image; it is displayed as a circle.")}</p>{isOwner && <button disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-[#07100b]">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t("ذخیره نشان", "Save crest")}</button>}</div></div>{message && <p className="mt-4 text-xs text-brand">{message}</p>}</form>
    <ClubInvitePanel clubId={clubId} />
    {isOwner && <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-[#101812] p-5 sm:p-7"><div className="flex items-center gap-2 text-brand"><Crown size={18} /><h2 className="font-black">{t("رقابت باشگاه", "Club competitions")}</h2></div><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t("انتخاب کنید امتیاز کدام لیگ‌ها و تورنمنت‌ها در جدول داخلی باشگاه حساب شود. این تنظیم مستقل از جدول جهانی است.", "Choose which leagues and tournaments count in your Club leaderboard. This is independent from the global leaderboard.")}</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{LEAGUES.map((league) => <label key={league.code} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3"><input type="checkbox" checked={competitionCodes.includes(league.code)} onChange={(event) => setCompetitionCodes((codes) => event.target.checked ? [...codes, league.code] : codes.filter((code) => code !== league.code))} className="h-4 w-4 accent-[#20b879]" /><span className="text-sm font-bold">{league.enName}</span>{league.globalLeaderboard && <span className="ms-auto text-[10px] text-brand">GLOBAL</span>}</label>)}</div><button type="button" onClick={saveCompetitions} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-[#07100b]">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{t("ذخیره رقابت‌ها", "Save competitions")}</button></section>}
    <ClubLifecycleActions clubId={clubId} memberCount={members.length} isOwner={isOwner} />
    {isOwner && <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-[#101812] p-5 sm:p-7"><div className="flex items-center gap-2 text-brand"><Crown size={18} /><h2 className="font-black">{t("انتقال مالکیت", "Transfer ownership")}</h2></div><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t("مالک جدید باید یکی از اعضای فعلی باشگاه باشد.", "The new owner must already be a current Club member.")}</p><div className="mt-4 space-y-2">{members.filter((member) => member.role !== "OWNER").map((member) => <button key={member.userId} type="button" onClick={() => transfer(member.userId)} className="flex w-full items-center justify-between rounded-xl border border-white/10 p-3 text-start hover:border-brand/50"><span className="font-bold">{member.user?.username ?? t("عضو", "Member")}</span><span className="text-xs font-black text-brand">{t("انتقال", "Transfer")}</span></button>)}</div></section>}
  </div></main>;
}
