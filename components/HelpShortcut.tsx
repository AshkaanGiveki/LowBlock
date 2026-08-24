"use client";

import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function HelpShortcut() {
  const { language, t } = useLanguage();
  return <Link href="/help" aria-label={t("راهنما", "Help")} className={`mobile-help-shortcut fixed top-[13px] z-[60] lg:hidden ${language === "fa" ? "left-5 md:left-8" : "right-5 md:right-8"}`}><span className="mobile-help-icon"><MessageCircleQuestion size={19} strokeWidth={1.9}/><i /></span></Link>;
}
