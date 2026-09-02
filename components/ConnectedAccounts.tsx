"use client";

import { useEffect, useState } from "react";
import { Bell, Link2, Unlink } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PlatformIcon } from "@/components/PlatformIcon";
import { useLanguage } from "@/components/LanguageProvider";
import { TelegramReminderScope, TelegramReminderScopeSelector } from "@/components/PlatformNotificationToggle";

type Item = { providerUsername?: string | null; providerDisplayName?: string | null; canMessage?: boolean };

export function ConnectedAccounts() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<{ telegram: Item | null; bale: Item | null }>({ telegram: null, bale: null });
  const [enabled, setEnabled] = useState(false);
  const [scope, setScope] = useState<TelegramReminderScope>("ALL_MATCHES");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = () => Promise.all([fetch("/api/account/connections").then((r) => r.json()), fetch("/api/notifications/preferences").then((r) => r.json())]).then(([a, p]) => {
    setAccounts({ telegram: a.telegram ?? null, bale: a.bale ?? null });
    setEnabled(p.enabled === true);
    setScope(p.telegramReminderScope === "GLOBAL_LEADERBOARD" ? "GLOBAL_LEADERBOARD" : "ALL_MATCHES");
  });
  useEffect(() => { load(); }, []);

  async function connect(provider: string) { setBusy(provider); const r = await fetch(`/api/account/connections/${provider}/start`, { method: "POST" }); const d = await r.json(); if (r.ok && d.url) window.location.href = d.url; else setBusy(""); }
  async function unlink(provider: string) { setBusy(provider); await fetch("/api/account/connections", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }) }); setConfirm(null); setBusy(""); await load(); }
  async function toggle() { setBusy("notifications"); const r = await fetch("/api/notifications/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) }); const data = await r.json().catch(() => null); if (r.ok) setEnabled(data?.enabled === true); setBusy(""); }
  async function changeScope(nextScope: TelegramReminderScope) { if (!accounts.telegram || !enabled || busy || nextScope === scope) return; setBusy("scope"); const r = await fetch("/api/notifications/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: "telegram", reminderScope: nextScope }) }); if (r.ok) setScope(nextScope); setBusy(""); }

  return <section className="mt-4 rounded-2xl border border-white/[.08] bg-[#101512] p-5 md:p-7">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><Link2 size={19} /></span><div><h2 className="font-black text-white">{t("حساب‌های متصل", "Connected accounts")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("حساب LowBlock را در همه برنامه‌ها استفاده کنید.", "Use your LowBlock account across every app.")}</p></div></div>
    <div className="mt-5 space-y-3">{(["telegram", "bale"] as const).map((provider) => { const item = accounts[provider]; return <div key={provider} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-black/10 p-4"><div className="flex min-w-0 items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${provider === "telegram" ? "border-sky-400/30 text-sky-300" : "border-cyan-300/30 text-cyan-200"}`}><PlatformIcon provider={provider} /></span><div className="min-w-0"><b className="text-sm text-white">{provider === "telegram" ? "Telegram" : "Bale"}</b><p className="mt-1 truncate text-xs text-[var(--muted)]">{item ? (item.providerUsername ? `@${item.providerUsername}` : item.providerDisplayName || t("متصل است", "Connected")) : t("متصل نیست", "Not connected")}</p></div></div>{item ? <button type="button" onClick={() => setConfirm(provider)} disabled={!!busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-400/25 px-3 py-2 text-xs font-bold text-red-300"><Unlink size={13} />{t("قطع اتصال", "Disconnect")}</button> : <button type="button" onClick={() => connect(provider)} disabled={!!busy} className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-black text-[#07100b]">{busy === provider ? t("…", "…") : t("اتصال", "Connect")}</button>}</div>; })}</div>
    <div className="mt-5 rounded-2xl border border-white/[.07] bg-black/10 p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><Bell size={18} className="mt-0.5 shrink-0 text-brand" /><div className="min-w-0"><b className="text-sm text-white">{t("یادآوری پیش‌بینی", "Prediction reminders")}</b><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t("اگر پیش‌بینی ثبت نکرده باشید، ۳۰ دقیقه قبل از بازی در تلگرام یادآوری می‌شوید.", "Get a Telegram reminder 30 minutes before a match when you are missing a pick.")}</p></div></div><button type="button" onClick={toggle} disabled={!accounts.telegram || !!busy} aria-pressed={enabled} aria-label={t("فعال‌سازی یادآوری‌ها", "Toggle prediction reminders")} dir="ltr" className={`relative h-8 w-14 shrink-0 rounded-full border transition ${enabled ? "border-brand bg-brand" : "border-white/15 bg-white/10"}`}><span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${enabled ? "translate-x-6" : "translate-x-0"}`} /></button></div>{accounts.telegram && enabled && <TelegramReminderScopeSelector scope={scope} disabled={!!busy} onChange={changeScope} />}{!accounts.telegram && <p className="mt-3 text-xs text-brand">{t("برای دریافت یادآوری، تلگرام را متصل کنید.", "Connect Telegram to receive prediction reminders.")}</p>}</div>
    <ConfirmModal open={!!confirm} title={t("قطع اتصال حساب؟", "Disconnect account?")} description={t("ورود خودکار و یادآوری‌ها متوقف می‌شوند؛ حساب و پیش‌بینی‌های شما محفوظ می‌مانند.", "Platform auto-login and Telegram reminders may stop working. Your LowBlock account and predictions stay safe.")} confirmLabel={t("قطع اتصال", "Disconnect")} cancelLabel={t("انصراف", "Cancel")} danger onCancel={() => setConfirm(null)} onConfirm={() => confirm && unlink(confirm.toUpperCase())} />
  </section>;
}
