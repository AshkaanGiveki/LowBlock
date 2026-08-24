"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type Toast = { id: number; message: string; tone: "error" | "success" };
type ToastContextValue = { showToast: (message: string, tone?: Toast["tone"]) => void };
const ToastContext = createContext<ToastContextValue>({ showToast: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, tone: Toast["tone"] = "error") => { const id = Date.now() + Math.random(); setToasts((current) => [...current.slice(-2), { id, message, tone }]); window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5200); }, []);
  return <ToastContext.Provider value={{ showToast }}>{children}<ToastViewport toasts={toasts} dismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}/></ToastContext.Provider>;
}
export function useToast() { return useContext(ToastContext); }
function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) { const { t } = useLanguage(); return <div className="toast-viewport" aria-live="polite" aria-atomic="true"><AnimatePresence initial={false}>{toasts.map((toast) => <motion.div key={toast.id} role="alert" initial={{ opacity: 0, y: -18, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: .96 }} transition={{ type: "spring", stiffness: 420, damping: 28 }} className={`app-toast app-toast-${toast.tone}`}><span className="app-toast-icon">{toast.tone === "error" ? <AlertCircle size={19}/> : <CheckCircle2 size={19}/>}</span><span className="app-toast-copy"><b>{toast.tone === "error" ? t("یک مشکل پیش آمد", "Something needs attention") : t("انجام شد", "All set")}</b><span>{toast.message}</span></span><button type="button" onClick={() => dismiss(toast.id)} aria-label={t("بستن پیام", "Dismiss message")}><X size={16}/></button><span className="app-toast-progress"/></motion.div>)}</AnimatePresence></div>; }
