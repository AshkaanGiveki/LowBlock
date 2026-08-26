"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Share2, X } from "lucide-react";
import { shareAward } from "@/lib/awards/share";

type Award = { id: string; competitionName: string; roundNumber: number; seasonStartYear: number };
type Phase = "darkening" | "hero" | "details";
const sprayPieces = Array.from({ length: 18 }, (_, index) => index);

function whenPageIsReady() { return new Promise<void>(resolve => { const ready = () => { void document.fonts?.ready.then(() => resolve()); }; if (document.readyState === "complete") ready(); else window.addEventListener("load", ready, { once: true }); }); }

export function AwardReveal() {
  const pathname = usePathname(); const [awards, setAwards] = useState<Award[]>([]); const [index, setIndex] = useState(0); const [phase, setPhase] = useState<Phase>("darkening"); const [busy, setBusy] = useState(false); const [imageReady, setImageReady] = useState(false); const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { let active = true; void whenPageIsReady().then(() => { if (!active) return; const repeatDemo = process.env.NODE_ENV !== "production" && pathname === "/" ? "?repeatDemo=1" : ""; return fetch(`/api/awards/unrevealed${repeatDemo}`).then(r => r.ok ? r.json() : null).then(data => { if (active && data?.awards?.length) { setAwards(data.awards); setIndex(0); setPhase("darkening"); setImageReady(false); } }); }).catch(() => undefined); return () => { active = false; }; }, [pathname]);
  useEffect(() => { if (!imageReady || !awards.length) return; closeRef.current?.focus(); if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("details"); return; } setPhase("hero"); const timer = window.setTimeout(() => setPhase("details"), 2700); return () => window.clearTimeout(timer); }, [imageReady, awards.length, index]);
  if (!awards.length || !awards[index]) return null; const award = awards[index];
  async function finish() { await fetch(`/api/awards/${award.id}/reveal`, { method: "PATCH" }).catch(() => undefined); if (index + 1 >= awards.length) setAwards([]); else { setIndex(index + 1); setPhase("darkening"); setImageReady(false); } }
  async function share() { setBusy(true); try { await shareAward(award.id); } finally { setBusy(false); } }
  return <div className={`award-reveal-backdrop award-phase-${phase}`} role="dialog" aria-modal="true" aria-labelledby="award-reveal-title" onKeyDown={event => { if (event.key === "Escape") void finish(); }}><div className="award-spray award-spray-left" aria-hidden="true">{sprayPieces.map(piece => <i key={piece} />)}</div><div className="award-spray award-spray-right" aria-hidden="true">{sprayPieces.map(piece => <i key={piece} />)}</div><div className="award-reveal-panel"><button ref={closeRef} type="button" aria-label="Continue" onClick={finish} className="award-reveal-close"><X size={18}/></button><div className="award-reveal-glow"/><img src={`/api/awards/${award.id}/trophy`} alt={`${award.competitionName} Round Winner, ${award.seasonStartYear}/${String(award.seasonStartYear + 1).slice(-2)} Matchday ${award.roundNumber}`} className="award-reveal-trophy" onLoad={async event => { await event.currentTarget.decode().catch(() => undefined); setImageReady(true); }}/><div className="award-reveal-copy"><p className="award-reveal-kicker">{award.competitionName}</p><h2 id="award-reveal-title">ROUND WINNER</h2><p className="award-reveal-meta">{award.seasonStartYear}/{String(award.seasonStartYear + 1).slice(-2)} · MD{String(award.roundNumber).padStart(2, "0")}</p><p className="award-reveal-scope">LOW BLOCK LEVEL</p><div className="award-reveal-actions"><button type="button" disabled={busy} onClick={share} className="award-share-button"><Share2 size={17}/>SHARE YOUR WIN</button><button type="button" onClick={finish} className="award-continue-button">CONTINUE</button></div></div></div></div>;
}
