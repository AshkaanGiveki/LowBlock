"use client";
import { useEffect, useMemo, useState } from "react";
import { Share2, Trophy, X } from "lucide-react";
import { sharePublicAward } from "@/lib/awards/share";
import { useLanguage } from "@/components/LanguageProvider";
import DepthCarousel from "@/components/DepthCarousel";

type Award = { id: string; type?: string; scope?: string; competitionName?: string; seasonStartYear?: number | null; roundNumber?: number | null; periodId?: string | null; trophyUrl?: string | null; assetAvailable?: boolean };

function awardTitle(award: Award, language: "fa" | "en") {
  const club = award.scope === "CLUB" || award.type?.startsWith("CLUB_");
  const weekly = award.type?.includes("WEEKLY");
  if (language === "fa") return club ? (weekly ? "قهرمان هفتگی باشگاه" : "قهرمان دور باشگاه") : (weekly ? "قهرمان هفتگی" : "قهرمان دور");
  return club ? (weekly ? "Club Weekly Winner" : "Club Round Winner") : (weekly ? "Weekly Winner" : "Round Winner");
}

function awardMeta(award: Award, language: "fa" | "en") {
  if (award.type?.includes("WEEKLY")) return award.periodId ?? (language === "fa" ? "هفته" : "Weekly");
  if (!award.roundNumber) return "";
  return language === "fa" ? `راند ${award.roundNumber}` : `MD${String(award.roundNumber).padStart(2, "0")}`;
}

export function PublicAwardsSection({ username }: { username: string }) {
  const { t, language } = useLanguage();
  const [awards, setAwards] = useState<Award[]>([]); const [details, setDetails] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { fetch(`/api/profiles/${encodeURIComponent(username)}/awards`).then(r => r.ok ? r.json() : null).then(d => setAwards(d?.awards ?? [])).catch(() => undefined); }, [username]);
  const slides = useMemo(() => awards.filter(a => a.trophyUrl).map(a => ({ image: a.trophyUrl!, alt: `${a.competitionName ?? "LowBlock"} ${awardTitle(a, language)}`, title: `${awardTitle(a, language)} · ${a.competitionName ?? "LowBlock"}` })), [awards, language]);
  async function share(award: Award) { try { const result = await sharePublicAward(`/api/profiles/${encodeURIComponent(username)}/awards/${award.id}/share-image`, language, award.id); setMessage(result === "saved" ? t("تصویر ذخیره شد؛ لینک LowBlock کپی شد.", "Image saved; contextual LowBlock link copied.") : t("با موفقیت به اشتراک گذاشته شد.", "Shared successfully.")); } catch { setMessage(t("اشتراک‌گذاری در دسترس نیست.", "Sharing is unavailable.")); } }
  if (!awards.length) return null;
  return <section className="mt-4 rounded-[1.75rem] border border-[#e8c66a]/20 bg-[#101512] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8c66a]/10 text-[#e8c66a]"><Trophy size={19}/></span><div><p className="text-[10px] font-black tracking-[.2em] text-[#e8c66a]">{t("جوایز", "AWARDS")}</p><h2 className="mt-1 text-xl font-black">{t("افتخارات بازیکن", "Player honours")}</h2></div></div><button type="button" onClick={() => setDetails(true)} className="rounded-xl border border-[#e8c66a]/35 px-3 py-2 text-xs font-black text-[#e8c66a]">{t("مشاهده جزئیات", "SEE DETAILS")}</button></div><div className="mt-5 flex gap-3 overflow-hidden">{awards.map(award => <div key={award.id} className="shrink-0" title={`${awardTitle(award, language)} · ${award.competitionName ?? "LowBlock"}`}>{award.trophyUrl ? <img src={award.trophyUrl} alt="" loading="lazy" className="h-24 w-20 rounded-xl border border-[#e8c66a]/25 bg-black/30 object-cover"/> : <span className="grid h-24 w-20 place-items-center rounded-xl border border-[#e8c66a]/25 bg-black/30 text-[#e8c66a]"><Trophy size={24}/></span>}</div>)}</div>{message && <p className="mt-4 text-xs text-brand">{message}</p>}{details && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={t("جزئیات افتخارات", "Award details")} onClick={() => setDetails(false)}><div className="relative w-full max-w-2xl rounded-[2rem] border border-[#e8c66a]/30 bg-[#09100c] p-4 sm:p-6" onClick={e => e.stopPropagation()}><button type="button" onClick={() => setDetails(false)} aria-label={t("بستن", "Close")} className="absolute right-4 top-4 z-[4000] grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/50 text-white"><X size={17}/></button>{slides.length ? <DepthCarousel items={slides} depth={150} spread={70} tilt={18} perspective={1400} visibleCards={3} cardWidth={250} cardHeight={330} radius={16} duration={700} showControls showIndicators/> : <p className="py-16 text-center text-sm text-white/60">{t("تصویر جوایز در دسترس نیست.", "Award artwork is unavailable.")}</p>}<div className="mt-2 space-y-3">{awards.map(award => <div key={award.id} className="flex items-center justify-between gap-3 text-sm"><span className="font-bold">{awardTitle(award, language)} · {award.competitionName ?? "LowBlock"} {awardMeta(award, language) && `· ${awardMeta(award, language)}`}</span>{award.assetAvailable && <button type="button" onClick={() => share(award)} aria-label={t("اشتراک‌گذاری جایزه", "Share award")} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand"><Share2 size={15}/></button>}</div>)}</div></div></div>}</section>;
}
