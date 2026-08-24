"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

export function BackButton({ label }: { label?: string }) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const rtl = language === "fa";
  const Icon = rtl ? ArrowRight : ArrowLeft;
  return <button type="button" onClick={() => router.back()} className="page-back-button mb-5 inline-flex self-start items-center gap-2 rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.025))] px-3.5 py-2.5 text-xs font-bold text-[var(--muted)] shadow-[0_8px_24px_rgba(0,0,0,.14)] transition hover:-translate-y-0.5 hover:border-brand/45 hover:bg-brand/10 hover:text-brand">
    <Icon size={15} aria-hidden="true" />
    {label ?? t("بازگشت", "Back")}
  </button>;
}
