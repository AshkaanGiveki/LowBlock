"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { friendlyError } from "@/lib/userErrors";
import { useState } from "react";

export function LeaveClubAction({ clubId }: { clubId: string }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    try {
      const response = await fetch(`/api/clubs/${clubId}/members`, { method: "DELETE", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(friendlyError(data.error, t));
        return;
      }
      setOpen(false);
      showToast(t("از باشگاه خارج شدید.", "You left the Club."), "success");
      router.replace("/club");
      router.refresh();
    } catch {
      showToast(t("خروج از باشگاه انجام نشد. لطفاً دوباره تلاش کنید.", "We could not leave the Club. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-400/[.06] px-4 py-3 text-sm font-black text-red-200 transition hover:border-red-300/40 hover:bg-red-400/[.12]">
      <LogOut size={16} />
      {t("ترک باشگاه", "Leave Club")}
    </button>
    <ConfirmModal
      open={open}
      title={t("ترک باشگاه؟", "Leave this Club?")}
      description={t("با تأیید، عضویت شما در این باشگاه پایان می‌یابد. سابقه و امتیازهای رقابت جهانی شما حفظ می‌شود.", "After confirmation, your membership in this Club will end. Your global competition history and points will remain safe.")}
      confirmLabel={busy ? t("در حال انجام…", "Leaving…") : t("ترک باشگاه", "Leave Club")}
      cancelLabel={t("انصراف", "Cancel")}
      onConfirm={() => { if (!busy) void leave(); }}
      onCancel={() => { if (!busy) setOpen(false); }}
      danger
    />
  </>;
}
