"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";
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
    <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-red-200/[.12] bg-[linear-gradient(135deg,rgba(127,29,29,.18),rgba(20,15,16,.72))] shadow-[0_16px_45px_rgba(0,0,0,.14)]">
      <button type="button" onClick={() => setOpen(true)} className="group flex w-full items-center gap-4 p-4 text-start transition hover:bg-red-300/[.06] sm:p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-200/15 bg-red-300/[.1] text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition duration-300 group-hover:scale-105 group-hover:bg-red-300/[.16]">
          <LogOut size={20} strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm font-black text-red-100">{t("ترک باشگاه", "Leave Club")}</b>
          <small className="mt-1 block text-xs leading-5 text-red-100/45">{t("عضویت فعال خود را در این باشگاه پایان دهید", "End your active membership in this Club")}</small>
        </span>
        <ChevronRight size={19} className="shrink-0 text-red-100/35 transition duration-300 group-hover:translate-x-0.5 group-hover:text-red-100/75 rtl:rotate-180" />
      </button>
    </div>
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
