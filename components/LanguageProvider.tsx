"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
type Language = "fa" | "en";
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void; t: (fa: string, en: string) => string }>({ language: "fa", setLanguage: () => {}, t: (fa) => fa });
export function LanguageProvider({ children }: { children: React.ReactNode }) { const [language, setLanguage] = useState<Language>("fa"); useEffect(() => { if (localStorage.getItem("lowblock_language") === "en") setLanguage("en"); }, []); useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = "rtl"; localStorage.setItem("lowblock_language", language); }, [language]); const value = useMemo(() => ({ language, setLanguage, t: (fa: string, en: string) => language === "fa" ? fa : en }), [language]); return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>; }
export function useLanguage() { return useContext(LanguageContext); }
export function T({ fa, en }: { fa: string; en: string }) { return <>{useLanguage().t(fa, en)}</>; }
