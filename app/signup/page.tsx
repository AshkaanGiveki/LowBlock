"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
export default function Signup() {
  const router = useRouter(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (password !== confirm) { setError("رمزهای عبور یکسان نیستند"); return; } setBusy(true); setError(""); const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error ?? "ثبت‌نام انجام نشد"); setBusy(false); return; } router.push("/app"); router.refresh(); }
  return <AuthShell title="رقابت را شروع کن" subtitle="یک نام کاربری بساز و وارد لیگ شو."><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold">نام کاربری<input required minLength={3} value={username} onChange={(event) => setUsername(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder="مثلاً علی_فوتبال" /></label>
    <label className="block text-sm font-semibold">رمز عبور<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder="حداقل ۸ کاراکتر" /></label>
    <label className="block text-sm font-semibold">تکرار رمز عبور<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="focus-ring mt-2 w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3" placeholder="رمز را دوباره وارد کن" /></label>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3.5 font-bold text-ink hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">{busy ? "در حال ساخت حساب…" : "ساخت حساب رایگان"}</button>
  </form><p className="mt-6 text-center text-sm text-[var(--muted)]">قبلاً ثبت‌نام کرده‌ای؟ <Link href="/login" className="font-bold text-brand">وارد شو</Link></p></AuthShell>;
}
