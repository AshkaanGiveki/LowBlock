"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

export function BackButton({ label }: { label?: string }) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const rtl = language === "fa";
  const Icon = rtl ? ArrowRight : ArrowLeft;
  return <button type="button" onClick={() => router.back()} className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs font-bold text-[var(--muted)] transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand">
    <Icon size={15} aria-hidden="true" />
    {label ?? t("بازگشت", "Back")}
  </button>;
}
