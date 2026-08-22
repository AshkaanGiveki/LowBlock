"use client";

import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function LocaleChevron({ className = "" }: { className?: string }) {
  const { language } = useLanguage();
  return <ChevronRight size={18} className={className} style={{ transform: language === "fa" ? "rotateY(180deg)" : undefined }} aria-hidden="true" />;
}
