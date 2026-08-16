"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Link2, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import type { MiniAppProvider } from "@/lib/auth/mini-app";

type PlatformContext = { provider: MiniAppProvider; initData: string };

function platformContext(): PlatformContext | null {
  const telegram = window.Telegram?.WebApp;
  if (telegram?.initData) return { provider: "telegram", initData: telegram.initData };
  const bale = window.Bale?.WebApp;
  if (bale?.initData) return { provider: "bale", initData: bale.initData };
  return null;
}

export function MiniAppBridge() {
  const router = useRouter();
  const { t } = useLanguage();
  const started = useRef(false);
  const [context, setContext] = useState<PlatformContext | null>(null);
  const [setup, setSetup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function exchange(platform: PlatformContext, action: "authenticate" | "create" | "linkCredentials", credentials?: { username: string; password: string }) {
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/mini-app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...platform, action, ...credentials }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.ok) {
      setSetup(false);
      router.refresh();
      return;
    }
    if (data.code === "ACCOUNT_SETUP_REQUIRED") {
      setSetup(true);
      return;
    }
    setSetup(true);
    setError(data.error ?? t("ورود به مینی‌اپ انجام نشد.", "Mini App sign-in failed."));
  }

  useEffect(() => {
    if (started.current) return;
    const timer = window.setTimeout(() => {
      const platform = platformContext();
      if (!platform) return;
      started.current = true;
      setContext(platform);
      const sdk = platform.provider === "telegram" ? window.Telegram?.WebApp : window.Bale?.WebApp;
      sdk?.ready?.();
      sdk?.expand?.();
      void exchange(platform, "authenticate");
    }, 0);
    return () => window.clearTimeout(timer);
  // The platform SDK is immutable for the lifetime of the webview.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function linkExisting(event: FormEvent) {
    event.preventDefault();
    if (context) await exchange(context, "linkCredentials", { username, password });
  }

  if (!setup || !context) return null;
  const platformName = context.provider === "telegram" ? "Telegram" : "Bale";
  return <div className="fixed inset-0 z-[100] grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="mini-app-title">
    <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111713] p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand"><ShieldCheck size={23}/></span>
        {showLogin && <button type="button" onClick={() => { setShowLogin(false); setError(""); }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/60" aria-label="Close"><X size={18}/></button>}
      </div>
      <h2 id="mini-app-title" className="mt-5 text-xl font-black">{t(`ورود با ${platformName}`, `Continue with ${platformName}`)}</h2>
      <p className="mt-2 text-sm leading-6 text-white/60">{t("حساب این پیام‌رسان را به حساب لوبلاک خود متصل کنید یا یک حساب تازه بسازید.", "Connect this messenger identity to your LowBlock account, or create a new account.")}</p>
      {showLogin ? <form onSubmit={linkExisting} className="mt-5 space-y-3">
        <input required minLength={3} maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t("نام کاربری لوبلاک", "LowBlock username")} autoComplete="username" className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand"/>
        <input required minLength={8} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("رمز عبور", "Password")} autoComplete="current-password" className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand"/>
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-black disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18}/> : <Link2 size={18}/>} {t("اتصال حساب", "Link account")}</button>
      </form> : <div className="mt-5 grid gap-3">
        <button disabled={busy} onClick={() => void exchange(context, "create")} className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-black disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={18}/>} {t("ساخت حساب تازه", "Create a new account")}</button>
        <button disabled={busy} onClick={() => setShowLogin(true)} className="rounded-lg border border-white/12 px-4 py-3 font-bold text-white/80">{t("از قبل حساب دارم", "I already have an account")}</button>
      </div>}
      {error && <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      <p className="mt-4 text-[11px] leading-5 text-white/35">{t("شناسه پیام‌رسان فقط پس از اعتبارسنجی امن در سرور ذخیره می‌شود.", "Your messenger ID is stored only after secure server-side validation.")}</p>
    </section>
  </div>;
}
