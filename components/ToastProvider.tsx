"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { dynaura, Toaster, type ToastOptions as DynauraToastOptions } from "dynaura";
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
      <Toaster
        position="top-center"
        theme={{
          background: "#08120d",
          foreground: "#f2fff7",
          muted: "rgba(221, 255, 235, .62)",
          ring: "rgba(75, 226, 145, .22)",
          button: "rgba(75, 226, 145, .13)",
          success: "#4be291",
          error: "#ff7186",
          warning: "#ffd166",
          info: "#75b9ff",
        }}
        queue={false}
        dedupe="id"
        swipe="both"
        timer
        haptics={false}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
