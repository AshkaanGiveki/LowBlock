"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Link2, LogIn } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { friendlyError } from "@/lib/userErrors";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => { params.then(({ token: value }) => setToken(value)); }, [params]);

  async function redeem(confirmSwitch = false) {
    setBusy(true);
    setNeedsLogin(false);
    const response = await fetch("/api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, confirmSwitch }) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409 && data.requiresSwitchConfirmation) {
      setBusy(false);
      setSwitchOpen(true);
      return;
    }
    if (!response.ok) {
      const friendly = friendlyError(data.error, t);
      setMessage(friendly);
      setNeedsLogin(response.status === 401 || data.error === "AUTH_REQUIRED");
      showToast(friendly);
      setBusy(false);
      return;
    }
    setMessage(t("به باشگاه پیوستید.", "You joined the Club."));
    setTimeout(() => router.replace("/club"), 700);
  }

  return <>
    <main className="grid min-h-screen place-items-center px-5 pb-28 pt-24">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(32,184,121,.22),transparent_40%),linear-gradient(145deg,#14251c,#0a0f0c)] p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand"><Link2 size={25} /></div>
        <h1 className="mt-5 text-3xl font-black">{t("دعوت باشگاه", "Club invitation")}</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t("با پذیرش دعوت، پیش‌بینی‌های شما همچنان از صفحه مرکزی ثبت می‌شوند.", "Your predictions will still be submitted from the central Predict page.")}</p>
        <button disabled={busy || !token} onClick={() => redeem()} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 font-black transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60">
          {busy ? "…" : <><CheckCircle2 size={17} />{t("پذیرش دعوت", "Accept invitation")}</>}
        </button>
        {message && <p role="alert" className="mt-4 rounded-xl bg-brand/10 p-3 text-sm leading-6 text-brand">{message}</p>}
        {needsLogin && <Link href="/login" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand/[.08] px-5 py-3 text-sm font-black text-brand transition hover:bg-brand/[.15]"><LogIn size={17} />{t("ورود به حساب", "Sign in to continue")}</Link>}
      </section>
    </main>
    <ConfirmModal open={switchOpen} title={t("باشگاه فعلی تغییر می‌کند", "Your current Club will change")} description={t("با پذیرش این دعوت، عضویت شما از باشگاه فعلی به باشگاه جدید منتقل می‌شود. سابقه رقابت جهانی شما حفظ خواهد شد.", "Accepting this invitation moves your membership from the current Club to the new one. Your global competition history stays safe.")} confirmLabel={t("پذیرش و جابه‌جایی", "Accept and switch")} cancelLabel={t("فعلاً نه", "Not now")} onConfirm={() => { setSwitchOpen(false); redeem(true); }} onCancel={() => setSwitchOpen(false)} />
  </>;
}
