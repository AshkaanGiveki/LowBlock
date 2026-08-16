"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";
export default function Signup() {
  const router = useRouter(); const {t}=useLanguage(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (password !== confirm) { setError(t("رمزهای عبور یکسان نیستند","Passwords do not match")); return; } setBusy(true); setError(""); const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error ?? t("ثبت‌نام انجام نشد","Sign up failed")); setBusy(false); return; } router.push("/app"); router.refresh(); }
  return <AuthShell title={t("رقابت را شروع کن","Start competing")} subtitle={t("یک نام کاربری بساز و وارد لیگ شو.","Create a username and join the league.")}><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold">{t("نام کاربری","Username")}<input required minLength={3} value={username} onChange={(event) => setUsername(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder={t("مثلاً علی_فوتبال","e.g. football_master")} /></label>
    <label className="block text-sm font-semibold">{t("رمز عبور","Password")}<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder={t("حداقل ۸ کاراکتر","At least 8 characters")} /></label>
    <label className="block text-sm font-semibold">{t("تکرار رمز عبور","Confirm password")}<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder={t("رمز را دوباره وارد کن","Enter password again")} /></label>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3.5 font-bold text-ink hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">{busy ? t("در حال ساخت حساب…","Creating account…") : t("ساخت حساب رایگان","Create free account")}</button>
  </form><p className="mt-6 text-center text-sm text-[var(--muted)]">{t("قبلاً ثبت‌نام کرده‌ای؟","Already registered?")} <Link href="/login" className="font-bold text-brand">{t("وارد شو","Sign in")}</Link></p></AuthShell>;
}
