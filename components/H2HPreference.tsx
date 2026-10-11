"use client";

import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function H2HPreference() {
  const { t } = useLanguage();
  const [state, setState] = useState<{ enabled?: boolean; optedIn?: boolean; effectiveWeekKey?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/h2h/preferences").then((response) => response.json()).then(setState).catch(() => undefined); }, []);
  if (!state?.enabled) return null;
  const current = state;
  async function toggle() {
    setBusy(true);
    const response = await fetch("/api/h2h/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ optedIn: !state?.optedIn }) });
    if (response.ok) setState((previous) => ({ ...previous, optedIn: !previous?.optedIn, effectiveWeekKey: current.effectiveWeekKey }));
    setBusy(false);
  }
  return <section className="mt-4 rounded-2xl border border-[#eacb70]/20 bg-[linear-gradient(135deg,rgba(234,203,112,.1),rgba(16,21,18,.96))] p-5 md:p-7"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eacb70]/15 text-[#eacb70]"><ShieldOff size={19} /></span><div className="min-w-0 flex-1"><h2 className="font-black text-white">{t("شرکت در H2H", "H2H participation")}</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{state.optedIn ? t("به‌صورت پیش‌فرض در انتخاب هفته بعد شرکت می‌کنید.", "You are opted in by default for next week's selection.") : t("برای انتخاب‌های هفته بعد از H2H خارج هستید.", "You are opted out of next week's H2H selection.")}</p></div><button type="button" disabled={busy} onClick={toggle} className="rounded-lg border border-[#eacb70]/30 px-3 py-2 text-xs font-black text-[#eacb70]">{state.optedIn ? t("غیرفعال", "Disable") : t("فعال", "Enable")}</button></div><p className="mt-3 text-[11px] text-white/40">Changes apply from week {state.effectiveWeekKey ?? "next"} and never remove you from a frozen league.</p></section>;
}
