"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { useLanguage } from "@/components/LanguageProvider";

export default function Signup() {
  const router = useRouter(); const { t } = useLanguage();
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (password !== confirm) { setError(t("\u0631\u0645\u0632\u0647\u0627\u06cc \u0639\u0628\u0648\u0631 \u06cc\u06a9\u0633\u0627\u0646 \u0646\u06cc\u0633\u062a\u0646\u062f", "Passwords do not match")); return; }
    setBusy(true); setError(""); const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error ?? t("\u062b\u0628\u062a\u200c\u0646\u0627\u0645 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f", "Sign-up failed")); setBusy(false); return; }
    router.push("/matches"); router.refresh();
  }
  return <AuthShell title={t("\u0631\u0642\u0627\u0628\u062a \u0631\u0627 \u0634\u0631\u0648\u0639 \u06a9\u0646", "Start competing")} subtitle={t("\u06cc\u06a9 \u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc \u0628\u0633\u0627\u0632 \u0648 \u0648\u0627\u0631\u062f \u0644\u06cc\u06af \u0634\u0648.", "Create a username and join the league.")}><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold">{t("\u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc", "Username")}<input required minLength={3} value={username} onChange={(event) => setUsername(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder={t("\u0645\u062b\u0644\u0627\u064b \u0639\u0644\u06cc_\u0641\u0648\u062a\u0628\u0627\u0644", "e.g. football_master")} /></label>
    <label className="block text-sm font-semibold">{t("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631", "Password")}<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder={t("\u062d\u062f\u0627\u0642\u0644 \u06f8 \u06a9\u0627\u0631\u0627\u06a9\u062a\u0631", "At least 8 characters")} /></label>
    <label className="block text-sm font-semibold">{t("\u062a\u06a9\u0631\u0627\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631", "Confirm password")}<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder={t("\u0631\u0645\u0632 \u0631\u0627 \u062f\u0648\u0628\u0627\u0631\u0647 \u0648\u0627\u0631\u062f \u06a9\u0646", "Enter password again")} /></label>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3.5 font-bold text-ink hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">{busy ? t("\u062f\u0631 \u062d\u0627\u0644 \u0633\u0627\u062e\u062a \u062d\u0633\u0627\u0628\u2026", "Creating account…") : t("\u0633\u0627\u062e\u062a \u062d\u0633\u0627\u0628 \u0631\u0627\u06cc\u06af\u0627\u0646", "Create free account")}</button>
  </form><p className="mt-6 text-center text-sm text-[var(--muted)]">{t("\u0642\u0628\u0644\u0627\u064b \u062b\u0628\u062a\u200c\u0646\u0627\u0645 \u06a9\u0631\u062f\u0647\u200c\u0627\u06cc\u061f", "Already registered?")} <Link href="/login" className="font-bold text-brand">{t("\u0648\u0627\u0631\u062f \u0634\u0648", "Sign in")}</Link></p></AuthShell>;
}
