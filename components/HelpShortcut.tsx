"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function HelpShortcut() {
  const { language, t } = useLanguage();
  return <Link href="/help" aria-label={t("راهنما", "Help")} className={`mobile-help-shortcut fixed top-[15px] z-[60] flex h-10 w-10 items-center justify-center rounded-[1rem] border border-brand/25 bg-[linear-gradient(145deg,rgba(32,184,121,.16),rgba(255,255,255,.04))] text-brand/80 shadow-[0_8px_25px_rgba(0,0,0,.2)] transition hover:border-brand/60 hover:bg-brand/15 hover:text-brand lg:hidden ${language === "fa" ? "left-[6.75rem]" : "right-[6.75rem]"}`}><CircleHelp size={17} strokeWidth={2}/></Link>;
}
