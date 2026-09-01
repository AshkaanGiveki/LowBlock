"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Trophy, X } from "lucide-react";
import { sharePublicAward } from "@/lib/awards/share";
import { useLanguage } from "@/components/LanguageProvider";
import DepthCarousel from "@/components/DepthCarousel";

type Award = { id: string; type?: string; scope?: string; competitionName?: string; roundNumber?: number | null; periodId?: string | null; trophyUrl?: string | null };

function awardTitle(a: Award, language: "fa" | "en") {
  const club = a.scope === "CLUB" || a.type?.startsWith("CLUB_");
  const weekly = a.type?.includes("WEEKLY");
  const exact = a.type?.includes("MONTHLY_EXACT");
  const season = a.type === "LEAGUE_WINNER" || a.type === "GLOBAL_WINNER" || a.type === "CLUB_LEAGUE_WINNER";
  if (language === "fa") {
    if (exact) return club ? "پیش‌بینی‌گر دقیق باشگاه" : "پیش‌بینی‌گر دقیق";
    if (season) return club ? "قهرمان فصل باشگاه" : "قهرمان فصل";
    return club ? (weekly ? "قهرمان هفتگی باشگاه" : "برنده دور باشگاه") : (weekly ? "قهرمان هفتگی" : "برنده دور");
  }
  if (exact) return club ? "Club Exact Picker" : "Exact Picker";
  if (season) return club ? "Club Season Winner" : "Season Winner";
  return club ? (weekly ? "Club Weekly Champion" : "Club Round Winner") : (weekly ? "Weekly Champion" : "Round Winner");
}

function awardMeta(a: Award, language: "fa" | "en") { if (a.type?.includes("WEEKLY")) return a.periodId ?? (language === "fa" ? "هفته" : "Weekly"); if (!a.roundNumber) return ""; return language === "fa" ? `راند ${a.roundNumber}` : `MD${String(a.roundNumber).padStart(2, "0")}`; }
function awardGroupKey(a: Award) { if (a.type?.includes("WEEKLY") || a.type?.includes("MONTHLY_EXACT")) return a.type ?? "UNKNOWN"; return `${a.type ?? "UNKNOWN"}:${a.competitionName ?? "LowBlock"}`; }

export function PublicAwardsSection({ username }: { username: string }) {
  const { t, language } = useLanguage();
  const [awards, setAwards] = useState<Award[]>([]); const [details, setDetails] = useState(false); const [message, setMessage] = useState(""); const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { fetch(`/api/profiles/${encodeURIComponent(username)}/awards`).then(r => r.ok ? r.json() : null).then(d => setAwards(d?.awards ?? [])).catch(() => undefined); }, [username]);
  useEffect(() => { if (!details) return; const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDetails(false); }; document.addEventListener("keydown", closeOnEscape); return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", closeOnEscape); }; }, [details]);
  const shareableAwards = useMemo(() => awards.filter(a => a.trophyUrl), [awards]);
  const groupedAwards = useMemo(() => { const groups = new Map<string, { award: Award; count: number }>(); for (const award of shareableAwards) { const key = awardGroupKey(award); const group = groups.get(key); if (group) group.count += 1; else groups.set(key, { award, count: 1 }); } return [...groups.values()]; }, [shareableAwards]);
  const slides = useMemo(() => shareableAwards.map(a => ({ image: a.trophyUrl!, alt: `${a.competitionName ?? "LowBlock"} ${awardTitle(a, language)}`, title: awardTitle(a, language), meta: `${a.competitionName ?? "LowBlock"}${awardMeta(a, language) ? ` - ${awardMeta(a, language)}` : ""}`, shareLabel: t("اشتراک‌گذاری جایزه", "Share award") })), [shareableAwards, language, t]);
  async function share(a: Award) { try { const result = await sharePublicAward(`/api/profiles/${encodeURIComponent(username)}/awards/${a.id}/share-image`, language, a.id); setMessage(result === "saved" ? t("تصویر ذخیره شد؛ لینک LowBlock کپی شد.", "Image saved; contextual LowBlock link copied.") : t("با موفقیت به اشتراک گذاشته شد.", "Shared successfully.")); } catch { setMessage(t("اشتراک‌گذاری در دسترس نیست.", "Sharing is unavailable.")); } }
  if (!awards.length) return null;
  const drawer = <AnimatePresence>{details && <motion.div key="honours-drawer" className="fixed inset-0 z-[100] flex items-end bg-black/90" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={event => { if (event.target === event.currentTarget) setDetails(false); }}><motion.aside className="relative h-[94dvh] min-h-0 w-full overflow-hidden rounded-t-[2rem] border border-b-0 border-[#e8c66a]/30 bg-[#09100c] p-2 shadow-[0_-24px_80px_rgba(0,0,0,.65)] sm:p-5" role="dialog" aria-modal="true" aria-label={t("جزئیات افتخارات", "Award details")} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 34, mass: .8 }}><div className="mx-auto mb-2 h-1 w-12 rounded-full bg-white/20"/><button type="button" onClick={() => setDetails(false)} aria-label={t("بستن", "Close")} className="absolute right-4 top-4 z-[4000] grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/60 text-white"><X size={18}/></button>{slides.length ? <DepthCarousel items={slides} rtl={language === "fa"} depth={150} spread={70} tilt={18} perspective={1400} visibleCards={3} cardWidth={300} cardHeight={460} radius={16} duration={700} showControls showIndicators onShare={index => { const award = shareableAwards[index]; if (award) void share(award); }} /> : <div className="grid min-h-[60vh] place-items-center text-sm text-white/60">{t("تصویر جوایز در دسترس نیست.", "Award artwork is unavailable.")}</div>}{message && <p className="relative z-[4001] mt-2 text-center text-xs text-brand">{message}</p>}</motion.aside></motion.div>}</AnimatePresence>;
  return <section className="my-[21px] rounded-[1.75rem] border border-[#e8c66a]/20 bg-[#101512] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8c66a]/10 text-[#e8c66a]"><Trophy size={19}/></span><div><p className="text-[10px] font-black tracking-[.2em] text-[#e8c66a]">{t("جوایز", "AWARDS")}</p><h2 className="mt-1 text-xl font-black">{t("افتخارات بازیکن", "Player honours")}</h2></div></div><button type="button" onClick={() => { setMessage(""); setDetails(true); }} className="rounded-xl border border-[#e8c66a]/35 px-3 py-2 text-xs font-black text-[#e8c66a]">{t("مشاهده همه", "SEE ALL")}</button></div><div className="mt-5 flex gap-3 overflow-x-auto px-2 pb-2">{groupedAwards.map(({ award, count }) => <button key={awardGroupKey(award)} type="button" onClick={() => { setMessage(""); setDetails(true); }} className="relative shrink-0 rounded-2xl p-1" title={`${awardTitle(award, language)} · ${award.competitionName ?? "LowBlock"}`} aria-label={`${awardTitle(award, language)} · ${award.competitionName ?? "LowBlock"}`}><span className="absolute right-0 top-0 z-10 rounded-full border border-[#e8c66a]/60 bg-[#172117] px-2 py-0.5 text-[11px] font-black text-[#f5d879]">{count}×</span><img src={award.trophyUrl!} alt={`${awardTitle(award, language)} ${award.competitionName ?? "LowBlock"}`} loading="lazy" className="h-24 w-20 rounded-xl bg-black/30 object-contain"/></button>)}</div>{message && <p className="mt-4 text-xs text-brand">{message}</p>}{mounted && createPortal(drawer, document.body)}</section>;
}
