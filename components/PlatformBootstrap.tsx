"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

type Platform = "telegram" | "bale";

export function PlatformBootstrap() {
  const router = useRouter();
  const { t } = useLanguage();
  const [boot, setBoot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async (provider: Platform, raw: string) => {
    setBoot(true); setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`/api/auth/platform/${provider}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: raw }), signal: controller.signal });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (data?.ok) {
        const path = window.location.pathname;
        const destination = path === "/" || path === "/platform-link" ? "/matches" : `${path}${window.location.search}${window.location.hash}`;
        router.replace(destination); router.refresh(); return;
      }
      if (data?.error === "LINK_REQUIRED") { router.replace(`/platform-link?provider=${provider}`); return; }
      setError(data?.error === "PLATFORM_AUTH_EXPIRED" ? t("نشست پلتفرم منقضی شده است. مینی‌اپ را ببندید و دوباره باز کنید.", "Your platform session expired. Close and reopen the Mini App.") : t("LowBlock نتوانست نشست شما را تأیید کند.", "LowBlock could not verify this platform session."));
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError" ? t("اتصال به LowBlock بیش از حد طول کشید. دوباره تلاش کنید.", "LowBlock took too long to connect. Please try again.") : t("اتصال به LowBlock ممکن نشد. دوباره تلاش کنید.", "LowBlock could not connect. Please try again."));
    } finally { window.clearTimeout(timeout); setBoot(false); }
  }, [router, t]);

  useEffect(() => {
    const w = window as Window & { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } }; Bale?: { WebApp?: { initData?: string } } };
    const tg = w.Telegram?.WebApp; const bale = w.Bale?.WebApp;
    if (tg?.initData) { tg.ready?.(); tg.expand?.(); void authenticate("telegram", tg.initData); return; }
    if (bale?.initData) void authenticate("bale", bale.initData);
  }, [authenticate]);

  if (error && !boot) return <div className="fixed inset-0 z-[200] grid place-items-center bg-[#07100b] px-6"><div className="w-full max-w-md rounded-[2rem] border border-red-300/20 bg-[#101a14] p-8 text-center shadow-2xl"><img src="/lowblock.png" alt="LowBlock" className="mx-auto h-14 w-14"/><p className="mt-6 text-[10px] font-black tracking-[.24em] text-red-300">LOWBLOCK MINI APP</p><h1 className="mt-3 text-2xl font-black text-white">{t("باز کردن LowBlock ممکن نشد", "LowBlock could not open")}</h1><p className="mt-3 text-sm leading-7 text-white/60">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-7 w-full rounded-xl bg-brand px-4 py-3.5 font-black text-[#07100b]">{t("تلاش دوباره", "Try again")}</button></div></div>;
  return boot ? <div className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-[#07100b] px-6"><div className="relative w-full max-w-sm text-center"><div className="relative mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-brand/30 bg-[#10231a] shadow-[0_0_70px_rgba(32,184,121,.25)]"><img src="/lowblock.png" alt="LowBlock" className="h-16 w-16 animate-pulse"/></div><p className="relative mt-8 text-[10px] font-black tracking-[.28em] text-brand">LOWBLOCK MINI APP</p><h1 className="relative mt-3 text-2xl font-black text-white">{t("در حال ورود امن", "Secure sign-in")}</h1><p className="relative mt-3 text-sm leading-7 text-white/55">{t("در حال بررسی حساب LowBlock شما…", "Checking your LowBlock account…")}</p><div className="mx-auto mt-7 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-white/10"><span className="block h-full w-1/2 animate-pulse rounded-full bg-brand"/></div></div></div> : null;
}
