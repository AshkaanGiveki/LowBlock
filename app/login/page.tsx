"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";

export default function Login() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error ?? t("\u0648\u0631\u0648\u062f \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f", "Sign-in failed")); setBusy(false); return; }
    router.push("/matches"); router.refresh();
  }

  return <AuthShell title={t("\u062e\u0648\u0634 \u0628\u0631\u06af\u0634\u062a\u06cc", "Welcome back")} subtitle={t("\u0628\u0631\u0627\u06cc \u0627\u062f\u0627\u0645\u0647 \u0631\u0642\u0627\u0628\u062a \u0648\u0627\u0631\u062f \u062d\u0633\u0627\u0628 \u062e\u0648\u062f\u062a \u0634\u0648.", "Sign in to continue the competition.")}><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold"><span className="mb-2 block">{t("\u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc", "Username")}</span><input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t("نام کاربری", "e.g. football_master")} className="focus-ring w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3 text-white placeholder:text-[var(--muted)]" /></label>
    <label className="block text-sm font-semibold"><span className="mb-2 block">{t("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631", "Password")}</span><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631", "Password")} className="focus-ring w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3 text-white placeholder:text-[var(--muted)]" /></label>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3.5 font-bold text-ink transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">{busy ? t("\u062f\u0631 \u062d\u0627\u0644 \u0648\u0631\u0648\u062f\u2026", "Signing in…") : t("\u0648\u0631\u0648\u062f \u0628\u0647 \u062d\u0633\u0627\u0628", "Sign in")}</button>
  </form><p className="mt-6 text-center text-sm text-[var(--muted)]">{t("\u062d\u0633\u0627\u0628 \u0646\u062f\u0627\u0631\u06cc\u061f", "No account?")} <Link href="/signup" className="font-bold text-brand">{t("\u062b\u0628\u062a\u200c\u0646\u0627\u0645 \u06a9\u0646", "Create one")}</Link></p></AuthShell>;
}
