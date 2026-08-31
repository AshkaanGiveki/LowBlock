"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { shareAward } from "@/lib/awards/share";
import { useLanguage } from "@/components/LanguageProvider";
import { LEAGUES } from "@/lib/football/leagues";
import { playAwardRevealSound } from "@/lib/awards/revealSound";
import { getAwardLabel, getAwardPeriod } from "@/lib/awards/presentation";

type Award = { id: string; competitionId?: string; competitionName: string; roundNumber?: number; seasonStartYear?: number; type?: string; periodId?: string };
type Phase = "darkening" | "hero" | "details";
const sprayPieces = Array.from({ length: 18 }, (_, index) => index);
function whenPageIsReady() { return new Promise<void>(resolve => { const ready = () => { void document.fonts?.ready.then(() => resolve()); }; if (document.readyState === "complete") ready(); else window.addEventListener("load", ready, { once: true }); }); }

export function AwardReveal() {
  const pathname = usePathname(); const { t, language } = useLanguage(); const [awards, setAwards] = useState<Award[]>([]); const [index, setIndex] = useState(0); const [phase, setPhase] = useState<Phase>("darkening"); const [imageReady, setImageReady] = useState(false); const [darkReady, setDarkReady] = useState(false); const [exiting, setExiting] = useState(false); const [busy, setBusy] = useState(false); const continueRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { let active = true; void whenPageIsReady().then(() => { if (!active) return; const repeatDemo = process.env.NODE_ENV !== "production" && pathname === "/" ? "?repeatDemo=1" : ""; return fetch(`/api/awards/unrevealed${repeatDemo}`).then(r => r.ok ? r.json() : null).then(data => { if (active && data?.awards?.length) { setAwards(data.awards); setIndex(0); setPhase("darkening"); setImageReady(false); setDarkReady(false); setExiting(false); } }); }).catch(() => undefined); return () => { active = false; }; }, [pathname]);
  useEffect(() => { if (!awards.length) return; const timer = window.setTimeout(() => setDarkReady(true), 1000); return () => window.clearTimeout(timer); }, [awards.length, index]);
  useEffect(() => { if (!imageReady || !darkReady || !awards.length) return; if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("details"); continueRef.current?.focus(); return; } setPhase("hero"); void playAwardRevealSound(); const timer = window.setTimeout(() => { setPhase("details"); continueRef.current?.focus(); }, 2700); return () => window.clearTimeout(timer); }, [imageReady, darkReady, awards.length, index]);
  if (!awards.length || !awards[index]) return null;
  const award = awards[index]; const league = LEAGUES.find(item => item.code === award.competitionId); const competitionName = league ? t(league.faName, league.enName) : award.competitionName; const label = getAwardLabel(award.type, language); const period = getAwardPeriod(award, language); const season = award.seasonStartYear ? `${award.seasonStartYear}/${String(award.seasonStartYear + 1).slice(-2)}` : "";
  async function finish() { setExiting(true); window.setTimeout(async () => { await fetch(`/api/awards/${award.id}/reveal`, { method: "PATCH" }).catch(() => undefined); if (index + 1 >= awards.length) setAwards([]); else { setIndex(index + 1); setPhase("darkening"); setImageReady(false); setDarkReady(false); setExiting(false); } }, 360); }
  async function share() { setBusy(true); try { await shareAward(award.id); } finally { setBusy(false); } }
  return <div className={`award-reveal-backdrop award-phase-${phase} ${exiting ? "award-reveal-exiting" : ""}`} role="dialog" aria-modal="true" aria-labelledby="award-reveal-title" onKeyDown={event => { if (event.key === "Escape") void finish(); }}><div className="award-spray award-spray-left" aria-hidden="true">{sprayPieces.map(piece => <i key={piece} />)}</div><div className="award-spray award-spray-right" aria-hidden="true">{sprayPieces.map(piece => <i key={piece} />)}</div><main className={`award-reveal-stage ${language === "fa" ? "award-reveal-stage-fa" : ""}`}><div className="award-reveal-glow"/><img src={`/api/awards/${award.id}/trophy`} alt={`${label} ${competitionName}`} className="award-reveal-trophy" onLoad={async event => { await event.currentTarget.decode().catch(() => undefined); setImageReady(true); }}/><div className="award-reveal-copy"><p className="award-reveal-kicker">{competitionName}</p><h2 id="award-reveal-title">{label}</h2><p className="award-reveal-meta">{season}{season && " · "}{period}</p><div className="award-reveal-scope"><span>{label}</span><img src="/lowblock-typo.png" alt="LowBlock"/></div><div className="award-reveal-actions"><button type="button" disabled={busy} onClick={share} className="award-share-button">{busy ? <Loader2 size={17} className="animate-spin"/> : <Share2 size={17}/>} {busy ? t("در حال آماده‌سازی…", "PREPARING…") : t("جامت را به بقیه نشان بده", "SHOW YOUR TROPHY")}</button><button ref={continueRef} type="button" onClick={finish} className="award-continue-button">{t("ادامه", "CONTINUE")}</button></div></div></main></div>;
}
