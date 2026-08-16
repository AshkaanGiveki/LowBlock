"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, ExternalLink, Link2, LoaderCircle, ShieldCheck, Unlink } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { MiniAppProvider } from "@/lib/auth/mini-app";

type Account = { provider: MiniAppProvider; username?: string };
type Me = { username: string; hasPassword: boolean; connectedAccounts: Account[] };

const providers: Array<{ id: MiniAppProvider; label: string; color: string }> = [
  { id: "telegram", label: "Telegram", color: "#2aabee" },
  { id: "bale", label: "Bale", color: "#41c17d" },
];

function currentPlatform() {
  if (window.Telegram?.WebApp?.initData) return { provider: "telegram" as const, initData: window.Telegram.WebApp.initData };
  if (window.Bale?.WebApp?.initData) return { provider: "bale" as const, initData: window.Bale.WebApp.initData };
  return null;
}

export function ConnectedAccounts() {
  const { t } = useLanguage();
  const [me, setMe] = useState<Me | null>(null);
  const [platform, setPlatform] = useState<ReturnType<typeof currentPlatform>>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function load() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    if (data.user) setMe(data.user);
  }

  useEffect(() => {
    setPlatform(currentPlatform());
    void load();
    const refresh = () => void load();
    window.addEventListener("lowblock-profile-updated", refresh);
    return () => window.removeEventListener("lowblock-profile-updated", refresh);
  }, []);

  async function connect(provider: MiniAppProvider) {
    if (!platform || platform.provider !== provider) return;
    setBusy(provider);
    setMessage("");
    const response = await fetch("/api/auth/mini-app", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...platform, action: "authenticate" }) });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error ?? t("اتصال حساب انجام نشد.", "Could not connect the account."));
    await load();
  }

  async function disconnect(provider: MiniAppProvider) {
    const accepted = window.confirm(t("این پیام‌رسان از حساب شما جدا شود؟", "Disconnect this messenger from your account?"));
    if (!accepted) return;
    setBusy(provider);
    setMessage("");
    const response = await fetch(`/api/auth/connected-accounts/${provider}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error ?? t("قطع اتصال انجام نشد.", "Could not disconnect the account."));
    await load();
  }

  async function merge(event: FormEvent) {
    event.preventDefault();
    if (!platform || !confirmed) return;
    setBusy("merge");
    setMessage("");
    const response = await fetch("/api/auth/mini-app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...platform, action: "mergeCredentials", username, password, confirmMerge: true }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error ?? t("ادغام حساب‌ها انجام نشد.", "Could not merge the accounts."));
    window.location.reload();
  }

  const links: Record<MiniAppProvider, string | undefined> = {
    telegram: process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_URL,
    bale: process.env.NEXT_PUBLIC_BALE_MINI_APP_URL,
  };
  const platformIsConnected = platform && me?.connectedAccounts.some((item) => item.provider === platform.provider);

  return <section className="mt-4 rounded-2xl border border-white/[.08] bg-[#101512] p-5 md:p-7">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-brand"><ShieldCheck size={20}/></span>
      <div><h2 className="text-lg font-black">{t("حساب‌های متصل", "Connected accounts")}</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t("تلگرام، بله و وب‌سایت را به یک پروفایل و یک سابقه پیش‌بینی متصل کنید.", "Keep Telegram, Bale, and the website connected to one profile and prediction history.")}</p></div>
    </div>
    <div className="mt-5 grid gap-3">
      {providers.map((provider) => {
        const account = me?.connectedAccounts.find((item) => item.provider === provider.id);
        const isBusy = busy === provider.id;
        return <article key={provider.id} className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-black/15 p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: provider.color }}>{provider.label.slice(0, 1)}</span>
          <div className="min-w-0 flex-1"><p className="font-black">{provider.label}</p><p className="mt-0.5 truncate text-xs text-[var(--muted)]">{account ? account.username ? `@${account.username}` : t("متصل", "Connected") : t("متصل نیست", "Not connected")}</p></div>
          {account ? <><span className="hidden items-center gap-1 text-xs font-bold text-brand min-[380px]:flex"><Check size={14}/>{t("متصل", "Connected")}</span><button type="button" disabled={isBusy} onClick={() => void disconnect(provider.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/45 transition hover:border-red-400/30 hover:text-red-300 disabled:opacity-50" aria-label={`Disconnect ${provider.label}`}>{isBusy ? <LoaderCircle className="animate-spin" size={16}/> : <Unlink size={16}/>}</button></> : platform?.provider === provider.id ? <button type="button" disabled={isBusy} onClick={() => void connect(provider.id)} className="rounded-lg bg-brand px-3 py-2 text-xs font-black">{isBusy ? "…" : t("اتصال", "Connect")}</button> : links[provider.id] ? <a href={links[provider.id]} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/60" aria-label={`Open ${provider.label}`}><ExternalLink size={16}/></a> : <span className="max-w-24 text-end text-[10px] leading-4 text-white/35">{t("از داخل مینی‌اپ باز کنید", "Open the Mini App")}</span>}
        </article>;
      })}
    </div>
    {platformIsConnected && <div className="mt-5 border-t border-white/[.07] pt-5">
      {!mergeOpen ? <button type="button" onClick={() => setMergeOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2.5 text-xs font-bold text-white/70"><Link2 size={15}/>{t("ادغام با یک حساب موجود", "Merge with an existing account")}</button> : <form onSubmit={merge} className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4">
        <h3 className="font-black text-amber-100">{t("ادغام حساب‌ها", "Merge accounts")}</h3>
        <p className="mt-1 text-xs leading-5 text-white/50">{t("پیش‌بینی‌ها و حساب‌های پیام‌رسان این پروفایل به حساب مقصد منتقل می‌شوند. اگر در یک مسابقه هر دو حساب پیش‌بینی داشته باشند، پیش‌بینی حساب مقصد حفظ می‌شود.", "Predictions and messenger connections from this profile will move to the destination account. If both accounts predicted the same match, the destination prediction is kept.")}</p>
        <div className="mt-3 grid gap-2"><input required minLength={3} maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder={t("نام کاربری حساب مقصد", "Destination username")} className="rounded-lg border border-white/10 bg-black/20 px-3.5 py-3 text-sm outline-none focus:border-brand"/><input required minLength={8} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder={t("رمز عبور حساب مقصد", "Destination password")} className="rounded-lg border border-white/10 bg-black/20 px-3.5 py-3 text-sm outline-none focus:border-brand"/></div>
        <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/60"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-[var(--brand)]"/>{t("می‌دانم که پس از ادغام، این پروفایل جداگانه حذف می‌شود.", "I understand that this separate profile is removed after merging.")}</label>
        <div className="mt-4 flex gap-2"><button disabled={!confirmed || busy === "merge"} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-xs font-black disabled:opacity-40">{busy === "merge" && <LoaderCircle className="animate-spin" size={15}/>} {t("تأیید ادغام", "Confirm merge")}</button><button type="button" onClick={() => setMergeOpen(false)} className="rounded-lg border border-white/10 px-3.5 py-2.5 text-xs font-bold text-white/60">{t("انصراف", "Cancel")}</button></div>
      </form>}
    </div>}
    {message && <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{message}</p>}
    {!me?.hasPassword && <p className="mt-4 rounded-lg border border-white/[.07] bg-white/[.025] p-3 text-xs leading-5 text-white/45">{t("برای ورود مستقیم از وب‌سایت یا قطع آخرین حساب پیام‌رسان، ابتدا در پایین همین صفحه یک رمز عبور تعیین کنید.", "Set a password below before signing in directly on the website or disconnecting your final messenger account.")}</p>}
  </section>;
}
