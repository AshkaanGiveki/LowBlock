"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function HelpShortcut() {
  const { language, t } = useLanguage();
  return <Link href="/help" aria-label={t("راهنما", "Help")} className={`mobile-help-shortcut fixed top-[15px] z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#101812]/90 text-white/75 shadow-lg backdrop-blur-xl transition hover:border-brand/50 hover:bg-brand/10 hover:text-brand lg:hidden ${language === "fa" ? "right-20" : "left-20"}`}><CircleHelp size={18}/></Link>;
}
