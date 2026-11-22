"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { dynaura, type ToastOptions as DynauraToastOptions } from "dynaura";
import { useLanguage } from "@/components/LanguageProvider";

type ToastTone = "error" | "success" | "warning" | "info";
type ToastOptions = Omit<DynauraToastOptions, "title" | "description"> & {
  title?: string;
  description?: DynauraToastOptions["description"];
};
type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone, options?: ToastOptions) => string;
  showSuccess: (message: string, options?: ToastOptions) => string;
  showError: (message: string, options?: ToastOptions) => string;
  showInfo: (message: string, options?: ToastOptions) => string;
  showWarning: (message: string, options?: ToastOptions) => string;
};

// Keep the Dynaura integration ready for a later product decision, but do not
// show transient notifications until the notification UX is approved.
const DYNAURA_NOTIFICATIONS_ENABLED = false;

const ToastContext = createContext<ToastContextValue>({
  showToast: () => "",
  showSuccess: () => "",
  showError: () => "",
  showInfo: () => "",
  showWarning: () => "",
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const showToast = useCallback(
    (message: string, tone: ToastTone = "error", options: ToastOptions = {}) => {
      if (!DYNAURA_NOTIFICATIONS_ENABLED) return "";
      const title = options.title ?? (tone === "success"
        ? t("انجام شد", "All set")
        : tone === "error"
          ? t("یک مشکل پیش آمد", "Something needs attention")
          : tone === "warning"
            ? t("توجه", "Heads up")
            : t("اطلاع", "Update"));
      return dynaura[tone]({ title, description: message, ...options });
    },
    [t],
  );
  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    showSuccess: (message, options) => showToast(message, "success", options),
    showError: (message, options) => showToast(message, "error", options),
    showInfo: (message, options) => showToast(message, "info", options),
    showWarning: (message, options) => showToast(message, "warning", options),
  }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
