"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
export default function Login() {
  const router = useRouter(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error ?? "ورود انجام نشد"); setBusy(false); return; } router.push("/app"); router.refresh(); }
  return <AuthShell title="خوش برگشتی" subtitle="برای ادامه رقابت وارد حساب خودت شو."><form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold"><span className="mb-2 block">نام کاربری</span><input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="مثلاً علی_فوتبال" className="focus-ring w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3 text-white placeholder:text-[var(--muted)]" /></label>
    <label className="block text-sm font-semibold"><span className="mb-2 block">رمز عبور</span><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="رمز عبور" className="focus-ring w-full rounded-xl border border-[var(--border)] bg-black/10 px-4 py-3 text-white placeholder:text-[var(--muted)]" /></label>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3.5 font-bold text-ink transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">{busy ? "در حال ورود…" : "ورود به حساب"}</button>
  </form><p className="mt-6 text-center text-sm text-[var(--muted)]">حساب نداری؟ <Link href="/signup" className="font-bold text-brand">ثبت‌نام کن</Link></p></AuthShell>;
}
