"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";
import { migrateGuestPredictions } from "@/lib/predictions/guestStorage";

export default function LoginForm() {
  const router = useRouter(); const { t } = useLanguage(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error ?? t("ورود انجام نشد", "Sign-in failed")); setBusy(false); return; } await migrateGuestPredictions(); router.push(new URLSearchParams(window.location.search).get("returnTo") || "/matches"); router.refresh(); }
  return <AuthShell title={t("خوش برگشتی", "Welcome back")} subtitle={t("برای ادامه رقابت وارد حساب خودت شو.", "Sign in to continue the competition.")}><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold"><span className="mb-2 block">{t("نام کاربری", "Username")}</span><input required value={username} onChange={event => setUsername(event.target.value)} className="focus-ring w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3 text-white" /></label><label className="block text-sm font-semibold"><span className="mb-2 block">{t("رمز عبور", "Password")}</span><input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="focus-ring w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3 text-white" /></label>{error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<button disabled={busy} className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3.5 font-bold text-ink disabled:opacity-60">{busy ? t("در حال ورود…", "Signing in…") : t("ورود به حساب", "Sign in")}</button></form><p className="mt-6 text-center text-sm text-[var(--muted)]">{t("حساب نداری؟", "No account?")} <Link href="/signup" className="font-bold text-brand">{t("ثبت‌نام کن", "Create one")}</Link></p></AuthShell>;
}
