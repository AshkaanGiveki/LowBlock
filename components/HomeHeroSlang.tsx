"use client";

import { useLanguage } from "@/components/LanguageProvider";
import RotatingText from "@/components/RotatingText";

export function HomeHeroSlang() {
  const { language } = useLanguage();
  const fa = language === "fa";
  return <span className="home-hero-slang-wrap">{fa ? <><RotatingText texts={["پیش‌بینی", "رقابت", "پیشرفت"]} splitBy="words" mainClassName="home-hero-slang" splitLevelClassName="overflow-hidden pb-1"/><span className="home-hero-slang-suffix">کنید.</span></> : <RotatingText texts={["Predict.", "Compete.", "Improve."]} splitBy="characters" mainClassName="home-hero-slang" splitLevelClassName="overflow-hidden pb-1"/>}</span>;
}
