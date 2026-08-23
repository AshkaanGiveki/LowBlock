"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function HelpShortcut() {
  const { language, t } = useLanguage();
  return <Link href="/help" aria-label={t("راهنما", "Help")} className={`mobile-help-shortcut fixed top-[15px] z-[60] flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-white/60 shadow-none transition hover:bg-brand/10 hover:text-brand lg:hidden ${language === "fa" ? "left-[10rem]" : "right-[10rem]"}`}><CircleHelp size={18}/></Link>;
}
